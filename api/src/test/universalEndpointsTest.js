/**
 * Testes dos Endpoints Universais CNAB
 * 
 * Teste abrangente dos novos endpoints /universal com arquivos reais.
 * Inclui validação de performance, respostas e integração.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do servidor de teste
const BASE_URL = 'http://localhost:3000/api/v1';
const UNIVERSAL_BASE = `${BASE_URL}/cnab/universal`;

/**
 * Helper para carregar arquivo de teste
 */
function loadTestFile(filename) {
  const filePath = path.join(__dirname, '../../../cnab-examples', filename);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.log(`⚠️ Arquivo ${filename} não encontrado: ${error.message}`);
    return null;
  }
}

/**
 * Helper para criar FormData com arquivo
 */
function createFormData(filename, content = null) {
  const form = new FormData();

  if (content) {
    // Usar conteúdo fornecido
    form.append('file', Buffer.from(content, 'utf8'), filename);
  } else {
    // Carregar arquivo do disco
    const filePath = path.join(__dirname, '../../../cnab-examples', filename);
    form.append('file', fs.createReadStream(filePath), filename);
  }

  return form;
}

/**
 * Helper para validar resposta padrão
 */
function validateUniversalResponse(response, operation) {
  console.log(`  ✓ Status: ${response.status}`);
  console.log(`  ✓ Success: ${response.data.success}`);
  console.log(`  ✓ Operation: ${response.data.operation}`);
  console.log(`  ✓ Timestamp: ${response.data.timestamp}`);

  if (response.data.metadata) {
    console.log(`  ✓ Operation ID: ${response.data.metadata.operationId}`);
    console.log(`  ✓ Version: ${response.data.metadata.version}`);

    if (response.data.metadata.timing) {
      console.log('  ✓ Timing:', response.data.metadata.timing);
    }
  }

  return response.data.success && response.data.operation === operation;
}

/**
 * Teste 1: GET /bancos - Lista bancos suportados
 */
async function testListarBancos() {
  console.log('\n🏦 === TESTE 1: LISTAR BANCOS ===');

  try {
    const response = await axios.get(`${UNIVERSAL_BASE}/bancos`);

    if (validateUniversalResponse(response, 'listar-bancos')) {
      console.log('✅ Endpoint /bancos funcionando');

      const { banks, statistics } = response.data.data;
      console.log(`📊 Total de bancos: ${statistics.totalBanks}`);
      console.log(`✅ Bancos suportados: ${statistics.supportedBanks}`);
      console.log(`📄 Total de schemas: ${statistics.totalSchemas}`);
      console.log(`📊 CNAB240: ${statistics.formatDistribution.cnab240} | CNAB400: ${statistics.formatDistribution.cnab400}`);

      // Mostrar alguns bancos
      console.log('\n🏦 Principais bancos:');
      banks.slice(0, 5).forEach(bank => {
        console.log(`   ${bank.code} - ${bank.name} (${bank.schemas.total} schemas)`);
      });

      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log('   Data:', error.response.data);
    }
    return false;
  }
}

/**
 * Teste 2: GET /schemas/{bankCode} - Schemas específicos
 */
async function testObterSchemasBanco() {
  console.log('\n📄 === TESTE 2: OBTER SCHEMAS DO BANCO ===');

  try {
    // Testar com banco Itaú (341)
    const response = await axios.get(`${UNIVERSAL_BASE}/schemas/341`);

    if (validateUniversalResponse(response, 'obter-schemas-banco')) {
      console.log('✅ Endpoint /schemas/{bankCode} funcionando');

      const { bankCode, bankName, schemas } = response.data.data;
      console.log(`🏦 Banco: ${bankCode} - ${bankName}`);
      console.log(`📄 Total de schemas: ${schemas.total}`);

      console.log('📊 Schemas por tipo:');
      Object.entries(schemas.byType).forEach(([type, typeSchemas]) => {
        if (typeSchemas.length > 0) {
          console.log(`   ${type}: ${typeSchemas.length} schemas`);
        }
      });

      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
    }
    return false;
  }
}

