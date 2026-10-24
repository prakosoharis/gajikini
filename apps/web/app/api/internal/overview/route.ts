import { handle, internalOverview, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => internalOverview(userIdFrom(req)));
