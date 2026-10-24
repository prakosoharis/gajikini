import { handle, hrInvoices, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => hrInvoices(userIdFrom(req)));