/**
 * Teste 3: POST /upload - Upload e análise básica
 */
async function testUpload() {
  console.log('\n📁 === TESTE 3: UPLOAD E ANÁLISE ===');

  try {
    const content = loadTestFile('rem58685.txt');
    if (!content) {
      console.log('⚠️ Arquivo de teste não encontrado');
      return false;
    }

    const form = createFormData('rem58685.txt');
    const config = {
      headers: {
        ...form.getHeaders(),
        'X-Operation-Id': 'test_upload_001'
      }
    };

    const response = await axios.post(`${UNIVERSAL_BASE}/upload`, form, config);

    if (validateUniversalResponse(response, 'upload')) {
      console.log('✅ Endpoint /upload funcionando');

      const { upload, detection, analysis } = response.data.data;

      console.log(`📁 Arquivo: ${upload.filename} (${upload.size} bytes)`);
      console.log(`🔍 Detecção: ${detection.format} - ${detection.bankName} (${detection.confidence}%)`);
      console.log(`📊 Linhas: ${analysis.statistics.totalLines}`);
      console.log(`📏 Tamanho linha: ${analysis.statistics.firstLineLength}`);

      console.log('📋 Tipos de registro:');
      Object.entries(analysis.recordTypes).forEach(([type, count]) => {
        console.log(`   Tipo ${type}: ${count} registros`);
      });

      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log('   Error:', error.response.data.error);
    }
    return false;
  }
}

/**
 * Teste 4: POST /validar - Validação especializada
 */
async function testValidar() {
  console.log('\n🛡️ === TESTE 4: VALIDAÇÃO ESPECIALIZADA ===');

  try {
    const content = loadTestFile('rem58685.txt');
    if (!content) {
      console.log('⚠️ Arquivo de teste não encontrado');
      return false;
    }

    // Testar via JSON (sem upload)
    const payload = {
      content
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-Operation-Id': 'test_validar_001'
      }
    };

    const response = await axios.post(`${UNIVERSAL_BASE}/validar`, payload, config);

    if (validateUniversalResponse(response, 'validar')) {
      console.log('✅ Endpoint /validar funcionando');

      const { detection, validation } = response.data.data;

      console.log(`🔍 Detecção: ${detection.format} - ${detection.bankName} (${detection.confidence}%)`);
      console.log(`🛡️ Válido: ${validation.isValid}`);
      console.log(`📊 Score: ${validation.score}`);
      console.log(`❌ Erros: ${validation.summary.totalErrors}`);
      console.log(`⚠️ Avisos: ${validation.summary.totalWarnings}`);

      console.log('📊 Erros por categoria:');
      Object.entries(validation.summary.errorsByCategory).forEach(([category, count]) => {
        if (count > 0) {
          console.log(`   ${category}: ${count} erros`);
        }
      });

      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log('   Error:', error.response.data.error);
    }
    return false;
  }
}

/**
 * Teste 5: POST /processar - Processamento completo
 */
