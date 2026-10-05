FROM node:20-bookworm-slim
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start","--prefix","backend"]
