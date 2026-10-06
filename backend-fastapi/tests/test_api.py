def test_login_bad_password(client):
    r = client.post("/auth/login", json={"email": "asha@example.com", "password": "wrong"})
    assert r.status_code == 401
    assert r.json() == {"error": "invalid email or password"}


def test_me(client, asha):
    r = client.get("/me", headers=asha)
    assert r.status_code == 200
    assert r.json()["email"] == "asha@example.com"


def test_groups_list(client, asha):
    r = client.get("/groups", headers=asha)
    assert [g["name"] for g in r.json()] == ["Goa trip", "Flat 4B"]


def test_group_detail(client, asha):
    r = client.get("/groups/1", headers=asha)
    assert r.status_code == 200
    assert len(r.json()["members"]) == 3


def test_group_detail_for_member(client, chetan):
    r = client.get("/groups/1", headers=chetan)
    assert r.status_code == 200
    assert len(r.json()["members"]) == 3


def test_equal_split_sums_to_amount(client, asha):
    body = {
        "group_id": 1,
        "amount_paise": 300,
        "category": "Food",
        "description": "Chai",
        "spent_on": "2026-08-18",
        "split_type": "equal",
    }
    r = client.post("/expenses", json=body, headers=asha)
    assert r.status_code == 201
    shares = [s["share_paise"] for s in r.json()["splits"]]
    assert shares == [100, 100, 100]


def test_exact_split_mismatch_400(client, asha):
    body = {
        "group_id": 1,
        "amount_paise": 1000,
        "category": "Food",
        "description": "Snacks",
        "spent_on": "2026-08-18",
        "split_type": "exact",
        "splits": [{"user_id": 1, "share_paise": 600}, {"user_id": 2, "share_paise": 300}],
    }
    r = client.post("/expenses", json=body, headers=asha)
    assert r.status_code == 400
    assert "sum" in r.json()["error"]


def test_balances_sum_to_zero(client, asha):
    r = client.get("/groups/1/balances", headers=asha)
    assert r.status_code == 200
    assert sum(b["net_paise"] for b in r.json()) == 0


def test_settle_reduces_balance(client, asha):
    before = {b["user_id"]: b["net_paise"] for b in client.get("/groups/2/balances", headers=asha).json()}
    r = client.post("/groups/2/settle", json={"from_user": 1, "to_user": 2, "amount_paise": 5000}, headers=asha)
    assert r.status_code == 201
    after = {b["user_id"]: b["net_paise"] for b in client.get("/groups/2/balances", headers=asha).json()}
    assert after[1] == before[1] + 5000
    assert after[2] == before[2] - 5000


def test_search(client, asha):
    r = client.get("/expenses/search", params={"q": "bigbasket"}, headers=asha)
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_dashboard_monthly(client, asha):
    r = client.get("/dashboard/monthly", params={"month": "2026-08"}, headers=asha)
    assert r.status_code == 200
    body = r.json()
    assert body["month"] == "2026-08"
    assert body["total_paise"] == sum(c["total_paise"] for c in body["by_category"])
    assert body["total_paise"] > 0


def test_csv_export_header(client, asha):
    r = client.get("/export/csv", params={"month": "2026-09"}, headers=asha)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0] == "date,description,category,group,paid_by,amount_inr,my_share_inr"
