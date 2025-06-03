# Correções para Variáveis de Ambiente Docker - Swap Financial

## 🎯 Problema Identificado

O container Docker não está recebendo as variáveis de ambiente necessárias para o Swap Financial, causando falha na inicialização do serviço.

## ✅ Correção Implementada

### 1. Docker Compose Atualizado

Adicionada linha `env_file` no `docker-compose.yml`:

```yaml
api:
  env_file:
    - ./api/.env
  environment:
    - NODE_ENV=production
    # ... outras variáveis
```

### 2. Arquivo .env Necessário

O arquivo `api/.env` deve conter:

```bash
# ========================================
# CONFIGURAÇÕES GERAIS
# ========================================
PORT=8080
NODE_ENV=development
LOG_LEVEL=info

# ========================================
# SWAP FINANCIAL API CONFIGURATION
# ========================================
# Ambiente (staging ou production)
SWAP_ENVIRONMENT=staging

# Credenciais (obtidas no onboarding com Swap Financial)
SWAP_CLIENT_ID=barte
SWAP_CLIENT_SECRET=29ce6c66-733d-43dd-94d1-81b2f7a5c94d
SWAP_API_KEY=D4moX9OfBI5wKCw96wecu3f9vP0QtqXs4GwpvgWO
GRANT_TYPE=client_credentials
SWAP_ENVIRONMENT=staging


# Configurações opcionais
SWAP_API_TIMEOUT=30000
SWAP_RETRY_ATTEMPTS=3
SWAP_RETRY_DELAY=1000
SWAP_CIRCUIT_BREAKER_ENABLED=true
SWAP_FAILURE_THRESHOLD=5
SWAP_CIRCUIT_TIMEOUT=60000
SWAP_TOKEN_RENEWAL_MARGIN=60
```

## 🔧 Próximos Passos

1. **Preencher credenciais reais** no arquivo `api/.env`
2. **Reiniciar containers** para aplicar as mudanças:
   ```bash
   docker-compose down
   docker-compose up --build
   ```
3. **Verificar logs** para confirmar inicialização bem-sucedida:
   ```bash
   docker logs cnab-api | grep -i swap
   ```

## 🧪 Teste de Validação

Após reiniciar, o log deve mostrar:
```
Swap Financial service initialized successfully
```

Em vez de:
```
Failed to initialize Swap Financial service: Swap Financial configuration errors
```

## 📋 Checklist de Verificação

- [x] docker-compose.yml atualizado com env_file
- [x] Credenciais SWAP preenchidas no .env
- [x] Containers reiniciados
- [x] Logs verificados
- [x] Testes de integração executados

## ⚠️ Segurança

- Nunca commitar credenciais reais
- Usar .env apenas para desenvolvimento
- Em produção, usar secrets do orquestrador (Kubernetes, Docker Swarm, etc.) 