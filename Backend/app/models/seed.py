from datetime import date, timedelta

from .base import SessionLocal
from .user import Role, User
from .chat import ChatScenario
from .jlpt import JlptExamSchedule, JlptLevelStructure, JlptSection, JlptMondaiTemplate


def seed_roles():
    db = SessionLocal()
    try:
        if db.query(Role).first():
            return
        db.add_all([
            Role(code='admin', name='Quản trị viên'),
            Role(code='user', name='Người dùng'),
        ])
        db.commit()
    finally:
        db.close()


def backfill_user_roles():
    """Assign the default 'user' role to any account left over from before roles existed."""
    db = SessionLocal()
    try:
        default_role = db.query(Role).filter(Role.code == 'user').first()
        if not default_role:
            return
        db.query(User).filter(User.role_id.is_(None)).update({User.role_id: default_role.id})
        db.commit()
    finally:
        db.close()


def seed_chat_scenarios():
    db = SessionLocal()
    try:
        if db.query(ChatScenario).first():
            return
        db.add_all([
            ChatScenario(
                title="Đi phỏng vấn xin việc",
                description="Luyện tập trả lời các câu hỏi phỏng vấn cơ bản với nhà tuyển dụng Nhật.",
                level="N3",
                icon="💼",
            ),
            ChatScenario(
                title="Đặt bàn nhà hàng",
                description="Gọi điện đặt chỗ và yêu cầu thực đơn đặc biệt.",
                level="N4",
                icon="🍽️",
            ),
            ChatScenario(
                title="Nói chuyện với đồng nghiệp",
                description="Trao đổi công việc và thảo luận dự án tại văn phòng.",
                level="N3",
                icon="👥",
            ),
            ChatScenario(
                title="Mua sắm tại siêu thị",
                description="Hỏi giá, tìm kiếm sản phẩm và thanh toán.",
                level="N5",
                icon="🛒",
            ),
        ])
        db.commit()
    finally:
        db.close()


def _first_sunday(year: int, month: int) -> date:
    d = date(year, month, 1)
    return d + timedelta(days=(6 - d.weekday()) % 7)


def seed_jlpt_schedules():
    """Seeds the next few real-world JLPT sittings (first Sunday of July and
    December each year — JLPT's actual pattern), so users have upcoming
    dates to target without an admin having to enter them by hand.

    registration_deadline is an ESTIMATE (~12 weeks before the exam) since
    there's no authoritative calendar to read the real deadline from — the
    frontend must label it as an estimate, not an official date.

    Unlike the other seed_* functions this doesn't short-circuit on "any row
    exists": it re-runs every startup so the schedule keeps extending into
    the future, skipping dates that already exist (unique on exam_date).
    """
    db = SessionLocal()
    try:
        today = date.today()
        candidate_dates = []
        for year in (today.year, today.year + 1, today.year + 2):
            candidate_dates.append(_first_sunday(year, 7))
            candidate_dates.append(_first_sunday(year, 12))

        upcoming = sorted(d for d in candidate_dates if d >= today)[:4]
        existing = {
            s.exam_date for s in db.query(JlptExamSchedule.exam_date)
            .filter(JlptExamSchedule.exam_date.in_(upcoming))
        }
        for exam_date in upcoming:
            if exam_date in existing:
                continue
            db.add(JlptExamSchedule(
                exam_date=exam_date,
                registration_deadline=exam_date - timedelta(weeks=12),
            ))
        db.commit()
    finally:
        db.close()


