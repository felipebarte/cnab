# API CNAB 400/240 Itaú Parser

Esta API permite processar arquivos CNAB 400 e **CNAB 240** do Itaú e outros bancos para extrair informações como códigos de barras, linhas digitáveis, dados de transferências PIX, além de enviar dados processados para webhooks externos.

## Base URL
```
http://localhost:3000/api/v1/cnab
```

## 🆕 **Novidades CNAB 240**

A API agora suporta completamente o formato **CNAB 240**, incluindo:
- ✅ **Processamento completo** de arquivos CNAB 240
- ✅ **Suporte a PIX** (Segmentos A e B)
- ✅ **Validação estrutural** avançada por banco
- ✅ **Múltiplos bancos** configurados
- ✅ **Detecção automática** de formato (240 vs 400)
- ✅ **Códigos de operação** específicos
- ✅ **Webhooks** para ambos os formatos

---

## **Endpoints CNAB 240**

### 1. Informações da API CNAB 240
```
GET /cnab240/info
```

**Resposta:**
```json
{
  "sucesso": true,
  "informacoes": {
    "nome": "API de Processamento CNAB 240",
    "versao": "1.0.0",
    "formato": "CNAB 240",
    "especificacao": "FEBRABAN CNAB 240 - Layout Padrão",
    "descricao": "API para processamento completo de arquivos CNAB 240 incluindo validação, estruturação e webhook",
    "recursos": {
      "processamento": "Processamento completo de arquivos CNAB 240",
      "validacao": "Validação estrutural e de dados",
      "formatos": "Consulta de formatos por banco",
      "webhook": "Envio de dados processados para webhook",
      "upload": "Suporte a upload de arquivos",
      "pix": "Processamento de transações PIX (Segmentos B)"
    },
    "endpoints": [
      {
        "metodo": "POST",
        "rota": "/api/v1/cnab240/processar",
        "descricao": "Processa arquivo CNAB 240 via texto",
        "parametros": ["conteudo", "opcoes?"]
      },
      {
        "metodo": "POST",
        "rota": "/api/v1/cnab240/processar (upload)",
        "descricao": "Processa arquivo CNAB 240 via upload",
        "parametros": ["arquivo", "opcoes?"]
      }
    ],
    "bancosSuportados": 5,
    "caracteristicas": {
      "formatoLinha": "240 caracteres fixos",
      "estruturaHierarquica": "Header → Lotes → Detalhes → Trailers",
      "suportePix": true,
      "validacaoCompleta": true,
      "webhook": true,
      "upload": true
    }
  }
}
```

### 2. Listar Bancos Suportados CNAB 240
```
GET /cnab240/formatos
```

**Resposta:**
```json
{
  "sucesso": true,
  "dados": {
    "totalBancos": 5,
    "bancosSuportados": [
      {
        "codigo": "341",
        "nome": "Banco Itaú S.A.",
        "versaoLayout": "087",
        "operacoesSuportadas": 8,
        "suportaPix": true,
        "tiposChavePix": 5
      },
      {
        "codigo": "237",
        "nome": "Banco Bradesco S.A.",
        "versaoLayout": "087",
        "operacoesSuportadas": 6,
        "suportaPix": true,
        "tiposChavePix": 5
      }
    ],
    "estatisticas": {
      "comSuportePix": 5,
      "semSuportePix": 0,
      "mediaOperacoesPorBanco": 7.2
    },
    "formato": "CNAB 240"
  }
}
```

### 3. Informações de Formato Específico do Banco
```
GET /cnab240/formatos/:banco
```

**Exemplo: GET /cnab240/formatos/341**

