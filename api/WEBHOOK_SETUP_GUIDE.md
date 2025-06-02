# 🔗 Guia Completo de Configuração do Webhook CNAB

## 🚨 **CORREÇÕES APLICADAS**

### ✅ **Problema Resolvido: Método Inexistente**
**Antes (ERRO):**
```javascript
// ❌ Método que não existe
await WebhookService.enviarDados(webhookUrl, dadosWebhook)
```

**Depois (CORRETO):**
```javascript
// ✅ Método correto com parâmetros na ordem certa
await WebhookService.enviarParaWebhook(dadosWebhook, webhookUrl)
```

### 📁 **Arquivos Corrigidos:**
- ✅ `api/src/controllers/cnab240Controller.js:650`
- ✅ `api/src/controllers/cnabUnifiedController.js:554`

## 🛠️ **CONFIGURAÇÃO ATUAL**

### **Arquivo `.env` (api/.env):**
```bash
# CONFIGURAÇÕES DO WEBHOOK
WEBHOOK_URL=https://sandbox-n8n-webhook.barte.com/webhook/cnab
WEBHOOK_CNAB_URL=https://sandbox-n8n-webhook.barte.com/webhook/cnab
WEBHOOK_ENABLED=true
WEBHOOK_TIMEOUT=30000
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_DELAY=5000

# CONFIGURAÇÕES DO SERVIDOR
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### **Prioridade de URLs:**
1. `webhookUrl` (parâmetro da requisição) - **MAIOR PRIORIDADE**
2. `WEBHOOK_CNAB_URL` (específica para CNAB)
3. `WEBHOOK_URL` (fallback geral)

## 🎯 **ENDPOINTS FUNCIONAIS**

### **1. Webhook Automático (CNAB 240/400)**
```bash
# Upload com detecção automática
curl -X POST http://localhost:8080/api/v1/cnab/webhook-auto/upload \
  -F "arquivo=@arquivo.txt" \
  -F "webhookUrl=https://seu-webhook.com/endpoint"

# Texto com detecção automática  
curl -X POST http://localhost:8080/api/v1/cnab/webhook-auto \
  -H "Content-Type: application/json" \
  -d '{
    "conteudo": "conteúdo CNAB...",
    "webhookUrl": "https://seu-webhook.com/endpoint"
  }'
```

### **2. Webhook CNAB 240 Específico**
```bash
# Upload CNAB 240
curl -X POST http://localhost:8080/api/v1/cnab240/processar-webhook \
  -F "arquivo=@arquivo240.txt" \
  -F "webhookUrl=https://seu-webhook.com/endpoint"

# Texto CNAB 240
curl -X POST http://localhost:8080/api/v1/cnab240/processar-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "conteudo": "conteúdo CNAB 240...",
    "webhookUrl": "https://seu-webhook.com/endpoint"
  }'
```

### **3. Webhook CNAB 400 (Legado)**
```bash
curl -X POST http://localhost:8080/api/v1/cnab/processar-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "conteudo": "conteúdo CNAB 400...",
    "webhookUrl": "https://seu-webhook.com/endpoint"
  }'
```

## 📊 **ESTRUTURA DOS DADOS ENVIADOS**

### **Para CNAB 240:**
```json
{
  "formato": "CNAB 240",
  "dadosEstruturados": {
    "arquivo": { "header": {...}, "trailer": {...} },
    "lotes": [
      {
        "header": {...},
        "detalhes": [...],
        "trailer": {...}
      }
    ]
  },
  "validacao": {
    "valido": true,
    "erros": [],
    "avisos": []
  },
  "somatorias": {
    "totalRegistros": 20,
    "totalLotes": 1,
    "valorTotal": 1500.00
  },
  "resumoProcessamento": {...},
  "informacoesArquivo": {...},
  "operationId": "op_1748787933811_sern9m12w",
  "dataProcessamento": "2025-06-01T14:25:33.816Z"
}
```

### **Para CNAB 400:**
```json
{
  "metadados": {
    "fonte": "CNAB 400 Itaú Parser API",
    "versao": "1.0.0",
    "dataProcessamento": "2025-06-01T14:25:33.816Z"
  },
  "arquivo": {
    "nome": "arquivo.txt",
    "tamanho": 4840,
    "formato": "CNAB 400"
  },
  "cabecalho": {...},
  "registros": [...],
  "resumo": {
    "totalRegistros": 10,
    "totalValor": 1000.50
  }
}
```

## 🔄 **SISTEMA DE RETRY**

### **Configurações:**
- **Tentativas:** 3 (configurável via `WEBHOOK_RETRY_ATTEMPTS`)
- **Timeout:** 30s (configurável via `WEBHOOK_TIMEOUT`)
- **Delay:** 5s base com progressão (configurável via `WEBHOOK_RETRY_DELAY`)
- **Delay Progressivo:** tentativa × delay base (5s, 10s, 15s)

### **Headers Enviados:**
```
Content-Type: application/json
User-Agent: CNAB-400-Itau-Parser-API/1.0.0
X-Webhook-Source: cnab-api
X-Webhook-Version: 1.0.0
X-Tentativa: 1
X-Operation-Id: op_1748787933811_sern9m12w
```

## 🧪 **TESTANDO O WEBHOOK**

### **1. Teste com webhook.site:**
```bash
# 1. Acesse https://webhook.site e copie sua URL única
# 2. Teste o endpoint:
curl -X POST http://localhost:8080/api/v1/cnab/webhook-auto/upload \
  -F "arquivo=@api/examples/pix85015.txt" \
  -F "webhookUrl=https://webhook.site/SEU-UUID-AQUI"
