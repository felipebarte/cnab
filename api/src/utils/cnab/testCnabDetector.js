/**
 * Script de Teste para CnabDetector
 * Testa a detecção automática de formatos CNAB
 */

import CnabDetector from './CnabDetector.js';

/**
 * Dados de teste simulando arquivos CNAB reais
 */
const testData = {
  // CNAB240 - Banco do Brasil (001) - exatamente 240 caracteres
  cnab240_bb: '001000000        20140908000000012345678910BANCO DO BRASIL S.A.                   001EMPRESA TESTE'.padEnd(240, '0'),

  // CNAB240 - Itaú (341) - exatamente 240 caracteres 
  cnab240_itau: '341000000        20140908000000012345678910BANCO ITAU S.A.                       341EMPRESA TESTE'.padEnd(240, '0'),

  // CNAB400 - Bradesco (237) - exatamente 400 caracteres
  cnab400_bradesco: '0                  0140908000000012345678910EMPRESA TESTE                                                                                         023701409000000000000'.padEnd(400, '0'),

  // CNAB400 - Itaú (341) - exatamente 400 caracteres
  cnab400_itau: '0                  0140908000000012345678910EMPRESA TESTE                                                                                         034101409000000000000'.padEnd(400, '0'),

  // Arquivo inválido
  invalid_file: 'Este não é um arquivo CNAB válido',

  // CNAB240 com múltiplas linhas
  cnab240_complete:
    '001000000        20140908000000012345678910BANCO DO BRASIL S.A.                   001EMPRESA TESTE'.padEnd(240, '0') + '\n' +
    '00100011P010001230000000000000001234567891001EMPRESA TESTE'.padEnd(240, '0') + '\n' +
    '991000000        000001'.padEnd(240, '0'),

  // CNAB400 com múltiplas linhas  
  cnab400_complete:
    '0                  0140908000000012345678910EMPRESA TESTE                                                                                         023701409000000000000'.padEnd(400, '0') + '\n' +
    '1                  012345678910012345678901234567890123456789012345678901234567890123456789012345678901234567890'.padEnd(400, '0') + '\n' +
    '9                  000001'.padEnd(400, '0')
};

/**
 * Executa testes completos do CnabDetector
 */