**Resposta:**
```json
{
  "sucesso": true,
  "banco": "341",
  "formato": {
    "banco": {
      "codigo": "341",
      "nome": "Banco Itaú S.A.",
      "versaoLayout": "087"
    },
    "operacoesSuportadas": [
      "201303", "203003", "203103", "204504", "204704", "221903", "229103"
    ],
    "codigosOperacao": {
      "204504": {
        "nome": "PIX Transferência",
        "descricao": "Transferência via PIX",
        "segmentosObrigatorios": ["A", "B"],
        "pix": true
      }
    },
    "caracteristicas": {
      "suportaPix": true,
      "tiposChavePix": ["CPF", "CNPJ", "EMAIL", "TELEFONE", "UUID"],
      "formatoLinha": "240 caracteres fixos",
      "estrutura": "Header Arquivo → Lotes (Header + Detalhes + Trailer) → Trailer Arquivo"
    }
  }
}
```

### 4. Processar Arquivo CNAB 240 (Texto)
```
POST /cnab240/processar
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_cnab_240_caracteres...\nlinha2_cnab_240_caracteres...",
  "opcoes": {
    "validarEstrutura": true,
    "extrairPix": true,
    "incluirDetalhesSegmentos": true
  }
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "sucesso": true,
    "dadosEstruturados": {
      "arquivo": {
        "header": {
          "codigoBanco": "341",
          "nomeEmpresa": "EMPRESA EXEMPLO LTDA",
          "dataGeracao": "15012024",
          "horaGeracao": "103000"
        },
        "trailer": {
          "quantidadeLotes": 1,
          "quantidadeRegistros": 5
        }
      },
      "lotes": [
        {
          "sequencia": 1,
          "header": {
            "tipoOperacao": "C",
            "tipoServico": "20",
            "codigoConvenio": "204504"
          },
          "detalhes": [
            {
              "segmentoA": {
                "nomeFavorecido": "JOAO SILVA",
                "bancoFavorecido": "341",
                "agenciaFavorecido": "1234",
                "contaFavorecido": "567890",
                "valorPagamento": "15050"
              },
              "segmentoB": {
                "subtipo": "B03",
                "chavePix": "11122233344",
                "tipoChave": "CPF",
                "dadosPix": {
                  "endToEnd": "E34112024011510300000000001",
                  "identificadorTxid": "PIX123456789"
                }
              }
            }
          ],
          "trailer": {
            "quantidadeRegistros": 3,
            "somatoriaValores": "15050"
          }
        }
      ]
    },
    "validacao": {
      "valido": true,
      "estrutura": "válida",
      "integridade": "válida",
      "banco": "válido"
    },
    "informacoesArquivo": {
      "formato": "CNAB 240",
      "banco": "341",
      "nomeBanco": "Banco Itaú S.A.",
      "totalLinhas": 5,
      "versaoLayout": "087"
    }
  }
}
```

### 5. Upload de Arquivo CNAB 240
```
POST /cnab240/processar (upload)
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `arquivo`: Arquivo CNAB 240 (.rem, .ret, .txt ou sem extensão)
- `opcoes`: JSON string com opções (opcional)

**Exemplo opcoes:**
```json
{
  "validarEstrutura": true,
  "extrairPix": true,
  "incluirDetalhesSegmentos": true
}
```

### 6. Validar Arquivo CNAB 240
```
POST /cnab240/validar
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_cnab_240_caracteres...\nlinha2_cnab_240_caracteres..."
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "valido": true,
  "erros": [],
  "avisos": ["Banco 341 suporta operações PIX"],
  "informacoesBasicas": {
    "banco": "Banco Itaú S.A.",
    "codigoBanco": "341",
    "totalLinhas": 5,
    "totalLotes": 1,
    "formato": "CNAB 240"
  }
}
```

### 7. Processar CNAB 240 e Enviar para Webhook (Texto)
```
POST /cnab240/processar-webhook
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_cnab_240_caracteres...\nlinha2_cnab_240_caracteres...",
  "webhookUrl": "https://meu-webhook.com/cnab240",
  "opcoes": {
    "validarEstrutura": true,
    "extrairPix": true
  }
}
```

### 8. Processar CNAB 240 e Enviar para Webhook (Upload)
```
POST /cnab240/processar-webhook/upload
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `arquivo`: Arquivo CNAB 240
- `webhookUrl`: URL do webhook (opcional)
- `opcoes`: Opções como JSON string (opcional)

