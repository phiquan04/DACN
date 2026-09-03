"""Approximates the real JLPT scoring scale (0-180, 3 sections of 0-60 each,
a per-section floor, and a per-level pass total) from raw correct/total
counts. The real JLPT scores with Item Response Theory against a secret
conversion table that can't be reproduced here, so this linearly scales
"correct / total in section * 60" instead — a common approximation used by
practice-test apps, not an official score. Shared by attempts.py (single
attempt) and dashboard.py (best attempt for the predicted-score card) so the
pass/fail rule stays identical everywhere.
"""
from collections import defaultdict
from typing import Dict, Iterable, Tuple

from sqlalchemy.orm import Session

from app.models.jlpt import JlptMondaiTemplate, JlptQuestion, JlptSection, JlptTestAttemptAnswer

JLPT_PASS_TOTALS: Dict[str, int] = {"N1": 100, "N2": 90, "N3": 95, "N4": 90, "N5": 80}
SECTION_MAX = 60
SECTION_FLOOR = 19
TOTAL_MAX = 180

# (section_type, section_name) is looked up per-question via mondai_template -> section
PerSectionRaw = Dict[Tuple[str, str], Tuple[int, int]]  # (section_type, name) -> (correct, total)


def raw_section_counts(db: Session, answers: Iterable[JlptTestAttemptAnswer]) -> PerSectionRaw:
    """Groups a list of graded answers into (correct, total) per section, by
    joining question -> mondai_template -> section."""
    answer_list = list(answers)
    question_ids = {a.question_id for a in answer_list}
    if not question_ids:
        return {}

    rows = (
        db.query(JlptQuestion.id, JlptSection.section_type, JlptSection.name)
        .join(JlptMondaiTemplate, JlptQuestion.mondai_template_id == JlptMondaiTemplate.id)
        .join(JlptSection, JlptMondaiTemplate.section_id == JlptSection.id)
        .filter(JlptQuestion.id.in_(question_ids))
        .all()
    )
    section_by_question = {qid: (section_type, name) for qid, section_type, name in rows}

    counts: PerSectionRaw = defaultdict(lambda: [0, 0])
    for a in answer_list:
        key = section_by_question.get(a.question_id)
        if not key:
            continue
        counts[key][1] += 1
        if a.is_correct:
            counts[key][0] += 1
    return {key: (correct, total) for key, (correct, total) in counts.items()}


def build_score_breakdown(level: str, per_section_raw: PerSectionRaw) -> dict:
    """Turns raw per-section counts into the 0-180 scaled breakdown + pass/fail
    under JLPT's real dual condition: total >= pass_total AND every section
    scaled score >= SECTION_FLOOR."""
    pass_total = JLPT_PASS_TOTALS.get(level, 90)

    sections = []
    total = 0
    all_above_floor = True
    for (section_type, name), (correct, section_total) in sorted(per_section_raw.items(), key=lambda kv: kv[0]):
        score = round(correct / section_total * SECTION_MAX) if section_total else 0
        above_floor = score >= SECTION_FLOOR
        all_above_floor = all_above_floor and above_floor
        total += score
        sections.append({
            "section_type": section_type, "name": name,
            "score": score, "max": SECTION_MAX, "floor": SECTION_FLOOR, "above_floor": above_floor,
        })

    is_pass = bool(sections) and total >= pass_total and all_above_floor

    return {
        "total": total, "total_max": TOTAL_MAX, "pass_total": pass_total,
        "is_pass": is_pass, "sections": sections,
    }
