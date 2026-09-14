# Production image: build the Vite client, then serve it from the Node API.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/api-server.mjs ./
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
EXPOSE 80
CMD ["npm", "start"]
