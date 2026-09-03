from datetime import date, timedelta

from .base import SessionLocal
from .user import Role, User
from .chat import ChatScenario
from .jlpt import JlptExamSchedule


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
