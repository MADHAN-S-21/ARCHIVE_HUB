import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "src" / "main" / "resources" / "static"
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = BASE_DIR / "backend" / "archivehub.db"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["JSON_SORT_KEYS"] = False


def utc_now() -> datetime:
    return datetime.utcnow()


def iso_now() -> str:
    return utc_now().replace(microsecond=0).isoformat()


def parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def role_from_email(email: str | None) -> str:
    normalized = (email or "").strip().lower()
    if normalized == "admin@gmail.com":
        return "ADMIN"
    if normalized.endswith("@faculty.gmail.com"):
        return "FACULTY"
    return "STUDENT"


def is_password_hash(value: str | None) -> bool:
    if not value:
        return False
    return value.startswith("scrypt:") or value.startswith("pbkdf2:")


def normalize_sgpas(value: Any) -> list[float]:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    normalized: list[float] = []
    if isinstance(value, list):
        for item in value:
            try:
                normalized.append(float(item))
            except (TypeError, ValueError):
                normalized.append(0.0)
    return normalized


def json_response(payload: Any, status: int = 200):
    return jsonify(payload), status


def get_db() -> sqlite3.Connection:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = MEMORY")
    conn.execute("PRAGMA synchronous = OFF")
    conn.execute("PRAGMA temp_store = MEMORY")
    return conn


def execute(query: str, params: tuple[Any, ...] = ()) -> int:
    with get_db() as conn:
        cursor = conn.execute(query, params)
        conn.commit()
        return cursor.lastrowid


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> sqlite3.Row | None:
    with get_db() as conn:
        return conn.execute(query, params).fetchone()


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    with get_db() as conn:
        return conn.execute(query, params).fetchall()


def user_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "fullname": row["fullname"],
        "firstname": row["firstname"],
        "lastname": row["lastname"],
        "bio": row["bio"],
        "profilePhotoUrl": row["profile_photo_url"],
        "institution": row["institution"],
        "rollNumber": row["roll_number"],
        "department": row["department"],
        "facultyId": row["faculty_id"],
        "role": row["role"],
        "joinedAt": row["joined_at"],
        "cgpa": row["cgpa"],
        "semesterSgpas": normalize_sgpas(row["semester_sgpas"]),
        "attendancePercentage": row["attendance_percentage"],
        "academicStatsLastUpdated": row["academic_stats_last_updated"],
    }


def user_request_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "fullname": row["fullname"],
        "rollNumber": row["roll_number"],
        "department": row["department"],
        "facultyId": row["faculty_id"],
        "role": row["role"],
        "requestedAt": row["requested_at"],
    }


def collection_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "ownerId": row["owner_id"],
        "parentId": row["parent_id"],
        "createdAt": row["created_at"],
    }


def document_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "size": row["size"],
        "uploadDate": row["upload_date"],
        "ownerId": row["owner_id"],
        "ownerName": row["owner_name"],
        "collectionId": row["collection_id"],
        "url": row["url"],
        "personal": bool(row["is_personal"]),
        "isPersonal": bool(row["is_personal"]),
    }


def get_user_by_id(user_id: int | None) -> dict[str, Any] | None:
    if user_id is None:
        return None
    return user_to_dict(fetch_one("SELECT * FROM users WHERE id = ?", (user_id,)))


def get_user_by_email(email: str | None) -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM users WHERE lower(email) = lower(?)", ((email or "").strip(),))


def get_user_by_username(username: str | None) -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM users WHERE lower(username) = lower(?)", ((username or "").strip(),))


def get_request_by_id(request_id: int) -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM user_requests WHERE id = ?", (request_id,))


def get_collection_row(collection_id: int | None) -> sqlite3.Row | None:
    if collection_id is None:
        return None
    return fetch_one("SELECT * FROM collections WHERE id = ?", (collection_id,))


def get_document_row(document_id: int) -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM documents WHERE id = ?", (document_id,))


