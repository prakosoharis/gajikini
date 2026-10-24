import { handle, internalAudit, userIdFrom } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => internalAudit(userIdFrom(req)));