---

## **Endpoints Unificados (Detecção Automática)**

### 9. Processar com Detecção Automática (Upload)
```
POST /processar-auto/upload
```

**Descrição:** Detecta automaticamente se o arquivo é CNAB 240 ou 400 e processa adequadamente.

**Form Data:**
- `arquivo`: Arquivo CNAB (240 ou 400)

**Resposta:**
```json
{
  "sucesso": true,
  "formatoDetectado": {
    "codigo": "CNAB_240",
    "nome": "CNAB 240",
    "confianca": 100,
    "indicadores": [
      "240 caracteres por linha",
      "Estrutura hierárquica identificada",
      "Headers e trailers corretos"
    ]
  },
  "dados": {
    "// dados processados conforme formato detectado"
  }
}
```

### 10. Processar com Detecção Automática (JSON)
```
POST /processar-auto
```

**Body:**
```json
{
  "conteudo": "linhas_cnab_240_ou_400..."
}
```

### 11. Detectar Formato Apenas
```
POST /detectar-formato
```

**Body:**
```json
{
  "conteudo": "primeiras_linhas_do_arquivo..."
}
```

**Resposta:**
```json
{
  "sucesso": true,
  "formato": {
    "codigo": "CNAB_240",
    "nome": "CNAB 240",
    "confianca": 95,
    "caracteristicas": {
      "tamanhoLinha": 240,
      "estrutura": "hierárquica",
      "tiposRegistro": ["0", "1", "3", "5", "9"]
    }
  }
}
```

---

## **Diferenças CNAB 240 vs CNAB 400**

| Característica | CNAB 400 | CNAB 240 |
|---|---|---|
| **Tamanho da Linha** | 400 caracteres | 240 caracteres |
| **Estrutura** | Sequencial simples | Hierárquica (Arquivo → Lotes → Detalhes) |
| **Registros** | Header + Detalhes + Trailer | Header Arquivo + Lotes + Trailer Arquivo |
| **Suporte PIX** | ❌ Não | ✅ Sim (Segmentos A e B) |
| **Bancos Suportados** | Itaú (341) | Itaú, Bradesco, Santander, BB, CEF |
| **Segmentos** | Não aplicável | A, B, J, O |
| **Códigos de Operação** | Limitado | Múltiplos (201303, 204504, etc.) |
| **Validação** | Básica | Avançada (estrutural + negócio) |
| **Limite de Arquivo** | 5MB | 20MB |

### Quando Usar Cada Formato

**Use CNAB 400 quando:**
- Processando arquivos legados do Itaú
- Focado em cobrança tradicional
- Estrutura simples é suficiente

**Use CNAB 240 quando:**
- Processando PIX
- Múltiplos bancos
- Operações complexas (transferências, tributos)
- Validação rigorosa é necessária
- Estrutura hierárquica é importante

---

## **Guia de Integração CNAB 240**

### 1. Fluxo Básico

```javascript
// 1. Detectar formato automaticamente
const deteccao = await fetch('/api/v1/cnab/detectar-formato', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conteudo: primeiraLinhaArquivo })
});

const formato = await deteccao.json();

// 2. Processar conforme formato detectado
if (formato.formato.codigo === 'CNAB_240') {
  const resultado = await fetch('/api/v1/cnab240/processar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conteudo: arquivoCompleto,
      opcoes: {
        validarEstrutura: true,
        extrairPix: true
      }
    })
  });
}
```

### 2. Tratamento de Erros

