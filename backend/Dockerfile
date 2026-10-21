FROM node:20 AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

EXPOSE 7734
CMD ["npm", "start"]

FROM runtime AS test
COPY tests ./tests
CMD ["npm", "test"]

FROM runtime AS production
