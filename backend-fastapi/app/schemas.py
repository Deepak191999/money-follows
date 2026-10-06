from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class Signup(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)


class Login(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class GroupCreate(BaseModel):
    name: str


class GroupPatch(BaseModel):
    name: str | None = None


class MemberAdd(BaseModel):
    email: EmailStr


class GroupOut(BaseModel):
    id: int
    name: str
    created_by: int


class GroupDetail(GroupOut):
    members: list[UserOut]


class Balance(BaseModel):
    user_id: int
    name: str
    net_paise: int


class SettleRequest(BaseModel):
    from_user: int
    to_user: int
    amount_paise: int = Field(ge=1)


class SettlementOut(BaseModel):
    id: int
    group_id: int
    from_user: int
    to_user: int
    amount_paise: int
    created_at: str


class Split(BaseModel):
    user_id: int
    share_paise: int


class ExpenseCreate(BaseModel):
    group_id: int | None = None
    paid_by: int | None = None
    amount_paise: int = Field(ge=1)
    category: str
    description: str
    spent_on: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    split_type: Literal["equal", "exact", "percent"]
    splits: list[Split] | None = None


class ExpenseOut(BaseModel):
    id: int
    group_id: int | None
    paid_by: int
    amount_paise: int
    category: str
    description: str
    spent_on: str
    split_type: str
    splits: list[Split]


class CategoryTotal(BaseModel):
    category: str
    total_paise: int


class MonthlyDashboard(BaseModel):
    month: str
    total_paise: int
    by_category: list[CategoryTotal]
