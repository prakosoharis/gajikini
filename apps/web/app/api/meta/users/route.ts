import { handle, metaUsers } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => metaUsers());