def create_root_collection(user_id: int, fullname: str | None, username: str) -> int:
    name = (fullname or username or "ARCHIVE").upper()
    return execute(
        """
        INSERT INTO collections (name, description, owner_id, parent_id, created_at)
        VALUES (?, ?, ?, NULL, ?)
        """,
        (name, f"Root collection for {username}", user_id, iso_now()),
    )


def ensure_student_root_collection(user_id: int, fullname: str | None, username: str) -> int:
    existing = fetch_one(
        "SELECT id FROM collections WHERE owner_id = ? AND parent_id IS NULL ORDER BY id LIMIT 1",
        (user_id,),
    )
    if existing:
        return int(existing["id"])
    return create_root_collection(user_id, fullname, username)


def create_user(
    fullname: str | None,
    username: str,
    email: str,
    password: str,
    role: str | None = None,
    firstname: str | None = None,
    lastname: str | None = None,
    bio: str | None = None,
    profile_photo_url: str | None = None,
    institution: str | None = None,
    roll_number: str | None = None,
    department: str | None = None,
    faculty_id: str | None = None,
    cgpa: float | None = None,
    semester_sgpas: list[float] | None = None,
    attendance_percentage: float | None = None,
    joined_at: str | None = None,
    academic_stats_last_updated: str | None = None,
) -> dict[str, Any]:
    if get_user_by_email(email):
        raise ValueError("Email already in use")
    if get_user_by_username(username):
        raise ValueError("Username already in use")

    resolved_role = role or role_from_email(email)
    password_hash = password if is_password_hash(password) else generate_password_hash(password)
    joined_value = joined_at or iso_now()

    user_id = execute(
        """
        INSERT INTO users (
            username, email, password_hash, fullname, firstname, lastname, bio,
            profile_photo_url, institution, roll_number, department, faculty_id,
            role, joined_at, cgpa, semester_sgpas, attendance_percentage, academic_stats_last_updated
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            username,
            email,
            password_hash,
            fullname,
            firstname,
            lastname,
            bio,
            profile_photo_url,
            institution,
            roll_number,
            department,
            faculty_id,
            resolved_role,
            joined_value,
            cgpa,
            json.dumps(semester_sgpas or []),
            attendance_percentage,
            academic_stats_last_updated,
        ),
    )

    if resolved_role == "STUDENT":
        ensure_student_root_collection(user_id, fullname, username)

    return get_user_by_id(user_id)


def requester_from_param(name: str) -> dict[str, Any] | None:
    raw = request.args.get(name)
    try:
        return get_user_by_id(int(raw)) if raw is not None else None
    except ValueError:
        return None


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                fullname TEXT,
                firstname TEXT,
                lastname TEXT,
                bio TEXT,
                profile_photo_url TEXT,
                institution TEXT,
                roll_number TEXT,
                department TEXT,
                faculty_id TEXT,
                role TEXT NOT NULL,
                joined_at TEXT,
                cgpa REAL,
                semester_sgpas TEXT,
                attendance_percentage REAL,
                academic_stats_last_updated TEXT
            );

            CREATE TABLE IF NOT EXISTS user_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                fullname TEXT,
                roll_number TEXT,
                department TEXT,
                faculty_id TEXT,
                role TEXT,
                requested_at TEXT
            );

            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                owner_id INTEGER NOT NULL,
                parent_id INTEGER,
                created_at TEXT,
                FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(parent_id) REFERENCES collections(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT,
                size INTEGER,
                upload_date TEXT,
                owner_id INTEGER NOT NULL,
                owner_name TEXT,
                collection_id INTEGER,
                url TEXT,
                is_personal INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE SET NULL
            );
            """
        )

    if get_user_by_email("admin@gmail.com") is None:
        create_user(
            fullname="ADMIN",
            username="admin",
            email="admin@gmail.com",
            password="admin123",
            role="ADMIN",
            firstname="System",
            lastname="Administrator",
            bio="System administrator for ArchiveHub.",
            joined_at=(utc_now() - timedelta(days=180)).replace(microsecond=0).isoformat(),
        )

    if get_user_by_email("faculty@faculty.gmail.com") is None:
        create_user(
            fullname="FACULTY",
            username="faculty",
            email="faculty@faculty.gmail.com",
            password="staff123",
            role="FACULTY",
            joined_at=(utc_now() - timedelta(days=60)).replace(microsecond=0).isoformat(),
        )