async function testProcessar() {
  console.log('\n🔄 === TESTE 5: PROCESSAMENTO COMPLETO ===');

  try {
    const content = loadTestFile('rem58685.txt');
    if (!content) {
      console.log('⚠️ Arquivo de teste não encontrado');
      return false;
    }

    const form = createFormData('rem58685.txt');
    form.append('includeValidation', 'true');

    const config = {
      headers: {
        ...form.getHeaders(),
        'X-Operation-Id': 'test_processar_001'
      }
    };

    const response = await axios.post(`${UNIVERSAL_BASE}/processar`, form, config);

    if (validateUniversalResponse(response, 'processar')) {
      console.log('✅ Endpoint /processar funcionando');

      const { detection, parsing, validation } = response.data.data;

      console.log(`🔍 Detecção: ${detection.format} - ${detection.bankName} (${detection.confidence}%)`);
      console.log(`🔄 Parsing: ${parsing.success ? '✅' : '❌'}`);

      if (parsing.metadata) {
        console.log(`📊 Total linhas: ${parsing.metadata.totalLines}`);
        console.log(`📦 Total lotes: ${parsing.metadata.totalBatches}`);
        console.log(`📋 Total registros: ${parsing.metadata.totalRecords}`);
      }

      if (validation) {
        console.log(`🛡️ Validação: ${validation.isValid ? '✅' : '❌'} (Score: ${validation.score})`);
        console.log(`❌ Erros: ${validation.errors?.length || 0}`);
        console.log(`⚠️ Avisos: ${validation.warnings?.length || 0}`);
      }

      // Verificar estrutura dos dados parseados
      if (parsing.data) {
        console.log('\n📋 Estrutura dos dados parseados:');
        console.log(`   📁 Header arquivo: ${parsing.data.arquivo?.header ? '✅' : '❌'}`);
        console.log(`   📁 Trailer arquivo: ${parsing.data.arquivo?.trailer ? '✅' : '❌'}`);
        console.log(`   📦 Lotes: ${parsing.data.lotes?.length || 0}`);

        if (parsing.data.lotes && parsing.data.lotes.length > 0) {
          parsing.data.lotes.forEach((lote, index) => {
            console.log(`   📄 Lote ${index + 1}: ${lote.detalhes?.length || 0} detalhes`);
          });
        }
      }

      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log('   Error:', error.response.data.error);
    }
    return false;
  }
}

/**
 * Teste 6: Tratamento de erros
 */
async function testTratamentoErros() {
  console.log('\n⚠️ === TESTE 6: TRATAMENTO DE ERROS ===');

  let passedTests = 0;
  const totalTests = 3;

  // Teste 6.1: Arquivo inválido
  try {
    const invalidContent = 'conteudo invalido sem formato cnab';
    const payload = { content: invalidContent };

    await axios.post(`${UNIVERSAL_BASE}/validar`, payload);
    console.log('❌ Deveria ter falhado com conteúdo inválido');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Erro de conteúdo inválido capturado corretamente');
      passedTests++;
    }
  }

  // Teste 6.2: Banco inexistente
  try {
    await axios.get(`${UNIVERSAL_BASE}/schemas/999`);
    console.log('❌ Deveria ter falhado com banco inexistente');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✅ Erro de banco inexistente capturado corretamente');
      passedTests++;
    }
  }

  // Teste 6.3: Upload sem arquivo
  try {
    await axios.post(`${UNIVERSAL_BASE}/upload`, {});
    console.log('❌ Deveria ter falhado sem arquivo');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Erro de arquivo obrigatório capturado corretamente');
      passedTests++;
    }
  }

  console.log(`📊 Testes de erro: ${passedTests}/${totalTests} passaram`);
  return passedTests === totalTests;
}

/**
 * Teste principal
 */
async function runAllTests() {
  console.log('🚀 === INICIANDO TESTES DOS ENDPOINTS UNIVERSAIS ===');
  console.log(`🎯 Base URL: ${UNIVERSAL_BASE}`);

  const startTime = Date.now();
  let passedTests = 0;
  const totalTests = 6;

  // Executar todos os testes
  const tests = [
    testListarBancos,
    testObterSchemasBanco,
    testUpload,
    testValidar,
    testProcessar,
    testTratamentoErros
  ];

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.log(`❌ Teste falhou: ${error.message}`);
    }

    // Pequena pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const totalTime = Date.now() - startTime;

  console.log('\n📊 === RESULTADO FINAL DOS TESTES ===');
  console.log(`✅ Testes passaram: ${passedTests}/${totalTests}`);
  console.log(`⏱️ Tempo total: ${totalTime}ms`);
  console.log(`🎯 Taxa de sucesso: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (passedTests === totalTests) {
    console.log('🎉 Todos os testes dos endpoints universais passaram!');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os logs acima.');
  }

  return passedTests === totalTests;
}

// Executar testes se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export default runAllTests; 