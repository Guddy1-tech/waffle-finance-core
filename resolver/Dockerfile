FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
USER node
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/index.js"]
CMD ["run"]
