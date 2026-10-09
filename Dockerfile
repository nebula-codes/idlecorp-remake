# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
# Emit plain JavaScript while retaining relative imports, JSON content and migration paths.
RUN npx tsc --ignoreConfig --module NodeNext --moduleResolution NodeNext \
    --target ES2023 --esModuleInterop --resolveJsonModule --strict --skipLibCheck \
    --rootDir . --outDir /compiled \
    apps/server/src/index.ts apps/server/src/admin.ts apps/server/src/migrate.ts

FROM node:24-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    BACKUP_DIR=/app/.runtime/backups
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /compiled/apps/server/src ./apps/server/src
COPY --from=build /compiled/packages ./packages
COPY --from=build /app/apps/server/migrations ./apps/server/migrations
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/scripts/backup.mjs /app/scripts/restore.mjs ./scripts/
COPY package.json ./
# Keep operator commands usable with the compiled image; no tsx, Electron or browser tools ship.
RUN node --input-type=module -e "import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.scripts={start:'node apps/server/src/index.js','db:migrate':'node apps/server/src/migrate.js',admin:'node apps/server/src/admin.js','db:backup':'node scripts/backup.mjs','db:restore':'node scripts/restore.mjs'}; delete p.devDependencies; delete p.build; p.main='apps/server/src/index.js'; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');" \
    && mkdir -p /app/.runtime/backups \
    && chown -R node:node /app/.runtime
EXPOSE 3001
USER node
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/src/index.js"]
