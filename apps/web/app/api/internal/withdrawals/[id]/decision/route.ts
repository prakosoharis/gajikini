import { handle, internalDecision, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req, params) => {
  const body = await req.json().catch(() => ({}));
  return internalDecision(userIdFrom(req), params.id, Boolean(body?.approve), body?.reason);
});
