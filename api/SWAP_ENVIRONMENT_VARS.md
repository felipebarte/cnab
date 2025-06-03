# Variáveis de Ambiente - Swap Financial Integration

Este documento descreve as variáveis de ambiente necessárias para configurar a integração com a API da Swap Financial.

## Configurações Obrigatórias

### Credenciais de Autenticação

```bash
# Ambiente da API Swap Financial (staging ou production)
SWAP_ENVIRONMENT=staging

# Credenciais de autenticação da Swap Financial
SWAP_CLIENT_ID=barte
SWAP_CLIENT_SECRET=29ce6c66-733d-43dd-94d1-81b2f7a5c94d
SWAP_API_KEY=D4moX9OfBI5wKCw96wecu3f9vP0QtqXs4GwpvgWO
```

⚠️ **Importante**: Essas credenciais são fornecidas pela Swap Financial após o onboarding.

## Configurações Opcionais

### Timeouts e Retry Logic

```bash
# Timeout para requisições HTTP (em milissegundos)
SWAP_API_TIMEOUT=30000

# Número de tentativas em caso de falha
SWAP_RETRY_ATTEMPTS=3

# Delay inicial entre tentativas (em milissegundos)
SWAP_RETRY_DELAY=1000
```

### Circuit Breaker

```bash
# Habilitar/desabilitar circuit breaker
SWAP_CIRCUIT_BREAKER_ENABLED=true

# Número de falhas consecutivas antes de abrir o circuit
SWAP_FAILURE_THRESHOLD=5

# Tempo em milissegundos para tentar reativar o circuit
SWAP_CIRCUIT_TIMEOUT=60000
```

### Cache de Token

```bash
# Margem de segurança para renovação de token (em segundos)
SWAP_TOKEN_RENEWAL_MARGIN=60
```

## URLs por Ambiente

As URLs são automaticamente configuradas baseadas no valor de `SWAP_ENVIRONMENT`:

- **Staging**: `https://api-stag.contaswap.io`
- **Production**: `https://api-prod.contaswap.io`

## Exemplo de Configuração no .env

```bash
# ========================================
# SWAP FINANCIAL API CONFIGURATION
# ========================================

# Ambiente
SWAP_ENVIRONMENT=staging

# Credenciais (obtidas no onboarding)
SWAP_CLIENT_ID=barte
SWAP_CLIENT_SECRET=29ce6c66-733d-43dd-94d1-81b2f7a5c94d
SWAP_API_KEY=D4moX9OfBI5wKCw96wecu3f9vP0QtqXs4GwpvgWO

# Configurações de performance (opcionais)
SWAP_API_TIMEOUT=30000
SWAP_RETRY_ATTEMPTS=3
SWAP_RETRY_DELAY=1000
SWAP_CIRCUIT_BREAKER_ENABLED=true
SWAP_FAILURE_THRESHOLD=5
SWAP_CIRCUIT_TIMEOUT=60000
SWAP_TOKEN_RENEWAL_MARGIN=60
```

## Validação de Configuração

O sistema irá validar automaticamente se todas as configurações obrigatórias estão presentes na inicialização. Se alguma configuração estiver faltando, o serviço não será inicializado e um erro descritivo será exibido.

## Endpoints para Teste

Após configurar as variáveis, você pode testar a integração usando:

- `GET /api/v1/swap/health` - Health check da integração
- `GET /api/v1/swap/config` - Verificar configurações (sem dados sensíveis)
- `POST /api/v1/swap/auth` - Testar autenticação
- `GET /api/v1/swap/metrics` - Métricas do circuit breaker

## Segurança

⚠️ **Nunca commite credenciais reais no repositório!**

- Use arquivos `.env` locais para desenvolvimento
- Configure as variáveis no ambiente de produção via sistema de deployment
- Mantenha as credenciais seguras e com acesso restrito 