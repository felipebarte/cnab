# Swagger Atualizado - Novo Endpoint de Validação Simples

## 📋 Resumo das Atualizações

O arquivo **`swagger.yaml`** foi atualizado para incluir a nova funcionalidade de validação simples do CNAB 240.

## 🔄 Modificações Realizadas

### 1. **Descrição Principal da API** (Linhas 4-16)

**Antes:**
```yaml
- ✅ Validação estrutural avançada por banco
```

**Depois:**
```yaml
- ✅ Validação estrutural avançada por banco (robusta)
- ✅ **NOVA**: Validação simples CNAB 240 (padrão CNAB 400)

**Tipos de Validação CNAB 240:**
- **Robusta** (`/validar`): 5 camadas de validação (estrutura, integridade, negócio, banco, operação)
- **Simples** (`/validar-simples`): Verifica apenas tamanho das linhas (240 chars) - Compatível com CNAB 400
```

### 2. **Endpoint `/cnab240/validar`** (Linha 207)

**Atualização:**
- Summary mudou de `"Validar arquivo CNAB 240"` para `"Validar arquivo CNAB 240 (robusta)"`
- Description expandida explicando que usa 5 camadas de validação

### 3. **Novo Endpoint `/cnab240/validar-simples`** (Linhas 230-316)

**Especificações completas:**
- **Method:** `POST`
- **Tag:** `CNAB 240`
- **Summary:** `"Validar arquivo CNAB 240 (simples - padrão CNAB 400)"`
- **Description:** Documentação completa com características e casos de uso
- **Request Body:** Igual ao endpoint de validação robusta
- **Responses:** 
  - `200`: Sucesso com schema próprio
  - `400`: Erro na requisição
- **Examples:** Dois exemplos (arquivo válido e inválido)

### 4. **Novo Schema `CNAB240ValidarSimplesResponse`** (Linhas 960-1016)

**Propriedades do Schema:**
```yaml
CNAB240ValidarSimplesResponse:
  type: object
  properties:
    sucesso: boolean
    validacao:
      type: object
      properties:
        valido: boolean
        formato: string
        totalLinhas: number
        tamanhoEsperado: number
        mensagem: string
        linhasInvalidas: array (opcional)
        erro: string (opcional)
```

## 📊 Comparação Visual

### Endpoints CNAB 240 Disponíveis

| Endpoint | Tipo | Descrição |
|----------|------|-----------|
| `/cnab240/validar` | **Robusta** | 5 camadas de validação completa |
| `/cnab240/validar-simples` | **✨ NOVA** | Validação simples (padrão CNAB 400) |
| `/cnab240/processar` | Processamento | Validação robusta + processamento |
| `/cnab240/processar/upload` | Upload | Upload + validação robusta + processamento |

## 🎯 Documentação do Novo Endpoint

### Request Example
```bash
curl -X POST http://localhost:8080/api/v1/cnab240/validar-simples \
  -H "Content-Type: application/json" \
  -d '{
    "conteudo": "341000010000100001A..."
  }'
```

### Response Examples

**✅ Arquivo Válido:**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": true,
    "formato": "CNAB 240",
    "totalLinhas": 4,
    "tamanhoEsperado": 240,
    "mensagem": "Arquivo CNAB 240 válido (linhas com 240 caracteres)"
  }
}
```

**❌ Arquivo Inválido:**
```json
{
  "sucesso": true,
  "validacao": {
    "valido": false,
    "formato": "CNAB 240",
    "totalLinhas": 2,
    "tamanhoEsperado": 240,
    "linhasInvalidas": [
      {
        "numero": 1,
        "tamanho": 119,
        "esperado": 240
      }
    ],
    "erro": "Encontradas 1 linha(s) com tamanho inválido"
  }
}
```

## 🚀 Como Acessar a Documentação

### Opção 1: Swagger UI (se configurado)
```
http://localhost:8080/api-docs
```

### Opção 2: Arquivo YAML
```
/home/felipe/cnab/api/swagger.yaml
```

### Opção 3: Importar no Postman/Insomnia
Importe o arquivo `swagger.yaml` diretamente nas ferramentas de API.

## ✅ Validação das Atualizações

**Todas as seguintes modificações foram aplicadas:**

- [x] Descrição principal da API atualizada
- [x] Endpoint `/cnab240/validar` clarificado como "robusta"
- [x] Novo endpoint `/cnab240/validar-simples` adicionado
- [x] Schema `CNAB240ValidarSimplesResponse` criado
- [x] Examples de request/response incluídos
- [x] Documentação completa de características e casos de uso
- [x] Compatibilidade com formato OpenAPI 3.0.3 mantida

## 🎉 Resultado

O Swagger agora está **100% atualizado** com a nova funcionalidade de validação simples, mantendo total compatibilidade com a implementação e oferecendo documentação completa para desenvolvedores que queiram integrar com a API. 