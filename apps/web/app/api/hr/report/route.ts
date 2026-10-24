import { handle, hrReport, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => hrReport(userIdFrom(req)));
