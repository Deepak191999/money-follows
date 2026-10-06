# Build context is the repository root so the seed file is available:
#   docker build -f backend-node/Dockerfile -t money-follows-backend-node .
FROM node:22-alpine
WORKDIR /app
COPY seed/seed.json /seed/seed.json
COPY backend-node/package.json backend-node/package-lock.json ./
RUN npm ci
COPY backend-node/tsconfig.json ./
COPY backend-node/src ./src
RUN npm run build && npm run seed
ENV NODE_ENV=production PORT=8000
EXPOSE 8000
CMD ["npm", "start"]
