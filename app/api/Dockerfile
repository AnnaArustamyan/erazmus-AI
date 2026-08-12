FROM node:24-alpine AS deps
WORKDIR /app
COPY app/api/package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY app/api/package*.json ./
COPY app/api/src ./src
COPY app/resources/derived ./resources/derived
COPY app/resources/README.md app/resources/MAPPING.md ./resources/

EXPOSE 4000
CMD ["node", "src/server.js"]