@app.route("/api/auth/register", methods=["POST"])
def register_user():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email")
    username = payload.get("username")
    password = payload.get("password")

    if not email or not username or not password:
        return json_response({"message": "Missing required registration fields"}, 400)

    existing_email = fetch_one("SELECT id FROM user_requests WHERE lower(email) = lower(?)", (email,))
    existing_username = fetch_one("SELECT id FROM user_requests WHERE lower(username) = lower(?)", (username,))
    if get_user_by_email(email) or existing_email:
        return json_response({"message": "Email already in use"}, 400)
    if get_user_by_username(username) or existing_username:
        return json_response({"message": "Username already in use"}, 400)

    role = payload.get("role") or role_from_email(email)
    execute(
        """
        INSERT INTO user_requests (
            username, email, password_hash, fullname, roll_number, department, faculty_id, role, requested_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            username,
            email,
            generate_password_hash(password),
            payload.get("fullname"),
            payload.get("rollNumber"),
            payload.get("department"),
            payload.get("facultyId"),
            role,
            iso_now(),
        ),
    )
    return json_response({"message": "Registration request sent to Admin. Please wait for approval."})


@app.route("/api/auth/login", methods=["POST"])
def login_user():
    payload = request.get_json(silent=True) or {}
    identifier = payload.get("username")
    password = payload.get("password")
    if not identifier or not password:
        return json_response({"message": "Missing credentials"}, 400)

    row = get_user_by_email(identifier) or get_user_by_username(identifier)
    if row is None or not check_password_hash(row["password_hash"], password):
        return json_response({"message": "Invalid credentials"}, 401)

    user = user_to_dict(row)
    return json_response({"token": f"mock-jwt-token-{secrets.token_hex(16)}", **user})


@app.route("/api/auth/logout", methods=["POST"])
def logout_user():
    return json_response({"message": "Logged out successfully"})


@app.route("/api/dashboard/stats", methods=["GET"])
def dashboard_stats():
    try:
        user_id = int(request.args.get("userId", ""))
    except ValueError:
        return json_response({"message": "Invalid user id"}, 400)

    requester = get_user_by_id(user_id)
    if requester is None:
        return ("", 401)

    docs = [document_to_dict(row) for row in fetch_all("SELECT * FROM documents ORDER BY upload_date DESC")]
    filtered_docs = docs if requester["role"] == "FACULTY" else [doc for doc in docs if doc["ownerId"] == user_id]

    total_size = sum(doc["size"] or 0 for doc in filtered_docs)
    cutoff = utc_now() - timedelta(hours=24)
    recent_uploads = 0
    for doc in filtered_docs:
        if doc["uploadDate"]:
            try:
                if datetime.fromisoformat(doc["uploadDate"]) > cutoff:
                    recent_uploads += 1
            except ValueError:
                pass

    active_students = 1
    if requester["role"] == "ADMIN":
        row = fetch_one("SELECT COUNT(*) AS count FROM users")
        active_students = int(row["count"]) if row else 0

    return json_response(
        {
            "totalArchives": len(filtered_docs),
            "activeStudents": active_students,
            "storageUsed": total_size,
            "recentUploads": recent_uploads,
            "cgpa": requester["cgpa"],
            "semesterSgpas": requester["semesterSgpas"],
            "attendancePercentage": requester["attendancePercentage"],
        }
    )


@app.route("/api/users", methods=["GET"])
def get_users():
    requester = requester_from_param("requesterId")
    if requester is None or requester["role"] != "ADMIN":
        return json_response({"message": "Only admins can view all users"}, 403)
    users = [user_to_dict(row) for row in fetch_all("SELECT * FROM users ORDER BY joined_at DESC, id DESC")]
    return json_response(users)


@app.route("/api/users/students", methods=["GET"])
def get_students():
    requester = requester_from_param("requesterId")
    if requester is None or requester["role"] != "FACULTY":
        return json_response({"message": "Only faculty can view all students"}, 403)
    students = [
        user_to_dict(row)
        for row in fetch_all("SELECT * FROM users WHERE role = 'STUDENT' ORDER BY fullname, username")
    ]
    return json_response(students)


@app.route("/api/users/<int:user_id>", methods=["GET"])
def get_user_profile(user_id: int):
    requester = requester_from_param("requesterId")
    if requester is None:
        return json_response({"message": "Unauthorized"}, 403)
    if requester["id"] != user_id and requester["role"] not in {"ADMIN", "FACULTY"}:
        return json_response({"message": "Access denied"}, 403)

    user = get_user_by_id(user_id)
    if user is None:
        return json_response({"message": "User not found"}, 404)
    return json_response(user)


@app.route("/api/users/<int:user_id>", methods=["PATCH"])
def update_user(user_id: int):
    requester = requester_from_param("requesterId")
    if requester is None:
        return json_response({"message": "Unauthorized to update this student"}, 403)

    user = get_user_by_id(user_id)
    if user is None:
        return json_response({"message": "Student not found"}, 400)

    updates = request.get_json(silent=True) or {}
    is_self = requester["id"] == user_id
    is_admin = requester["role"] == "ADMIN"
    is_faculty = requester["role"] == "FACULTY"

    if not is_admin and not is_self and not is_faculty:
        return json_response({"message": "Unauthorized to update this student"}, 403)

    if is_faculty and not is_self:
        academic_fields = {"cgpa", "semesterSgpas", "attendancePercentage"}
        if user["role"] != "STUDENT" or not set(updates).issubset(academic_fields):
            return json_response({"message": "Faculty can only update student academic records"}, 403)

    next_roll = user["rollNumber"] if user["rollNumber"] is not None else updates.get("rollNumber")
    next_department = user["department"] if user["department"] is not None else updates.get("department")
    next_faculty_id = user["facultyId"] if user["facultyId"] is not None else updates.get("facultyId")
    next_cgpa = user["cgpa"]
    next_sgpas = user["semesterSgpas"]
    next_attendance = user["attendancePercentage"]

    if "cgpa" in updates:
        try:
            next_cgpa = float(updates["cgpa"]) if updates["cgpa"] is not None else None
        except (TypeError, ValueError):
            next_cgpa = None
    if "semesterSgpas" in updates:
        next_sgpas = normalize_sgpas(updates["semesterSgpas"])
    if "attendancePercentage" in updates:
        try:
            next_attendance = float(updates["attendancePercentage"]) if updates["attendancePercentage"] is not None else None
        except (TypeError, ValueError):
            next_attendance = None

    stats_updated = any(key in updates for key in {"cgpa", "semesterSgpas", "attendancePercentage"})
    execute(
        """
        UPDATE users
        SET fullname = ?, firstname = ?, lastname = ?, bio = ?, profile_photo_url = ?,
            institution = ?, roll_number = ?, department = ?, faculty_id = ?, cgpa = ?,
            semester_sgpas = ?, attendance_percentage = ?, academic_stats_last_updated = ?
        WHERE id = ?
        """,
        (
            updates.get("fullname", user["fullname"]),
            updates.get("firstname", user["firstname"]),
            updates.get("lastname", user["lastname"]),
            updates.get("bio", user["bio"]),
            updates.get("profilePhotoUrl", user["profilePhotoUrl"]),
            updates.get("institution", user["institution"]),
            next_roll,
            next_department,
            next_faculty_id,
            next_cgpa,
            json.dumps(next_sgpas),
            next_attendance,
            iso_now() if stats_updated else user["academicStatsLastUpdated"],
            user_id,
        ),
    )
    return json_response(get_user_by_id(user_id))


@app.route("/api/users/<int:user_id>/photo", methods=["POST"])
def upload_profile_photo(user_id: int):
    requester = requester_from_param("requesterId")
    if requester is None or (requester["role"] != "ADMIN" and requester["id"] != user_id):
        return json_response({"message": "Unauthorized to change this photo"}, 403)

    file = request.files.get("file")
    if file is None or not file.filename:
        return json_response({"message": "Photo upload failed: No file selected"}, 400)

    filename = f"{secrets.token_hex(8)}_{secure_filename(file.filename)}"
    file.save(UPLOAD_DIR / filename)
    photo_url = f"/uploads/{filename}"
    execute("UPDATE users SET profile_photo_url = ? WHERE id = ?", (photo_url, user_id))
    return json_response({"url": photo_url})


@app.route("/api/users", methods=["POST"])
def create_user_endpoint():
    requester = requester_from_param("requesterId")
    if requester is None or requester["role"] != "ADMIN":
        return json_response({"message": "Only admins can create students"}, 403)

    payload = request.get_json(silent=True) or {}
    try:
        user = create_user(
            fullname=payload.get("fullname"),
            username=payload.get("username"),
            email=payload.get("email"),
            password=payload.get("password") or "temp123",
            role=payload.get("role"),
            roll_number=payload.get("rollNumber"),
            department=payload.get("department"),
            faculty_id=payload.get("facultyId"),
        )
    except ValueError as exc:
        return json_response({"message": str(exc)}, 400)
    return json_response(user)


def delete_user_files(user_id: int) -> None:
    docs = fetch_all("SELECT url FROM documents WHERE owner_id = ?", (user_id,))
    for row in docs:
        url = row["url"] or ""
        if url.startswith("/uploads/"):
            file_path = UPLOAD_DIR / url.replace("/uploads/", "", 1)
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError:
                    pass


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id: int):
    requester = requester_from_param("requesterId")
    if requester is None or (requester["role"] != "ADMIN" and requester["id"] != user_id):
        return json_response({"message": "Unauthorized to delete this student"}, 403)

    delete_user_files(user_id)
    execute("DELETE FROM users WHERE id = ?", (user_id,))
    return json_response({"message": "Student deleted successfully"})


@app.route("/api/admin/requests", methods=["GET"])
def get_requests():
    requester = requester_from_param("requesterId")
    if requester is None or requester["role"] != "ADMIN":
        return json_response({"message": "Only admins can view requests"}, 403)
    rows = fetch_all("SELECT * FROM user_requests ORDER BY requested_at DESC, id DESC")
    return json_response([user_request_to_dict(row) for row in rows])


@app.route("/api/admin/requests/<int:request_id>/approve", methods=["POST"])
def approve_request(request_id: int):
    requester = requester_from_param("requesterId")
    if requester is None or requester["role"] != "ADMIN":
        return json_response({"message": "Unauthorized"}, 403)

    user_request = get_request_by_id(request_id)
    if user_request is None:
        return json_response({"message": "Request not found"}, 404)

    try:
        create_user(
            fullname=user_request["fullname"],
            username=user_request["username"],
            email=user_request["email"],
            password=user_request["password_hash"],
            role=user_request["role"] or "STUDENT",
            roll_number=user_request["roll_number"],
            department=user_request["department"],
            faculty_id=user_request["faculty_id"],
        )
    except ValueError as exc:
        return json_response({"message": str(exc)}, 400)

    execute("DELETE FROM user_requests WHERE id = ?", (request_id,))
    return json_response({"message": "Request approved and student created"})


@app.route("/api/admin/requests/<int:request_id>/reject", methods=["POST"])
def reject_request(request_id: int):
    requester = requester_from_param("requesterId")
    if requester is None or requester["role"] != "ADMIN":
        return json_response({"message": "Unauthorized"}, 403)
    execute("DELETE FROM user_requests WHERE id = ?", (request_id,))
    return json_response({"message": "Request rejected"})


@app.route("/api/collections", methods=["GET"])
def get_collections():
    try:
        user_id = int(request.args.get("userId", ""))
    except ValueError:
        return json_response({"message": "Invalid user id"}, 400)

    requester = get_user_by_id(user_id)
    if requester is None:
        return json_response([], 200)

    rows = fetch_all("SELECT * FROM collections ORDER BY created_at ASC, id ASC")
    collections = [collection_to_dict(row) for row in rows]
    if requester["role"] == "FACULTY":
        return json_response(collections)
    return json_response([item for item in collections if item["ownerId"] == user_id])


@app.route("/api/collections", methods=["POST"])
def create_collection_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        owner_id = int(payload.get("ownerId"))
    except (TypeError, ValueError):
        return json_response({"message": "User not found"}, 401)

    requester = get_user_by_id(owner_id)
    if requester is None:
        return json_response({"message": "User not found"}, 401)
    if requester["role"] in {"FACULTY", "ADMIN"}:
        return json_response({"message": "This user is not authorized to create collections"}, 403)

    parent_id = payload.get("parentId")
    if parent_id not in (None, "", "null"):
        try:
            parent_id = int(parent_id)
        except (TypeError, ValueError):
            return json_response({"message": "Invalid parent collection"}, 403)
    else:
        parent_id = None

    if parent_id is None:
        root = fetch_one("SELECT id FROM collections WHERE owner_id = ? AND parent_id IS NULL ORDER BY id LIMIT 1", (owner_id,))
        if root is not None:
            parent_id = int(root["id"])
    else:
        parent = get_collection_row(parent_id)
        if parent is None or int(parent["owner_id"]) != owner_id:
            return json_response({"message": "Invalid parent collection"}, 403)

    collection_id = execute(
        """
        INSERT INTO collections (name, description, owner_id, parent_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (payload.get("name"), payload.get("description"), owner_id, parent_id, iso_now()),
    )
    return json_response(collection_to_dict(get_collection_row(collection_id)))


@app.route("/api/collections/<int:collection_id>", methods=["DELETE"])
def delete_collection(collection_id: int):
    try:
        user_id = int(request.args.get("userId", ""))
    except ValueError:
        return json_response({"message": "Unauthorized to delete this collection"}, 403)

    collection = get_collection_row(collection_id)
    if collection is None:
        return ("", 404)

    requester = get_user_by_id(user_id)
    if requester is None or int(collection["owner_id"]) != user_id:
        return json_response({"message": "Unauthorized to delete this collection"}, 403)

    child_exists = fetch_one("SELECT id FROM collections WHERE parent_id = ? LIMIT 1", (collection_id,))
    if child_exists:
        return json_response({"message": "Delete child collections first"}, 400)

    document_exists = fetch_one("SELECT id FROM documents WHERE collection_id = ? LIMIT 1", (collection_id,))
    if document_exists:
        return json_response({"message": "Delete documents in this collection first"}, 400)

    execute("DELETE FROM collections WHERE id = ?", (collection_id,))
    return json_response({"message": "Collection deleted successfully"})


@app.route("/api/documents", methods=["GET"])
def get_documents():
    try:
        user_id = int(request.args.get("userId", ""))
    except ValueError:
        return json_response([], 200)

    requester = get_user_by_id(user_id)
    collection_id_raw = request.args.get("collectionId")
    is_personal = parse_bool(request.args.get("isPersonal"), False)

    collection_id = None
    if collection_id_raw not in (None, "", "null"):
        try:
            collection_id = int(collection_id_raw)
        except ValueError:
            collection_id = None

    rows = fetch_all("SELECT * FROM documents ORDER BY upload_date DESC, id DESC")
    documents: list[dict[str, Any]] = []
    for row in rows:
        doc = document_to_dict(row)
        if collection_id is not None:
            if doc["collectionId"] != collection_id:
                continue
        elif doc["collectionId"] is not None:
            continue

        if is_personal:
            if doc["isPersonal"] and doc["ownerId"] == user_id:
                documents.append(doc)
            continue

        if doc["isPersonal"]:
            continue
        if requester and requester["role"] == "FACULTY":
            documents.append(doc)
        elif doc["ownerId"] == user_id:
            documents.append(doc)

    return json_response(documents)


@app.route("/api/documents/upload", methods=["POST"])
def upload_document():
    file = request.files.get("file")
    if file is None or not file.filename:
        return json_response({"message": "File is empty"}, 400)

    try:
        user_id = int(request.form.get("userId", ""))
    except ValueError:
        return json_response({"message": "Unauthorized to upload to this section"}, 403)

    requester = get_user_by_id(user_id)
    is_personal = parse_bool(request.form.get("isPersonal"), False)
    collection_id_raw = request.form.get("collectionId")
    collection_id = None
    if collection_id_raw not in (None, "", "null"):
        try:
            collection_id = int(collection_id_raw)
        except ValueError:
            collection_id = None

    if requester is None:
        return json_response({"message": "Unauthorized to upload to this section"}, 403)
    if requester["role"] == "ADMIN":
        return json_response({"message": "Admins are not allowed to upload documents"}, 403)
    if requester["role"] == "FACULTY" and not is_personal:
        return json_response({"message": "Unauthorized to upload to this section"}, 403)

    if requester["role"] == "STUDENT":
        if collection_id is None:
            return json_response(
                {"message": "Please select a sub-collection for your upload. Files cannot be uploaded to the root."},
                400,
            )
        target_collection = get_collection_row(collection_id)
        if target_collection is None or target_collection["parent_id"] is None:
            return json_response({"message": "Files must be uploaded to a sub-collection, not the root."}, 400)
        if int(target_collection["owner_id"]) != user_id:
            return json_response({"message": "Invalid collection ownership"}, 403)

    filename = f"{secrets.token_hex(8)}_{secure_filename(file.filename)}"
    file.save(UPLOAD_DIR / filename)

    document_id = execute(
        """
        INSERT INTO documents (
            name, type, size, upload_date, owner_id, owner_name, collection_id, url, is_personal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            file.filename,
            file.mimetype,
            os.path.getsize(UPLOAD_DIR / filename),
            iso_now(),
            user_id,
            requester["fullname"],
            collection_id,
            f"/uploads/{filename}",
            1 if is_personal else 0,
        ),
    )
    return json_response(document_to_dict(get_document_row(document_id)))


@app.route("/api/documents/<int:document_id>", methods=["PATCH"])
def update_document(document_id: int):
    try:
        user_id = int(request.args.get("userId", ""))
    except ValueError:
        return json_response({"message": "Unauthorized"}, 403)

    requester = get_user_by_id(user_id)
    doc_row = get_document_row(document_id)
    if doc_row is None:
        return json_response({"message": "Document not found"}, 404)
    if requester is None:
        return json_response({"message": "Unauthorized"}, 403)

    doc = document_to_dict(doc_row)
    if requester["role"] != "ADMIN" and doc["ownerId"] != user_id:
        return json_response({"message": "Unauthorized"}, 403)

    updates = request.get_json(silent=True) or {}
    execute("UPDATE documents SET name = ? WHERE id = ?", (updates.get("name", doc["name"]), document_id))
    return json_response(document_to_dict(get_document_row(document_id)))


@app.route("/api/documents/<int:document_id>", methods=["DELETE"])
def delete_document(document_id: int):
    try:
        user_id = int(request.args.get("userId", ""))
    except ValueError:
        return json_response({"message": "Unauthorized"}, 403)

    requester = get_user_by_id(user_id)
    doc_row = get_document_row(document_id)
    if doc_row is None:
        return json_response({"message": "Document not found"}, 404)
    if requester is None:
        return json_response({"message": "Unauthorized"}, 403)

    doc = document_to_dict(doc_row)
    if requester["role"] != "ADMIN" and doc["ownerId"] != user_id:
        return json_response({"message": "Unauthorized"}, 403)

    if doc["url"] and doc["url"].startswith("/uploads/"):
        file_path = UPLOAD_DIR / doc["url"].replace("/uploads/", "", 1)
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                pass

    execute("DELETE FROM documents WHERE id = ?", (document_id,))
    return json_response({"message": "Document deleted successfully"})


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/", methods=["GET"])
def root_index():
    return send_from_directory(STATIC_DIR, "login.html")


@app.route("/<path:path>", methods=["GET"])
def static_pages(path: str):
    file_path = STATIC_DIR / path
    if file_path.exists() and file_path.is_file():
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, "login.html")


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8082, debug=True)
