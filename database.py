"""
Simple offline SQLite storage for the AI Balance Challenge.

sqlite3 ships with Python's standard library — no pip install needed,
no server, no internet. It just writes to a local .db file sitting
next to this script.
"""

import sqlite3
from datetime import datetime

DB_PATH = "balance_challenge.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    """Create the attempts table if it doesn't exist yet. Call once at startup."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            challenge INTEGER NOT NULL,
            score INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            time_taken INTEGER NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def save_attempt(name, challenge, score, total_questions, time_taken):
    """Log one completed challenge attempt."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """INSERT INTO attempts
           (name, challenge, score, total_questions, time_taken, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            name,
            challenge,
            score,
            total_questions,
            time_taken,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )

    conn.commit()
    conn.close()


def get_leaderboard(challenge=None, limit=10):
    """
    Top attempts, best score first, fastest time as tiebreaker.
    Pass challenge=1..4 to filter to one challenge, or None for all.
    """
    conn = get_connection()
    cur = conn.cursor()

    if challenge:
        cur.execute(
            """SELECT name, challenge, score, total_questions, time_taken, timestamp
               FROM attempts
               WHERE challenge = ?
               ORDER BY score DESC, time_taken ASC
               LIMIT ?""",
            (challenge, limit),
        )
    else:
        cur.execute(
            """SELECT name, challenge, score, total_questions, time_taken, timestamp
               FROM attempts
               ORDER BY score DESC, time_taken ASC
               LIMIT ?""",
            (limit,),
        )

    rows = cur.fetchall()
    conn.close()

    return [
        {
            "name": r[0],
            "challenge": r[1],
            "score": r[2],
            "total_questions": r[3],
            "time_taken": r[4],
            "timestamp": r[5],
        }
        for r in rows
    ]