async function runDetectorTests() {
  console.log('🚀 Iniciando testes do CnabDetector...\n');

  const detector = new CnabDetector();

  try {
    // Teste 1: Detecção de CNAB240
    console.log('📋 Teste 1: Detecção CNAB240 - Banco do Brasil');
    const bb240 = detector.detectFormat(testData.cnab240_bb);
    console.log('✅ BB CNAB240:', {
      formato: bb240.format,
      banco: `${bb240.bankCode} - ${bb240.bankName}`,
      válido: bb240.isValidBank,
      confiança: `${bb240.confidence}%`,
      linhas: bb240.totalLines
    });
    console.log('');

    // Teste 2: Detecção de CNAB240 - Itaú
    console.log('📋 Teste 2: Detecção CNAB240 - Itaú');
    const itau240 = detector.detectFormat(testData.cnab240_itau);
    console.log('✅ Itaú CNAB240:', {
      formato: itau240.format,
      banco: `${itau240.bankCode} - ${itau240.bankName}`,
      válido: itau240.isValidBank,
      confiança: `${itau240.confidence}%`
    });
    console.log('');

    // Teste 3: Detecção de CNAB400 - Bradesco
    console.log('📋 Teste 3: Detecção CNAB400 - Bradesco');
    const bradesco400 = detector.detectFormat(testData.cnab400_bradesco);
    console.log('✅ Bradesco CNAB400:', {
      formato: bradesco400.format,
      banco: `${bradesco400.bankCode} - ${bradesco400.bankName}`,
      válido: bradesco400.isValidBank,
      confiança: `${bradesco400.confidence}%`
    });
    console.log('');

    // Teste 4: Detecção de CNAB400 - Itaú
    console.log('📋 Teste 4: Detecção CNAB400 - Itaú');
    const itau400 = detector.detectFormat(testData.cnab400_itau);
    console.log('✅ Itaú CNAB400:', {
      formato: itau400.format,
      banco: `${itau400.bankCode} - ${itau400.bankName}`,
      válido: itau400.isValidBank,
      confiança: `${itau400.confidence}%`
    });
    console.log('');

    // Teste 5: Arquivo inválido
    console.log('📋 Teste 5: Detecção de Arquivo Inválido');
    try {
      const invalid = detector.detectFormat(testData.invalid_file);
      console.log('⚠️  Arquivo inválido detectado como:', invalid);
    } catch (error) {
      console.log('✅ Arquivo inválido rejeitado corretamente:', error.message);
    }
    console.log('');

    // Teste 6: Arquivo CNAB240 completo
    console.log('📋 Teste 6: Análise de Arquivo CNAB240 Completo');
    const complete240 = detector.detectFormat(testData.cnab240_complete);
    console.log('✅ CNAB240 Completo:', {
      formato: complete240.format,
      banco: complete240.bankName,
      linhas: complete240.totalLines,
      header: complete240.hasHeader,
      trailer: complete240.hasTrailer,
      registros: complete240.estimatedRecords,
      tiposRegistro: Array.from(complete240.recordTypes),
      confiança: `${complete240.confidence}%`
    });
    console.log('');

    // Teste 7: Arquivo CNAB400 completo
    console.log('📋 Teste 7: Análise de Arquivo CNAB400 Completo');
    const complete400 = detector.detectFormat(testData.cnab400_complete);
    console.log('✅ CNAB400 Completo:', {
      formato: complete400.format,
      banco: complete400.bankName,
      linhas: complete400.totalLines,
      header: complete400.hasHeader,
      trailer: complete400.hasTrailer,
      registros: complete400.estimatedRecords,
      tiposRegistro: Array.from(complete400.recordTypes),
      confiança: `${complete400.confidence}%`
    });
    console.log('');

    // Teste 8: Detecção rápida (quick detect)
    console.log('📋 Teste 8: Detecção Rápida (Quick Detect)');
    const quickBB = detector.quickDetect(testData.cnab240_bb);
    const quickBradesco = detector.quickDetect(testData.cnab400_bradesco);

    console.log('✅ Quick Detect BB:', `${quickBB.format} - ${quickBB.bankName}`);
    console.log('✅ Quick Detect Bradesco:', `${quickBradesco.format} - ${quickBradesco.bankName}`);
    console.log('');

    // Teste 9: Validação de arquivos
    console.log('📋 Teste 9: Validação de Arquivos CNAB');
    const validFiles = [
      { name: 'CNAB240 BB', data: testData.cnab240_bb },
      { name: 'CNAB240 Itaú', data: testData.cnab240_itau },
      { name: 'CNAB400 Bradesco', data: testData.cnab400_bradesco },
      { name: 'Arquivo Inválido', data: testData.invalid_file }
    ];

    for (const file of validFiles) {
      const isValid = detector.isValidCnabFile(file.data);
      console.log(`${isValid ? '✅' : '❌'} ${file.name}: ${isValid ? 'Válido' : 'Inválido'}`);
    }
    console.log('');

    // Teste 10: Bancos suportados
    console.log('📋 Teste 10: Bancos Suportados');
    const supportedBanks = detector.getSupportedBanks();
    console.log('✅ Total de bancos suportados:', Object.keys(supportedBanks).length);
    console.log('📊 Lista de bancos:');
    Object.entries(supportedBanks).forEach(([code, name]) => {
      console.log(`   ${code}: ${name}`);
    });

    console.log('\n🎉 Todos os testes do CnabDetector concluídos com sucesso!');
    return true;

  } catch (error) {
    console.error('\n❌ Erro nos testes:', error);
    return false;
  }
}

/**
 * Teste de performance do detector
 */
async function performanceTest() {
  console.log('\n🏃‍♂️ Teste de Performance do CnabDetector...');

  const detector = new CnabDetector();
  const iterations = 1000;

  // Teste de detecção rápida
  const startQuick = Date.now();
  for (let i = 0; i < iterations; i++) {
    detector.quickDetect(testData.cnab240_bb);
  }
  const quickTime = Date.now() - startQuick;

  // Teste de detecção completa
  const startComplete = Date.now();
  for (let i = 0; i < 100; i++) { // Menos iterações para detecção completa
    detector.detectFormat(testData.cnab240_complete);
  }
  const completeTime = Date.now() - startComplete;

  console.log('⚡ Performance Results:');
  console.log(`   Quick Detect: ${quickTime}ms para ${iterations} detecções (${(quickTime / iterations).toFixed(2)}ms cada)`);
  console.log(`   Complete Detect: ${completeTime}ms para 100 detecções (${(completeTime / 100).toFixed(2)}ms cada)`);
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runDetectorTests()
    .then(() => performanceTest())
    .catch(console.error);
}

export { runDetectorTests, performanceTest }; 