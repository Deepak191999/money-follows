#!/usr/bin/env bash
# Runs the same happy-path scenario against whichever backend is on $BASE (default localhost:8000).
set -euo pipefail
BASE="${BASE:-http://localhost:8000}"
j() { curl -sS -H 'Content-Type: application/json' "$@"; }

curl -sSf "$BASE/health" >/dev/null && echo "health ok"
TOKEN=$(j -X POST "$BASE/auth/login" -d '{"email":"asha@example.com","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
auth=(-H "Authorization: Bearer $TOKEN")
echo "login ok"

j "${auth[@]}" "$BASE/me" | grep -q '"asha@example.com"' && echo "me ok"
j "${auth[@]}" "$BASE/groups" | python3 -c 'import sys,json;g=json.load(sys.stdin);assert len(g)==2,g' && echo "groups ok"
j "${auth[@]}" "$BASE/groups/1" | python3 -c 'import sys,json;g=json.load(sys.stdin);assert len(g["members"])==3,g' && echo "group detail ok"
j "${auth[@]}" "$BASE/expenses?group_id=1" | python3 -c 'import sys,json;e=json.load(sys.stdin);assert len(e)==7,len(e)' && echo "group expenses ok"
j "${auth[@]}" "$BASE/expenses" | python3 -c 'import sys,json;e=json.load(sys.stdin);assert len(e)==4,len(e)' && echo "personal expenses ok"
j "${auth[@]}" "$BASE/groups/1/balances" | python3 -c 'import sys,json;b=json.load(sys.stdin);assert sum(x["net_paise"] for x in b)==0,b' && echo "balances sum to zero"
echo "contract ok"
