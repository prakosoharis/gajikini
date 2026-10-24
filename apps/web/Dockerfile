FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/internal/package.json apps/internal/
COPY apps/hr/package.json apps/hr/

RUN pnpm install --frozen-lockfile --filter @ewa/shared --filter web

COPY packages/shared packages/shared
COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_HR_URL=http://localhost:3022
ARG NEXT_PUBLIC_OPS_URL=http://localhost:3021
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_HR_URL=$NEXT_PUBLIC_HR_URL
ENV NEXT_PUBLIC_OPS_URL=$NEXT_PUBLIC_OPS_URL

RUN pnpm --filter @ewa/shared build && pnpm --filter web build

WORKDIR /repo/apps/web
EXPOSE 3000

CMD ["pnpm", "start"]
