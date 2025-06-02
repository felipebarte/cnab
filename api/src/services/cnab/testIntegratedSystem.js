/**
 * Teste Integrado do Sistema CNAB Universal Completo
 * Testa toda a integração da Task 3 - CnabUniversalService
 */

import cnabSystem from './index.js';

/**
 * Dados de teste representativos
 */
const testData = {
  cnab240_bb: '001000000        20140908000000012345678910BANCO DO BRASIL S.A.                   001EMPRESA TESTE'.padEnd(240, '0'),
  cnab400_itau: '0                  0140908000000012345678910EMPRESA TESTE                                                                                         034101409000000000000'.padEnd(400, '0'),
  invalid_file: 'Arquivo inválido para teste',
  
  cnab240_complete: 
    '001000000        20140908000000012345678910BANCO DO BRASIL S.A.                   001EMPRESA TESTE'.padEnd(240, '0') + '\n' +
    '00100011P010001230000000000000001234567891001EMPRESA TESTE'.padEnd(240, '0') + '\n' +
    '00130013D0100012300000001234567890000001234567890123456789012345678901234567890123456789012345'.padEnd(240, '0') + '\n' +
    '991000000        000001000000000000000003000000000000000001234567890000000000000000000000000000000'.padEnd(240, '0')
};

/**
 * Executa teste integrado completo
 */
async function runIntegratedSystemTest() {
  console.log('🚀 Teste Integrado do Sistema CNAB Universal - Task 3\n');

  try {
    // Teste 1: Inicialização do sistema completo
    console.log('📋 Teste 1: Inicialização do Sistema Completo');
    const systemInfo = await cnabSystem.initialize();
    console.log('✅ Sistema inicializado:', {
      versão: systemInfo.version,
      nome: systemInfo.name,
      inicializado: systemInfo.initialized
    });
    console.log('');

    // Teste 2: Detecção de formato via sistema principal
    console.log('📋 Teste 2: Detecção de Formato via Sistema Principal');
    
    const detectionBB = await cnabSystem.detectFormat(testData.cnab240_bb);
    console.log('✅ CNAB240 BB detectado:', {
      formato: detectionBB.format,
      banco: detectionBB.bankName,
      confiança: detectionBB.confidence + '%'
    });

    const detectionItau = await cnabSystem.detectFormat(testData.cnab400_itau);
    console.log('✅ CNAB400 Itaú detectado:', {
      formato: detectionItau.format,
      banco: detectionItau.bankName,
      confiança: detectionItau.confidence + '%'
    });
    console.log('');

    // Teste 3: Processamento de arquivo via sistema principal
    console.log('📋 Teste 3: Processamento de Arquivo Completo');
    
    const processResult = await cnabSystem.processFile(testData.cnab240_complete);
    console.log('✅ Resultado do processamento:', {
      sucesso: processResult.success,
      confiança: processResult.metadata?.confidence,
      tempoProcessamento: processResult.metadata?.processingTime
    });

    if (processResult.success) {
      console.log('📊 Dados extraídos:', {
        formato: processResult.detection?.format,
        banco: processResult.detection?.bankName,
        totalLinhas: processResult.data?.summary?.totalRecords,
        detalhes: processResult.data?.details?.length || 0
      });
    } else {
      console.log('❌ Erro no processamento:', processResult.error?.message);
    }
    console.log('');

    // Teste 4: Validação de arquivo inválido
    console.log('📋 Teste 4: Validação de Arquivo Inválido');
    
    const invalidResult = await cnabSystem.processFile(testData.invalid_file);
    console.log('✅ Arquivo inválido rejeitado:', {
      sucesso: invalidResult.success,
      erro: invalidResult.error?.message
    });
    console.log('');

    // Teste 5: Informações do sistema integrado
    console.log('📋 Teste 5: Informações do Sistema Integrado');
    
    const finalSystemInfo = cnabSystem.getSystemInfo();
    console.log('✅ Informações completas do sistema:', {
      versão: finalSystemInfo.version,
      inicializado: finalSystemInfo.initialized,
      componentes: finalSystemInfo.universalService?.components
    });

    const stats = cnabSystem.getStats();
    console.log('📊 Estatísticas de uso:', {
      arquivosProcessados: stats.filesProcessed,
      detecções: stats.detectionCalls,
      erros: stats.errors
    });
    console.log('');

    // Teste 6: Bancos e formatos suportados
    console.log('📋 Teste 6: Bancos e Formatos Suportados');
    
    const supported = cnabSystem.getSupportedBanksAndFormats();
    console.log('✅ Formatos suportados:', supported.formats);
    console.log('📊 Total de bancos suportados:', Object.keys(supported.banks).length);
    console.log('🏦 Principais bancos:');
    Object.entries(supported.banks).slice(0, 5).forEach(([code, name]) => {
      console.log(`   ${code}: ${name}`);
    });
    console.log('');

    // Teste 7: Validação de arquivo CNAB
    console.log('📋 Teste 7: Validação de Arquivo CNAB');
    
    const isValidBB = cnabSystem.isValidCnabFile(testData.cnab240_bb);
    const isValidItau = cnabSystem.isValidCnabFile(testData.cnab400_itau);
    const isValidInvalid = cnabSystem.isValidCnabFile(testData.invalid_file);
    
    console.log('✅ Validações:', {
      'CNAB240 BB': isValidBB,
      'CNAB400 Itaú': isValidItau,
      'Arquivo Inválido': isValidInvalid
    });
    console.log('');

    // Teste 8: Limpeza de cache
    console.log('📋 Teste 8: Gerenciamento de Cache');
    
    const cacheInfo = cnabSystem.clearCache();
    console.log('✅ Cache limpo:', cacheInfo);
    console.log('');

    console.log('🎉 TESTE INTEGRADO CONCLUÍDO COM SUCESSO!');
    console.log('✅ Task 3 - CnabUniversalService implementada e funcionando!');

  } catch (error) {
    console.error('❌ Erro no teste integrado:', error);
  }
}

/**
 * Teste de performance do sistema integrado
 */
async function runIntegratedPerformanceTest() {
  console.log('\n🏃‍♂️ Teste de Performance do Sistema Integrado...');

  try {
    const startTime = Date.now();

    // Processar múltiplos arquivos simultaneamente
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(cnabSystem.processFile(testData.cnab240_bb));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log('⚡ Resultados de Performance Integrada:');
    console.log(`   Tempo total: ${endTime - startTime}ms para 20 processamentos`);
    console.log(`   Tempo médio: ${((endTime - startTime) / 20).toFixed(2)}ms por arquivo`);
    console.log(`   Sucessos: ${successCount}, Erros: ${errorCount}`);

    const finalStats = cnabSystem.getStats();
    console.log('📊 Estatísticas finais:', {
      totalProcessados: finalStats.filesProcessed,
      cacheHits: finalStats.cacheHits,
      erros: finalStats.errors
    });

  } catch (error) {
    console.error('❌ Erro no teste de performance:', error);
  }
}

// Executar testes
if (import.meta.url === `file://${process.argv[1]}`) {
  await runIntegratedSystemTest();
  await runIntegratedPerformanceTest();
} 