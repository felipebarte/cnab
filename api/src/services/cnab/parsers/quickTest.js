/**
 * Teste Rápido - CnabParserService
 * 
 * Teste focado no parsing básico usando arquivo real CNAB240
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CnabParserService from './CnabParserService.js';
import CnabUniversalService from '../CnabUniversalService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega arquivo real CNAB240 do Banco Itaú
 */
function loadRealCnab240() {
  const filePath = path.join(__dirname, '../../../../cnab-examples/pix32946.txt');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    console.log(`📁 Arquivo carregado: ${lines.length} linhas`);
    console.log(`📏 Primeira linha: ${lines[0].length} caracteres`);

    // Mostrar alguns detalhes
    console.log(`🏦 Código banco: '${lines[0].substring(0, 3)}'`);
    console.log(`📋 Tipo registro: '${lines[0].charAt(7)}'`);

    return content;
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return null;
  }
}

async function quickTest() {
  console.log('🚀 === TESTE RÁPIDO CNAB PARSER ===\n');

  try {
    // 1. Carregar arquivo real
    const cnab240Data = loadRealCnab240();
    if (!cnab240Data) {
      console.log('❌ Falha ao carregar arquivo');
      return;
    }

    // 2. Inicializar serviços essenciais
    console.log('🔧 Inicializando serviços...');
    const universalService = new CnabUniversalService();
    await universalService.initialize();

    const parserService = new CnabParserService();
    await parserService.initialize();
    console.log('✅ Serviços prontos\n');

    // 3. Detectar formato
    console.log('🔍 Detectando formato...');
    const detection = await universalService.detectFormat(cnab240Data);
    console.log('📊 Detecção:', {
      formato: detection.format,
      banco: detection.bankName,
      codigo: detection.bankCode,
      confiança: `${detection.confidence}%`
    });

    // 4. Fazer parsing
    console.log('\n🔄 Iniciando parsing...');
    const startTime = Date.now();
    const result = await parserService.parseFile(cnab240Data, detection);
    const parseTime = Date.now() - startTime;

    // 5. Resultados
    if (result.success) {
      console.log('✅ PARSING CONCLUÍDO COM SUCESSO!');
      console.log('📊 Resultados:', {
        formato: result.metadata.format,
        banco: result.metadata.bankName,
        totalLinhas: result.metadata.totalLines,
        totalLotes: result.metadata.totalBatches,
        totalDetalhes: result.metadata.totalRecords,
        tempoProcessamento: `${parseTime}ms`
      });

      // Estrutura dos dados
      console.log('\n📋 Estrutura dos dados:');
      console.log(`   📁 Header arquivo: ${!!result.data.arquivo.header ? '✅' : '❌'}`);
      console.log(`   📁 Trailer arquivo: ${!!result.data.arquivo.trailer ? '✅' : '❌'}`);
      console.log(`   📦 Lotes: ${result.data.lotes?.length || 0}`);

      if (result.data.lotes && result.data.lotes.length > 0) {
        const firstBatch = result.data.lotes[0];
        console.log(`   📄 Primeiro lote: ${firstBatch.detalhes?.length || 0} detalhes`);
      }

      // Campos extraídos do header
      if (result.data.arquivo.header && result.data.arquivo.header.fields) {
        const headerFields = Object.keys(result.data.arquivo.header.fields);
        console.log(`   🔍 Campos header: ${headerFields.length} campos extraídos`);
      }

    } else {
      console.log('⚠️ PARSING CONCLUÍDO COM PROBLEMAS:');
      console.log(`   ❌ Erros: ${result.errors?.length || 0}`);
      console.log(`   ⚠️ Avisos: ${result.warnings?.length || 0}`);

      if (result.errors && result.errors.length > 0) {
        console.log('\n📋 Principais erros:');
        result.errors.slice(0, 3).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.message}`);
        });
      }

      // Verificar se ainda conseguiu extrair dados
      if (result.data && result.data.metadata) {
        console.log('\n✅ Mesmo com erros, conseguiu extrair dados básicos');
      }
    }

    console.log(`\n⚡ Tempo total: ${parseTime}ms`);
    console.log('🎉 Teste concluído!');

  } catch (error) {
    console.log('❌ Erro fatal:', error.message);
    console.log('📋 Stack:', error.stack);
  }
}

// Executar teste
quickTest().catch(console.error); 