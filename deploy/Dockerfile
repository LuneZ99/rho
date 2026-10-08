FROM node:22.23.0-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=@rho/server --workspace=@rho/shared --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN mkdir -p /data/agent && chown node:node /data/agent
USER node
CMD ["npm", "run", "start", "-w", "@rho/server"]
