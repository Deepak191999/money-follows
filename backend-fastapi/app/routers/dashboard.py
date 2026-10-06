import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import text

from ..auth import current_user
from ..db import get_conn
from ..schemas import MonthlyDashboard

router = APIRouter()

MONTH = r"^\d{4}-\d{2}$"


@router.get("/dashboard/monthly", response_model=MonthlyDashboard)
def monthly(month: str = Query(pattern=MONTH), user=Depends(current_user), conn=Depends(get_conn)):
    rows = conn.execute(
        text(
            """
            SELECT e.category, SUM(s.share_paise) AS total_paise
            FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
            WHERE s.user_id = :u AND e.spent_on LIKE :prefix
            GROUP BY e.category ORDER BY total_paise DESC, e.category
            """
        ),
        {"u": user["id"], "prefix": f"{month}-%"},
    ).mappings().all()
    by_category = [dict(r) for r in rows]
    return {"month": month, "total_paise": sum(r["total_paise"] for r in by_category), "by_category": by_category}


def inr(paise):
    return f"{paise / 100:.2f}"


@router.get("/export/csv")
def export_csv(month: str = Query(pattern=MONTH), user=Depends(current_user), conn=Depends(get_conn)):
    rows = conn.execute(
        text(
            """
            SELECT e.spent_on, e.description, e.category, COALESCE(g.name, '') AS group_name,
                   p.name AS paid_by, e.amount_paise, s.share_paise
            FROM expense_splits s
            JOIN expenses e ON e.id = s.expense_id
            JOIN users p ON p.id = e.paid_by
            LEFT JOIN groups g ON g.id = e.group_id
            WHERE s.user_id = :u AND e.spent_on LIKE :prefix
            ORDER BY e.spent_on, e.id
            """
        ),
        {"u": user["id"], "prefix": f"{month}-%"},
    ).mappings().all()
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["date", "description", "category", "group", "paid_by", "amount_inr", "my_share_inr"])
    for r in rows:
        writer.writerow(
            [
                r["spent_on"],
                r["description"],
                r["category"],
                r["group_name"],
                r["paid_by"],
                inr(r["amount_paise"]),
                inr(r["share_paise"]),
            ]
        )
    headers = {"Content-Disposition": f'attachment; filename="expenses-{month}.csv"'}
    return Response(buf.getvalue(), media_type="text/csv", headers=headers)
