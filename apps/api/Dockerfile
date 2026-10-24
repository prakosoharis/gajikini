FROM node:22-alpine

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/internal/package.json apps/internal/
COPY apps/hr/package.json apps/hr/

RUN pnpm install --frozen-lockfile --filter @ewa/shared --filter api

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @ewa/shared build && pnpm --filter api build

WORKDIR /repo/apps/api
EXPOSE 4000

CMD ["sh", "-c", "pnpm exec prisma db push --skip-generate && node dist/seed.js && node dist/main.js"]