# Official JLPT exam blueprint (jlpt.jp "Test sections and testing time" +
# the mondai composition published in each level's public sample questions).
# `kotoba` groups 文字・語彙 with 文法 (this is how JLPT itself groups them for
# scoring: 言語知識(文字・語彙・文法)), so mondai numbers here are renumbered
# sequentially per section rather than following the raw booklet numbering,
# which restarts at 1 for every timed test session. `dokkai` covers 読解
# only. For N5-N3 the real booklet's second session (文法・読解) does not
# publish a time split between its grammar and reading mondai, and for N2/N1
# 文字・語彙・文法・読解 is one untimed-internally session — so section-level
# time_minutes is left blank for kotoba/dokkai (see each level's `notes`);
# only choukai has an officially isolated time. Mondai-level time_minutes is
# intentionally left blank for the admin to fill in later.
_JLPT_LEVEL_STRUCTURES = {
    "N5": {
        "total_time_minutes": 90,
        "notes": (
            "Buổi thi thực tế gồm: Từ vựng - Hán tự (20 phút) + Ngữ pháp - Đọc hiểu "
            "(40 phút, không công bố mốc thời gian tách riêng giữa ngữ pháp và đọc hiểu) "
            "+ Nghe hiểu (30 phút). Tổng 90 phút. Phần Từ vựng - Ngữ pháp ở đây gộp theo "
            "cách tính điểm chính thức của JLPT (言語知識); thời lượng của phần này và "
            "phần Đọc hiểu để trống vì đề thi gốc không tách riêng, admin có thể tự ước lượng."
        ),
        "sections": [
            {"section_type": "kotoba", "name": "Từ vựng - Ngữ pháp (文字・語彙・文法)", "mondai": [
                (1, "漢字読み", 7), (2, "表記", 5), (3, "文脈規定", 6), (4, "言い換え類義", 3),
                (5, "文の文法1（文法形式の判断）", 9), (6, "文の文法2（文の組み立て）", 4), (7, "文章の文法", 4),
            ]},
            {"section_type": "dokkai", "name": "Đọc hiểu (読解)", "mondai": [
                (1, "内容理解（短文）", 3), (2, "内容理解（中文）", 2), (3, "情報検索", 1),
            ]},
            {"section_type": "choukai", "name": "Nghe hiểu (聴解)", "time_minutes": 30, "mondai": [
                (1, "課題理解", 7), (2, "ポイント理解", 6), (3, "発話表現", 5), (4, "即時応答", 6),
            ]},
        ],
    },
    "N4": {
        "total_time_minutes": 115,
        "notes": (
            "Buổi thi thực tế gồm: Từ vựng - Hán tự (25 phút) + Ngữ pháp - Đọc hiểu "
            "(55 phút, không công bố mốc thời gian tách riêng giữa ngữ pháp và đọc hiểu) "
            "+ Nghe hiểu (35 phút). Tổng 115 phút. Phần Từ vựng - Ngữ pháp ở đây gộp theo "
            "cách tính điểm chính thức của JLPT (言語知識); thời lượng của phần này và "
            "phần Đọc hiểu để trống vì đề thi gốc không tách riêng, admin có thể tự ước lượng."
        ),
        "sections": [
            {"section_type": "kotoba", "name": "Từ vựng - Ngữ pháp (文字・語彙・文法)", "mondai": [
                (1, "漢字読み", 9), (2, "表記", 6), (3, "文脈規定", 10), (4, "言い換え類義", 5), (5, "用法", 5),
                (6, "文の文法1", 15), (7, "文の文法2", 5), (8, "文章の文法", 5),
            ]},
            {"section_type": "dokkai", "name": "Đọc hiểu (読解)", "mondai": [
                (1, "内容理解（短文）", 4), (2, "内容理解（中文）", 4), (3, "情報検索", 2),
            ]},
            {"section_type": "choukai", "name": "Nghe hiểu (聴解)", "time_minutes": 35, "mondai": [
                (1, "課題理解", 8), (2, "ポイント理解", 7), (3, "発話表現", 5), (4, "即時応答", 8),
            ]},
        ],
    },
    "N3": {
        "total_time_minutes": 140,
        "notes": (
            "Buổi thi thực tế gồm: Từ vựng - Hán tự (30 phút) + Ngữ pháp - Đọc hiểu "
            "(70 phút, không công bố mốc thời gian tách riêng giữa ngữ pháp và đọc hiểu) "
            "+ Nghe hiểu (40 phút). Tổng 140 phút. Phần Từ vựng - Ngữ pháp ở đây gộp theo "
            "cách tính điểm chính thức của JLPT (言語知識); thời lượng của phần này và "
            "phần Đọc hiểu để trống vì đề thi gốc không tách riêng, admin có thể tự ước lượng."
        ),
        "sections": [
            {"section_type": "kotoba", "name": "Từ vựng - Ngữ pháp (文字・語彙・文法)", "mondai": [
                (1, "漢字読み", 8), (2, "表記", 6), (3, "文脈規定", 11), (4, "言い換え類義", 5), (5, "用法", 5),
                (6, "文の文法1", 13), (7, "文の文法2", 5), (8, "文章の文法", 5),
            ]},
            {"section_type": "dokkai", "name": "Đọc hiểu (読解)", "mondai": [
                (1, "内容理解（短文）", 4), (2, "内容理解（中文）", 6), (3, "内容理解（長文）", 4), (4, "情報検索", 2),
            ]},
            {"section_type": "choukai", "name": "Nghe hiểu (聴解)", "time_minutes": 40, "mondai": [
                (1, "課題理解", 6), (2, "ポイント理解", 6), (3, "概要理解", 3), (4, "発話表現", 4), (5, "即時応答", 9),
            ]},
        ],
    },
    "N2": {
        "total_time_minutes": 155,
        "notes": (
            "Buổi thi thực tế gộp Từ vựng - Ngữ pháp - Đọc hiểu thành 1 buổi duy nhất "
            "105 phút (không tách mốc thời gian cho từng phần con) + Nghe hiểu 50 phút. "
            "Tổng 155 phút. Thời lượng của phần Từ vựng - Ngữ pháp và phần Đọc hiểu để "
            "trống, admin có thể tự ước lượng."
        ),
        "sections": [
            {"section_type": "kotoba", "name": "Từ vựng - Ngữ pháp (文字・語彙・文法)", "mondai": [
                (1, "漢字読み", 5), (2, "表記", 5), (3, "語形成", 5), (4, "文脈規定", 7), (5, "言い換え類義", 5),
                (6, "用法", 5), (7, "文の文法1", 12), (8, "文の文法2", 5), (9, "文章の文法", 5),
            ]},
            {"section_type": "dokkai", "name": "Đọc hiểu (読解)", "mondai": [
                (1, "内容理解（短文）", 5), (2, "内容理解（中文）", 9), (3, "統合理解", 2),
                (4, "主張理解（長文）", 3), (5, "情報検索", 2),
            ]},
            {"section_type": "choukai", "name": "Nghe hiểu (聴解)", "time_minutes": 50, "mondai": [
                (1, "課題理解", 5), (2, "ポイント理解", 6), (3, "概要理解", 5), (4, "即時応答", 12), (5, "統合理解", 4),
            ]},
        ],
    },
    "N1": {
        "total_time_minutes": 165,
        "notes": (
            "Buổi thi thực tế gộp Từ vựng - Ngữ pháp - Đọc hiểu thành 1 buổi duy nhất "
            "110 phút (không tách mốc thời gian cho từng phần con) + Nghe hiểu 55 phút. "
            "Tổng 165 phút. Thời lượng của phần Từ vựng - Ngữ pháp và phần Đọc hiểu để "
            "trống, admin có thể tự ước lượng."
        ),
        "sections": [
            {"section_type": "kotoba", "name": "Từ vựng - Ngữ pháp (文字・語彙・文法)", "mondai": [
                (1, "漢字読み", 6), (2, "文脈規定", 7), (3, "言い換え類義", 6), (4, "用法", 6),
                (5, "文の文法1", 10), (6, "文の文法2", 5), (7, "文章の文法", 5),
            ]},
            {"section_type": "dokkai", "name": "Đọc hiểu (読解)", "mondai": [
                (1, "内容理解（短文）", 4), (2, "内容理解（中文）", 9), (3, "内容理解（長文）", 4),
                (4, "統合理解", 3), (5, "主張理解（長文）", 4), (6, "情報検索", 2),
            ]},
            {"section_type": "choukai", "name": "Nghe hiểu (聴解)", "time_minutes": 55, "mondai": [
                (1, "課題理解", 5), (2, "ポイント理解", 6), (3, "概要理解", 5), (4, "即時応答", 11), (5, "統合理解", 4),
            ]},
        ],
    },
}


