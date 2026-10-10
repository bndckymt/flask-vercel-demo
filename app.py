
import os
import psycopg
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify

load_dotenv()

app = Flask(__name__)
DATABASE_URL = os.getenv("DATABASE_URL")


def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured.")

    return psycopg.connect(DATABASE_URL)


def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    title TEXT NOT NULL,
                    completed BOOLEAN NOT NULL DEFAULT FALSE
                )
            """)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, completed
                FROM tasks
                ORDER BY id DESC
            """)
            rows = cur.fetchall()

    return jsonify([
        {"id": row[0], "title": row[1], "completed": row[2]}
        for row in rows
    ])


@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "")

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "Task title is required"}), 400

    title = title.strip()

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tasks (title)
                VALUES (%s)
                RETURNING id, title, completed
                """,
                (title,)
            )
            row = cur.fetchone()

    return jsonify({
        "id": row[0],
        "title": row[1],
        "completed": row[2]
    }), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    completed = data.get("completed")

    if not isinstance(completed, bool):
        return jsonify({"error": "A boolean completed value is required"}), 400

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tasks
                SET completed = %s
                WHERE id = %s
                RETURNING id, title, completed
                """,
                (completed, task_id)
            )
            row = cur.fetchone()

    if row is None:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({
        "id": row[0],
        "title": row[1],
        "completed": row[2]
    })


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM tasks WHERE id = %s RETURNING id",
                (task_id,)
            )
            deleted = cur.fetchone()

    if deleted is None:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted"})


@app.route("/api/tasks/completed", methods=["DELETE"])
def clear_completed():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tasks WHERE completed = TRUE")

    return jsonify({"message": "Completed tasks cleared"})


# Initialize the hosted database table.
# If Neon is unavailable, the app won't start successfully.
init_db()
