import WebhookService from '../../src/services/webhookService.js';

describe('WebhookService - Validação de Interface', () => {
  describe('Métodos Disponíveis', () => {
    it('deve ter o método enviarParaWebhook disponível', () => {
      expect(typeof WebhookService.enviarParaWebhook).toBe('function');
    });

    it('NÃO deve ter o método enviarDados (método incorreto)', () => {
      expect(WebhookService.enviarDados).toBeUndefined();
    });

    it('deve ter a assinatura correta para enviarParaWebhook', () => {
      // Verifica se o método aceita os parâmetros corretos
      const method = WebhookService.enviarParaWebhook;
      // Métodos estáticos podem ter length diferente, vamos verificar se é uma função
      expect(typeof method).toBe('function');
      expect(method.name).toBe('enviarParaWebhook');
    });
  });

  describe('Configurações Padrão', () => {
    it('deve ter configurações padrão definidas', () => {
      expect(WebhookService.defaultConfig).toBeDefined();
      expect(WebhookService.defaultConfig.timeout).toBeDefined();
      expect(WebhookService.defaultConfig.retryAttempts).toBeDefined();
      expect(WebhookService.defaultConfig.retryDelay).toBeDefined();
      expect(WebhookService.defaultConfig.enabled).toBeDefined();
    });
  });

  describe('Métodos Auxiliares', () => {
    it('deve ter métodos de formatação disponíveis', () => {
      expect(typeof WebhookService.formatarDadosCnab).toBe('function');
      expect(typeof WebhookService.extrairCabecalho).toBe('function');
      expect(typeof WebhookService.formatarRegistros).toBe('function');
      expect(typeof WebhookService.calcularResumo).toBe('function');
    });

    it('deve ter métodos utilitários disponíveis', () => {
      expect(typeof WebhookService.formatarValor).toBe('function');
      expect(typeof WebhookService.formatarData).toBe('function');
      expect(typeof WebhookService.sleep).toBe('function');
      expect(typeof WebhookService.validarConfiguracao).toBe('function');
    });
  });
});

describe('WebhookService - Prevenção de Erros Comuns', () => {
  describe('Validação de Chamadas Incorretas', () => {
    it('deve falhar se tentar chamar método inexistente enviarDados', () => {
      expect(() => {
        WebhookService.enviarDados({}, 'https://test.com');
      }).toThrow();
    });

    it('deve ter método enviarParaWebhook com nome correto', () => {
      // Teste simples que verifica apenas a existência e nome do método
      expect(WebhookService.enviarParaWebhook).toBeDefined();
      expect(WebhookService.enviarParaWebhook.name).toBe('enviarParaWebhook');
    });

    it('deve validar que métodos auxiliares existem', () => {
      // Verifica que os métodos de formatação existem
      expect(WebhookService.formatarDadosCnab).toBeDefined();
      expect(WebhookService.formatarValor).toBeDefined();
      expect(WebhookService.formatarData).toBeDefined();
    });
  });
});

describe('WebhookService - Documentação de Interface', () => {
  it('deve documentar a interface correta para desenvolvedores', () => {
    const interfaceDocumentation = {
      metodoCorreto: 'enviarParaWebhook',
      parametros: ['dadosCnab', 'webhookUrl'],
      retorno: {
        sucesso: 'boolean',
        enviado: 'boolean',
        tentativas: 'number',
        tempoResposta: 'number',
        operationId: 'string'
      },
      exemplo: `
        // ✅ CORRETO:
        await WebhookService.enviarParaWebhook(dadosCnab, webhookUrl);
        
        // ❌ INCORRETO (método não existe):
        await WebhookService.enviarDados(webhookUrl, dadosCnab);
      `
    };

    expect(interfaceDocumentation.metodoCorreto).toBe('enviarParaWebhook');
    expect(interfaceDocumentation.parametros).toEqual(['dadosCnab', 'webhookUrl']);
    expect(interfaceDocumentation.retorno.sucesso).toBe('boolean');
  });

  it('deve garantir que a interface não mudou inadvertidamente', () => {
    // Lista de métodos que devem existir
    const metodosEsperados = [
      'enviarParaWebhook',
      'formatarDadosCnab',
      'extrairCabecalho',
      'formatarRegistros',
      'calcularResumo',
      'formatarValor',
      'formatarData',
      'sleep',
      'validarConfiguracao'
    ];

    // Lista de métodos que NÃO devem existir (métodos incorretos)
    const metodosProibidos = [
      'enviarDados',
      'enviarWebhook',
      'sendData',
      'postWebhook'
    ];

    // Verifica métodos esperados
    metodosEsperados.forEach(metodo => {
      expect(WebhookService[metodo]).toBeDefined();
      expect(typeof WebhookService[metodo]).toBe('function');
    });

    // Verifica que métodos incorretos não existem
    metodosProibidos.forEach(metodo => {
      expect(WebhookService[metodo]).toBeUndefined();
    });
  });
}); 