```javascript
try {
  const response = await fetch('/api/v1/cnab240/processar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conteudo })
  });
  
  const result = await response.json();
  
  if (!result.sucesso) {
    // Tratar erro específico
    switch (result.codigo) {
      case 'BANCO_NAO_SUPORTADO':
        console.error('Banco não configurado:', result.banco);
        break;
      case 'ESTRUTURA_INVALIDA':
        console.error('Estrutura inválida:', result.erros);
        break;
      default:
        console.error('Erro geral:', result.erro);
    }
  }
} catch (error) {
  console.error('Erro de rede:', error);
}
```

### 3. Webhook para CNAB 240

```javascript
// Configurar webhook para receber dados CNAB 240
app.post('/webhook/cnab240', (req, res) => {
  const dadosCnab240 = req.body;
  
  console.log('CNAB 240 recebido:', {
    banco: dadosCnab240.arquivo.header.codigoBanco,
    totalLotes: dadosCnab240.lotes.length,
    operationId: req.headers['x-operation-id']
  });
  
  // Processar lotes
  dadosCnab240.lotes.forEach(lote => {
    console.log(`Lote ${lote.sequencia}:`, {
      tipoOperacao: lote.header.tipoOperacao,
      codigoConvenio: lote.header.codigoConvenio,
      totalDetalhes: lote.detalhes.length,
      valorTotal: lote.totalizadores.valorTotal
    });
    
    // Processar transações PIX
    lote.detalhes.forEach(detalhe => {
      if (detalhe.segmentoB?.dadosPix) {
        console.log('PIX encontrado:', {
          chavePix: detalhe.segmentoB.chavePix,
          tipoChave: detalhe.segmentoB.tipoChave,
          valor: detalhe.segmentoA.valorPagamento,
          endToEnd: detalhe.segmentoB.dadosPix.endToEnd
        });
      }
    });
  });
  
  res.json({ success: true, processedAt: new Date() });
});
```

---

## **Especificações Técnicas CNAB 240**

### Estrutura Hierárquica

```
Header de Arquivo (Tipo 0)
├── Lote 1
│   ├── Header de Lote (Tipo 1)
│   ├── Detalhes (Tipo 3)
│   │   ├── Segmento A (Dados principais)
│   │   └── Segmento B (Dados complementares/PIX)
│   └── Trailer de Lote (Tipo 5)
├── Lote 2...
└── Trailer de Arquivo (Tipo 9)
```

### Segmentos Suportados

| Segmento | Descrição | Uso |
|---|---|---|
| **A** | Dados principais do pagamento/crédito | Obrigatório |
| **B** | Dados complementares (PIX, endereços) | Opcional/PIX |
| **J** | Dados de títulos de cobrança | Cobrança |
| **O** | Dados de pagamento de tributos | Tributos |

### Códigos de Operação

| Código | Nome | Descrição | Segmentos |
|---|---|---|---|
| `201303` | Pagamento de Tributos | Impostos, taxas | A, O |
| `203003` | Cobrança (Títulos) | Boletos, títulos | A, J |
| `204504` | PIX Transferência | PIX imediato | A, B |
| `204704` | PIX Programado | PIX agendado | A, B |
| `221903` | Operação Especial | Específicas do banco | A, B |

### Tipos de Chave PIX

| Tipo | Formato | Validação | Exemplo |
|---|---|---|---|
| `CPF` | 11 dígitos | /^\d{11}$/ | 12345678901 |
| `CNPJ` | 14 dígitos | /^\d{14}$/ | 12345678000199 |
| `EMAIL` | Email válido | RFC 5322 | user@example.com |
| `TELEFONE` | 10-13 dígitos | +55XXXXXXXXXXX | +5511999999999 |
| `UUID` | UUID v4 | RFC 4122 | 550e8400-e29b-41d4-a716-446655440000 |

### Bancos Configurados

| Código | Nome | PIX | Operações |
|---|---|---|---|
| `341` | Banco Itaú S.A. | ✅ | 8 |
| `237` | Banco Bradesco S.A. | ✅ | 6 |
| `033` | Banco Santander Brasil S.A. | ✅ | 7 |
| `001` | Banco do Brasil S.A. | ✅ | 8 |
| `104` | Caixa Econômica Federal | ✅ | 6 |

