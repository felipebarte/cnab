# Testes CNAB 240

Este diretório contém todos os testes automatizados para as funcionalidades CNAB 240.

## Estrutura de Testes

```
cnab240/
├── unit/                    # Testes unitários
│   ├── parsers/            # Testes dos parsers
│   ├── validators/         # Testes dos validadores
│   ├── models/             # Testes dos modelos
│   └── services/           # Testes dos serviços
├── integration/            # Testes de integração
│   ├── cnab240Controller.test.js
│   ├── endpoints.test.js
│   └── upload.test.js
├── fixtures/               # Arquivos de teste
│   ├── valid/              # Arquivos CNAB 240 válidos
│   │   ├── itau_pix.txt
│   │   ├── bb_cobranca.txt
│   │   └── santander_tributos.txt
│   ├── invalid/            # Arquivos com erros
│   │   ├── estrutura_invalida.txt
│   │   ├── somatoria_incorreta.txt
│   │   └── segmento_ausente.txt
│   └── performance/        # Arquivos grandes para teste de performance
│       └── arquivo_10k_registros.txt
└── README.md               # Este arquivo
```

## Fixtures Baseadas nos Exemplos

Os arquivos de teste serão criados baseados nos exemplos reais encontrados em `api/examples/`:

### Arquivos PIX (204504, 204704)
- `pix85015.txt`, `pix32946.txt`, etc.
- Testes de transferências PIX
- Validação de chaves PIX (CPF, email, telefone, UUID)

### Arquivos REM (203003, 203103, 201303)
- `rem92563.txt`, `rem41017.txt`, etc.
- Testes de cobrança e tributos
- Validação de segmentos específicos

## Tipos de Teste

1. **Testes Unitários**: Cada componente isoladamente
2. **Testes de Integração**: Fluxo completo da API
3. **Testes de Performance**: Arquivos grandes e velocidade
4. **Testes de Compatibilidade**: Diferentes bancos e formatos

## Meta de Cobertura

- **Cobertura mínima**: 90%
- **Cobertura de linhas críticas**: 100%
- **Testes de todos os códigos de operação identificados**

## Implementação

Os testes serão implementados na **Task #19** usando Jest e supertest para os testes de API. 