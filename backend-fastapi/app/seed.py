import json
import os
from pathlib import Path

from sqlalchemy import text

from .auth import hash_password, now_iso
from .db import BASE_DIR, engine, recreate_schema

SEED_FILE = Path(os.environ.get("SEED_FILE", BASE_DIR.parent / "seed" / "seed.json"))


def main():
    data = json.loads(SEED_FILE.read_text())
    recreate_schema()
    now = now_iso()
    with engine.begin() as conn:
        for u in data["users"]:
            conn.execute(
                text("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (:id, :name, :email, :hash, :now)"),
                {"id": u["id"], "name": u["name"], "email": u["email"], "hash": hash_password(u["password"]), "now": now},
            )
        for g in data["groups"]:
            conn.execute(
                text("INSERT INTO groups (id, name, created_by, created_at) VALUES (:id, :name, :by, :now)"),
                {"id": g["id"], "name": g["name"], "by": g["created_by"], "now": now},
            )
            for uid in g["members"]:
                conn.execute(text("INSERT INTO group_members (group_id, user_id) VALUES (:g, :u)"), {"g": g["id"], "u": uid})
        for e in data["expenses"]:
            conn.execute(
                text(
                    "INSERT INTO expenses (id, group_id, paid_by, amount_paise, category, description, spent_on, split_type, created_at) "
                    "VALUES (:id, :group_id, :paid_by, :amount_paise, :category, :description, :spent_on, :split_type, :now)"
                ),
                {**{k: v for k, v in e.items() if k != "splits"}, "now": now},
            )
            for s in e["splits"]:
                conn.execute(
                    text("INSERT INTO expense_splits (expense_id, user_id, share_paise) VALUES (:e, :u, :s)"),
                    {"e": e["id"], "u": s["user_id"], "s": s["share_paise"]},
                )
        for s in data["settlements"]:
            conn.execute(
                text(
                    "INSERT INTO settlements (id, group_id, from_user, to_user, amount_paise, created_at) "
                    "VALUES (:id, :group_id, :from_user, :to_user, :amount_paise, :created_at)"
                ),
                s,
            )
    print(f"seeded {len(data['users'])} users, {len(data['groups'])} groups, {len(data['expenses'])} expenses")


if __name__ == "__main__":
    main()
