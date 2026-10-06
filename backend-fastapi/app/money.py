from fastapi import HTTPException


def distribute(amount, user_ids):
    share = round(amount / len(user_ids))
    return [{"user_id": u, "share_paise": share} for u in user_ids]


def compute_splits(split_type, amount, splits, member_ids):
    if not splits:
        if split_type != "equal":
            raise HTTPException(400, f"{split_type} split requires splits")
        return distribute(amount, member_ids)

    user_ids = [s.user_id for s in splits]
    if len(set(user_ids)) != len(user_ids):
        raise HTTPException(400, "duplicate user in splits")
    unknown = set(user_ids) - set(member_ids)
    if unknown:
        raise HTTPException(400, f"users not in group: {sorted(unknown)}")

    if split_type == "equal":
        return distribute(amount, user_ids)

    if split_type == "exact":
        if any(s.share_paise < 0 for s in splits):
            raise HTTPException(400, "shares must be non-negative")
        if sum(s.share_paise for s in splits) != amount:
            raise HTTPException(400, "exact splits must sum to amount_paise")
        return [{"user_id": s.user_id, "share_paise": s.share_paise} for s in splits]

    if any(s.share_paise < 0 for s in splits):
        raise HTTPException(400, "percentages must be non-negative")
    if sum(s.share_paise for s in splits) != 100:
        raise HTTPException(400, "percent splits must sum to 100")
    return [{"user_id": s.user_id, "share_paise": round(amount * s.share_paise / 100)} for s in splits]
