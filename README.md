# CNAB Project

Este projeto utiliza Task Master AI para gerenciamento de tarefas.

## Configuração

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure suas chaves de API:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione suas chaves de API:

```bash
# Chaves de API necessárias para o projeto
OPENAI_API_KEY=sua-chave-openai-aqui

# Outras chaves opcionais para Task Master AI
ANTHROPIC_API_KEY=sua-chave-anthropic-aqui
PERPLEXITY_API_KEY=sua-chave-perplexity-aqui
GOOGLE_API_KEY=sua-chave-google-aqui
MISTRAL_API_KEY=sua-chave-mistral-aqui
```

### 2. Configuração do MCP

O arquivo `.cursor/mcp.json` está configurado para usar variáveis de ambiente. Certifique-se de que suas chaves de API estejam configuradas no seu ambiente.

### 3. Instalação

```bash
npm install
```

### 4. Uso

O projeto utiliza Task Master AI para gerenciamento de tarefas. Consulte a documentação do Task Master AI para mais informações sobre como usar as ferramentas disponíveis.

## Segurança

- **NUNCA** commite chaves de API diretamente no código
- Use sempre variáveis de ambiente para informações sensíveis
- O arquivo `.env` está no `.gitignore` e não deve ser commitado
- Use o arquivo `.env.example` como template para configuração 