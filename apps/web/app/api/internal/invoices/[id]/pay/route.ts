import { handle, internalPayInvoice, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req, params) => internalPayInvoice(userIdFrom(req), params.id));
