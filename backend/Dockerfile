FROM node:20 AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

EXPOSE 7734
CMD ["npm", "start"]

FROM runtime AS development
RUN npm ci --include=dev --no-audit --no-fund

FROM development AS test
COPY tests ./tests
CMD ["npm", "test"]

FROM runtime AS production
