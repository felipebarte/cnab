# Validação Simples CNAB 240 - Padrão CNAB 400

## 📋 Resumo da Implementação

Esta documentação descreve a implementação da **validação simples para arquivos CNAB 240** que segue exatamente o mesmo padrão da validação do CNAB 400, verificando apenas se as linhas têm o tamanho correto (240 caracteres).

## 🎯 Objetivo

Implementar uma validação do CNAB 240 que seja **idêntica** ao comportamento da validação do CNAB 400:
- Verificação apenas do tamanho das linhas
- Performance otimizada
- Compatibilidade com sistemas existentes
- Simplicidade na validação

## 🔧 Arquivos Modificados

### 1. Service: `api/src/services/cnab240/cnab240Service.js`

**Nova função adicionada:**
```javascript
static validarArquivoCnab240(cnabContent) {
  // Validação simples seguindo padrão CNAB 400
  // Verifica apenas se as linhas têm 240 caracteres
}
```

**Características:**
- ✅ Valida conteúdo não nulo/undefined
- ✅ Trata strings vazias adequadamente  
- ✅ Verifica tamanho exato de 240 caracteres por linha
- ✅ Ignora linhas vazias/espaços
- ✅ Retorna resultado estruturado

### 2. Controller: `api/src/controllers/cnab240Controller.js`

**Nova função adicionada:**
```javascript
static async validarArquivoSimples(req, res) {
  // Endpoint para validação simples
  // POST /api/v1/cnab240/validar-simples
}
```

**Características:**
- ✅ Validação de entrada (campo "conteudo" obrigatório)
- ✅ Tratamento de erros gracioso
- ✅ Retorna status 200 mesmo para arquivos inválidos
- ✅ Estrutura de resposta consistente

### 3. Rotas: `api/src/routes/cnab240Routes.js`

**Nova rota adicionada:**
```javascript
router.post('/validar-simples', Cnab240Controller.validarArquivoSimples);
```

## 📡 API Endpoint

### POST /api/v1/cnab240/validar-simples

**Request:**
```json
{
  "conteudo": "string com conteúdo do arquivo CNAB 240"
}
```

**Response Sucesso (Arquivo Válido):**
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

**Response Sucesso (Arquivo Inválido):**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": false,
    "erro": "Arquivo contém 2 linha(s) com tamanho inválido. CNAB 240 deve ter 240 caracteres por linha"
  }
}
```

**Response Erro (Campo obrigatório):**
```json
{
  "sucesso": false,
  "erro": "Campo \"conteudo\" é obrigatório",
  "codigo": "CONTEUDO_OBRIGATORIO"
}
```

## 🧪 Testes Implementados

### 1. Testes do Service: `api/tests/cnab240/cnab240Service.test.js`

```javascript
describe('Validação simples (padrão CNAB 400)', () => {
  it('deve validar arquivo com linhas de 240 caracteres como válido');
  it('deve rejeitar conteúdo vazio');
  it('deve rejeitar conteúdo não string');
  it('deve rejeitar arquivo com linhas de tamanho incorreto');
  it('deve identificar múltiplas linhas inválidas');
  it('deve tratar erro interno graciosamente');
  it('deve ignorar linhas vazias ou só com espaços');
});
```

### 2. Testes do Controller: `api/tests/cnab240/cnab240Controller.test.js`

```javascript
describe('POST /api/v1/cnab240/validar-simples', () => {
  it('deve validar arquivo CNAB 240 com validação simples');
  it('deve rejeitar arquivo com linhas de tamanho incorreto');
  it('deve retornar erro quando conteúdo não é fornecido');
  it('deve rejeitar conteúdo vazio');
  it('deve retornar resultado mesmo quando há erro interno');
});
```

## 📖 Documentação e Exemplos

### 1. README Atualizado: `api/README.md`

- ✅ Seção completa sobre validação simples
- ✅ Comparação com validação robusta
- ✅ Exemplos de uso com curl
- ✅ Códigos de resposta
- ✅ Quando usar cada tipo de validação

### 2. Exemplo Prático: `examples/cnab240_validacao_simples.js`

- ✅ Script Node.js completo para testes
- ✅ Comparação de performance entre validações
- ✅ Exemplos de uso da API
- ✅ Diferentes cenários de teste

## 🔍 Comparação: Simples vs Robusta

| Aspecto | Validação Simples | Validação Robusta |
|---------|-------------------|-------------------|
| **Verificação** | Apenas tamanho (240 chars) | 5 camadas completas |
| **Performance** | ⚡ Muito rápida | 🐌 Mais lenta |
| **Compatibilidade** | 🔄 Idêntica ao CNAB 400 | 🔧 Específica CNAB 240 |
| **Endpoint** | `/validar-simples` | `/validar` |
| **Uso Recomendado** | Verificação rápida | Validação antes processamento |

## ✅ Casos de Uso

### Validação Simples (`/validar-simples`)
- ✅ Verificação rápida de formato antes upload
- ✅ Sistemas que migram do CNAB 400 para 240
- ✅ APIs que precisam de response rápido
- ✅ Validação básica de estrutura de arquivo

### Validação Robusta (`/validar`)
- ✅ Validação completa antes processamento
- ✅ Verificação de integridade matemática
- ✅ Validação de regras de negócio específicas
- ✅ Sistemas que precisam de garantias completas

## 🚀 Exemplos de Uso

### Curl Básico
```bash
curl -X POST http://localhost:3000/api/v1/cnab240/validar-simples \
  -H "Content-Type: application/json" \
  -d '{"conteudo":"341000010000100001A..."}'
```

### JavaScript/Node.js
```javascript
const response = await fetch('/api/v1/cnab240/validar-simples', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conteudo: arquivoCnab240 })
});

const resultado = await response.json();
console.log('Válido:', resultado.validacao.valido);
```

### Python
```python
import requests

response = requests.post('http://localhost:3000/api/v1/cnab240/validar-simples', 
  json={'conteudo': arquivo_cnab_240})

resultado = response.json()
print(f"Válido: {resultado['validacao']['valido']}")
```

## 📊 Códigos de Resposta

| Status | Situação | Estrutura |
|--------|----------|-----------|
| `200` | ✅ Validação executada | `{ sucesso: true, validacao: {...} }` |
| `400` | ❌ Campo obrigatório | `{ sucesso: false, erro: "...", codigo: "..." }` |
| `500` | ❌ Erro interno | `{ sucesso: false, erro: "...", codigo: "..." }` |

## 🎉 Conclusão

A validação simples CNAB 240 foi implementada com sucesso, oferecendo:

1. **Compatibilidade Total** com padrão CNAB 400
2. **Performance Otimizada** para verificações rápidas
3. **API Consistente** com endpoints existentes
4. **Testes Abrangentes** cobrindo todos os cenários
5. **Documentação Completa** com exemplos práticos

A funcionalidade está pronta para uso em produção e permite que sistemas existentes que usam CNAB 400 migrem facilmente para CNAB 240 mantendo o mesmo comportamento de validação. 