"""Shared vocabulary-XP -> level curve, used both by the learning flow
(app/routes/vocabulary/learning.py) and by the admin user detail view
(app/routes/admin_users.py) so the two never drift apart."""


def xp_threshold(level: int) -> int:
    """Total XP required to reach `level` — a triangular curve, so each
    level costs 100 XP more than the last (level 2 at 100, level 3 at 300,
    level 4 at 600, ...)."""
    n = level - 1
    return 100 * n * (n + 1) // 2


def level_info(xp: int):
    level = 1
    while xp_threshold(level + 1) <= xp:
        level += 1
    return level, xp_threshold(level), xp_threshold(level + 1)
