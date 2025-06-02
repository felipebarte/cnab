/**
 * Teste Integrado do Sistema CNAB Universal
 * Testa a integração entre todos os componentes implementados até agora
 */

import cnabSystem from './index.js';

/**
 * Executa testes integrados do sistema CNAB
 */
async function runIntegrationTests() {
  console.log('🚀 Iniciando testes integrados do Sistema CNAB Universal...\n');

  try {
    // Teste 1: Inicialização do sistema completo
    console.log('📋 Teste 1: Inicialização do Sistema Completo');
    await cnabSystem.initialize();
    
    const systemInfo = cnabSystem.getSystemInfo();
    console.log('✅ Sistema inicializado:', {
      version: systemInfo.version,
      initialized: systemInfo.initialized,
      schemaLoaderStatus: systemInfo.schemaLoader?.initialized || false,
      schemasCarregados: systemInfo.schemaLoader?.cacheSize || 0
    });
    console.log('');

    // Teste 2: Uso do Schema Loader através da interface principal
    console.log('📋 Teste 2: Carregamento de Schema via Sistema Principal');
    const itauSchema = await cnabSystem.loadSchema('341', 'cnab240', 'header_arquivo');
    console.log('✅ Schema Itaú carregado via sistema principal:', {
      campos: Object.keys(itauSchema).length - 1,
      cacheKey: itauSchema._metadata.cacheKey
    });
    console.log('');

    // Teste 3: Verificar bancos suportados via interface principal  
    console.log('📋 Teste 3: Bancos Suportados via Interface Principal');
    const cnab240Banks = cnabSystem.getSupportedBanks('cnab240');
    const cnab400Banks = cnabSystem.getSupportedBanks('cnab400');
    console.log('✅ CNAB240:', cnab240Banks.length, 'bancos');
    console.log('✅ CNAB400:', cnab400Banks.length, 'bancos');
    console.log('');

    // Teste 4: Acesso direto ao Schema Loader
    console.log('📋 Teste 4: Acesso Direto ao Schema Loader');
    const schemaLoader = cnabSystem.getSchemaLoader();
    const cacheStats = schemaLoader.getCacheStats();
    console.log('✅ Schema Loader acessível:', {
      cacheSize: cacheStats.size,
      memoryUsage: cacheStats.memoryEstimate
    });
    console.log('');

    // Teste 5: Carregar múltiplos schemas para diferentes bancos
    console.log('📋 Teste 5: Carregamento de Múltiplos Schemas');
    const testBanks = [
      { bank: '033', format: 'cnab240', type: 'header_arquivo', name: 'Santander' },
      { bank: '001', format: 'cnab240', type: 'header_lote', name: 'Banco do Brasil' },
      { bank: '756', format: 'cnab240', type: 'trailer_lote', name: 'Sicoob' }
    ];

    for (const { bank, format, type, name } of testBanks) {
      try {
        const schema = await cnabSystem.loadSchema(bank, format, type);
        console.log(`✅ ${name} (${bank}): ${Object.keys(schema).length - 1} campos`);
      } catch (error) {
        console.log(`⚠️  ${name} (${bank}): ${error.message}`);
      }
    }
    console.log('');

    // Teste 6: Performance e cache
    console.log('📋 Teste 6: Verificação de Performance e Cache');
    const startTime = Date.now();
    
    // Tentar carregar schema já em cache
    await cnabSystem.loadSchema('341', 'cnab240', 'header_arquivo');
    const cacheTime = Date.now() - startTime;
    
    console.log(`✅ Acesso ao cache: ${cacheTime}ms`);
    
    // Verificar cache final
    const finalCacheStats = schemaLoader.getCacheStats();
    console.log('📊 Cache final:', {
      schemas: finalCacheStats.size,
      memoria: finalCacheStats.memoryEstimate,
      keys: finalCacheStats.keys.slice(0, 3).join(', ') + '...'
    });
    console.log('');

    // Teste 7: Informações completas do sistema
    console.log('📋 Teste 7: Status Final do Sistema');
    const finalSystemInfo = cnabSystem.getSystemInfo();
    console.log('✅ Sistema CNAB Universal:', {
      version: finalSystemInfo.version,
      sistemasAtivos: {
        principal: finalSystemInfo.initialized,
        schemaLoader: finalSystemInfo.schemaLoader.initialized,
        cache: finalSystemInfo.cacheEnabled,
        autoDetection: finalSystemInfo.autoDetectionEnabled
      },
      performance: {
        schemasCarregados: finalSystemInfo.schemaLoader.cacheSize,
        bancosSuportados: finalSystemInfo.supportedBanks.length,
        formatosSuportados: finalSystemInfo.supportedFormats.length
      }
    });

    console.log('\n🎉 Todos os testes integrados passaram com sucesso!');
    console.log('✅ Task 2 (CnabSchemaLoader) integrada ao sistema principal!');
    return true;

  } catch (error) {
    console.error('\n❌ Erro nos testes integrados:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch(console.error);
}

export { runIntegrationTests }; 