### Limitações CNAB 240

- Arquivos de upload limitados a **20MB** (vs 5MB no CNAB 400)
- Máximo de **999 lotes** por arquivo
- Máximo de **99999 detalhes** por lote
- Cada linha deve ter exatamente **240 caracteres**
- Codificação: **UTF-8** ou **ASCII**
- Timeout para webhook: **30 segundos**

### Performance Esperada

| Operação | Tempo Médio | Limite |
|---|---|---|
| Processamento CNAB 240 (1000 linhas) | 2-5 segundos | 30s |
| Validação estrutural | 1-2 segundos | 10s |
| Upload de arquivo (10MB) | 5-10 segundos | 60s |
| Webhook delivery | 1-3 segundos | 30s |

### Códigos de Erro CNAB 240

| Código | HTTP | Descrição | Solução |
|---|---|---|---|
| `BANCO_NAO_SUPORTADO` | 400 | Banco não configurado no sistema | Verificar se o código do banco está na lista suportada |
| `ESTRUTURA_INVALIDA` | 400 | Estrutura hierárquica incorreta | Validar headers, lotes e trailers |
| `LINHA_TAMANHO_INCORRETO` | 400 | Linha não tem 240 caracteres | Verificar formatação das linhas |
| `TIPO_REGISTRO_INVALIDO` | 400 | Tipo de registro não reconhecido | Tipos válidos: 0, 1, 3, 5, 9 |
| `SEGMENTO_INVALIDO` | 400 | Segmento não suportado | Segmentos válidos: A, B, J, O |
| `OPERACAO_NAO_SUPORTADA` | 400 | Código de operação inválido | Verificar operações suportadas pelo banco |
| `PIX_ESTRUTURA_INVALIDA` | 400 | Dados PIX malformados | Validar segmento B e chave PIX |
| `CHAVE_PIX_INVALIDA` | 400 | Formato de chave PIX incorreto | Verificar formato conforme tipo |
| `ARQUIVO_MUITO_GRANDE` | 413 | Arquivo excede 20MB | Reduzir tamanho do arquivo |
| `TIMEOUT_WEBHOOK` | 504 | Webhook não respondeu em 30s | Verificar disponibilidade do endpoint |
| `LOTES_EXCESSO` | 400 | Mais de 999 lotes no arquivo | Dividir arquivo em menores |
| `DETALHES_EXCESSO` | 400 | Mais de 99999 detalhes por lote | Reduzir detalhes por lote |

---

## **Endpoints CNAB 400 (Mantidos para Compatibilidade)**

## Endpoints Disponíveis

### 1. Informações da API
```
GET /info
```

**Resposta:**
```json
{
  "sucesso": true,
  "api": "CNAB 400 Itaú Parser API",
  "versao": "1.0.0",
  "banco": "Itaú",
  "formato": "CNAB 400",
  "funcionalidades": [
    "Processamento de arquivos CNAB 400",
    "Extração de códigos de barras",
    "Extração de linhas digitáveis",
    "Validação de arquivos CNAB",
    "Upload de arquivos",
    "Processamento via texto",
    "Envio para webhook externo",
    "Sistema de retry automático",
    "Formatação estruturada de dados"
  ],
  "endpoints": {
    "POST /api/v1/cnab/processar": "Processa conteúdo CNAB via texto",
    "POST /api/v1/cnab/upload": "Processa arquivo CNAB via upload",
    "POST /api/v1/cnab/processar-webhook": "Processa CNAB via texto e envia para webhook",
    "POST /api/v1/cnab/processar-webhook/upload": "Processa arquivo CNAB e envia para webhook",
    "POST /api/v1/cnab/codigos-barras": "Extrai códigos de barras",
    "POST /api/v1/cnab/linhas-digitaveis": "Extrai linhas digitáveis",
    "POST /api/v1/cnab/validar": "Valida arquivo CNAB",
    "GET /api/v1/cnab/info": "Informações sobre a API"
  }
}
```

