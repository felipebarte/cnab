# Documentação da Suíte de Testes - Funcionalidade Webhook

Esta documentação descreve a suíte completa de testes implementada para validar a funcionalidade de webhook da API CNAB 400 Itaú Parser.

## 📋 Visão Geral

A suíte de testes cobre todas as funcionalidades críticas do sistema de webhook, incluindo:
- Testes unitários dos serviços
- Testes de integração end-to-end
- Mock servers para simulação de cenários
- Validação de performance e edge cases

## 🗂️ Estrutura dos Testes

### 1. Testes Unitários

#### `webhookService.test.js`
**Objetivo**: Testa isoladamente o `WebhookService` e suas funcionalidades.

**Cobertura**:
- ✅ Envio de dados para webhook com sucesso
- ✅ Tratamento de URLs customizadas
- ✅ Configuração de webhook desabilitado
- ✅ Validação de configuração obrigatória
- ✅ Sistema de retry progressivo
- ✅ Classificação de diferentes tipos de erro (timeout, auth, network)
- ✅ Formatação de dados CNAB para webhook
- ✅ Validação de valores monetários e datas
- ✅ Headers HTTP corretos
- ✅ Delay progressivo entre tentativas

**Principais cenários testados**:
```javascript
// Envio bem-sucedido
expect(resultado).toEqual({
  sucesso: true,
  enviado: true,
  tentativas: 1,
  response: expect.objectContaining({ status: 200 })
});

// Sistema de retry
mockedAxios.post
  .mockRejectedValueOnce(networkError)  // Falha 1
  .mockRejectedValueOnce(networkError)  // Falha 2  
  .mockResolvedValueOnce(successResponse); // Sucesso na 3ª tentativa
```

#### `cnabService.test.js`
**Objetivo**: Testa o `CnabService` com foco nas funcionalidades utilizadas pelo webhook.

**Cobertura**:
- ✅ Processamento de CNAB válido
- ✅ Extração de códigos de barras
- ✅ Geração de linhas digitáveis
- ✅ Validação de arquivos CNAB
- ✅ Tratamento de dados vazios/inválidos
- ✅ Estruturas de dados compatíveis com webhook
- ✅ Performance com arquivos grandes
- ✅ Encoding e caracteres especiais

### 2. Testes de Integração

#### `webhookIntegration.test.js`
**Objetivo**: Testa os endpoints completos de webhook end-to-end.

**Cobertura**:
- ✅ `POST /api/v1/cnab/processar-webhook` (texto)
- ✅ `POST /api/v1/cnab/processar-webhook-upload` (arquivo)
- ✅ Cenários de sucesso e falha
- ✅ Retry automático em falhas temporárias
- ✅ Timeout e handling de erros
- ✅ Validação de dados enviados para webhook
- ✅ Performance com arquivos grandes
- ✅ Configurações de ambiente

**Exemplo de teste end-to-end**:
```javascript
const response = await request(app)
  .post('/api/v1/cnab/processar-webhook')
  .send({
    conteudo: conteudoCnabValido,
    webhookUrl: mockServer.getUrl('/webhook/cnab')
  })
  .expect(200);

// Verifica resposta da API
expect(response.body.webhook.enviado).toBe(true);

// Verifica dados recebidos pelo webhook
const webhookRequest = await mockServer.waitForRequestOnPath('/webhook/cnab');
expect(webhookRequest.body.resumo.totalRegistros).toBeGreaterThan(0);
```

### 3. Mock Server

#### `mocks/webhookMockServer.js`
**Objetivo**: Simula um servidor webhook externo para testes controlados.

**Funcionalidades**:
- ✅ Múltiplos endpoints com comportamentos diferentes
- ✅ Configuração dinâmica de respostas
- ✅ Simulação de delays e timeouts
- ✅ Captura de requisições para validação
- ✅ Cenários de retry controlados

**Endpoints disponíveis**:
```javascript
/webhook/cnab       // Sucesso padrão
/webhook/error      // Sempre retorna erro 500
/webhook/timeout    // Simula timeout (nunca responde)
/webhook/unauthorized // Erro 401
/webhook/retry      // Falha N vezes, depois funciona
/webhook/custom     // Configurável dinamicamente
```

## 🧪 Executando os Testes

### Todos os testes
```bash
cd api
npm test
```

### Testes específicos
```bash
# Apenas testes unitários do WebhookService
npm test webhookService.test.js

# Apenas testes de integração
npm test webhookIntegration.test.js

# Apenas testes do CnabService
npm test cnabService.test.js

# Com cobertura
npm test -- --coverage
```

