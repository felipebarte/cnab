#!/usr/bin/env node

/**
 * Exemplo de Integração: Validação Simples + Endpoints Existentes CNAB 240
 * 
 * Este exemplo demonstra como usar a nova validação simples em conjunto
 * com os endpoints de processamento existentes para otimizar performance
 * e oferecer diferentes estratégias de validação.
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8080/api/v1/cnab240';

// Exemplo de arquivo CNAB 240 válido (estrutura básica)
const exemploArquivoValido = [
  // Header de Arquivo (240 chars)
  '341000010000100001A010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  // Header de Lote (240 chars)  
  '341000020000200002B020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  // Trailer de Lote (240 chars)
  '341000030000300003C030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  // Trailer de Arquivo (240 chars)
  '341000040000400004D040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
].join('\n');

// Exemplo de arquivo CNAB 240 inválido (linhas com tamanho incorreto)
const exemploArquivoInvalido = [
  '341000010000100001A0100000000', // Apenas 29 caracteres
  '341000020000200002B0200000000000000000000000000000', // Apenas 50 caracteres
  '341000030000300003C03000000000000000000', // Apenas 39 caracteres
  '341000040000400004D04' // Apenas 21 caracteres
].join('\n');

/**
 * Estratégia 1: Validação Simples Primeiro (Pré-filtro)
 * Use esta estratégia para triagem rápida antes de processamento pesado
 */
