FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5000

CMD ["sh", "docker-entrypoint.sh"]