### Com filtros
```bash
# Apenas testes relacionados a retry
npm test -- --testNamePattern="retry"

# Apenas testes de formatação
npm test -- --testNamePattern="formatar"
```

## 📊 Métricas de Cobertura

### Objetivos de Cobertura
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Áreas Críticas Cobertas
1. **WebhookService**: 100% das funções públicas
2. **Sistema de Retry**: Todos os cenários de falha
3. **Formatação de Dados**: Todas as estruturas de saída
4. **Validação**: Cenários válidos e inválidos
5. **Error Handling**: Todos os tipos de erro classificados

## 🔧 Configuração dos Testes

### Variáveis de Ambiente para Testes
```javascript
process.env.WEBHOOK_ENABLED = 'true';
process.env.WEBHOOK_TIMEOUT = '5000';        // Reduzido para testes
process.env.WEBHOOK_RETRY_ATTEMPTS = '3';
process.env.WEBHOOK_RETRY_DELAY = '1000';    // Reduzido para testes
```

### Mocks Utilizados
- **axios**: Para controlar requisições HTTP
- **Logger**: Para evitar output desnecessário
- **ErrorHandler**: Para respostas consistentes
- **console**: Para logs limpos durante testes

## 📝 Padrões e Convenções

### Estrutura de Teste
```javascript
describe('ComponentePrincipal', () => {
  describe('funcionalidadeEspecifica', () => {
    it('deve fazer algo específico quando condição X', () => {
      // Arrange
      const input = setupTestData();
      
      // Act  
      const result = executeFunction(input);
      
      // Assert
      expect(result).toMatchObject(expectedStructure);
    });
  });
});
```

### Naming Convention
- **Arquivos**: `nomeDoComponente.test.js`
- **Describes**: Nome do componente e funcionalidade
- **Its**: "deve [ação] quando [condição]"

### Timeouts
- **Testes unitários**: 5000ms (padrão)
- **Testes com retry**: 10000ms
- **Testes de integração**: 15000ms
- **Testes de performance**: 30000ms

## 🚨 Cenários de Erro Testados

### Erros de Rede
- Connection timeout
- Connection refused  
- DNS resolution failure
- Network unreachable

### Erros HTTP
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable

### Erros de Configuração
- URL não configurada
- Timeout muito baixo
- Número inválido de tentativas
- Webhook desabilitado

### Erros de Dados
- CNAB vazio
- CNAB com formato inválido
- Dados corrompidos
- Encoding incorreto

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
- name: Run Tests
  run: |
    cd api
    npm test -- --coverage --watchAll=false
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./api/coverage/lcov.info
```

### Pre-commit Hooks
```json
{
  "pre-commit": "cd api && npm test -- --watchAll=false --passWithNoTests"
}
```

## 🐛 Debugging

### Logs Detalhados
```bash
# Executar com logs completos
DEBUG=* npm test

# Apenas logs de webhook
DEBUG=webhook:* npm test
```

### Mock Server Debug
```javascript
// No teste, para debug do mock server
console.log('Requests recebidas:', mockServer.getRequests());
console.log('Última request:', mockServer.getLastRequest());
```

## 📈 Performance

### Benchmarks Esperados
- **Teste unitário simples**: < 100ms
- **Teste com retry**: < 2s  
- **Teste de integração**: < 5s
- **Teste de performance**: < 30s

### Otimizações Implementadas
- Delays reduzidos em testes (1000ms vs 5000ms em produção)
- Mock server com timeouts baixos
- Reutilização de instâncias de teste
- Cleanup automático entre testes

## 🎯 Próximos Passos

### Melhorias Futuras
1. **Testes de Carga**: Simular múltiplas requisições simultâneas
2. **Testes de Segurança**: Validar sanitização de dados
3. **Testes de Resiliência**: Simular falhas de infraestrutura
4. **Testes de Monitoramento**: Integrar com métricas de APM

### Cobertura Adicional
1. **Middleware de Autenticação**: Se implementado
2. **Rate Limiting**: Se implementado
3. **Caching**: Se implementado
4. **Logging Estruturado**: Validar formato dos logs

---

## 📞 Suporte

Para dúvidas sobre os testes ou para reportar problemas:
1. Verifique os logs de execução
2. Consulte esta documentação
3. Execute testes isoladamente para debug
4. Verifique configuração das variáveis de ambiente

**Última atualização**: Janeiro 2025 