
import os
import re

import psycopg
from dotenv import load_dotenv
from flask import (
    Flask, render_template, request, jsonify,
    redirect, url_for, flash, session
)
from flask_login import (
    LoginManager, UserMixin, login_user,
    login_required, logout_user, current_user
)
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)

app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY"),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("FLASK_DEBUG") != "1",
)

if not app.config["SECRET_KEY"]:
    raise RuntimeError("SECRET_KEY is not configured.")

DATABASE_URL = os.getenv("DATABASE_URL")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

csrf = CSRFProtect(app)


def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg.connect(DATABASE_URL)


class User(UserMixin):
    def __init__(self, user_id, username, password_hash):
        self.id = str(user_id)
        self.username = username
        self.password_hash = password_hash


@login_manager.user_loader
def load_user(user_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, password_hash FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()

    if row is None:
        return None

    return User(row[0], row[1], row[2])


@app.route("/")
def home():
    if not current_user.is_authenticated:
        return redirect(url_for("login"))
    return render_template("index.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("home"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        confirmation = request.form.get("confirm_password", "")

        if not re.fullmatch(r"[A-Za-z0-9_]{3,50}", username):
            flash("Use 3–50 letters, numbers, or underscores for your username.")
            return render_template("register.html"), 400

        if len(password) < 12:
            flash("Your password must be at least 12 characters.")
            return render_template("register.html"), 400

        if len(password) > 128:
            flash("Your password must be 128 characters or fewer.")
            return render_template("register.html"), 400

        if password != confirmation:
            flash("The passwords do not match.")
            return render_template("register.html"), 400

        password_hash = generate_password_hash(password, method="scrypt")

        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO users (username, password_hash)
                        VALUES (%s, %s)
                        RETURNING id, username, password_hash
                        """,
                        (username, password_hash)
                    )
                    row = cur.fetchone()
        except psycopg.errors.UniqueViolation:
            flash("That username is already taken.")
            return render_template("register.html"), 409

        user = User(row[0], row[1], row[2])
        session.clear()
        login_user(user)
        return redirect(url_for("home"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("home"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, username, password_hash
                    FROM users
                    WHERE username = %s
                    """,
                    (username,)
                )
                row = cur.fetchone()

        if row is None or not check_password_hash(row[2], password):
            flash("Invalid username or password.")
            return render_template("login.html"), 401

        session.clear()
        login_user(User(row[0], row[1], row[2]))
        return redirect(url_for("home"))

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    session.clear()
    flash("You have been logged out.")
    return redirect(url_for("login"))



@app.route("/api/tasks", methods=["GET"])
@login_required
def get_tasks():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, completed
                FROM tasks
                WHERE user_id = %s
                ORDER BY id DESC
                """,
                (int(current_user.id),)
            )
            rows = cur.fetchall()

    return jsonify([
        {"id": row[0], "title": row[1], "completed": row[2]}
        for row in rows
    ])


@app.route("/api/tasks", methods=["POST"])
@login_required
def add_task():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "")

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "Task title is required"}), 400

    title = title.strip()

    if len(title) > 200:
        return jsonify({"error": "Task title must be 200 characters or fewer"}), 400

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tasks (title, user_id)
                VALUES (%s, %s)
                RETURNING id, title, completed
                """,
                (title, int(current_user.id))
            )
            row = cur.fetchone()

    return jsonify({
        "id": row[0],
        "title": row[1],
        "completed": row[2]
    }), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@login_required
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
                WHERE id = %s AND user_id = %s
                RETURNING id, title, completed
                """,
                (completed, task_id, int(current_user.id))
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
@login_required
def delete_task(task_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM tasks
                WHERE id = %s AND user_id = %s
                RETURNING id
                """,
                (task_id, int(current_user.id))
            )
            deleted = cur.fetchone()

    if deleted is None:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted"})


@app.route("/api/tasks/completed", methods=["DELETE"])
@login_required
def clear_completed():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM tasks
                WHERE user_id = %s AND completed = TRUE
                """,
                (int(current_user.id),)
            )

    return jsonify({"message": "Completed tasks cleared"})
