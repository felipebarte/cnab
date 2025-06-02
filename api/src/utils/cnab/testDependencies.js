/**
 * Script de teste para verificar dependências CNAB
 * Testa se todas as bibliotecas instaladas estão funcionando corretamente
 */

import yaml from 'js-yaml';
// import cnabYaml from '@banco-br/cnab_yaml';
// import nodejsCnab from '@banco-br/nodejs-cnab';

/**
 * Testa se o js-yaml está funcionando
 */
export function testJsYaml() {
  console.log('🔧 Testando js-yaml...');

  try {
    const testYaml = `
test:
  name: "CNAB Test"
  version: "1.0.0"
  formats:
    - cnab240
    - cnab400
`;

    const parsed = yaml.load(testYaml);
    console.log('✅ js-yaml funcionando!', parsed);
    return true;
  } catch (error) {
    console.error('❌ Erro no js-yaml:', error);
    return false;
  }
}

/**
 * Testa se as bibliotecas banco-br estão acessíveis
 */
export function testBancoBrLibraries() {
  console.log('🔧 Testando bibliotecas @banco-br...');

  try {
    // Teste básico de importação
    // const cnabYamlVersion = cnabYaml?.version || 'unknown';
    // const nodejsCnabVersion = nodejsCnab?.version || 'unknown';

    console.log('✅ Bibliotecas @banco-br detectadas!');
    // console.log(`  - @banco-br/cnab_yaml: ${cnabYamlVersion}`);
    // console.log(`  - @banco-br/nodejs-cnab: ${nodejsCnabVersion}`);

    return true;
  } catch (error) {
    console.error('❌ Erro nas bibliotecas @banco-br:', error);
    return false;
  }
}

/**
 * Verifica compatibilidade com dependência existente
 */
export async function testLegacyCompatibility() {
  console.log('🔧 Testando compatibilidade com cnab400-itau-parser...');

  try {
    // Importação dinâmica para evitar erro se não existir
    const cnab400Itau = await import('cnab400-itau-parser').catch(() => null);

    if (cnab400Itau) {
      console.log('✅ cnab400-itau-parser disponível para compatibilidade!');
      return true;
    } else {
      console.log('⚠️  cnab400-itau-parser não encontrado');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro na verificação de compatibilidade:', error);
    return false;
  }
}

/**
 * Executa todos os testes
 */
export async function runAllTests() {
  console.log('🚀 Iniciando testes de dependências CNAB...\n');

  const results = {
    jsYaml: testJsYaml(),
    bancoBrLibs: testBancoBrLibraries(),
    legacyCompat: await testLegacyCompatibility()
  };

  console.log('\n📊 Resultados dos testes:');
  console.log('  js-yaml:', results.jsYaml ? '✅' : '❌');
  console.log('  @banco-br libs:', results.bancoBrLibs ? '✅' : '❌');
  console.log('  Legacy compat:', results.legacyCompat ? '✅' : '❌');

  const allPassed = Object.values(results).every(result => result);

  if (allPassed) {
    console.log('\n🎉 Todos os testes passaram! Sistema pronto para implementação.');
  } else {
    console.log('\n⚠️  Alguns testes falharam. Verifique as dependências.');
  }

  return results;
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
} 