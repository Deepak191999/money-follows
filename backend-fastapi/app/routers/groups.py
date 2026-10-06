from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import text

from ..auth import current_user, now_iso
from ..db import get_conn
from ..schemas import Balance, GroupCreate, GroupDetail, GroupOut, GroupPatch, MemberAdd, SettleRequest, SettlementOut

router = APIRouter(prefix="/groups")


def is_member(conn, group_id, user_id):
    return conn.execute(
        text("SELECT 1 FROM group_members WHERE group_id = :g AND user_id = :u"), {"g": group_id, "u": user_id}
    ).first() is not None


def load_group(conn, group_id):
    row = conn.execute(text("SELECT id, name, created_by FROM groups WHERE id = :id"), {"id": group_id}).mappings().first()
    if not row:
        raise HTTPException(404, "group not found")
    return dict(row)


def group_detail(conn, group):
    members = conn.execute(
        text(
            "SELECT u.id, u.name, u.email FROM users u JOIN group_members m ON m.user_id = u.id "
            "WHERE m.group_id = :g ORDER BY u.id"
        ),
        {"g": group["id"]},
    ).mappings().all()
    return {**group, "members": [dict(m) for m in members]}


@router.get("", response_model=list[GroupOut])
def list_groups(user=Depends(current_user), conn=Depends(get_conn)):
    rows = conn.execute(
        text(
            "SELECT g.id, g.name, g.created_by FROM groups g JOIN group_members m ON m.group_id = g.id "
            "WHERE m.user_id = :u ORDER BY g.id"
        ),
        {"u": user["id"]},
    ).mappings().all()
    return [dict(r) for r in rows]


@router.post("", response_model=GroupOut, status_code=201)
def create_group(body: GroupCreate, user=Depends(current_user), conn=Depends(get_conn)):
    result = conn.execute(
        text("INSERT INTO groups (name, created_by, created_at) VALUES (:name, :by, :now)"),
        {"name": body.name, "by": user["id"], "now": now_iso()},
    )
    group_id = result.lastrowid
    conn.execute(text("INSERT INTO group_members (group_id, user_id) VALUES (:g, :u)"), {"g": group_id, "u": user["id"]})
    return {"id": group_id, "name": body.name, "created_by": user["id"]}


@router.get("/{id}", response_model=GroupDetail)
def get_group(id: int, user=Depends(current_user), conn=Depends(get_conn)):
    return group_detail(conn, load_group(conn, id))


@router.patch("/{id}", response_model=GroupOut)
def patch_group(id: int, body: GroupPatch, user=Depends(current_user), conn=Depends(get_conn)):
    group = load_group(conn, id)
    if body.name is not None:
        conn.execute(text("UPDATE groups SET name = :name WHERE id = :id"), {"name": body.name, "id": id})
        group["name"] = body.name
    return group


@router.delete("/{id}", status_code=204, response_class=Response)
def delete_group(id: int, user=Depends(current_user), conn=Depends(get_conn)):
    group = load_group(conn, id)
    if group["created_by"] != user["id"]:
        raise HTTPException(403, "only the creator can delete a group")
    p = {"g": id}
    conn.execute(text("DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = :g)"), p)
    conn.execute(text("DELETE FROM expenses WHERE group_id = :g"), p)
    conn.execute(text("DELETE FROM settlements WHERE group_id = :g"), p)
    conn.execute(text("DELETE FROM group_members WHERE group_id = :g"), p)
    conn.execute(text("DELETE FROM groups WHERE id = :g"), p)


@router.post("/{id}/members", response_model=GroupDetail)
def add_member(id: int, body: MemberAdd, user=Depends(current_user), conn=Depends(get_conn)):
    group = load_group(conn, id)
    if not is_member(conn, id, user["id"]):
        raise HTTPException(404, "group not found")
    target = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": body.email}).first()
    if not target:
        raise HTTPException(404, "user not found")
    if not is_member(conn, id, target[0]):
        conn.execute(text("INSERT INTO group_members (group_id, user_id) VALUES (:g, :u)"), {"g": id, "u": target[0]})
    return group_detail(conn, group)


@router.get("/{id}/balances", response_model=list[Balance])
def balances(id: int, user=Depends(current_user), conn=Depends(get_conn)):
    load_group(conn, id)
    rows = conn.execute(
        text(
            """
            SELECT u.id AS user_id, u.name,
              COALESCE((SELECT SUM(amount_paise) FROM expenses WHERE group_id = :g AND paid_by = u.id), 0)
            - COALESCE((SELECT SUM(s.share_paise) FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
                        WHERE e.group_id = :g AND s.user_id = u.id), 0)
            + COALESCE((SELECT SUM(amount_paise) FROM settlements WHERE group_id = :g AND from_user = u.id), 0)
            - COALESCE((SELECT SUM(amount_paise) FROM settlements WHERE group_id = :g AND to_user = u.id), 0)
              AS net_paise
            FROM users u JOIN group_members m ON m.user_id = u.id
            WHERE m.group_id = :g ORDER BY u.id
            """
        ),
        {"g": id},
    ).mappings().all()
    return [dict(r) for r in rows]


@router.post("/{id}/settle", response_model=SettlementOut, status_code=201)
def settle(id: int, body: SettleRequest, user=Depends(current_user), conn=Depends(get_conn)):
    load_group(conn, id)
    if not is_member(conn, id, user["id"]):
        raise HTTPException(404, "group not found")
    if body.from_user == body.to_user:
        raise HTTPException(400, "from_user and to_user must differ")
    if not (is_member(conn, id, body.from_user) and is_member(conn, id, body.to_user)):
        raise HTTPException(400, "both users must be group members")
    created_at = now_iso()
    result = conn.execute(
        text(
            "INSERT INTO settlements (group_id, from_user, to_user, amount_paise, created_at) "
            "VALUES (:g, :f, :t, :a, :now)"
        ),
        {"g": id, "f": body.from_user, "t": body.to_user, "a": body.amount_paise, "now": created_at},
    )
    return {"id": result.lastrowid, "group_id": id, **body.model_dump(), "created_at": created_at}
