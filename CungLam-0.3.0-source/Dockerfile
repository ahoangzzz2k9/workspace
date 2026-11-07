# Cùng Làm — image Node 24, không dependency ngoài.
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    CUNGLAM_DB=/app/data/cunglam.db

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY docs ./docs
COPY README.md ./

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 4321
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
