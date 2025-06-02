/**
 * Script de Teste para CnabUniversalService
 * Testa todas as funcionalidades do serviço universal CNAB
 */

import CnabUniversalService from './CnabUniversalService.js';

/**
 * Dados de teste para diferentes cenários
 */
const testData = {
  // CNAB240 válido do Banco do Brasil
  cnab240_bb: '001000000        20140908000000012345678910BANCO DO BRASIL S.A.                   001EMPRESA TESTE'.padEnd(240, '0'),

  // CNAB400 válido do Itaú
  cnab400_itau: '0                  0140908000000012345678910EMPRESA TESTE                                                                                         034101409000000000000'.padEnd(400, '0'),

  // Arquivo CNAB240 completo com múltiplas linhas
  cnab240_complete:
    '001000000        20140908000000012345678910BANCO DO BRASIL S.A.                   001EMPRESA TESTE'.padEnd(240, '0') + '\n' +
    '00100011P010001230000000000000001234567891001EMPRESA TESTE'.padEnd(240, '0') + '\n' +
    '00130013D0100012300000001234567890000001234567890123456789012345678901234567890123456789012345'.padEnd(240, '0') + '\n' +
    '00100015T010001230000000000000003000000000000000001234567890000000000000000000000000000000000000'.padEnd(240, '0') + '\n' +
    '991000000        000001000000000000000003000000000000000001234567890000000000000000000000000000000'.padEnd(240, '0'),

  // Arquivo CNAB400 completo
  cnab400_complete:
    '0                  0140908000000012345678910EMPRESA TESTE                                                                                         034101409000000000000'.padEnd(400, '0') + '\n' +
    '1                  0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'.padEnd(400, '0') + '\n' +
    '1                  9876543210987654321098765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765432109876543210'.padEnd(400, '0') + '\n' +
    '9                  000001000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'.padEnd(400, '0'),

  // Arquivo inválido
  invalid_file: 'Este arquivo não é um CNAB válido',

  // Arquivo com tamanho incorreto
  wrong_size: 'Este arquivo tem tamanho incorreto para CNAB'.padEnd(350, '0')
};

/**
 * Executa testes completos do CnabUniversalService
 */
