# API CNAB 400 Itaú Parser

Uma API Node.js moderna para processar arquivos CNAB 400 do Itaú, extraindo informações como códigos de barras e linhas digitáveis.

## 🚀 Funcionalidades

- ✅ **Processamento de arquivos CNAB 400** do Itaú
- ✅ **Upload de arquivos** (.rem, .ret, .txt)
- ✅ **Processamento via texto** (JSON)
- ✅ **Extração de códigos de barras**
- ✅ **Extração de linhas digitáveis**
- ✅ **Validação de arquivos CNAB**
- ✅ **API RESTful** com documentação completa
- ✅ **Tratamento de erros** robusto
- ✅ **Rate limiting** e segurança

## 📋 Pré-requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd cnab
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (opcional):
```bash
cp .env.example .env
# Edite o arquivo .env conforme necessário
```

## 🚀 Uso

### Iniciar o servidor

```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

O servidor estará disponível em `http://localhost:8080`

### Endpoints Disponíveis

#### 1. Informações da API
```bash
GET /api/v1/cnab/info
```

#### 2. Upload de Arquivo CNAB
```bash
POST /api/v1/cnab/upload
Content-Type: multipart/form-data

# Exemplo com curl
curl -X POST http://localhost:8080/api/v1/cnab/upload \
  -F "arquivo=@caminho/para/arquivo.rem"
```

#### 3. Processar Conteúdo CNAB (Texto)
```bash
POST /api/v1/cnab/processar
Content-Type: application/json

{
  "conteudo": "linha1_cnab_400_caracteres...\nlinha2_cnab_400_caracteres..."
}
```

#### 4. Extrair Códigos de Barras
```bash
POST /api/v1/cnab/codigos-barras
Content-Type: application/json

{
  "conteudo": "conteudo_cnab_aqui..."
}
```

#### 5. Extrair Linhas Digitáveis
```bash
POST /api/v1/cnab/linhas-digitaveis
Content-Type: application/json

{
  "conteudo": "conteudo_cnab_aqui..."
}
```

#### 6. Validar Arquivo CNAB
```bash
POST /api/v1/cnab/validar
Content-Type: application/json

{
  "conteudo": "conteudo_cnab_aqui..."
}
```

## 📖 Documentação Completa

Para documentação detalhada da API, consulte: [CNAB_API_DOCS.md](./CNAB_API_DOCS.md)

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com coverage
npm run test:coverage
```

## 🛠️ Desenvolvimento

```bash
# Linting
npm run lint
npm run lint:fix

# Formatação de código
npm run format
npm run format:check
```

## 📁 Estrutura do Projeto

```
cnab/
├── src/
│   ├── controllers/     # Controladores da API
│   ├── services/        # Lógica de negócio
│   ├── routes/          # Definição das rotas
│   ├── middleware/      # Middlewares customizados
│   ├── config/          # Configurações
│   ├── models/          # Modelos de dados
│   └── utils/           # Utilitários
├── examples/            # Arquivos de exemplo
├── tests/               # Testes automatizados
└── docs/                # Documentação adicional
```

## 🔒 Segurança

- **Helmet**: Proteção contra vulnerabilidades comuns
- **CORS**: Configuração de Cross-Origin Resource Sharing
- **Rate Limiting**: Limitação de requisições por IP
- **Validação de entrada**: Validação rigorosa de dados
- **Upload seguro**: Limitação de tamanho e tipos de arquivo

## 📦 Dependências Principais

- **express**: Framework web para Node.js
- **cnab400-itau-parser**: Biblioteca para processamento de CNAB 400 do Itaú
- **multer**: Middleware para upload de arquivos
- **helmet**: Middleware de segurança
- **cors**: Middleware para CORS
- **morgan**: Logger de requisições HTTP

## 🐛 Tratamento de Erros

A API retorna códigos de erro padronizados:

| Código | Descrição |
|--------|-----------|
| `ARQUIVO_OBRIGATORIO` | Nenhum arquivo foi enviado |
| `CONTEUDO_OBRIGATORIO` | Campo 'conteudo' é obrigatório |
| `ARQUIVO_INVALIDO` | Arquivo CNAB inválido |
| `CONTEUDO_INVALIDO` | Conteúdo CNAB inválido |
| `ERRO_PROCESSAMENTO` | Erro durante processamento |
| `ERRO_EXTRACAO` | Erro durante extração |
| `ERRO_VALIDACAO` | Erro durante validação |

## 📝 Exemplos de Uso

### Exemplo 1: Upload de arquivo
```bash
curl -X POST http://localhost:8080/api/v1/cnab/upload \
  -F "arquivo=@examples/cnab400_valido.txt"