```

### **2. Verificar Logs:**
```bash
# Acompanhe os logs do servidor
tail -f api/logs/app.log

# Ou via console durante desenvolvimento
cd api && npm start
```

### **3. Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "mensagem": "Arquivo CNAB 240 processado e webhook enviado com sucesso",
  "webhook": {
    "enviado": true,
    "url": "https://webhook.site/test",
    "sucesso": true,
    "resposta": {
      "status": 200,
      "statusText": "OK"
    }
  }
}
```

## ⚠️ **TROUBLESHOOTING**

### **Erro: "WebhookService.enviarDados is not a function"**
✅ **RESOLVIDO** - Corrigido nos controllers para usar `enviarParaWebhook()`

### **Webhook não enviado:**
1. Verifique se `WEBHOOK_ENABLED=true`
2. Confirme se a URL está configurada
3. Teste a conectividade com a URL de destino

### **Timeout no webhook:**
1. Aumente `WEBHOOK_TIMEOUT` se necessário
2. Verifique se o endpoint de destino está respondendo
3. Considere usar um proxy/tunnel para testes locais

### **Dados não chegam no formato esperado:**
1. Verifique se está usando o endpoint correto (auto, 240, ou 400)
2. Confirme a estrutura esperada pelo seu webhook
3. Use webhook.site para debug da estrutura recebida

## 🔧 **CONFIGURAÇÕES AVANÇADAS**

### **Desabilitar Webhook Temporariamente:**
```bash
# No .env
WEBHOOK_ENABLED=false
```

### **Configurar Timeout Personalizado:**
```bash
# Para endpoints lentos (60 segundos)
WEBHOOK_TIMEOUT=60000
```

### **Aumentar Tentativas para APIs Instáveis:**
```bash
WEBHOOK_RETRY_ATTEMPTS=5
WEBHOOK_RETRY_DELAY=10000
```

---

## 🛡️ **PREVENÇÃO DE ERROS FUTUROS**

### **Ferramentas de Validação Criadas:**

#### **1. Script de Validação Automática**
```bash
# Executa validação completa do uso do WebhookService
npm run validate:webhook

# Executa todas as validações (lint + webhook + testes)
npm run validate:all
```

#### **2. Teste de Integração**
```bash
# Executa teste específico de validação da interface
npm test -- webhookService.integration.test.js
```

#### **3. Validação no CI/CD**
Adicione ao seu pipeline de CI/CD:
```yaml
# .github/workflows/ci.yml
- name: Validar uso do WebhookService
  run: npm run validate:webhook
```

### **O que as Validações Verificam:**

✅ **Método Correto:** Confirma uso de `enviarParaWebhook()`  
❌ **Métodos Incorretos:** Detecta uso de `enviarDados()` ou outros métodos inexistentes  
⚠️ **Ordem de Parâmetros:** Alerta sobre possível inversão de parâmetros  
🔍 **Interface Completa:** Valida que todos os métodos esperados estão disponíveis  

### **Exemplo de Saída da Validação:**
```
🔍 Validando uso do WebhookService...

📁 Analisando 5 arquivo(s) de controller...

📄 src/controllers/cnab240Controller.js
  ✅ 1 uso(s) correto(s) encontrado(s)

📊 Resumo da Validação:
  ✅ Usos corretos: 3
  ⚠️  Avisos: 0
  ❌ Problemas críticos: 0

🎉 SUCESSO: Todos os usos do WebhookService estão corretos!
```

### **Integração com Git Hooks:**
```bash
# Adicione ao .husky/pre-commit
npm run validate:webhook
```

---

## 📝 **CHANGELOG**

### **v1.2.0 - 2025-06-01**
- ✅ **PREVENÇÃO:** Criado script de validação automática (`validate-webhook-usage.js`)
- ✅ **TESTES:** Adicionado teste de integração para validar interface do WebhookService
- ✅ **NPM SCRIPTS:** Adicionados comandos `validate:webhook` e `validate:all`
- ✅ **CORREÇÃO:** Corrigido mock nos testes para usar `enviarParaWebhook`
- ✅ **DOCUMENTAÇÃO:** Expandido guia com ferramentas de prevenção

### **v1.1.0 - 2025-06-01**
- ✅ **CORREÇÃO CRÍTICA:** Substituído `WebhookService.enviarDados()` por `WebhookService.enviarParaWebhook()`
- ✅ **PADRONIZAÇÃO:** Unificada a assinatura de métodos entre todos os controllers
- ✅ **TESTE:** Validado funcionamento com webhook.site
- ✅ **DOCUMENTAÇÃO:** Criado guia completo de configuração 