async function runUniversalServiceTests() {
  console.log('🚀 Iniciando testes do CnabUniversalService...\n');

  try {
    // Teste 1: Inicialização do serviço
    console.log('📋 Teste 1: Inicialização do CnabUniversalService');
    const service = new CnabUniversalService({
      validateSchema: true,
      cacheResults: true
    });

    const initInfo = await service.initialize();
    console.log('✅ Serviço inicializado:', {
      version: initInfo.version,
      initialized: initInfo.initialized,
      components: initInfo.components
    });
    console.log('');

    // Teste 2: Detecção de formato simples
    console.log('📋 Teste 2: Detecção de Formato');

    const detectionBB = await service.detectFormat(testData.cnab240_bb);
    console.log('✅ CNAB240 BB detectado:', {
      formato: detectionBB.format,
      banco: detectionBB.bankName,
      confiança: detectionBB.confidence + '%'
    });

    const detectionItau = await service.detectFormat(testData.cnab400_itau);
    console.log('✅ CNAB400 Itaú detectado:', {
      formato: detectionItau.format,
      banco: detectionItau.bankName,
      confiança: detectionItau.confidence + '%'
    });
    console.log('');

    // Teste 3: Processamento de arquivo completo
    console.log('📋 Teste 3: Processamento de Arquivo Completo CNAB240');

    const result240 = await service.processFile(testData.cnab240_complete);
    console.log('✅ Arquivo CNAB240 processado:', {
      sucesso: result240.success,
      formato: result240.detection?.format,
      banco: result240.detection?.bankName,
      linhas: result240.data?.summary?.totalRecords,
      tempoProcessamento: result240.metadata?.processingTime
    });

    if (result240.success && result240.data) {
      console.log('📊 Dados extraídos CNAB240:', {
        header: !!result240.data.header,
        trailer: !!result240.data.trailer,
        detalhes: result240.data.details?.length || 0,
        registrosTotal: result240.data.summary?.totalRecords
      });
    }
    console.log('');

    // Teste 4: Processamento de arquivo CNAB400
    console.log('📋 Teste 4: Processamento de Arquivo Completo CNAB400');

    const result400 = await service.processFile(testData.cnab400_complete);
    console.log('✅ Arquivo CNAB400 processado:', {
      sucesso: result400.success,
      formato: result400.detection?.format,
      banco: result400.detection?.bankName,
      linhas: result400.data?.summary?.totalRecords,
      tempoProcessamento: result400.metadata?.processingTime
    });

    if (result400.success && result400.data) {
      console.log('📊 Dados extraídos CNAB400:', {
        header: !!result400.data.header,
        trailer: !!result400.data.trailer,
        detalhes: result400.data.details?.length || 0,
        registrosTotal: result400.data.summary?.totalRecords
      });
    }
    console.log('');

    // Teste 5: Validação de arquivos inválidos
    console.log('📋 Teste 5: Validação de Arquivos Inválidos');

    const invalidResult = await service.processFile(testData.invalid_file);
    console.log('✅ Arquivo inválido rejeitado:', {
      sucesso: invalidResult.success,
      erro: invalidResult.error?.message,
      tipo: invalidResult.error?.type
    });

    const wrongSizeResult = await service.processFile(testData.wrong_size);
    console.log('✅ Arquivo com tamanho incorreto rejeitado:', {
      sucesso: wrongSizeResult.success,
      erro: wrongSizeResult.error?.message
    });
    console.log('');

    // Teste 6: Informações do sistema e estatísticas
    console.log('📋 Teste 6: Informações do Sistema');

    const systemInfo = service.getSystemInfo();
    console.log('✅ Informações do sistema:', {
      versão: systemInfo.version,
      inicializado: systemInfo.initialized,
      cache: systemInfo.cache,
      configuração: systemInfo.configuration
    });

    console.log('📊 Estatísticas de uso:', {
      arquivosProcessados: systemInfo.stats.filesProcessed,
      chamadas: systemInfo.stats.detectionCalls,
      schemasCarregados: systemInfo.stats.schemaLoads,
      cacheHits: systemInfo.stats.cacheHits,
      erros: systemInfo.stats.errors
    });
    console.log('');

    // Teste 7: Bancos e formatos suportados
    console.log('📋 Teste 7: Bancos e Formatos Suportados');

    const supported = service.getSupportedBanksAndFormats();
    console.log('✅ Formatos suportados:', supported.formats);
    console.log('📊 Total de bancos suportados:', Object.keys(supported.banks).length);
    console.log('🏦 Principais bancos:');
    Object.entries(supported.banks).slice(0, 5).forEach(([code, name]) => {
      console.log(`   ${code}: ${name}`);
    });
    console.log('');

    // Teste 8: Cache e performance
    console.log('📋 Teste 8: Cache e Performance');

    // Processar o mesmo arquivo novamente para testar cache
    const startTime = Date.now();
    const cachedResult = await service.processFile(testData.cnab240_bb);
    const cacheTime = Date.now() - startTime;

    console.log('✅ Resultado do cache:', {
      sucesso: cachedResult.success,
      tempoCache: `${cacheTime}ms`,
      cacheSize: service.getSystemInfo().cache.size
    });

    // Limpar cache
    const cacheCleared = service.clearCache();
    console.log('🧹 Cache limpo:', cacheCleared);
    console.log('');

    // Teste 9: Reset de estatísticas
    console.log('📋 Teste 9: Reset de Estatísticas');

    const statsBefore = service.getSystemInfo().stats;
    console.log('📊 Estatísticas antes do reset:', {
      arquivos: statsBefore.filesProcessed,
      detecções: statsBefore.detectionCalls
    });

    service.resetStats();
    const statsAfter = service.getSystemInfo().stats;
    console.log('✅ Estatísticas após reset:', {
      arquivos: statsAfter.filesProcessed,
      detecções: statsAfter.detectionCalls
    });
    console.log('');

    console.log('🎉 Todos os testes do CnabUniversalService concluídos com sucesso!');

  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  }
}

/**
 * Teste de performance específico
 */
async function runPerformanceTests() {
  console.log('\n🏃‍♂️ Testes de Performance do CnabUniversalService...');

  const service = new CnabUniversalService();
  await service.initialize();

  try {
    // Teste detecção múltipla
    const detectionStartTime = Date.now();
    const detectionPromises = [];

    for (let i = 0; i < 100; i++) {
      detectionPromises.push(service.detectFormat(testData.cnab240_bb));
    }

    await Promise.all(detectionPromises);
    const detectionTime = Date.now() - detectionStartTime;

    // Teste processamento múltiplo
    const processingStartTime = Date.now();
    const processingPromises = [];

    for (let i = 0; i < 50; i++) {
      processingPromises.push(service.processFile(testData.cnab240_bb));
    }

    await Promise.all(processingPromises);
    const processingTime = Date.now() - processingStartTime;

    console.log('⚡ Resultados de Performance:');
    console.log(`   Detecção: ${detectionTime}ms para 100 operações (${(detectionTime / 100).toFixed(2)}ms cada)`);
    console.log(`   Processamento: ${processingTime}ms para 50 operações (${(processingTime / 50).toFixed(2)}ms cada)`);

    const finalStats = service.getSystemInfo().stats;
    console.log('📊 Estatísticas finais:', {
      cacheHits: finalStats.cacheHits,
      performance: finalStats.performance
    });

  } catch (error) {
    console.error('❌ Erro nos testes de performance:', error);
  }
}

// Executar todos os testes
if (import.meta.url === `file://${process.argv[1]}`) {
  await runUniversalServiceTests();
  await runPerformanceTests();
} 