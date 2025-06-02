/**
 * SwaggerSpec - Configuração da Documentação OpenAPI
 * 
 * Define a especificação OpenAPI/Swagger para auto-documentação
 * dos endpoints universais CNAB.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CNAB Universal API',
      version: '1.0.0',
      description: `
        API Universal para processamento de arquivos CNAB (Centro Nacional de Automação Bancária).
        
        **Características principais:**
        - ✅ Detecção automática de formato (CNAB240/CNAB400)
        - ✅ Suporte a todos os bancos brasileiros
        - ✅ Parsing completo com dados estruturados
        - ✅ Validação abrangente (estrutural, campos, integridade, negócio)
        - ✅ Upload otimizado para arquivos grandes
        - ✅ Respostas padronizadas com metadados ricos
        - ✅ Rastreamento de operações por ID único
        
        **Formatos suportados:**
        - CNAB240: Arquivos de 240 caracteres por linha
        - CNAB400: Arquivos de 400 caracteres por linha
        
        **Bancos suportados:**
        Todos os principais bancos brasileiros incluindo Itaú, Bradesco, Banco do Brasil, 
        Santander, Caixa, BTG Pactual, Safra, Sicoob, Sicredi e muitos outros.
      `,
      contact: {
        name: 'CNAB Universal API',
        email: 'dev@cnab-universal.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Servidor de produção'
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Servidor de desenvolvimento'
      }
    ],
    tags: [
      {
        name: 'CNAB Universal',
        description: 'Endpoints universais para processamento CNAB completo'
      },
      {
        name: 'Health Check',
        description: 'Endpoints de monitoramento e status da API'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Chave de API para autenticação (opcional)'
        }
      },
      parameters: {
        OperationId: {
          in: 'header',
          name: 'X-Operation-Id',
          schema: {
            type: 'string'
          },
          description: 'ID único para rastreamento da operação',
          example: 'op_1234567890_abc123'
        }
      },
      schemas: {
        UniversalResponse: {
          type: 'object',
          required: ['success', 'operation', 'timestamp'],
          properties: {
            success: {
              type: 'boolean',
              description: 'Indica se a operação foi bem-sucedida'
            },
            operation: {
              type: 'string',
              description: 'Nome da operação executada',
              example: 'processar'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp da resposta ISO 8601'
            },
            data: {
              type: 'object',
              description: 'Dados da resposta (varia por endpoint)'
            },
            metadata: {
              type: 'object',
              properties: {
                version: {
                  type: 'string',
                  example: '1.0.0',
                  description: 'Versão da API'
                },
                processedBy: {
                  type: 'string',
                  example: 'cnab-universal-api',
                  description: 'Sistema que processou a requisição'
                },
                operationId: {
                  type: 'string',
                  description: 'ID único da operação'
                },
                timing: {
                  type: 'object',
                  description: 'Tempos de processamento em milissegundos',
                  additionalProperties: {
                    type: 'string',
                    pattern: '^\\d+ms$'
                  }
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'operation', 'timestamp', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            operation: {
              type: 'string',
              example: 'processar'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            error: {
              type: 'object',
              required: ['message', 'code', 'type'],
              properties: {
                message: {
                  type: 'string',
                  description: 'Descrição do erro'
                },
                code: {
                  type: 'string',
                  description: 'Código do erro',
                  example: 'INVALID_FORMAT'
                },
                type: {
                  type: 'string',
                  description: 'Tipo/categoria do erro',
                  example: 'ValidationError'
                },
                details: {
                  type: 'object',
                  description: 'Detalhes adicionais do erro',
                  nullable: true
                }
              }
            },
            statusCode: {
              type: 'integer',
              description: 'Código de status HTTP',
              example: 400
            }
          }
        },
        DetectionResult: {
          type: 'object',
          required: ['format', 'bankCode', 'bankName', 'confidence'],
          properties: {
            format: {
              type: 'string',
              enum: ['CNAB240', 'CNAB400'],
              description: 'Formato detectado do arquivo'
            },
            bankCode: {
              type: 'string',
              pattern: '^\\d{3}$',
              description: 'Código do banco (3 dígitos)',
              example: '341'
            },
            bankName: {
              type: 'string',
              description: 'Nome do banco',
              example: 'Banco Itaú'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Confiança da detecção (0-100%)',
              example: 95
            },
            reason: {
              type: 'string',
              description: 'Motivo/detalhes da detecção',
              nullable: true
            }
          }
        },
        ValidationSummary: {
          type: 'object',
          properties: {
            isValid: {
              type: 'boolean',
              description: 'Se o arquivo passou em todas as validações'
            },
            score: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Score de qualidade do arquivo (0-100)'
            },
            totalErrors: {
              type: 'integer',
              minimum: 0,
              description: 'Total de erros encontrados'
            },
            totalWarnings: {
              type: 'integer',
              minimum: 0,
              description: 'Total de avisos encontrados'
            },
            errorsByCategory: {
              type: 'object',
              properties: {
                structural: {
                  type: 'integer',
                  description: 'Erros estruturais'
                },
                field: {
                  type: 'integer',
                  description: 'Erros de campo'
                },
                integrity: {
                  type: 'integer',
                  description: 'Erros de integridade'
                },
                business: {
                  type: 'integer',
                  description: 'Erros de regra de negócio'
                }
              }
            }
          }
        },
        BankInfo: {
          type: 'object',
          required: ['code', 'name', 'schemas', 'supported'],
          properties: {
            code: {
              type: 'string',
              pattern: '^\\d{3}$',
              description: 'Código do banco',
              example: '341'
            },
            name: {
              type: 'string',
              description: 'Nome do banco',
              example: 'Banco Itaú'
            },
            schemas: {
              type: 'object',
              properties: {
                cnab240: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Quantidade de schemas CNAB240'
                },
                cnab400: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Quantidade de schemas CNAB400'
                },
                total: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Total de schemas'
                }
              }
            },
            supported: {
              type: 'boolean',
              description: 'Se o banco é suportado pela API'
            },
            lastUpdated: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Data da última atualização dos schemas'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: [
    './src/routes/universal/*.js',  // Rotas universais
    './src/routes/*.js',            // Outras rotas
    './src/controllers/universal/*.js' // Controllers universais
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec; 