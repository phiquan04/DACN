from .base import SessionLocal
from .user import Role, User
from .chat import ChatScenario


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
