import { handle, hrOverview, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => hrOverview(userIdFrom(req)));