### 2. Processar Conteúdo CNAB (Texto)
```
POST /processar
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_do_cnab_400_caracteres...\nlinha2_do_cnab_400_caracteres..."
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "sucesso": true,
    "dados": [...],
    "totalRegistros": 10,
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  },
  "validacao": {
    "valido": true,
    "totalLinhas": 10,
    "formato": "CNAB 400"
  }
}
```

### 3. Upload de Arquivo CNAB
```
POST /upload
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `arquivo`: Arquivo CNAB (.rem, .ret, .txt ou sem extensão)

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "sucesso": true,
    "dados": [...],
    "totalRegistros": 10,
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  },
  "arquivo": {
    "nome": "retorno_itau.rem",
    "tamanho": 12500,
    "formato": "CNAB 400"
  }
}
```

### 4. Processar CNAB e Enviar para Webhook (Texto)
```
POST /processar-webhook
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_do_cnab_400_caracteres...\nlinha2_do_cnab_400_caracteres...",
  "webhookUrl": "https://meu-webhook.com/cnab" // Opcional
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "sucesso": true,
    "dados": [...],
    "totalRegistros": 10,
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  },
  "webhook": {
    "enviado": true,
    "tentativas": 1,
    "tempoResposta": 1250,
    "operationId": "op-1642252800000-abc123",
    "timestamp": "2024-01-15T10:30:01.250Z",
    "response": {
      "status": 200,
      "statusText": "OK",
      "headers": {
        "content-type": "application/json"
      }
    }
  }
}
```

**Dados Enviados para o Webhook:**
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
    "nome": "arquivo_cnab.txt",
    "tamanho": 12500,
    "formato": "CNAB 400",
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  },
  "cabecalho": {
    "banco": "341",
    "nomeBanco": "BANCO ITAU SA",
    "empresa": "Empresa não identificada",
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
      "linhaDigitavel": "34191.23456 78901.234567 89012.345678 9 01234567890123",
      "valor": 150.50,
      "vencimento": "2024-02-15T00:00:00.000Z",
      "pagador": {
        "nome": "João Silva",
        "documento": "12345678901",
        "endereco": "Rua Teste, 123"
      },
      "recebedor": {
        "nome": "Empresa XYZ",
        "documento": "12345678000199",
        "conta": "12345-6"
      },
      "status": "pago",
      "dataPagamento": "2024-01-15T00:00:00.000Z"
    }
  ],
  "resumo": {
    "totalRegistros": 1,
    "totalValor": 150.50,
    "totalComCodigoBarras": 1,
    "totalComLinhaDigitavel": 1,
    "totalPagos": 1,
    "totalPendentes": 0,
    "valorMedio": 150.50,
    "maiorValor": 150.50,
    "menorValor": 150.50
  }
}
```

### 5. Processar CNAB e Enviar para Webhook (Upload)
```
POST /processar-webhook/upload
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `arquivo`: Arquivo CNAB (.rem, .ret, .txt ou sem extensão)
- `webhookUrl`: URL do webhook (opcional)

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "sucesso": true,
    "dados": [...],
    "totalRegistros": 10,
    "dataProcessamento": "2024-01-15T10:30:00.000Z"
  },
  "arquivo": {
    "nome": "retorno_itau.rem",
    "tamanho": 12500,
    "formato": "CNAB 400"
  },
  "webhook": {
    "enviado": true,
    "tentativas": 2,
    "tempoResposta": 2100,
    "operationId": "op-1642252800000-def456"
  }
}
```

### 6. Extrair Códigos de Barras
```
POST /codigos-barras
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_do_cnab_400_caracteres...\nlinha2_do_cnab_400_caracteres..."
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "codigosBarras": [
    {
      "codigoBarras": "34191234567890123456789012345678901234",
      "valor": "150.50",
      "vencimento": "2024-02-15",
      "nossoNumero": "12345678"
    }
  ],
  "total": 1,
  "dataProcessamento": "2024-01-15T10:30:00.000Z"
}
```

### 7. Extrair Linhas Digitáveis
```
POST /linhas-digitaveis
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_do_cnab_400_caracteres...\nlinha2_do_cnab_400_caracteres..."
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "linhasDigitaveis": [
    {
      "linhaDigitavel": "34191.23456 78901.234567 78901.234567 8 90120000015050",
      "valor": "150.50",
      "vencimento": "2024-02-15",
      "nossoNumero": "12345678"
    }
  ],
  "total": 1,
  "dataProcessamento": "2024-01-15T10:30:00.000Z"
}
```

### 8. Validar Arquivo CNAB
```
POST /validar
```

**Body (JSON):**
```json
{
  "conteudo": "linha1_do_cnab_400_caracteres...\nlinha2_do_cnab_400_caracteres..."
}
```

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": true,
    "totalLinhas": 10,
    "formato": "CNAB 400"
  }
}
```

