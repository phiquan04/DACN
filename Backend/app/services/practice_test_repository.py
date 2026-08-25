"""Storage for imported JLPT practice exams.

Uses raw psycopg2 against the `exams`/`questions`/`choices`/`answers` tables
directly (not the SQLAlchemy models in app/models/) — this predates the rest
of the app's ORM setup and is kept as-is here rather than changed as part of
a route/service split.
"""
import os

import psycopg2
from psycopg2.extras import execute_values


def save_exam_to_db(data: dict) -> int:
    conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO exams (title, level, year, month)
                       VALUES (%s, %s, %s, %s) RETURNING id""",
                    (data['title'], data.get('level'), data.get('year'), data.get('month'))
                )
                exam_id = cur.fetchone()[0]

                for q in data['questions']:
                    cur.execute(
                        """INSERT INTO questions (exam_id, section, question_no, question_text)
                           VALUES (%s, %s, %s, %s) RETURNING id""",
                        (exam_id, q.get('section'), q['question_no'], q['question_text'])
                    )
                    q_id = cur.fetchone()[0]

                    execute_values(cur,
                        "INSERT INTO choices (question_id, choice_no, choice_text) VALUES %s",
                        [(q_id, c['choice_no'], c['choice_text']) for c in q.get('choices', [])]
                    )

                    cur.execute(
                        """INSERT INTO answers (question_id, correct_no, explanation)
                           VALUES (%s, %s, %s)""",
                        (q_id, q.get('correct_no'), q.get('explanation'))
                    )
        return exam_id
    finally:
        conn.close()


def list_exams() -> list:
    conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, e.title, e.level, e.year, e.month,
                       COUNT(q.id) as question_count
                FROM exams e
                LEFT JOIN questions q ON q.exam_id = e.id
                GROUP BY e.id
                ORDER BY e.year DESC, e.month DESC
            """)
            rows = cur.fetchall()
    conn.close()
    return [
        {'id': r[0], 'title': r[1], 'level': r[2],
         'year': r[3], 'month': r[4], 'question_count': r[5]}
        for r in rows
    ]


def get_exam_questions(exam_id: int) -> list:
    conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT q.id, q.question_no, q.section, q.question_text,
                       a.correct_no, a.explanation
                FROM questions q
                LEFT JOIN answers a ON a.question_id = q.id
                WHERE q.exam_id = %s
                ORDER BY q.question_no
            """, (exam_id,))
            questions = cur.fetchall()

            result = []
            for row in questions:
                q_id = row[0]
                cur.execute(
                    "SELECT choice_no, choice_text FROM choices WHERE question_id = %s ORDER BY choice_no",
                    (q_id,)
                )
                choices = [{'choice_no': c[0], 'choice_text': c[1]} for c in cur.fetchall()]
                result.append({
                    'id': q_id,
                    'question_no': row[1],
                    'section': row[2],
                    'question_text': row[3],
                    'choices': choices,
                    'correct_no': row[4],
                    'explanation': row[5]
                })
    conn.close()
    return result
