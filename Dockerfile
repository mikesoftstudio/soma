# ─── Build stage ────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma/ ./prisma/
COPY src/ ./src/

RUN npx prisma generate
RUN npm run build

# ─── Production stage ────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN addgroup -S soma && adduser -S soma -G soma
USER soma

EXPOSE 3000 2525

CMD ["node", "dist/server.js"]
