# 单端口部署镜像：构建前端 → 由后端同时托管 API 与静态页面
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY blockchaindemo/package*.json ./blockchaindemo/
RUN cd blockchaindemo && npm ci --omit=dev

COPY blockchaindemo/ ./blockchaindemo
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PORT=3001
EXPOSE 3001

CMD ["node", "blockchaindemo/headless-server.js"]
