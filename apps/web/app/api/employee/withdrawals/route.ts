import { createWithdrawal, handle, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const body = await req.json().catch(() => ({}));
  return createWithdrawal(userIdFrom(req), body?.amount);
});
