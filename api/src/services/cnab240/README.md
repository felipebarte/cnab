# Serviços CNAB 240

Este diretório contém todos os serviços responsáveis pelo processamento de arquivos CNAB 240.

## Estrutura

```
cnab240/
├── index.js              # Ponto de entrada principal
├── cnab240Service.js     # Serviço principal (Task #15)
├── parsers/              # Parsers específicos (Task #23)
│   ├── headerArquivoParser.js
│   ├── headerLoteParser.js
│   ├── segmentoParser.js
│   ├── segmentoBParser.js
│   └── trailerParser.js
├── validators/           # Validadores (Task #25)
│   ├── estruturaValidator.js
│   ├── integridadeValidator.js
│   ├── negocioValidator.js
│   └── bancoValidator.js
└── generators/           # Geradores (Task #22)
    └── cnab240Generator.js
```

## Características CNAB 240

- **Registros de 240 caracteres** (vs 400 do CNAB 400)
- **Estrutura hierárquica**: Arquivo > Lotes > Segmentos
- **Múltiplos segmentos**: A, B (B01-B04), J, O
- **Suporte a PIX**: Transferências e chaves PIX
- **Múltiplos bancos**: BB, Itaú, Santander, Caixa, Bradesco

## Próximas Implementações

1. **Task #11**: Parser base para registros 240
2. **Task #12**: Modelos de dados
3. **Task #23**: Parsers específicos por tipo
4. **Task #24**: Configurações por banco
5. **Task #15**: Serviço principal
6. **Task #25**: Validadores avançados 