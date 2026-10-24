import { handle, hrEmployees, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => hrEmployees(userIdFrom(req)));
