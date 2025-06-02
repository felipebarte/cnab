#!/usr/bin/env node

/**
 * Exemplo de uso da validação simples CNAB 240
 * Este exemplo demonstra como usar a nova funcionalidade que segue
 * exatamente o mesmo padrão da validação do CNAB 400
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/v1';

// Exemplo de linha CNAB 240 válida (240 caracteres)
const linhaValida240 = '341000010000100001A010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

// Exemplo de linha CNAB 240 inválida (menos de 240 caracteres)
const linhaInvalida240 = '341000010000100001A01000000000000000000000000000000000000000000000';

/**
 * Função para testar validação simples
 */
async function testarValidacaoSimples() {
  console.log('🔍 Testando Validação Simples CNAB 240 (Padrão CNAB 400)\\n');

  // Teste 1: Arquivo válido
  console.log('✅ Teste 1: Arquivo com linhas de 240 caracteres (VÁLIDO)');
  const arquivoValido = [
    linhaValida240,
    linhaValida240.replace('A01', 'B01'),
    linhaValida240.replace('A01', 'C01'),
    linhaValida240.replace('A01', 'Z01')
  ].join('\\n');

  try {
    const response1 = await axios.post(`${API_BASE_URL}/cnab240/validar-simples`, {
      conteudo: arquivoValido
    });

    console.log('Resultado:', JSON.stringify(response1.data, null, 2));
    console.log('');
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }

  // Teste 2: Arquivo inválido
  console.log('❌ Teste 2: Arquivo com linhas de tamanho incorreto (INVÁLIDO)');
  const arquivoInvalido = [
    linhaValida240,
    linhaInvalida240, // Esta linha tem menos de 240 caracteres
    linhaValida240
  ].join('\\n');

  try {
    const response2 = await axios.post(`${API_BASE_URL}/cnab240/validar-simples`, {
      conteudo: arquivoInvalido
    });

    console.log('Resultado:', JSON.stringify(response2.data, null, 2));
    console.log('');
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }

  // Teste 3: Conteúdo vazio
  console.log('❌ Teste 3: Conteúdo vazio (INVÁLIDO)');
  try {
    const response3 = await axios.post(`${API_BASE_URL}/cnab240/validar-simples`, {
      conteudo: ''
    });

    console.log('Resultado:', JSON.stringify(response3.data, null, 2));
    console.log('');
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }

  // Teste 4: Sem campo conteúdo
  console.log('❌ Teste 4: Request sem campo "conteudo" (ERRO 400)');
  try {
    const response4 = await axios.post(`${API_BASE_URL}/cnab240/validar-simples`, {});

    console.log('Resultado:', JSON.stringify(response4.data, null, 2));
  } catch (error) {
    console.log('Status:', error.response?.status);
    console.log('Resultado:', JSON.stringify(error.response?.data, null, 2));
  }
}

/**
 * Comparação com validação robusta
 */
async function compararValidacoes() {
  console.log('\\n🔬 Comparando Validação Simples vs Robusta\\n');

  const arquivoTeste = [
    linhaValida240,
    linhaValida240.replace('A01', 'B01')
  ].join('\\n');

  console.time('⚡ Validação Simples');
  try {
    const responseSimples = await axios.post(`${API_BASE_URL}/cnab240/validar-simples`, {
      conteudo: arquivoTeste
    });
    console.timeEnd('⚡ Validação Simples');
    console.log('Resultado Simples - Válido:', responseSimples.data.validacao.valido);
  } catch (error) {
    console.timeEnd('⚡ Validação Simples');
    console.error('Erro validação simples:', error.response?.data || error.message);
  }

  console.time('🐌 Validação Robusta');
  try {
    const responseRobusta = await axios.post(`${API_BASE_URL}/cnab240/validar`, {
      conteudo: arquivoTeste
    });
    console.timeEnd('🐌 Validação Robusta');
    console.log('Resultado Robusta - Válido:', responseRobusta.data.validacao.valido);
    console.log('Detalhes adicionais:', responseRobusta.data.validacao.resumo ? 'Sim' : 'Não');
  } catch (error) {
    console.timeEnd('🐌 Validação Robusta');
    console.error('Erro validação robusta:', error.response?.data || error.message);
  }
}

/**
 * Executar todos os testes
 */
async function executarTestes() {
  console.log('🚀 Iniciando testes da Validação Simples CNAB 240\\n');
  console.log('📋 Características da validação simples:');
  console.log('   • Verifica apenas o tamanho das linhas (240 caracteres)');
  console.log('   • Compatível com o padrão de validação do CNAB 400');
  console.log('   • Performance otimizada para verificações rápidas');
  console.log('   • Não realiza validações de estrutura ou integridade\\n');

  await testarValidacaoSimples();
  await compararValidacoes();

  console.log('\\n✅ Testes concluídos!');
  console.log('\\n💡 Dicas de uso:');
  console.log('   • Use validação simples para verificações rápidas de formato');
  console.log('   • Use validação robusta para validação completa antes do processamento');
  console.log('   • A validação simples é idêntica ao comportamento do CNAB 400');
}

// Executar se chamado diretamente
if (require.main === module) {
  executarTestes().catch(console.error);
}

module.exports = {
  testarValidacaoSimples,
  compararValidacoes,
  executarTestes
}; 