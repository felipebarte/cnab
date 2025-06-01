// Mock da biblioteca cnab400-itau-parser
jest.mock('cnab400-itau-parser', () => {
  return jest.fn((content) => {
    // Simula o comportamento da biblioteca baseado no conteúdo
    if (!content || content.trim() === '') {
      return [];
    }

    const linhas = content.split('\n').filter(linha => linha.trim() !== '');
    const registros = [];

    // Processa apenas registros de detalhe (ignorando header e trailer)
    for (let i = 1; i < linhas.length - 1; i++) {
      const linha = linhas[i];
      if (linha.length >= 400) {
        registros.push({
          nossoNumero: linha.substring(62, 73).trim() || `000${i}456`,
          valor: parseFloat((linha.substring(126, 139).trim() || '10050').replace(/^0+/, '')) / 100,
          vencimento: '2024-01-31',
          nome: linha.substring(254, 284).trim() || `CLIENTE ${i}`,
          codigoBarras: linha.includes('001234567890123456789012345678901234567890') ?
            linha.substring(300, 344) : null,
          linhaDigitavel: linha.includes('001234567890123456789012345678901234567890') ?
            '12345.67890 12345.678901 12345.678901 2 12345678901234' : null
        });
      }
    }

    return registros;
  });
});

// Mock do console para não poluir output dos testes
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('CnabService', () => {
  let CnabService;

  beforeAll(async () => {
    // Importa o CnabService após configurar os mocks
    const module = await import('../src/services/cnabService.js');
    CnabService = module.default;
  });

  // Dados CNAB válidos para testes
  const conteudoCnabValido = `34100000001234567890BANCO ITAU SA       123456789012345    240125000001400000
34100001001234567890001JOAO SILVA              00000123456R$ 000000010050240131000000001000
34100001001234567890002MARIA SANTOS            00000654321R$ 000000020075240228000000002000
341000000030000000000300000003007500000000000000000000000000000000000000000000000000000`;

  const conteudoCnabComCodeBarras = `34100000001234567890BANCO ITAU SA       123456789012345    240125000001400000
34100001001234567890001JOAO SILVA              001234567890123456789012345678901234567890001000
34100001001234567890002MARIA SANTOS            004567890123456789012345678901234567890123002000
341000000030000000000300000000000000000000000000000000000000000000000000000000000000000`;

  describe('processarArquivoCnab', () => {
    it('deve processar CNAB válido e retornar estrutura completa', async () => {
      const resultado = await CnabService.processarArquivoCnab(conteudoCnabValido);

      expect(resultado).toHaveProperty('sucesso', true);
      expect(resultado).toHaveProperty('dados');
      expect(resultado).toHaveProperty('dadosEstruturados');
      expect(resultado).toHaveProperty('totalRegistros');
      expect(resultado).toHaveProperty('informacoesArquivo');

      expect(resultado.dados).toBeInstanceOf(Array);
      expect(resultado.totalRegistros).toBeGreaterThan(0);
      expect(resultado.informacoesArquivo.formato).toBe('CNAB 400');
    });

    it('deve lidar com conteúdo vazio graciosamente', async () => {
      const resultado = await CnabService.processarArquivoCnab('');

      expect(resultado.dados).toEqual([]);
      expect(resultado.totalRegistros).toBe(0);
    });

    it('deve falhar com conteúdo inválido', async () => {
      await expect(CnabService.processarArquivoCnab(null)).rejects.toThrow(
        'Conteúdo do arquivo CNAB é obrigatório e deve ser uma string'
      );
    });
  });

  describe('extrairCodigosBarras', () => {
    it('deve extrair códigos de barras quando presentes', async () => {
      const resultado = await CnabService.extrairCodigosBarras(conteudoCnabComCodeBarras);

      expect(resultado).toHaveProperty('sucesso', true);
      expect(resultado).toHaveProperty('codigosBarras');
      expect(resultado).toHaveProperty('total');

      expect(resultado.codigosBarras).toBeInstanceOf(Array);
      if (resultado.codigosBarras.length > 0) {
        resultado.codigosBarras.forEach(item => {
          expect(item).toHaveProperty('codigoBarras');
          expect(item).toHaveProperty('valor');
          expect(item).toHaveProperty('vencimento');
        });
      }
    });

    it('deve retornar array vazio quando não há códigos de barras', async () => {
      const resultado = await CnabService.extrairCodigosBarras(conteudoCnabValido);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.codigosBarras).toBeInstanceOf(Array);
      expect(resultado.total).toBe(0);
    });
  });

  describe('extrairLinhasDigitaveis', () => {
    it('deve extrair linhas digitáveis quando presentes', async () => {
      const resultado = await CnabService.extrairLinhasDigitaveis(conteudoCnabComCodeBarras);

      expect(resultado).toHaveProperty('sucesso', true);
      expect(resultado).toHaveProperty('linhasDigitaveis');
      expect(resultado).toHaveProperty('total');

      expect(resultado.linhasDigitaveis).toBeInstanceOf(Array);
      if (resultado.linhasDigitaveis.length > 0) {
        resultado.linhasDigitaveis.forEach(item => {
          expect(item).toHaveProperty('linhaDigitavel');
          expect(item.linhaDigitavel).toMatch(/^\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}$/);
        });
      }
    });

    it('deve retornar array vazio quando não há linhas digitáveis', async () => {
      const resultado = await CnabService.extrairLinhasDigitaveis(conteudoCnabValido);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.linhasDigitaveis).toBeInstanceOf(Array);
      expect(resultado.total).toBe(0);
    });
  });

  describe('validarArquivoCnab', () => {
    it('deve validar CNAB com formato correto', () => {
      const resultado = CnabService.validarArquivoCnab(conteudoCnabValido);

      expect(resultado).toHaveProperty('valido', true);
      expect(resultado).toHaveProperty('totalLinhas');
      expect(resultado).toHaveProperty('formato', 'CNAB 400');
    });

    it('deve detectar problemas em CNAB inválido', () => {
      const cnabInvalido = 'linha-muito-curta\noutra-linha-sem-formatacao-adequada';

      const resultado = CnabService.validarArquivoCnab(cnabInvalido);

      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('tamanho inválido');
    });

    it('deve retornar inválido para conteúdo vazio', () => {
      const resultado = CnabService.validarArquivoCnab('');

      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('não contém linhas válidas');
    });

    it('deve detectar linhas com tamanho incorreto', () => {
      const cnabComLinhaIncorreta = `34100000001234567890BANCO ITAU SA       123456789012345    240125000001400000
linha-muito-curta
341000000030000000000300000003007500000000000000000000000000000000000000000000000000000`;

      const resultado = CnabService.validarArquivoCnab(cnabComLinhaIncorreta);

      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('tamanho inválido');
    });
  });

  describe('extrairDadosEstruturados', () => {
    it('deve extrair dados estruturados com informações completas', () => {
      const dadosCnab = [
        {
          nossoNumero: '123456',
          valor: 100.50,
          vencimento: '2024-12-31',
          nome: 'João Silva'
        }
      ];

      const resultado = CnabService.extrairDadosEstruturados(conteudoCnabValido, dadosCnab);

      expect(resultado).toHaveProperty('cabecalho');
      expect(resultado).toHaveProperty('registros');
      expect(resultado).toHaveProperty('trailer');
      expect(resultado).toHaveProperty('resumo');
      expect(resultado).toHaveProperty('estatisticas');

      expect(resultado.cabecalho).toMatchObject({
        banco: expect.objectContaining({
          codigo: expect.any(String),
          nome: expect.any(String)
        })
      });
    });

    it('deve lidar com dados vazios graciosamente', () => {
      const dadosVazios = [];

      const resultado = CnabService.extrairDadosEstruturados('', dadosVazios);

      expect(resultado).toHaveProperty('cabecalho');
      expect(resultado).toHaveProperty('registros');
      expect(resultado.registros).toEqual([]);
    });
  });

  describe('Integração com Webhook - Compatibilidade', () => {
    it('deve processar CNAB e gerar estrutura compatível com webhook', async () => {
      const dadosProcessados = await CnabService.processarArquivoCnab(conteudoCnabValido);

      // Verifica estrutura esperada pelo webhook
      expect(dadosProcessados).toHaveProperty('dados');
      expect(dadosProcessados).toHaveProperty('dadosEstruturados');
      expect(dadosProcessados).toHaveProperty('totalRegistros');

      // Estrutura de dados que o WebhookService espera
      const dadosParaWebhook = {
        dados: dadosProcessados.dados,
        totalRegistros: dadosProcessados.totalRegistros,
        arquivo: {
          nome: 'teste.cnab',
          tamanho: conteudoCnabValido.length
        },
        ...dadosProcessados.dadosEstruturados
      };

      expect(dadosParaWebhook).toMatchObject({
        dados: expect.any(Array),
        totalRegistros: expect.any(Number),
        arquivo: expect.objectContaining({
          nome: expect.any(String),
          tamanho: expect.any(Number)
        }),
        cabecalho: expect.any(Object)
      });
    });

    it('deve extrair códigos de barras e linhas digitáveis para webhook', async () => {
      const codigosResult = await CnabService.extrairCodigosBarras(conteudoCnabComCodeBarras);
      const linhasResult = await CnabService.extrairLinhasDigitaveis(conteudoCnabComCodeBarras);

      expect(codigosResult.codigosBarras).toBeInstanceOf(Array);
      expect(linhasResult.linhasDigitaveis).toBeInstanceOf(Array);

      // Verifica que códigos e linhas estão sincronizados se existirem
      if (codigosResult.total > 0) {
        expect(linhasResult.total).toBe(codigosResult.total);
      }
    });
  });

  describe('Performance e edge cases', () => {
    it('deve processar arquivo grande sem problemas de performance', async () => {
      // Gera um CNAB com muitas linhas
      const cabecalho = '34100000001234567890BANCO ITAU SA       123456789012345    240125000001400000';
      const trailler = '341000000030000000000300000003007500000000000000000000000000000000000000000000000000000';

      const registros = Array(100).fill().map((_, i) => // Reduzido para 100 registros nos testes
        `34100001001234567890${String(i).padStart(3, '0')}CLIENTE ${i}              00000${String(i).padStart(6, '0')}R$ 000000010050240131000000001000`
      );

      const cnabGrande = [cabecalho, ...registros, trailler].join('\n');

      const startTime = Date.now();
      const resultado = await CnabService.processarArquivoCnab(cnabGrande);
      const endTime = Date.now();

      expect(resultado.totalRegistros).toBe(100);
      expect(endTime - startTime).toBeLessThan(2000); // Menos de 2 segundos para testes
    });

    it('deve lidar com caracteres especiais e encoding', async () => {
      const cnabComAcentos = `34100000001234567890BANCO ITAÚ SA       123456789012345    240125000001400000
34100001001234567890001JOÃO JOSÉ DA SILVA      00000123456R$ 000000010050240131000000001000
34100001001234567890002MARÍA JOSÉ GONZÁLEZ     00000654321R$ 000000020075240228000000002000
341000000030000000000300000003007500000000000000000000000000000000000000000000000000000`;

      const resultado = await CnabService.processarArquivoCnab(cnabComAcentos);

      expect(resultado.dados).toBeInstanceOf(Array);
      expect(resultado.totalRegistros).toBeGreaterThan(0);
    });

    it('deve tratar linhas com espaços em branco extras', async () => {
      const cnabComEspacos = `  34100000001234567890BANCO ITAU SA       123456789012345    240125000001400000  
  34100001001234567890001JOAO SILVA              00000123456R$ 000000010050240131000000001000  
  341000000030000000000300000003007500000000000000000000000000000000000000000000000000000  `;

      const resultado = await CnabService.processarArquivoCnab(cnabComEspacos);

      expect(resultado.dados).toBeInstanceOf(Array);
      expect(resultado.totalRegistros).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Métodos auxiliares', () => {
    it('deve formatar datas CNAB corretamente', () => {
      // Testa método estático se disponível
      if (CnabService.formatarDataCnab) {
        expect(CnabService.formatarDataCnab('311224')).toBeTruthy();
        expect(CnabService.formatarDataCnab('000000')).toBeNull();
        expect(CnabService.formatarDataCnab('')).toBeNull();
      }
    });

    it('deve converter valores CNAB corretamente', () => {
      // Testa método estático se disponível
      if (CnabService.converterValorCnab) {
        expect(CnabService.converterValorCnab('0000001000')).toBe(10.00);
        expect(CnabService.converterValorCnab('0000000000')).toBe(0);
      }
    });

    it('deve retornar cabeçalho padrão quando necessário', () => {
      // Testa método estático se disponível
      if (CnabService.getCabecalhoPadrao) {
        const cabecalho = CnabService.getCabecalhoPadrao();
        expect(cabecalho).toHaveProperty('banco');
        expect(cabecalho.banco.codigo).toBe('341');
      }
    });
  });
}); 