**Resposta de Erro:**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": false,
    "erro": "Arquivo contém 2 linha(s) com tamanho inválido. CNAB 400 deve ter 400 caracteres por linha"
  }
}
```

## Configuração de Webhook

### Variáveis de Ambiente

Para utilizar a funcionalidade de webhook, configure as seguintes variáveis:

```bash
# URL padrão do webhook (obrigatória se não fornecer na requisição)
WEBHOOK_CNAB_URL=https://meu-webhook.com/cnab
# ou
WEBHOOK_URL=https://meu-webhook.com/endpoint

# Configurações opcionais
WEBHOOK_ENABLED=true                    # Habilita/desabilita webhook (padrão: true)
WEBHOOK_TIMEOUT=30000                   # Timeout em ms (padrão: 30000)
WEBHOOK_RETRY_ATTEMPTS=3                # Número de tentativas (padrão: 3)
WEBHOOK_RETRY_DELAY=5000               # Delay entre tentativas em ms (padrão: 5000)
```

### Sistema de Retry

O webhook implementa um sistema de retry automático:

- **Tentativas**: Configurável via `WEBHOOK_RETRY_ATTEMPTS` (padrão: 3)
- **Delay Progressivo**: Aumenta a cada tentativa (5s, 10s, 15s...)
- **Tipos de Erro Elegíveis para Retry**:
  - Erros de rede (ECONNREFUSED, ENOTFOUND, etc.)
  - Timeouts (ECONNABORTED)
  - Erros HTTP 5xx (500, 502, 503, etc.)

### Headers HTTP Enviados

```http
Content-Type: application/json
User-Agent: CNAB-400-Itau-Parser-API/1.0.0
X-Webhook-Source: cnab-api
X-Webhook-Version: 1.0.0
X-Operation-Id: op-1642252800000-abc123
```

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `ARQUIVO_OBRIGATORIO` | Nenhum arquivo foi enviado no upload |
| `CONTEUDO_OBRIGATORIO` | Campo 'conteudo' é obrigatório |
| `ARQUIVO_INVALIDO` | Arquivo CNAB não passou na validação |
| `CONTEUDO_INVALIDO` | Conteúdo CNAB não passou na validação |
| `ERRO_PROCESSAMENTO` | Erro durante o processamento do CNAB |
| `ERRO_EXTRACAO` | Erro durante a extração de dados |
| `ERRO_VALIDACAO` | Erro durante a validação |
| `ERRO_INFORMACOES` | Erro ao obter informações da API |
| `WEBHOOK_URL_OBRIGATORIA` | URL do webhook não configurada |
| `WEBHOOK_TIMEOUT` | Timeout na requisição para webhook |
| `WEBHOOK_AUTH_ERROR` | Erro de autenticação no webhook |
| `WEBHOOK_ERROR` | Erro genérico no envio para webhook |
| `WEBHOOK_NETWORK_ERROR` | Erro de rede ao conectar com webhook |

## Exemplos de Uso

### Usando curl para upload de arquivo:
```bash
curl -X POST \
  http://localhost:3000/api/v1/cnab/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'arquivo=@/caminho/para/arquivo.rem'
