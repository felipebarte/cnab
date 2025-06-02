/**
 * Teste Específico - rem58685.txt
 * 
 * Teste focado no arquivo de remessa CNAB240 do Banco Itaú
 * Arquivo: rem58685.txt (36 linhas, CNAB240)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CnabParserService from './CnabParserService.js';
import CnabUniversalService from '../CnabUniversalService.js';
import CnabValidatorService from '../validators/CnabValidatorService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega arquivo rem58685.txt
 */
function loadRemessaFile() {
  const filePath = path.join(__dirname, '../../../../cnab-examples/rem58685.txt');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    console.log(`📁 Arquivo carregado: rem58685.txt`);
    console.log(`📊 Total de linhas: ${lines.length}`);
    console.log(`📏 Primeira linha: ${lines[0].length} caracteres`);

    // Analisar estrutura das linhas
    console.log('\n🔍 Análise da estrutura:');
    console.log(`🏦 Código banco: '${lines[0].substring(0, 3)}'`);
    console.log(`📋 Tipo registro primeira linha: '${lines[0].charAt(7)}'`);
    console.log(`📋 Tipo registro última linha: '${lines[lines.length - 1].charAt(7)}'`);

    // Contar tipos de registro
    const tiposRegistro = {};
    lines.forEach((line, index) => {
      const tipo = line.charAt(7);
      tiposRegistro[tipo] = (tiposRegistro[tipo] || 0) + 1;
    });

    console.log('📊 Tipos de registro encontrados:', tiposRegistro);

    return content;
  } catch (error) {
    console.log(`❌ Erro ao carregar arquivo: ${error.message}`);
    return null;
  }
}

/**
 * Análise detalhada do arquivo
 */
function analyzeFileStructure(content) {
  const lines = content.trim().split('\n');
  console.log('\n🔬 === ANÁLISE DETALHADA DA ESTRUTURA ===');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const tipoRegistro = line.charAt(7);
    const codigoBanco = line.substring(0, 3);
    const lote = line.substring(3, 7);

    console.log(`Linha ${lineNum.toString().padStart(2, '0')}: Banco=${codigoBanco} | Lote=${lote} | Tipo=${tipoRegistro} | Tam=${line.length}`);

    // Mostrar início da linha para identificação
    if (line.length > 50) {
      console.log(`        Início: ${line.substring(0, 50)}...`);
    } else {
      console.log(`        Completa: ${line}`);
    }
  });

  console.log('');
}