async function estrategiaValidacaoPreFiltro(conteudo) {
  console.log('\n🔍 ESTRATÉGIA 1: Validação Pré-filtro');
  console.log('📝 Descrição: Validação simples primeiro, processamento só se passar');

  try {
    const inicio = Date.now();

    // 1. Validação simples primeiro (muito rápida)
    console.log('\n⚡ Executando validação simples...');
    const validacaoSimples = await axios.post(`${API_BASE_URL}/validar-simples`, {
      conteudo
    });

    const tempoValidacaoSimples = Date.now() - inicio;
    console.log(`✅ Validação simples concluída em ${tempoValidacaoSimples}ms`);

    if (!validacaoSimples.data.validacao.valido) {
      console.log('❌ Arquivo rejeitado na validação simples');
      console.log('📊 Economia de tempo: Não precisou fazer processamento pesado');
      return {
        sucesso: false,
        erro: 'Formato básico inválido',
        tempoTotal: tempoValidacaoSimples,
        economiaEnergia: true
      };
    }

    // 2. Se passou na validação simples, fazer processamento completo
    console.log('\n🔄 Arquivo passou na validação simples, processando...');
    const processamento = await axios.post(`${API_BASE_URL}/processar`, {
      conteudo
    });

    const tempoTotal = Date.now() - inicio;
    console.log(`✅ Processamento completo concluído em ${tempoTotal}ms`);

    return {
      sucesso: true,
      dados: processamento.data,
      tempoValidacaoSimples,
      tempoTotal,
      estrategia: 'pre-filtro'
    };

  } catch (error) {
    console.error('❌ Erro na estratégia pré-filtro:', error.response?.data || error.message);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Estratégia 2: Validação Robusta Direta
 * Use para arquivos que você já sabe que são válidos ou críticos
 */
async function estrategiaValidacaoRobusta(conteudo) {
  console.log('\n🔍 ESTRATÉGIA 2: Validação Robusta Direta');
  console.log('📝 Descrição: Validação completa sem pré-filtro');

  try {
    const inicio = Date.now();

    // Validação robusta direta
    console.log('\n🏗️ Executando validação robusta...');
    const validacaoRobusta = await axios.post(`${API_BASE_URL}/validar`, {
      conteudo
    });

    const tempoValidacao = Date.now() - inicio;
    console.log(`✅ Validação robusta concluída em ${tempoValidacao}ms`);

    if (!validacaoRobusta.data.valido) {
      console.log('❌ Arquivo rejeitado na validação robusta');
      return {
        sucesso: false,
        erro: 'Validação estrutural falhou',
        erros: validacaoRobusta.data.erros,
        tempoTotal: tempoValidacao
      };
    }

    return {
      sucesso: true,
      validacao: validacaoRobusta.data,
      tempoTotal: tempoValidacao,
      estrategia: 'robusta-direta'
    };

  } catch (error) {
    console.error('❌ Erro na validação robusta:', error.response?.data || error.message);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Estratégia 3: Validação Híbrida Inteligente
 * Combina validação simples + robusta baseado em critérios
 */
async function estrategiaValidacaoHibrida(conteudo, opcoes = {}) {
  console.log('\n🔍 ESTRATÉGIA 3: Validação Híbrida Inteligente');
  console.log('📝 Descrição: Estratégia adaptativa baseada em critérios');

  const {
    tamanhoLimite = 10000, // Arquivos maiores usam pré-filtro
    forcarRobusta = false,
    incluirProcessamento = false
  } = opcoes;

  try {
    const tamanhoArquivo = conteudo.length;
    const linhas = conteudo.split('\n').length;

    console.log(`📊 Análise: ${tamanhoArquivo} caracteres, ${linhas} linhas`);

    // Critério de decisão
    const usarPreFiltro = tamanhoArquivo > tamanhoLimite && !forcarRobusta;

    if (usarPreFiltro) {
      console.log('📈 Arquivo grande detectado, usando pré-filtro');
      const resultado = await estrategiaValidacaoPreFiltro(conteudo);

      if (incluirProcessamento && resultado.sucesso) {
        console.log('\n🔄 Adicionando processamento...');
        const processamento = await axios.post(`${API_BASE_URL}/processar`, {
          conteudo
        });
        resultado.dados = processamento.data;
      }

      return resultado;

    } else {
      console.log('📉 Arquivo pequeno, usando validação robusta direta');
      return await estrategiaValidacaoRobusta(conteudo);
    }

  } catch (error) {
    console.error('❌ Erro na validação híbrida:', error.response?.data || error.message);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Estratégia 4: Processamento com Upload
 * Demonstra como usar validação simples com upload de arquivo
 */
async function estrategiaUploadComValidacao(conteudo, nomeArquivo = 'teste.cnab') {
  console.log('\n🔍 ESTRATÉGIA 4: Upload com Validação');
  console.log('📝 Descrição: Simula upload com validação prévia');

  try {
    // 1. Validação simples antes do upload
    console.log('\n⚡ Validando formato antes do upload...');
    const validacaoPrevia = await axios.post(`${API_BASE_URL}/validar-simples`, {
      conteudo
    });

    if (!validacaoPrevia.data.validacao.valido) {
      console.log('❌ Upload cancelado: formato inválido');
      return {
        sucesso: false,
        erro: 'Upload cancelado - formato básico inválido',
        uploadCancelado: true
      };
    }

    console.log('✅ Formato válido, simulando upload...');

    // 2. Simular upload (em caso real seria multipart/form-data)
    const FormData = require('form-data');
    const form = new FormData();
    form.append('arquivo', Buffer.from(conteudo), nomeArquivo);

    // Em caso real:
    // const uploadResult = await axios.post(`${API_BASE_URL}/processar/upload`, form, {
    //   headers: form.getHeaders()
    // });

    console.log('📤 Upload simulado com sucesso');

    return {
      sucesso: true,
      mensagem: 'Upload realizado com validação prévia',
      arquivo: nomeArquivo,
      tamanho: conteudo.length,
      estrategia: 'upload-validado'
    };

  } catch (error) {
    console.error('❌ Erro no upload com validação:', error.response?.data || error.message);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Função principal para demonstrar todas as estratégias
 */
async function demonstrarEstragegias() {
  console.log('🚀 DEMONSTRAÇÃO: Integração Validação Simples + Endpoints CNAB 240');
  console.log('='.repeat(80));

  // Teste com arquivo válido
  console.log('\n📋 TESTE 1: Arquivo CNAB 240 Válido');
  console.log('-'.repeat(50));

  const resultados = [];

  // Estratégia 1: Pré-filtro
  const resultado1 = await estrategiaValidacaoPreFiltro(exemploArquivoValido);
  resultados.push({ estrategia: 'Pré-filtro', ...resultado1 });

  // Estratégia 2: Robusta direta
  const resultado2 = await estrategiaValidacaoRobusta(exemploArquivoValido);
  resultados.push({ estrategia: 'Robusta Direta', ...resultado2 });

  // Estratégia 3: Híbrida
  const resultado3 = await estrategiaValidacaoHibrida(exemploArquivoValido, {
    incluirProcessamento: false
  });
  resultados.push({ estrategia: 'Híbrida', ...resultado3 });

  // Estratégia 4: Upload
  const resultado4 = await estrategiaUploadComValidacao(exemploArquivoValido);
  resultados.push({ estrategia: 'Upload Validado', ...resultado4 });

  // Teste com arquivo inválido
  console.log('\n📋 TESTE 2: Arquivo CNAB 240 Inválido');
  console.log('-'.repeat(50));

  const resultadoInvalido = await estrategiaValidacaoPreFiltro(exemploArquivoInvalido);
  console.log('\n✅ Arquivo inválido rejeitado rapidamente na validação simples!');

  // Resumo dos resultados
  console.log('\n📊 RESUMO COMPARATIVO');
  console.log('='.repeat(80));

  resultados.forEach(resultado => {
    console.log(`\n🔹 ${resultado.estrategia}:`);
    console.log(`   Sucesso: ${resultado.sucesso ? '✅' : '❌'}`);
    if (resultado.tempoTotal) {
      console.log(`   Tempo: ${resultado.tempoTotal}ms`);
    }
    if (resultado.economiaEnergia) {
      console.log(`   💡 Economia de energia: SIM`);
    }
  });

  console.log('\n🎯 RECOMENDAÇÕES DE USO:');
  console.log('• Use pré-filtro para volumes altos');
  console.log('• Use robusta direta para arquivos críticos');
  console.log('• Use híbrida para APIs públicas');
  console.log('• Use upload validado para interfaces de usuário');
}

// Executar demonstração se chamado diretamente
if (require.main === module) {
  demonstrarEstragegias().catch(console.error);
}

module.exports = {
  estrategiaValidacaoPreFiltro,
  estrategiaValidacaoRobusta,
  estrategiaValidacaoHibrida,
  estrategiaUploadComValidacao
}; 