def seed_jlpt_level_structures():
    """Seeds the official JLPT exam blueprint (sections + mondai templates)
    for every level that doesn't already have one configured. Safe to re-run:
    a level already present in jlpt_level_structures (e.g. an admin edited it
    via the structure editor) is left untouched."""
    db = SessionLocal()
    try:
        existing_levels = {
            level for (level,) in db.query(JlptLevelStructure.level).all()
        }
        for level, data in _JLPT_LEVEL_STRUCTURES.items():
            if level in existing_levels:
                continue
            level_structure = JlptLevelStructure(
                level=level,
                total_time_minutes=data["total_time_minutes"],
                notes=data["notes"],
            )
            db.add(level_structure)
            db.flush()
            for order_no, section_data in enumerate(data["sections"]):
                section = JlptSection(
                    level_structure_id=level_structure.id,
                    section_type=section_data["section_type"],
                    name=section_data["name"],
                    order_no=order_no,
                    time_minutes=section_data.get("time_minutes"),
                )
                db.add(section)
                db.flush()
                for mondai_no, name, question_count in section_data["mondai"]:
                    db.add(JlptMondaiTemplate(
                        section_id=section.id,
                        mondai_no=mondai_no,
                        name=name,
                        question_count=question_count,
                    ))
        db.commit()
    finally:
        db.close()
