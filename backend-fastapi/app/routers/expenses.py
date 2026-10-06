from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import text

from ..auth import current_user, now_iso
from ..db import get_conn
from ..money import compute_splits
from ..schemas import ExpenseCreate, ExpenseOut
from .groups import is_member

router = APIRouter(prefix="/expenses")

EXPENSE_COLS = "id, group_id, paid_by, amount_paise, category, description, spent_on, split_type"


def attach_splits(conn, rows):
    expenses = [dict(r) for r in rows]
    for e in expenses:
        e["splits"] = [
            dict(s)
            for s in conn.execute(
                text("SELECT user_id, share_paise FROM expense_splits WHERE expense_id = :e ORDER BY rowid"),
                {"e": e["id"]},
            ).mappings()
        ]
    return expenses


def load_expense(conn, expense_id):
    row = conn.execute(text(f"SELECT {EXPENSE_COLS} FROM expenses WHERE id = :id"), {"id": expense_id}).mappings().first()
    if not row:
        raise HTTPException(404, "expense not found")
    return attach_splits(conn, [row])[0]


def validate(conn, body, user_id):
    paid_by = body.paid_by if body.paid_by is not None else user_id
    if body.group_id is None:
        if paid_by != user_id:
            raise HTTPException(400, "personal expenses must be paid by the caller")
        member_ids = [user_id]
    else:
        if not is_member(conn, body.group_id, user_id):
            raise HTTPException(404, "group not found")
        if not is_member(conn, body.group_id, paid_by):
            raise HTTPException(400, "paid_by must be a group member")
        member_ids = [
            r[0]
            for r in conn.execute(
                text("SELECT user_id FROM group_members WHERE group_id = :g ORDER BY user_id"), {"g": body.group_id}
            )
        ]
    splits = compute_splits(body.split_type, body.amount_paise, body.splits, member_ids)
    return paid_by, splits


def insert_splits(conn, expense_id, splits):
    for s in splits:
        conn.execute(
            text("INSERT INTO expense_splits (expense_id, user_id, share_paise) VALUES (:e, :u, :s)"),
            {"e": expense_id, "u": s["user_id"], "s": s["share_paise"]},
        )


@router.get("", response_model=list[ExpenseOut])
def list_expenses(group_id: int | None = None, user=Depends(current_user), conn=Depends(get_conn)):
    if group_id is None:
        rows = conn.execute(
            text(f"SELECT {EXPENSE_COLS} FROM expenses WHERE group_id IS NULL AND paid_by = :u ORDER BY spent_on, id"),
            {"u": user["id"]},
        ).mappings().all()
    else:
        rows = conn.execute(
            text(f"SELECT {EXPENSE_COLS} FROM expenses WHERE group_id = :g ORDER BY spent_on, id"), {"g": group_id}
        ).mappings().all()
    return attach_splits(conn, rows)


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(body: ExpenseCreate, user=Depends(current_user), conn=Depends(get_conn)):
    paid_by, splits = validate(conn, body, user["id"])
    result = conn.execute(
        text(
            "INSERT INTO expenses (group_id, paid_by, amount_paise, category, description, spent_on, split_type, created_at) "
            "VALUES (:group_id, :paid_by, :amount_paise, :category, :description, :spent_on, :split_type, :now)"
        ),
        {**body.model_dump(exclude={"splits", "paid_by"}), "paid_by": paid_by, "now": now_iso()},
    )
    insert_splits(conn, result.lastrowid, splits)
    return load_expense(conn, result.lastrowid)


@router.get("/search", response_model=list[ExpenseOut])
def search(q: str = Query(min_length=1), user=Depends(current_user), conn=Depends(get_conn)):
    like = f"%{q}%"
    rows = conn.execute(
        text(
            f"""
            SELECT {EXPENSE_COLS} FROM expenses e
            WHERE (e.description LIKE '{like}' OR e.category LIKE '{like}')
              AND ((e.group_id IS NULL AND e.paid_by = :u)
                   OR e.group_id IN (SELECT group_id FROM group_members WHERE user_id = :u))
            ORDER BY e.spent_on DESC, e.id DESC
            """
        ),
        {"u": user["id"]},
    ).mappings().all()
    return attach_splits(conn, rows)


@router.get("/{id}", response_model=ExpenseOut)
def get_expense(id: int, user=Depends(current_user), conn=Depends(get_conn)):
    return load_expense(conn, id)


@router.patch("/{id}", response_model=ExpenseOut)
def patch_expense(id: int, body: ExpenseCreate, user=Depends(current_user), conn=Depends(get_conn)):
    load_expense(conn, id)
    paid_by, splits = validate(conn, body, user["id"])
    conn.execute(
        text(
            "UPDATE expenses SET group_id = :group_id, paid_by = :paid_by, amount_paise = :amount_paise, "
            "category = :category, description = :description, spent_on = :spent_on, split_type = :split_type "
            "WHERE id = :id"
        ),
        {**body.model_dump(exclude={"splits", "paid_by"}), "paid_by": paid_by, "id": id},
    )
    conn.execute(text("DELETE FROM expense_splits WHERE expense_id = :e"), {"e": id})
    insert_splits(conn, id, splits)
    return load_expense(conn, id)


@router.delete("/{id}", status_code=204, response_class=Response)
def delete_expense(id: int, user=Depends(current_user), conn=Depends(get_conn)):
    load_expense(conn, id)
    conn.execute(text("DELETE FROM expense_splits WHERE expense_id = :e"), {"e": id})
    conn.execute(text("DELETE FROM expenses WHERE id = :e"), {"e": id})