async function testRem58685() {
  console.log('🚀 === TESTE ESPECÍFICO - rem58685.txt ===\n');

  try {
    // 1. Carregar e analisar arquivo
    const content = loadRemessaFile();
    if (!content) {
      console.log('❌ Falha ao carregar arquivo rem58685.txt');
      return;
    }

    // Análise detalhada da estrutura
    analyzeFileStructure(content);

    // 2. Inicializar serviços
    console.log('🔧 Inicializando serviços...');
    const universalService = new CnabUniversalService();
    await universalService.initialize();

    const parserService = new CnabParserService();
    await parserService.initialize();

    const validatorService = new CnabValidatorService();
    await validatorService.initialize();

    console.log('✅ Serviços prontos\n');

    // 3. Detecção automática de formato
    console.log('🔍 === DETECTANDO FORMATO ===');
    const detection = await universalService.detectFormat(content);
    console.log('📊 Resultado da detecção:', {
      formato: detection.format,
      banco: detection.bankName,
      código: detection.bankCode,
      confiança: `${detection.confidence}%`,
      motivo: detection.reason || 'N/A'
    });

    // 4. Parsing completo
    console.log('\n🔄 === INICIANDO PARSING ===');
    const startTime = Date.now();
    const parseResult = await parserService.parseFile(content, detection);
    const parseTime = Date.now() - startTime;

    if (parseResult.success) {
      console.log('✅ PARSING CONCLUÍDO COM SUCESSO!');

      console.log('\n📊 Estatísticas do parsing:', {
        formato: parseResult.metadata.format,
        banco: parseResult.metadata.bankName,
        código: parseResult.metadata.bankCode,
        totalLinhas: parseResult.metadata.totalLines,
        totalLotes: parseResult.metadata.totalBatches,
        totalRegistros: parseResult.metadata.totalRecords,
        tempo: `${parseTime}ms`
      });

      // Estrutura dos dados parseados
      console.log('\n📋 Estrutura dos dados parseados:');
      console.log(`   📁 Header arquivo: ${!!parseResult.data.arquivo.header ? '✅' : '❌'}`);
      console.log(`   📁 Trailer arquivo: ${!!parseResult.data.arquivo.trailer ? '✅' : '❌'}`);
      console.log(`   📦 Lotes: ${parseResult.data.lotes?.length || 0}`);

      // Detalhes dos lotes
      if (parseResult.data.lotes && parseResult.data.lotes.length > 0) {
        parseResult.data.lotes.forEach((lote, index) => {
          console.log(`   📄 Lote ${index + 1}:`);
          console.log(`      - Header: ${!!lote.header ? '✅' : '❌'}`);
          console.log(`      - Trailer: ${!!lote.trailer ? '✅' : '❌'}`);
          console.log(`      - Detalhes: ${lote.detalhes?.length || 0}`);

          if (lote.detalhes && lote.detalhes.length > 0) {
            // Mostrar tipos de segmentos nos detalhes
            const segmentos = {};
            lote.detalhes.forEach(detalhe => {
              const segmento = detalhe.rawData ? detalhe.rawData.charAt(13) : 'N/A';
              segmentos[segmento] = (segmentos[segmento] || 0) + 1;
            });
            console.log(`      - Segmentos: ${Object.entries(segmentos).map(([seg, count]) => `${seg}(${count})`).join(', ')}`);
          }
        });
      }

      // Campos extraídos do header
      if (parseResult.data.arquivo.header && parseResult.data.arquivo.header.fields) {
        const headerFields = Object.keys(parseResult.data.arquivo.header.fields);
        console.log(`\n🔍 Campos extraídos do header arquivo: ${headerFields.length} campos`);

        // Mostrar alguns campos importantes
        const importantFields = ['codigo_banco', 'nome_banco', 'nome_empresa', 'data_arquivo', 'hora_arquivo'];
        importantFields.forEach(field => {
          const value = parseResult.data.arquivo.header.fields[field];
          if (value !== undefined) {
            console.log(`      ${field}: ${value}`);
          }
        });
      }

    } else {
      console.log('⚠️ PARSING CONCLUÍDO COM PROBLEMAS');
      console.log(`   ❌ Erros: ${parseResult.errors?.length || 0}`);
      console.log(`   ⚠️ Avisos: ${parseResult.warnings?.length || 0}`);

      if (parseResult.errors && parseResult.errors.length > 0) {
        console.log('\n📋 Principais erros:');
        parseResult.errors.slice(0, 5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.message}`);
          if (error.line) console.log(`      Linha: ${error.line}`);
          if (error.field) console.log(`      Campo: ${error.field}`);
        });
      }

      // Verificar se ainda conseguiu extrair dados básicos
      if (parseResult.data && parseResult.data.metadata) {
        console.log('\n✅ Mesmo com problemas, conseguiu extrair dados básicos');
        console.log('📊 Metadados:', parseResult.data.metadata);
      }
    }

    // 5. Teste de validação adicional
    console.log('\n🛡️ === TESTANDO VALIDAÇÃO ESPECÍFICA ===');
    try {
      const validationResult = await validatorService.validateFile(content, detection);
      console.log('📊 Resultado da validação:', {
        válido: validationResult.isValid,
        erros: validationResult.errors?.length || 0,
        avisos: validationResult.warnings?.length || 0,
        score: validationResult.score || 'N/A'
      });

      if (validationResult.errors && validationResult.errors.length > 0) {
        console.log('\n📋 Erros de validação (top 3):');
        validationResult.errors.slice(0, 3).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.message}`);
        });
      }
    } catch (validationError) {
      console.log(`⚠️ Erro na validação: ${validationError.message}`);
    }

    console.log(`\n⚡ Tempo total de processamento: ${parseTime}ms`);
    console.log('🎉 Teste do rem58685.txt concluído!');

  } catch (error) {
    console.log('❌ Erro durante teste:', error.message);
    console.log('📋 Stack:', error.stack);
  }
}

// Executar teste
testRem58685().catch(console.error); 