from datetime import datetime, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text

from .db import get_conn
from .schemas import AuthResponse, Login, Signup, UserOut

router = APIRouter()

SECRET = "moneyfollows-2026"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, password_hash):
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def make_token(user_id):
    return jwt.encode({"sub": str(user_id)}, SECRET, algorithm="HS256")


def current_user(request: Request, conn=Depends(get_conn)):
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "missing bearer token")
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    row = conn.execute(
        text("SELECT id, name, email FROM users WHERE id = :id"), {"id": int(payload["sub"])}
    ).mappings().first()
    if not row:
        raise HTTPException(401, "invalid token")
    return dict(row)


@router.post("/auth/signup", response_model=AuthResponse, status_code=201)
def signup(body: Signup, conn=Depends(get_conn)):
    exists = conn.execute(text("SELECT 1 FROM users WHERE email = :email"), {"email": body.email}).first()
    if exists:
        raise HTTPException(409, "email already registered")
    result = conn.execute(
        text("INSERT INTO users (name, email, password_hash, created_at) VALUES (:name, :email, :hash, :now)"),
        {"name": body.name, "email": body.email, "hash": hash_password(body.password), "now": now_iso()},
    )
    user_id = result.lastrowid
    user = {"id": user_id, "name": body.name, "email": body.email}
    return {"token": make_token(user_id), "user": user}


@router.post("/auth/login", response_model=AuthResponse)
def login(body: Login, conn=Depends(get_conn)):
    row = conn.execute(
        text("SELECT id, name, email, password_hash FROM users WHERE email = :email"), {"email": body.email}
    ).mappings().first()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "invalid email or password")
    user = {"id": row["id"], "name": row["name"], "email": row["email"]}
    return {"token": make_token(row["id"]), "user": user}


@router.get("/me", response_model=UserOut)
def me(user=Depends(current_user)):
    return user
