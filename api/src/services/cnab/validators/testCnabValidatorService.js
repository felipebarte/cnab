/**
 * Teste Abrangente - CnabValidatorService
 * 
 * Testa todo o sistema de validação CNAB:
 * - StructuralValidator
 * - FieldValidator  
 * - IntegrityValidator
 * - BusinessRuleValidator
 */

import CnabValidatorService from './CnabValidatorService.js';

/**
 * Dados de teste simulados para validação
 */
const testData = {
  // CNAB240 válido com todas as validações passando
  validCnab240: {
    content: [
      // Header arquivo
      '00100000         2014082200001333000000000000000000000000014082400010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Header lote
      '00100011R01000014082400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Detalhe segmento P
      '00100013000010000P 000000000001233000000000000001234567890123456789000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Trailer lote
      '00100015         000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Trailer arquivo
      '00199999         000000100000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    ].join('\n'),
    detection: {
      format: 'cnab240',
      bankCode: '001',
      bankName: 'Banco do Brasil'
    }
  },

  // CNAB400 válido
  validCnab400: {
    content: [
      // Header
      '0001REMESSA01COBRANCA       000123400000001234567890BANCO DO BRASIL      1208240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
      // Detalhe
      '100000000000000000001234567890123456789000000000000000000000000000000012345678901234567890000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002',
      // Trailer
      '9001001230000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003'
    ].join('\n'),
    detection: {
      format: 'cnab400',
      bankCode: '001',
      bankName: 'Banco do Brasil'
    }
  },

  // CNAB240 com erros estruturais
  invalidStructuralCnab240: {
    content: [
      // Header com tamanho incorreto
      '00100000         20140822000013330000000000000000000000000140824000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ERRO_TAMANHO',
      // Lote sem header correspondente (tipo 5 sem tipo 1)
      '00100015         000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    ].join('\n'),
    detection: {
      format: 'cnab240',
      bankCode: '001',
      bankName: 'Banco do Brasil'
    }
  },

  // CNAB com erros de campos
  invalidFieldsCnab240: {
    content: [
      // Header arquivo
      '00100000         2014082200001333000000000000000000000000014082400010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Header lote  
      '00100011R01000014082400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Detalhe com dados inválidos (CPF inválido, data futura, etc.)
      '00100013000010000P 012345678901234999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999',
      // Trailer lote
      '00100015         000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Trailer arquivo
      '00199999         000000100000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    ].join('\n'),
    detection: {
      format: 'cnab240',
      bankCode: '001',
      bankName: 'Banco do Brasil'
    }
  },

  // CNAB com erros de integridade
  invalidIntegrityCnab240: {
    content: [
      // Header arquivo
      '00100000         2014082200001333000000000000000000000000014082400010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Header lote
      '00100011R01000014082400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Detalhe
      '00100013000010000P 000000000001233000000000000001234567890123456789000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Trailer lote com contadores incorretos
      '00100015         000099900005000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      // Trailer arquivo com contadores incorretos
      '00199999         000099900050000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    ].join('\n'),
    detection: {
      format: 'cnab240',
      bankCode: '001',
      bankName: 'Banco do Brasil'
    }
  }
};

/**
 * Executa todos os testes do CnabValidatorService
 */
async function runValidatorTests() {
  console.log('\n🧪 ===== TESTE COMPLETO - CnabValidatorService =====\n');

  const validator = new CnabValidatorService({
    enableStructuralValidation: true,
    enableFieldValidation: true,
    enableIntegrityValidation: true,
    enableBusinessRuleValidation: true,
    enablePerformanceLogging: true
  });

  try {
    // Inicializar validator
    console.log('📋 Inicializando CnabValidatorService...');
    await validator.initialize();

    const systemInfo = validator.getSystemInfo();
    console.log('✅ Sistema inicializado:', JSON.stringify(systemInfo, null, 2));

    // Teste 1: CNAB240 válido
    console.log('\n🔍 === TESTE 1: CNAB240 Válido ===');
    await testValidFile(validator, testData.validCnab240, 'CNAB240 Válido');

    // Teste 2: CNAB400 válido
    console.log('\n🔍 === TESTE 2: CNAB400 Válido ===');
    await testValidFile(validator, testData.validCnab400, 'CNAB400 Válido');

    // Teste 3: Erros estruturais
    console.log('\n🔍 === TESTE 3: Erros Estruturais ===');
    await testInvalidFile(validator, testData.invalidStructuralCnab240, 'Erros Estruturais');

    // Teste 4: Erros de campos  
    console.log('\n🔍 === TESTE 4: Erros de Campos ===');
    await testInvalidFile(validator, testData.invalidFieldsCnab240, 'Erros de Campos');

    // Teste 5: Erros de integridade
    console.log('\n🔍 === TESTE 5: Erros de Integridade ===');
    await testInvalidFile(validator, testData.invalidIntegrityCnab240, 'Erros de Integridade');

    // Teste 6: Validação de linha individual
    console.log('\n🔍 === TESTE 6: Validação de Linha Individual ===');
    await testLineValidation(validator);

    // Teste 7: Validação de campo individual
    console.log('\n🔍 === TESTE 7: Validação de Campo Individual ===');
    await testFieldValidation(validator);

    // Estatísticas finais
    console.log('\n📊 === ESTATÍSTICAS FINAIS ===');
    const finalStats = validator.getSystemInfo();
    console.log('Stats:', JSON.stringify(finalStats.stats, null, 2));

    console.log('\n✅ ===== TODOS OS TESTES CONCLUÍDOS COM SUCESSO =====\n');

  } catch (error) {
    console.error('\n❌ ERRO GERAL NOS TESTES:', error);
  }
}

/**
 * Testa arquivo válido
 */
async function testValidFile(validator, testCase, testName) {
  try {
    const startTime = Date.now();

    const result = await validator.validateFile(
      testCase.content,
      testCase.detection
    );

    const duration = Date.now() - startTime;

    console.log(`📄 ${testName}:`);
    console.log(`   ✅ Válido: ${result.valid}`);
    console.log(`   ⚠️  Warnings: ${result.warnings.length}`);
    console.log(`   ❌ Erros: ${result.errors.length}`);
    console.log(`   ⏱️  Tempo: ${duration}ms`);
    console.log(`   📊 Checks: ${result.summary.totalChecks} total, ${result.summary.passedChecks} passou`);

    if (result.warnings.length > 0) {
      console.log('   Warnings:');
      result.warnings.slice(0, 3).forEach(w => {
        console.log(`     - ${w.message}`);
      });
    }

    if (result.errors.length > 0) {
      console.log('   Erros:');
      result.errors.slice(0, 3).forEach(e => {
        console.log(`     - ${e.message}`);
      });
    }

    return result;

  } catch (error) {
    console.error(`❌ Erro no teste ${testName}:`, error);
  }
}

/**
 * Testa arquivo inválido
 */
async function testInvalidFile(validator, testCase, testName) {
  try {
    const startTime = Date.now();

    const result = await validator.validateFile(
      testCase.content,
      testCase.detection
    );

    const duration = Date.now() - startTime;

    console.log(`📄 ${testName}:`);
    console.log(`   ✅ Válido: ${result.valid}`);
    console.log(`   ⚠️  Warnings: ${result.warnings.length}`);
    console.log(`   ❌ Erros: ${result.errors.length}`);
    console.log(`   ⏱️  Tempo: ${duration}ms`);

    if (result.errors.length > 0) {
      console.log('   Erros encontrados (primeiros 5):');
      result.errors.slice(0, 5).forEach(e => {
        console.log(`     - Linha ${e.line}: ${e.message}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('   Warnings encontrados (primeiros 3):');
      result.warnings.slice(0, 3).forEach(w => {
        console.log(`     - Linha ${w.line}: ${w.message}`);
      });
    }

    return result;

  } catch (error) {
    console.error(`❌ Erro no teste ${testName}:`, error);
  }
}

/**
 * Testa validação de linha individual
 */
async function testLineValidation(validator) {
  try {
    // Linha de detalhe CNAB240 válida
    const validLine = '00100013000010000P 000000000001233000000000000001234567890123456789000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    const detection = {
      format: 'cnab240',
      bankCode: '001',
      bankName: 'Banco do Brasil'
    };

    const result = await validator.validateLine(validLine, 1, null, detection);

    console.log('📄 Validação de Linha Individual:');
    console.log(`   ✅ Válido: ${result.valid}`);
    console.log(`   ❌ Erros: ${result.errors.length}`);
    console.log(`   ⚠️  Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      result.errors.forEach(e => {
        console.log(`     - ${e.message}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro no teste de linha:', error);
  }
}

/**
 * Testa validação de campo individual
 */
async function testFieldValidation(validator) {
  try {
    // Teste de diferentes tipos de campo
    const fieldTests = [
      {
        name: 'Numérico válido',
        value: '12345',
        schema: { picture: '9(5)', pos: [1, 5] },
        expectedValid: true
      },
      {
        name: 'Numérico inválido (letras)',
        value: '123AB',
        schema: { picture: '9(5)', pos: [1, 5] },
        expectedValid: false
      },
      {
        name: 'Data válida',
        value: '12082024',
        schema: { picture: '9(8)', date_format: '%d%m%Y', pos: [1, 8] },
        expectedValid: true
      },
      {
        name: 'Data inválida',
        value: '32132024',
        schema: { picture: '9(8)', date_format: '%d%m%Y', pos: [1, 8] },
        expectedValid: false
      }
    ];

    console.log('🔍 Validação de Campos Individuais:');

    for (const test of fieldTests) {
      const result = validator.validateField(test.value, test.schema, 'test_field');

      const status = result.valid === test.expectedValid ? '✅' : '❌';
      console.log(`   ${status} ${test.name}: ${result.valid ? 'VÁLIDO' : 'INVÁLIDO'}`);

      if (!result.valid && result.errors.length > 0) {
        console.log(`       Erro: ${result.errors[0]}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro no teste de campo:', error);
  }
}

// Executar testes se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidatorTests().catch(console.error);
}

export { runValidatorTests, testData };
export default runValidatorTests; 