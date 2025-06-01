/**
 * Testes para configurações específicas de bancos CNAB 240
 * 
 * Validação das configurações implementadas na task 24
 */

import { describe, it, expect } from '@jest/globals';
import {
  BANCOS_240,
  CODIGOS_OPERACAO,
  TIPOS_REGISTRO,
  SEGMENTOS,
  SEGMENTOS_B,
  VALIDADORES_PIX,
  VALIDADORES_BANCO,
  UTILS_VALIDACAO
} from '../../src/config/bancos240.js';

describe('CNAB 240 - Configurações de Bancos', () => {

  describe('BANCOS_240 - Configurações básicas', () => {
    const bancosSuportados = ['001', '341', '033', '104', '237'];

    bancosSuportados.forEach(codigo => {
      it(`deve ter configuração completa para banco ${codigo}`, () => {
        const banco = BANCOS_240[codigo];

        expect(banco).toBeDefined();
        expect(banco.nome).toBeDefined();
        expect(banco.codigo).toBe(codigo);
        expect(banco.versaoLayout).toBeDefined();
        expect(Array.isArray(banco.segmentosSuportados)).toBe(true);
        expect(Array.isArray(banco.operacoesSuportadas)).toBe(true);
        expect(banco.validacoes).toBeDefined();
        expect(banco.pix).toBeDefined();
      });

      it(`deve ter configurações PIX completas para banco ${codigo}`, () => {
        const banco = BANCOS_240[codigo];

        expect(banco.pix.tiposChaveSuportados).toBeDefined();
        expect(banco.pix.segmentosBSuportados).toBeDefined();
        expect(banco.pix.limites).toBeDefined();
        expect(banco.pix.validadores).toBeDefined();

        // Verificar limites por tipo de operação
        expect(banco.pix.limites.simples).toBeDefined();
        expect(banco.pix.limites.programado).toBeDefined();
        expect(banco.pix.limites.lote).toBeDefined();

        // Verificar estrutura dos limites
        ['simples', 'programado', 'lote'].forEach(tipo => {
          expect(banco.pix.limites[tipo].diario).toBeGreaterThan(0);
          expect(banco.pix.limites[tipo].mensal).toBeGreaterThan(0);
          expect(banco.pix.limites[tipo].porTransacao).toBeGreaterThan(0);
        });
      });
    });

    it('deve ter Itaú (341) como banco principal com mais operações', () => {
      const itau = BANCOS_240['341'];

      expect(itau.nome).toBe('Itaú Unibanco');
      expect(itau.operacoesSuportadas.length).toBeGreaterThanOrEqual(7);
      expect(itau.operacoesSuportadas).toContain('204504'); // PIX Transferência
      expect(itau.operacoesSuportadas).toContain('204704'); // PIX Programado
    });
  });

  describe('VALIDADORES_PIX - Validação de chaves PIX', () => {
    it('deve validar CPF corretamente', () => {
      expect(VALIDADORES_PIX.CPF('12345678901')).toBe(true);
      expect(VALIDADORES_PIX.CPF('123.456.789-01')).toBe(true); // Com formatação
      expect(VALIDADORES_PIX.CPF('1234567890')).toBe(false); // 10 dígitos
      expect(VALIDADORES_PIX.CPF('123456789012')).toBe(false); // 12 dígitos
      expect(VALIDADORES_PIX.CPF('12345678901a')).toBe(false); // Com letra
    });

    it('deve validar CNPJ corretamente', () => {
      expect(VALIDADORES_PIX.CNPJ('12345678000199')).toBe(true);
      expect(VALIDADORES_PIX.CNPJ('12.345.678/0001-99')).toBe(true); // Com formatação
      expect(VALIDADORES_PIX.CNPJ('1234567800019')).toBe(false); // 13 dígitos
      expect(VALIDADORES_PIX.CNPJ('123456780001999')).toBe(false); // 15 dígitos
      expect(VALIDADORES_PIX.CNPJ('12345678000199a')).toBe(false); // Com letra
    });

    it('deve validar EMAIL corretamente', () => {
      expect(VALIDADORES_PIX.EMAIL('usuario@exemplo.com')).toBe(true);
      expect(VALIDADORES_PIX.EMAIL('teste.email+tag@dominio.com.br')).toBe(true);
      expect(VALIDADORES_PIX.EMAIL('email@')).toBe(false);
      expect(VALIDADORES_PIX.EMAIL('@dominio.com')).toBe(false);
      expect(VALIDADORES_PIX.EMAIL('email.sem.arroba.com')).toBe(false);

      // Email muito longo (> 77 caracteres)
      const emailLongo = 'a'.repeat(70) + '@test.com';
      expect(VALIDADORES_PIX.EMAIL(emailLongo)).toBe(false);
    });

    it('deve validar TELEFONE corretamente', () => {
      expect(VALIDADORES_PIX.TELEFONE('+5511999887766')).toBe(true);
      expect(VALIDADORES_PIX.TELEFONE('11999887766')).toBe(true);
      expect(VALIDADORES_PIX.TELEFONE('(11) 99988-7766')).toBe(true); // Com formatação
      expect(VALIDADORES_PIX.TELEFONE('119998877')).toBe(false); // Muito curto
      expect(VALIDADORES_PIX.TELEFONE('11999887766123456')).toBe(false); // Muito longo
      expect(VALIDADORES_PIX.TELEFONE('11999887766a')).toBe(false); // Com letra
    });

    it('deve validar UUID corretamente', () => {
      expect(VALIDADORES_PIX.UUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(VALIDADORES_PIX.UUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true); // Maiúsculo
      expect(VALIDADORES_PIX.UUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // Muito curto
      expect(VALIDADORES_PIX.UUID('550e8400-e29b-41d4-a716-4466554400001')).toBe(false); // Muito longo
      expect(VALIDADORES_PIX.UUID('550e8400e29b41d4a716446655440000')).toBe(false); // Sem hífens
      expect(VALIDADORES_PIX.UUID('550g8400-e29b-41d4-a716-446655440000')).toBe(false); // Caractere inválido
    });
  });

  describe('VALIDADORES_BANCO - Validação específica por banco', () => {
    it('deve validar agência do Banco do Brasil (001)', () => {
      const validador = VALIDADORES_BANCO['001'];

      expect(validador.validarAgencia('1234')).toBe(true);
      expect(validador.validarAgencia('0001')).toBe(true);
      expect(validador.validarAgencia('123')).toBe(false); // Muito curta
      expect(validador.validarAgencia('12345')).toBe(false); // Muito longa
      expect(validador.validarAgencia('123a')).toBe(false); // Com letra
    });

    it('deve validar conta do Itaú (341)', () => {
      const validador = VALIDADORES_BANCO['341'];

      expect(validador.validarConta('12345')).toBe(true); // Mínimo 5 dígitos
      expect(validador.validarConta('123456789012')).toBe(true); // Máximo 12 dígitos
      expect(validador.validarConta('1234')).toBe(false); // Muito curta
      expect(validador.validarConta('1234567890123')).toBe(false); // Muito longa
      expect(validador.validarConta('12345a')).toBe(false); // Com letra
    });

    it('deve validar conta do Bradesco (237)', () => {
      const validador = VALIDADORES_BANCO['237'];

      expect(validador.validarConta('1234567')).toBe(true); // Exatamente 7 dígitos
      expect(validador.validarConta('123456')).toBe(false); // Muito curta
      expect(validador.validarConta('12345678')).toBe(false); // Muito longa
      expect(validador.validarConta('123456a')).toBe(false); // Com letra
    });

    it('deve validar dígito verificador para todos os bancos', () => {
      const bancos = ['001', '341', '033', '104', '237'];

      bancos.forEach(codigo => {
        const validador = VALIDADORES_BANCO[codigo];

        expect(validador.validarDigitoVerificador('1234', '567890', '1')).toBe(true);
        expect(validador.validarDigitoVerificador('1234', '567890', '9')).toBe(true);

        // Banco do Brasil aceita 'X' como DV
        if (codigo === '001') {
          expect(validador.validarDigitoVerificador('1234', '567890', 'X')).toBe(true);
        } else {
          expect(validador.validarDigitoVerificador('1234', '567890', 'X')).toBe(false);
        }

        expect(validador.validarDigitoVerificador('1234', '567890', 'A')).toBe(false);
        expect(validador.validarDigitoVerificador('1234', '567890', '12')).toBe(false);
      });
    });
  });

  describe('CODIGOS_OPERACAO - Códigos de operação', () => {
    it('deve ter códigos de operação identificados', () => {
      const codigosEsperados = ['201303', '203003', '203103', '204504', '204704', '221903', '229103'];

      codigosEsperados.forEach(codigo => {
        expect(CODIGOS_OPERACAO[codigo]).toBeDefined();
        expect(CODIGOS_OPERACAO[codigo].nome).toBeDefined();
        expect(CODIGOS_OPERACAO[codigo].descricao).toBeDefined();
        expect(Array.isArray(CODIGOS_OPERACAO[codigo].segmentosObrigatorios)).toBe(true);
        expect(Array.isArray(CODIGOS_OPERACAO[codigo].segmentosOpcionais)).toBe(true);
      });
    });

    it('deve identificar operações PIX corretamente', () => {
      expect(CODIGOS_OPERACAO['204504'].pix).toBe(true); // PIX Transferência
      expect(CODIGOS_OPERACAO['204704'].pix).toBe(true); // PIX Programado
      expect(CODIGOS_OPERACAO['201303'].pix).toBeUndefined(); // Pagamento de Tributos (não é PIX)
    });

    it('deve ter segmentos obrigatórios para operações PIX', () => {
      expect(CODIGOS_OPERACAO['204504'].segmentosObrigatorios).toContain('A');
      expect(CODIGOS_OPERACAO['204504'].segmentosObrigatorios).toContain('B');
      expect(CODIGOS_OPERACAO['204704'].segmentosObrigatorios).toContain('A');
      expect(CODIGOS_OPERACAO['204704'].segmentosObrigatorios).toContain('B');
    });
  });

  describe('SEGMENTOS_B - Subtipos do Segmento B', () => {
    it('deve ter configuração completa para todos os subtipos', () => {
      const subtipos = ['B01', 'B02', 'B03', 'B04'];

      subtipos.forEach(subtipo => {
        expect(SEGMENTOS_B[subtipo]).toBeDefined();
        expect(SEGMENTOS_B[subtipo].nome).toBeDefined();
        expect(SEGMENTOS_B[subtipo].descricao).toBeDefined();
        expect(SEGMENTOS_B[subtipo].validador).toBeDefined();
      });
    });

    it('deve ter validadores funcionais para subtipos B01, B02 e B04', () => {
      expect(SEGMENTOS_B['B01'].validador('+5511999887766')).toBe(true); // Telefone
      expect(SEGMENTOS_B['B02'].validador('email@teste.com')).toBe(true); // Email
      expect(SEGMENTOS_B['B04'].validador('550e8400-e29b-41d4-a716-446655440000')).toBe(true); // UUID
    });

    it('deve validar subtipo B03 com tipo de inscrição', () => {
      const validadorB03 = SEGMENTOS_B['B03'].validador;

      expect(validadorB03('12345678901', '1')).toBe(true); // CPF
      expect(validadorB03('12345678000199', '2')).toBe(true); // CNPJ
      expect(validadorB03('12345678901', '2')).toBe(false); // CPF com tipo CNPJ
      expect(validadorB03('12345678000199', '1')).toBe(false); // CNPJ com tipo CPF
      expect(validadorB03('12345678901', '3')).toBe(false); // Tipo inválido
    });
  });

  describe('UTILS_VALIDACAO - Funções utilitárias', () => {
    it('deve validar configuração de banco específico', () => {
      const dados = {
        agencia: '1234',
        conta: '567890',
        digitoVerificador: '1'
      };

      const resultado = UTILS_VALIDACAO.validarConfigBanco('341', dados);

      expect(resultado.valido).toBe(true);
      expect(resultado.banco).toBe('Itaú Unibanco');
      expect(resultado.erros).toHaveLength(0);
    });

    it('deve rejeitar banco não configurado', () => {
      const dados = { agencia: '1234', conta: '567890' };
      const resultado = UTILS_VALIDACAO.validarConfigBanco('999', dados);

      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('não configurado');
    });

    it('deve detectar formato de agência inválido', () => {
      const dados = {
        agencia: '123', // Muito curta para qualquer banco
        conta: '567890',
        digitoVerificador: '1'
      };

      const resultado = UTILS_VALIDACAO.validarConfigBanco('341', dados);

      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toContain('Formato de agência inválido para Itaú Unibanco');
    });

    it('deve validar chave PIX específica', () => {
      // CPF válido
      let resultado = UTILS_VALIDACAO.validarChavePix('12345678901', 'CPF');
      expect(resultado.valido).toBe(true);
      expect(resultado.erro).toBeNull();

      // Email válido
      resultado = UTILS_VALIDACAO.validarChavePix('email@teste.com', 'EMAIL');
      expect(resultado.valido).toBe(true);
      expect(resultado.erro).toBeNull();

      // CPF inválido
      resultado = UTILS_VALIDACAO.validarChavePix('123', 'CPF');
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('inválido');

      // Tipo não suportado
      resultado = UTILS_VALIDACAO.validarChavePix('123', 'INVALIDO');
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('não suportado');
    });

    it('deve verificar se operação é suportada pelo banco', () => {
      // Itaú suporta PIX
      expect(UTILS_VALIDACAO.operacaoSuportada('341', '204504')).toBe(true);

      // Banco do Brasil não suporta operação especial do Itaú
      expect(UTILS_VALIDACAO.operacaoSuportada('001', '221903')).toBe(false);

      // Banco inexistente
      expect(UTILS_VALIDACAO.operacaoSuportada('999', '204504')).toBe(false);
    });

    it('deve verificar limites PIX para o banco', () => {
      // Valor dentro do limite
      let resultado = UTILS_VALIDACAO.verificarLimitePix('341', 'simples', 10000); // R$ 100,00
      expect(resultado.valido).toBe(true);

      // Valor acima do limite por transação
      resultado = UTILS_VALIDACAO.verificarLimitePix('341', 'simples', 60000000); // R$ 600.000,00 (limite Itaú: R$ 500.000,00)
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('excede limite');

      // Banco sem PIX configurado
      resultado = UTILS_VALIDACAO.verificarLimitePix('999', 'simples', 10000);
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('não configurado');

      // Tipo de operação inválido
      resultado = UTILS_VALIDACAO.verificarLimitePix('341', 'inexistente', 10000);
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('não configurado');
    });
  });

  describe('Integração - Validação completa', () => {
    it('deve validar transação PIX completa do Itaú', () => {
      const banco = BANCOS_240['341'];
      const dadosTransacao = {
        codigoBanco: '341',
        codigoOperacao: '204504', // PIX Transferência
        agencia: '1234',
        conta: '567890',
        digitoVerificador: '1',
        chavePix: '12345678901',
        tipoChave: 'CPF',
        valor: 50000 // R$ 500,00
      };

      // Verificar se banco suporta operação
      expect(UTILS_VALIDACAO.operacaoSuportada(dadosTransacao.codigoBanco, dadosTransacao.codigoOperacao)).toBe(true);

      // Validar dados bancários
      const validacaoBanco = UTILS_VALIDACAO.validarConfigBanco(dadosTransacao.codigoBanco, dadosTransacao);
      expect(validacaoBanco.valido).toBe(true);

      // Validar chave PIX
      const validacaoPix = UTILS_VALIDACAO.validarChavePix(dadosTransacao.chavePix, dadosTransacao.tipoChave);
      expect(validacaoPix.valido).toBe(true);

      // Verificar limites
      const verificacaoLimite = UTILS_VALIDACAO.verificarLimitePix(dadosTransacao.codigoBanco, 'simples', dadosTransacao.valor);
      expect(verificacaoLimite.valido).toBe(true);
    });

    it('deve rejeitar transação com valor acima do limite', () => {
      const dadosTransacao = {
        codigoBanco: '237', // Bradesco (limite menor)
        valor: 50000000 // R$ 500.000,00 (limite Bradesco: R$ 400.000,00)
      };

      const verificacaoLimite = UTILS_VALIDACAO.verificarLimitePix(dadosTransacao.codigoBanco, 'simples', dadosTransacao.valor);
      expect(verificacaoLimite.valido).toBe(false);
      expect(verificacaoLimite.erro).toContain('excede limite');
    });

    it('deve validar diferentes tipos de chave PIX por segmento B', () => {
      const testes = [
        { subtipo: 'B01', chave: '+5511999887766', valido: true },
        { subtipo: 'B02', chave: 'email@teste.com', valido: true },
        { subtipo: 'B03', chave: '12345678901', tipo: '1', valido: true }, // CPF
        { subtipo: 'B03', chave: '12345678000199', tipo: '2', valido: true }, // CNPJ
        { subtipo: 'B04', chave: '550e8400-e29b-41d4-a716-446655440000', valido: true },
        { subtipo: 'B01', chave: 'email@teste.com', valido: false }, // Email em subtipo telefone
        { subtipo: 'B02', chave: '+5511999887766', valido: false }, // Telefone em subtipo email
      ];

      testes.forEach(teste => {
        const segmento = SEGMENTOS_B[teste.subtipo];
        let resultado;

        if (teste.subtipo === 'B03') {
          resultado = segmento.validador(teste.chave, teste.tipo);
        } else {
          resultado = segmento.validador(teste.chave);
        }

        expect(resultado).toBe(teste.valido);
      });
    });
  });
}); 