# Configuração do Webhook CNAB

Este documento explica como configurar o webhook para envio automático de dados CNAB processados.

## 📋 Variáveis de Ambiente

### Configurações Obrigatórias

| Variável | Descrição | Valor Padrão | Exemplo |
|----------|-----------|--------------|---------|
| `WEBHOOK_URL` | URL principal do webhook | - | `https://sandbox-n8n-webhook.barte.com/webhook/cnab` |
| `WEBHOOK_CNAB_URL` | URL alternativa (usado pelo WebhookService) | - | `https://sandbox-n8n-webhook.barte.com/webhook/cnab` |

### Configurações Opcionais

| Variável | Descrição | Valor Padrão | Exemplo |
|----------|-----------|--------------|---------|
| `WEBHOOK_ENABLED` | Habilita/desabilita webhook | `true` | `true` ou `false` |
| `WEBHOOK_TIMEOUT` | Timeout das requisições (ms) | `30000` | `30000` |
| `WEBHOOK_RETRY_ATTEMPTS` | Número de tentativas | `3` | `3` |
| `WEBHOOK_RETRY_DELAY` | Delay entre tentativas (ms) | `5000` | `5000` |

## 🚀 Configuração Rápida

1. **Copie o arquivo de exemplo:**
   ```bash
   cp .env.example .env
   ```

2. **Edite o arquivo `.env`:**
   ```bash
   nano .env
   ```

3. **Configure a URL do webhook:**
   ```env
   WEBHOOK_URL=https://seu-webhook.com/endpoint
   WEBHOOK_CNAB_URL=https://seu-webhook.com/endpoint
   ```

## 📡 Endpoints Disponíveis

### POST /api/v1/cnab/processar-webhook
Processa CNAB via texto e envia para webhook.

**Body (JSON):**
```json
{
  "conteudo": "conteúdo do arquivo CNAB...",
  "webhookUrl": "https://webhook-opcional.com/endpoint"
}
```

### POST /api/v1/cnab/processar-webhook/upload
Processa CNAB via upload e envia para webhook.

**Body (Multipart):**
- `arquivo`: Arquivo CNAB
- `webhookUrl`: URL opcional do webhook

## 📊 Estrutura dos Dados Enviados

O webhook recebe dados estruturados no seguinte formato:

```json
{
  "metadados": {
    "fonte": "CNAB 400 Itaú Parser API",
    "versao": "1.0.0",
    "dataProcessamento": "2024-01-15T10:30:00.000Z",
    "webhook": {
      "tentativaEnvio": 1,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  },
  "arquivo": {
    "nome": "cnab400.txt",
    "tamanho": 12345,
    "formato": "CNAB 400",
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  },
  "cabecalho": {
    "banco": "341",
    "nomeBanco": "BANCO ITAU SA",
    "empresa": "Empresa Exemplo LTDA",
    "dataGeracao": "2024-01-15",
    "sequencial": "000001",
    "tipoArquivo": "RETORNO",
    "servico": "COBRANCA"
  },
  "registros": [
    {
      "sequencia": 1,
      "tipo": "transacao",
      "nossoNumero": "123456789",
      "codigoBarras": "34191234567890123456789012345678901234567890",
      "linhaDigitavel": "34191.23456 78901.234567 89012.345678 9 12345678901234567890",
      "valor": 100.50,
      "vencimento": "2024-01-30",
      "pagador": {
        "nome": "João da Silva",
        "documento": "12345678901",
        "endereco": "Rua das Flores, 123"
      },
      "recebedor": {
        "nome": "Empresa Exemplo LTDA",
        "documento": "12345678000123",
        "conta": "12345-6"
      },
      "status": "processado",
      "dataPagamento": null,
      "observacoes": ""
    }
  ],
  "resumo": {
    "totalRegistros": 1,
    "totalValor": 100.50,
    "totalComCodigoBarras": 1,
    "totalComLinhaDigitavel": 1,
    "totalPagos": 0,
    "totalPendentes": 1,
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🔧 Sistema de Retry

O sistema implementa retry automático com as seguintes características:

- **Tentativas:** Configurável via `WEBHOOK_RETRY_ATTEMPTS` (padrão: 3)
- **Delay:** Configurável via `WEBHOOK_RETRY_DELAY` (padrão: 5000ms)
- **Delay progressivo:** Cada tentativa aumenta o delay (tentativa × delay base)
- **Timeout:** Configurável via `WEBHOOK_TIMEOUT` (padrão: 30000ms)

## 🛡️ Headers Enviados

O webhook recebe os seguintes headers:

```
Content-Type: application/json
X-Webhook-Source: cnab-api
X-Webhook-Version: 1.0.0
User-Agent: CNAB-API-Webhook/1.0.0
```

## ⚠️ Tratamento de Erros

### Webhook Desabilitado
```json
{
  "sucesso": true,
  "mensagem": "CNAB processado com sucesso (webhook desabilitado)",
  "webhook": {
    "enviado": false,
    "motivo": "Webhook desabilitado na configuração"
  }
}
```

### URL Não Configurada
```json
{
  "sucesso": false,
  "erro": "URL do webhook não configurada",
  "codigo": "WEBHOOK_URL_OBRIGATORIA"
}
```

### Falha no Envio
```json
{
  "sucesso": false,
  "erro": "Falha no envio para webhook: Connection timeout",
  "codigo": "ERRO_WEBHOOK",
  "detalhes": {
    "cnabProcessado": true,
    "webhookEnviado": false
  }
}
```

## 🧪 Testando o Webhook

### 1. Teste com webhook.site
```bash
# Crie um endpoint temporário em https://webhook.site
# Configure no .env:
WEBHOOK_URL=https://webhook.site/seu-uuid-aqui
```

### 2. Teste local com ngrok
```bash
# Instale ngrok e exponha porta local
ngrok http 8080

# Configure no .env:
WEBHOOK_URL=https://seu-ngrok-url.ngrok.io/webhook
```

### 3. Teste com curl
```bash
curl -X POST http://localhost:3000/api/v1/cnab/processar-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "conteudo": "seu conteúdo CNAB aqui...",
    "webhookUrl": "https://webhook.site/seu-uuid"
  }'
```

## 📝 Logs

O sistema gera logs detalhados para debug:

```
🚀 Enviando dados CNAB para webhook: https://webhook.com/endpoint
📊 Total de registros: 150
🔄 Tentativa 1/3 - Enviando para webhook
✅ Webhook respondeu com status 200
✅ Dados enviados com sucesso para webhook
```

## 🔍 Validação de Configuração

O WebhookService inclui validação automática:

```javascript
const validacao = WebhookService.validarConfiguracao();
if (!validacao.valida) {
  console.error('Problemas na configuração:', validacao.problemas);
}
```

## 🚨 Troubleshooting

### Problema: Webhook não está sendo chamado
- ✅ Verifique se `WEBHOOK_ENABLED=true`
- ✅ Verifique se `WEBHOOK_URL` está configurada
- ✅ Verifique os logs da aplicação

### Problema: Timeout nas requisições
- ✅ Aumente `WEBHOOK_TIMEOUT`
- ✅ Verifique conectividade com o endpoint
- ✅ Teste o endpoint manualmente

### Problema: Muitas tentativas falhando
- ✅ Verifique se o endpoint está respondendo corretamente
- ✅ Ajuste `WEBHOOK_RETRY_ATTEMPTS` e `WEBHOOK_RETRY_DELAY`
- ✅ Verifique formato dos dados esperados pelo webhook 