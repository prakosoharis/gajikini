import { handle, internalRetry, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req, params) => internalRetry(userIdFrom(req), params.id));
