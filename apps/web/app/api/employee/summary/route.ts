import { employeeSummary, handle, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => employeeSummary(userIdFrom(req)));