```

### Exemplo 2: Validação de conteúdo
```bash
curl -X POST http://localhost:8080/api/v1/cnab/validar \
  -H "Content-Type: application/json" \
  -d '{"conteudo":"sua_linha_cnab_400_caracteres..."}'
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Se você encontrar algum problema ou tiver dúvidas:

1. Verifique a [documentação da API](./CNAB_API_DOCS.md)
2. Consulte os [exemplos](./examples/)
3. Abra uma [issue](../../issues) no GitHub

## 🔄 Changelog

### v1.0.0
- ✅ Implementação inicial da API CNAB 400 Itaú Parser
- ✅ Endpoints para upload e processamento de arquivos
- ✅ Extração de códigos de barras e linhas digitáveis
- ✅ Validação de arquivos CNAB
- ✅ Documentação completa
- ✅ Testes automatizados 

## Validação CNAB 240 - Modo Simples

### Nova Funcionalidade: Validação Simples CNAB 240

Implementamos uma nova funcionalidade que permite validar arquivos CNAB 240 seguindo **exatamente o mesmo padrão** da validação do CNAB 400, ou seja, verificando apenas se as linhas têm o tamanho correto (240 caracteres).

#### Endpoint
```
POST /api/v1/cnab240/validar-simples
```

#### Exemplo de Uso

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/cnab240/validar-simples \
  -H "Content-Type: application/json" \
  -d '{\n    "conteudo": "341000010000100001A..." \n  }'
```

**Response (Sucesso):**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": true,
    "totalLinhas": 10,
    "formato": "CNAB 240"
  }
}
```

**Response (Erro - Tamanho Inválido):**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": false,
    "erro": "Arquivo contém 3 linha(s) com tamanho inválido. CNAB 240 deve ter 240 caracteres por linha"
  }
}
```

#### Comparação com Validação Robusta

| Aspecto | Validação Simples | Validação Robusta |
|---------|-------------------|-------------------|
| **Verificação** | Apenas tamanho das linhas (240 chars) | 5 camadas de validação |
| **Performance** | ⚡ Muito rápida | 🐌 Mais lenta |
| **Compatibilidade** | 🔄 Idêntica ao CNAB 400 | 🔧 Específica do CNAB 240 |
| **Detalhamento** | ⚠️ Básico | ✅ Completo |
| **Uso Recomendado** | Validação rápida de formato | Validação completa antes do processamento |

#### Quando Usar Cada Validação

**Validação Simples (`/validar-simples`):**
- ✅ Verificação rápida de formato
- ✅ Compatibilidade com sistemas existentes do CNAB 400
- ✅ Validação básica antes do upload
- ✅ Sistemas que precisam de performance

**Validação Robusta (`/validar`):**
- ✅ Validação completa antes do processamento
- ✅ Verificação de integridade matemática
- ✅ Validação de regras de negócio
- ✅ Sistemas que precisam de garantias

#### Códigos de Resposta

| Código | Situação | Descrição |
|--------|----------|----------|
| `200` | ✅ Sucesso | Validação executada (pode ser válido ou inválido) |
| `400` | ❌ Erro de Request | Campo "conteudo" não fornecido |
| `500` | ❌ Erro Interno | Erro no processamento interno | 