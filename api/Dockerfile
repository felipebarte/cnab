# Build stage
FROM node:20-alpine AS builder

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json ./

# Instalar dependências de produção (ignorando scripts prepare/husky)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar dependências da fase de build
COPY --from=builder /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Criar diretórios necessários e definir permissões
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nodeuser:nodejs /app

# Definir usuário
USER nodeuser

# Expor porta
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: 8080, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
        if (res.statusCode === 200) { process.exit(0); } else { process.exit(1); } \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Comando padrão
CMD ["npm", "start"] 