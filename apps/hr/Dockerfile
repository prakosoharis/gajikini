FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/internal/package.json apps/internal/
COPY apps/hr/package.json apps/hr/

RUN pnpm install --frozen-lockfile --filter @ewa/shared --filter hr

COPY packages/shared packages/shared
COPY apps/hr apps/hr

RUN pnpm --filter @ewa/shared build && pnpm --filter hr build

WORKDIR /repo/apps/hr
EXPOSE 3000

CMD ["pnpm", "start"]
