# Processamento de Arquivos CNAB

Esta documentação descreve a implementação do processador de arquivos CNAB (Centro Nacional de Automação Bancária) no Payment Flow Mastermind. A implementação suporta os formatos CNAB 240 e CNAB 400 para arquivos de remessa e retorno de boletos e PIX.

## Estrutura de Arquivos

```
/src/lib/api/
├── index.ts                  # Exportações principais da API
├── cnabParser.ts             # Implementação do parser CNAB
├── cnabApi.ts                # Funções de API para upload e processamento
└── models/
    └── cnabLayouts.ts        # Definição dos layouts para diferentes bancos
```

## Formatos Suportados

- **CNAB 400**: Formato legado, com 400 caracteres por linha
  - Boletos (Bradesco)
  - PIX (Bradesco)
- **CNAB 240**: Formato mais recente, com 240 caracteres por linha
  - Implementação genérica Febraban

## Componentes principais

### 1. Parser CNAB (`cnabParser.ts`)

O parser CNAB é responsável por processar o conteúdo dos arquivos e convertê-los em estruturas de dados utilizáveis. Principais funcionalidades:

- Identificação automática do formato (CNAB 240 ou CNAB 400)
- Identificação do tipo de operação (remessa ou retorno)
- Identificação do banco (pelo código)
- Identificação do tipo de arquivo (boleto ou PIX)
- Extração estruturada de header, trailer e registros de detalhe

### 2. API CNAB (`cnabApi.ts`)

A API de CNAB expõe funções para:

- Validação de arquivos CNAB
- Processamento de arquivos CNAB
- Contagem de pagamentos e cálculo de valores totais

### 3. Layouts CNAB (`models/cnabLayouts.ts`)

Define a estrutura dos diferentes tipos de arquivos CNAB:

- Posições dos campos em cada linha
- Tipos de valores (texto, número, valor monetário, data)
- Layouts específicos por banco

## Uso da API

### Validação de arquivo

```typescript
import { validateCNABFile } from '@/lib/api';

// Verifica se o arquivo é um CNAB válido
const validationResult = await validateCNABFile(file);
if (validationResult.valid) {
  // Arquivo é válido, continue o processamento
} else {
  // Exiba o erro
  console.error(validationResult.error);
}
```

### Processamento de arquivo

```typescript
import { processUploadedCNABFile } from '@/lib/api';

// Processa o arquivo CNAB
const result = await processUploadedCNABFile(file);
if (result.success && result.data) {
  // Arquivo processado com sucesso
  const cnabFile = result.data;
  console.log(`Processados ${cnabFile.paymentCount} pagamentos totalizando ${cnabFile.totalAmount}`);
} else {
  // Exiba o erro
  console.error(result.error);
}
```

## Componente de Upload

O componente `FileUpload.tsx` fornece uma interface amigável para upload e processamento de arquivos CNAB:

- Suporte para arrastar e soltar arquivos
- Validação de formato e tamanho
- Feedback visual do progresso de processamento
- Indicação clara de sucesso ou erro
- Possibilidade de remover arquivos da lista

## Adicionando suporte para novos bancos

Para adicionar suporte a layouts de outros bancos, edite o arquivo `models/cnabLayouts.ts` e:

1. Crie uma nova constante com o layout específico do banco
2. Adicione o novo layout ao objeto `CNAB_LAYOUTS`

Exemplo:

```typescript
// Novo layout para banco X
export const CNAB400_BANCO_X = {
  header: { /* ... */ },
  detail: { /* ... */ },
  trailer: { /* ... */ }
};

// Adicione ao mapeamento de layouts
export const CNAB_LAYOUTS = {
  '400': {
    '237': { /* ... */ },
    'X': {  // Código do novo banco
      'boleto': CNAB400_BANCO_X,
    },
    'default': CNAB400_BRADESCO_BOLETO
  },
  // ...
};
``` 