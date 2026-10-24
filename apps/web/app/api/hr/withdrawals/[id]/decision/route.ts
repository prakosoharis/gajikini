import { handle, hrDecision, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req, params) => {
  const body = await req.json().catch(() => ({}));
  return hrDecision(userIdFrom(req), params.id, Boolean(body?.approve), body?.reason);
});