```

### Usando curl para processar conteúdo:
```bash
curl -X POST \
  http://localhost:3000/api/v1/cnab/processar \
  -H 'Content-Type: application/json' \
  -d '{
    "conteudo": "sua_linha_cnab_400_caracteres_aqui..."
  }'
```

### Usando curl para extrair códigos de barras:
```bash
curl -X POST \
  http://localhost:3000/api/v1/cnab/codigos-barras \
  -H 'Content-Type: application/json' \
  -d '{
    "conteudo": "sua_linha_cnab_400_caracteres_aqui..."
  }'
```

### Usando curl para processar e enviar para webhook (texto):
```bash
curl -X POST \
  http://localhost:3000/api/v1/cnab/processar-webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "conteudo": "sua_linha_cnab_400_caracteres_aqui...",
    "webhookUrl": "https://meu-webhook.com/cnab"
  }'
```

### Usando curl para processar e enviar para webhook (upload):
```bash
curl -X POST \
  http://localhost:3000/api/v1/cnab/processar-webhook/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'arquivo=@/caminho/para/arquivo.rem' \
  -F 'webhookUrl=https://meu-webhook.com/cnab'
```

### Exemplo usando JavaScript/fetch:
```javascript
// Processar CNAB e enviar para webhook
const response = await fetch('http://localhost:3000/api/v1/cnab/processar-webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    conteudo: cnabContent,
    webhookUrl: 'https://meu-webhook.com/cnab' // Opcional se configurado no .env
  })
});

const result = await response.json();

if (result.webhook.enviado) {
  console.log(`Webhook enviado com sucesso em ${result.webhook.tentativas} tentativa(s)`);
  console.log(`Tempo de resposta: ${result.webhook.tempoResposta}ms`);
} else {
  console.log(`Webhook não enviado: ${result.webhook.motivo}`);
}
```

### Exemplo de webhook receiver (Node.js/Express):
```javascript
app.post('/meu-webhook/cnab', (req, res) => {
  const dadosCnab = req.body;
  
  console.log('Dados CNAB recebidos:', {
    fonte: dadosCnab.metadados.fonte,
    totalRegistros: dadosCnab.resumo.totalRegistros,
    totalValor: dadosCnab.resumo.totalValor,
    operationId: req.headers['x-operation-id']
  });
  
  // Processar dados...
  
  // Resposta de sucesso
  res.status(200).json({
    success: true,
    message: 'Dados CNAB processados com sucesso',
    processedAt: new Date().toISOString()
  });
});
```

## Limitações

- Arquivos de upload limitados a 5MB
- Suporte apenas para CNAB 400 do Itaú
- Formatos de arquivo aceitos: .rem, .ret, .txt ou sem extensão
- Cada linha do arquivo CNAB deve ter exatamente 400 caracteres
- Timeout padrão para webhook: 30 segundos
- Máximo de 10 tentativas de retry para webhook
- Delay mínimo entre tentativas: 1 segundo

## Segurança

### Headers de Segurança
- A API inclui headers de identificação em todas as requisições de webhook
- Operation ID único para rastreamento de cada operação
- User-Agent específico para identificação da fonte

### Validação
- Validação rigorosa do formato CNAB antes do processamento
- Sanitização de dados antes do envio para webhook
- Timeout configurável para evitar requisições indefinidas

### Logs e Monitoramento
- Logs detalhados de todas as operações de webhook
- Rastreamento de tentativas e falhas
- Métricas de performance e tempo de resposta

## Dependências

- **cnab400-itau-parser**: Biblioteca principal para processamento de arquivos CNAB 400 do Itaú
- **multer**: Para upload de arquivos
- **express**: Framework web para Node.js
- **axios**: Cliente HTTP para envio de webhooks 