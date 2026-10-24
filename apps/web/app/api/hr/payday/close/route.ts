import { handle, hrClosePayday, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => hrClosePayday(userIdFrom(req)));
