import { HttpError } from './http.js';

export type Split = { user_id: number; share_paise: number };
export type SplitType = 'equal' | 'exact' | 'percent';

export function computeSplits(amount: number, type: SplitType, splits: Split[] | undefined, memberIds: number[]): Split[] {
  if (type === 'equal') {
    const userIds = splits && splits.length ? splits.map((s) => s.user_id) : memberIds;
    if (userIds.length === 0) throw new HttpError(400, 'equal split needs at least one user');
    const share = Math.round(amount / userIds.length);
    return userIds.map((id) => ({ user_id: id, share_paise: share }));
  }
  if (!splits || splits.length === 0) throw new HttpError(400, `${type} split requires splits`);
  const total = splits.reduce((sum, s) => sum + s.share_paise, 0);
  if (type === 'exact') {
    if (total !== amount) throw new HttpError(400, `exact splits sum to ${total}, expected ${amount}`);
    return splits.map((s) => ({ user_id: s.user_id, share_paise: s.share_paise }));
  }
  if (total !== 100) throw new HttpError(400, `percent splits sum to ${total}, expected 100`);
  return splits.map((s) => ({ user_id: s.user_id, share_paise: Math.round((amount * s.share_paise) / 100) }));
}
