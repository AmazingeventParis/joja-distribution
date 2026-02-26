FROM node:20-alpine AS base

# --- Stage 1: Install dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Stage 3: Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Creer le dossier uploads et ses sous-dossiers
RUN mkdir -p /app/uploads/logos /app/uploads/signatures /app/uploads/pdfs

# Copier le standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Le volume pour les fichiers uploades (persiste entre les deployments)
VOLUME ["/app/uploads"]

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
