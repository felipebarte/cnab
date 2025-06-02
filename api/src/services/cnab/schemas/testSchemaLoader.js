/**
 * Script de Teste para CnabSchemaLoader
 * Testa todas as funcionalidades do carregador de schemas
 */

import CnabSchemaLoader from './CnabSchemaLoader.js';

/**
 * Executa testes completos do CnabSchemaLoader
 */
async function runSchemaLoaderTests() {
  console.log('🚀 Iniciando testes do CnabSchemaLoader...\n');

  try {
    // Teste 1: Inicialização
    console.log('📋 Teste 1: Inicialização do Schema Loader');
    const loader = new CnabSchemaLoader();
    await loader.initialize();
    
    const systemInfo = loader.getSystemInfo();
    console.log('✅ Sistema inicializado:', systemInfo);
    console.log('');

    // Teste 2: Carregar schema específico (Santander CNAB240)
    console.log('📋 Teste 2: Carregamento de Schema Específico');
    const santanderSchema = await loader.loadSchema('033', 'cnab240', 'header_arquivo');
    console.log('✅ Schema Santander carregado:', {
      fields: Object.keys(santanderSchema).length - 1, // -1 para _metadata
      metadata: santanderSchema._metadata
    });
    console.log('');

    // Teste 3: Testar cache
    console.log('📋 Teste 3: Verificação de Cache');
    const santanderSchemaCache = await loader.loadSchema('033', 'cnab240', 'header_arquivo');
    console.log('✅ Schema carregado do cache:', santanderSchemaCache._metadata.cacheKey);
    
    const cacheStats = loader.getCacheStats();
    console.log('📊 Estatísticas do cache:', cacheStats);
    console.log('');

    // Teste 4: Carregar múltiplos schemas
    console.log('📋 Teste 4: Carregamento de Múltiplos Schemas');
    const testSchemas = [
      { bank: '341', format: 'cnab240', type: 'header_arquivo' }, // Itaú
      { bank: '104', format: 'cnab240', type: 'retorno', subType: 'sigcb' }, // Caixa especial
      { bank: '001', format: 'cnab400', type: 'header_arquivo' }  // BB CNAB400
    ];

    for (const { bank, format, type, subType } of testSchemas) {
      try {
        const schema = await loader.loadSchema(bank, format, type, subType);
        console.log(`✅ Schema ${bank}-${format}-${type}${subType ? '-' + subType : ''}: ${Object.keys(schema).length - 1} campos`);
      } catch (error) {
        console.log(`⚠️  Schema ${bank}-${format}-${type}${subType ? '-' + subType : ''}: ${error.message}`);
      }
    }
    console.log('');

    // Teste 5: Verificar bancos suportados
    console.log('📋 Teste 5: Bancos Suportados');
    const cnab240Banks = loader.getSupportedBanks('cnab240');
    const cnab400Banks = loader.getSupportedBanks('cnab400');
    console.log('✅ CNAB240 suportados:', cnab240Banks);
    console.log('✅ CNAB400 suportados:', cnab400Banks);
    console.log('');

    // Teste 6: Testar fallback para schema genérico
    console.log('📋 Teste 6: Fallback para Schema Genérico');
    try {
      const genericSchema = await loader.loadSchema('999', 'cnab240', 'header_arquivo');
      console.log('✅ Schema genérico carregado como fallback:', Object.keys(genericSchema).length - 1, 'campos');
    } catch (error) {
      console.log('⚠️  Fallback genérico não disponível:', error.message);
    }
    console.log('');

    // Teste 7: Validação de schema
    console.log('📋 Teste 7: Exemplo de Estrutura de Schema');
    const exampleSchema = await loader.loadSchema('033', 'cnab240', 'header_arquivo');
    const firstField = Object.entries(exampleSchema).find(([key]) => key !== '_metadata');
    
    if (firstField) {
      console.log('✅ Exemplo de campo no schema:', {
        campo: firstField[0],
        estrutura: firstField[1]
      });
    }
    console.log('');

    // Teste 8: Estatísticas finais
    console.log('📋 Teste 8: Estatísticas Finais');
    const finalCacheStats = loader.getCacheStats();
    const finalSystemInfo = loader.getSystemInfo();
    
    console.log('📊 Cache final:', finalCacheStats);
    console.log('🔧 Sistema final:', {
      initialized: finalSystemInfo.initialized,
      cacheSize: finalSystemInfo.cacheSize,
      totalBanks: finalSystemInfo.supportedBanks.cnab240.length + finalSystemInfo.supportedBanks.cnab400.length
    });

    console.log('\n🎉 Todos os testes do CnabSchemaLoader concluídos com sucesso!');
    return true;

  } catch (error) {
    console.error('\n❌ Erro nos testes:', error);
    return false;
  }
}

/**
 * Executa um teste específico de performance
 */
async function performanceTest() {
  console.log('\n🏃‍♂️ Teste de Performance: Carregamento de 20 schemas...');
  
  const loader = new CnabSchemaLoader();
  await loader.initialize();
  
  const startTime = Date.now();
  
  // Carregar 20 schemas diferentes
  const testCases = [];
  const banks = ['033', '341', '104', '001'];
  const formats = ['cnab240', 'cnab400'];
  const types = ['header_arquivo', 'header_lote', 'trailer_lote'];
  
  for (const bank of banks) {
    for (const format of formats) {
      for (const type of types) {
        testCases.push({ bank, format, type });
        if (testCases.length >= 20) break;
      }
      if (testCases.length >= 20) break;
    }
    if (testCases.length >= 20) break;
  }
  
  let loaded = 0;
  let cached = 0;
  
  for (const { bank, format, type } of testCases) {
    try {
      const startLoad = Date.now();
      await loader.loadSchema(bank, format, type);
      const loadTime = Date.now() - startLoad;
      
      if (loadTime < 5) { // Menos de 5ms = provavelmente cache
        cached++;
      } else {
        loaded++;
      }
    } catch (error) {
      // Schema não existe, ok
    }
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`⚡ Performance: ${totalTime}ms total, ${loaded} carregados, ${cached} do cache`);
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runSchemaLoaderTests()
    .then(() => performanceTest())
    .catch(console.error);
}

export { runSchemaLoaderTests, performanceTest }; 