/**
 * Utilitários para geração de dados de teste CNAB 240
 * 
 * Funções auxiliares para criar linhas CNAB 240 válidas
 * para uso nos testes do Cnab240Service
 */

/**
 * Gera header de arquivo CNAB 240
 * @param {Object} opcoes - Opções para personalizar o header
 * @returns {string} Linha de header de arquivo com 240 caracteres
 */
export const gerarHeaderArquivo = (opcoes = {}) => {
  const banco = opcoes.banco || '341';

  // Cria linha base com campos essenciais
  let linha = banco.padStart(3, '0') + // 3 - banco
    '0000' + // 4 - lote (arquivo)
    '0' + // 1 - tipo registro (header arquivo)
    ' '.repeat(9) + // 9 - uso FEBRABAN
    '11222333000195' + // 14 - CNPJ
    '00000000000000000000' + // 20 - convenio
    '00000' + // 5 - agencia
    '000000000000' + // 12 - conta
    '0' + // 1 - dv
    'EMPRESA TESTE LTDA            ' + // 30 - nome empresa
    'BANCO TESTE SA                ' + // 30 - nome banco
    ' '.repeat(10) + // 10 - uso FEBRABAN
    '01062024' + // 8 - data
    '103000' + // 6 - hora
    '000001' + // 6 - sequencial
    '087' + // 3 - versao
    '00000'; // 5 - densidade

  // Preencher até exatamente 240 caracteres
  return linha.padEnd(240, ' ');
};

/**
 * Gera header de lote CNAB 240
 * @param {number} numeroLote - Número do lote
 * @returns {string} Linha de header de lote com 240 caracteres
 */
export const gerarHeaderLote = (numeroLote = 1) => {
  const lote = numeroLote.toString().padStart(4, '0');

  let linha = '341' + // 3 - banco
    lote + // 4 - lote
    '1' + // 1 - tipo registro (header lote)
    'C' + // 1 - operacao
    '30' + // 2 - servico
    '01' + // 2 - forma lancamento
    '045' + // 3 - versao
    ' ' + // 1 - uso FEBRABAN
    '11222333000195' + // 14 - CNPJ
    '00000000000000000000' + // 20 - convenio
    '00000' + // 5 - agencia
    '000000000000' + // 12 - conta
    '0' + // 1 - dv
    'EMPRESA TESTE LTDA            ' + // 30 - nome empresa
    'PAGAMENTO PIX               ' + // 30 - finalidade (reduzido de 40 para 30)
    'LOTE PAGAMENTOS PIX         ' + // 30 - historico (reduzido de 40 para 30)
    'RUA EXEMPLO           ' + // 22 - endereco (reduzido de 30 para 22)
    '00000' + // 5 - numero
    '       ' + // 7 - complemento (reduzido de 15 para 7)
    'SAO PAULO   ' + // 12 - cidade (reduzido de 20 para 12)
    '01234567' + // 8 - cep
    'SP' + // 2 - estado
    ' '.repeat(29); // 29 - uso FEBRABAN (preencher o restante)

  // Verificar se tem exatamente 240 caracteres
  if (linha.length !== 240) {
    throw new Error(`Header de lote deve ter 240 caracteres, tem ${linha.length}`);
  }

  return linha;
};

/**
 * Gera segmento A CNAB 240
 * @param {Object} opcoes - Opções para personalizar o segmento
 * @returns {string} Linha de segmento A com 240 caracteres
 */
export const gerarSegmentoA = (opcoes = {}) => {
  const {
    valorPagamento = 10000, // R$ 100,00 (valor padrão corrigido)
    sequencial = 1,
    dataVencimento = '01062024',
    dataPagamento = '00000000' // Data vazia por padrão para testar status
  } = opcoes;

  const valorStr = valorPagamento.toString().padStart(15, '0');
  const seqStr = sequencial.toString().padStart(5, '0');

  let linha = '341' + // 001-003: Código do banco
    '0001' + // 004-007: Lote de serviço
    '3' + // 008: Tipo de registro (3 - detalhe)
    seqStr + // 009-013: Número sequencial do registro
    'A' + // 014: Código do segmento (A)
    '0' + // 015: Tipo de movimento
    '00' + // 016-017: Código da instrução para movimento
    '000' + // 018-020: Câmara centralizadora
    '341' + // 021-023: Banco favorecido
    '12345' + // 024-028: Agência favorecido
    '0' + // 029: DV agência
    '123456789012' + // 030-041: Conta favorecido
    '3' + // 042: DV conta
    '0' + // 043: DV agência/conta
    'FAVORECIDO NOME TESTE'.padEnd(30, ' ') + // 044-073: Nome favorecido
    'DOCUMENTO123456789'.padEnd(20, ' ') + // 074-093: Número documento empresa
    dataPagamento + // 094-101: Data pagamento (DDMMAAAA) - conforme parser
    'BRL' + // 102-104: Tipo da moeda
    valorStr + // 105-119: Valor do pagamento - conforme parser
    'BANCO123456789'.padEnd(15, ' ') + // 120-134: Número documento banco
    '00000000' + // 135-142: Data real efetivação
    '000000000000000' + // 143-157: Valor real efetivação
    'INFORMACOES COMPLEMENT'.padEnd(20, ' ') + // 158-177: Outras informações
    '00' + // 178-179: Complemento de registro
    '00000' + // 180-184: Código da ocorrência
    'COMPRGT123'.padEnd(10, ' ') + // 185-194: Código banco compensação
    'NOSSO1'.padEnd(5, ' ') + // 195-199: Nosso número
    'DV123456789'.padEnd(10, ' ') + // 200-209: DV nosso número
    ' '.repeat(31); // 210-240: Uso exclusivo FEBRABAN

  // Garantir exatamente 240 caracteres
  return linha.substring(0, 240).padEnd(240, ' ');
};

/**
 * Gera segmento B CNAB 240 (PIX)
 * @param {string|Object} subtipoOuOpcoes - Subtipo do segmento B (ex: 'B01', 'B02') ou objeto de opções
 * @param {Object} opcoes - Opções adicionais (se primeiro parâmetro for string)
 * @returns {string} Linha de segmento B com 240 caracteres
 */
export const gerarSegmentoB = (subtipoOuOpcoes = 'B03', opcoes = {}) => {
  // Suporte para chamada com subtipo como string ou objeto completo
  let subtipo, chavePix, sequencial;

  if (typeof subtipoOuOpcoes === 'string') {
    subtipo = subtipoOuOpcoes;
    chavePix = opcoes.chavePix || '12345678901';
    sequencial = opcoes.sequencial || 2;
  } else {
    const config = subtipoOuOpcoes;
    subtipo = config.subtipo || 'B03';
    chavePix = config.chavePix || '12345678901';
    sequencial = config.sequencial || 2;
  }

  // Extrair apenas os 3 primeiros caracteres do subtipo se tiver mais e padronizar para 3 chars
  const subtipoCode = subtipo.substring(0, 3).padEnd(3, ' ');
  const seqStr = sequencial.toString().padStart(5, '0');

  let linha = '341' + // 3 - banco
    '0001' + // 4 - lote
    '3' + // 1 - tipo registro (detalhe)
    seqStr + // 5 - sequencial
    'B' + // 1 - segmento (posição 13)
    subtipoCode + // 3 - subtipo (B01, B02, B03, B04) - posições 14-16
    '1' + // 1 - tipo inscricao (1=CPF) - posição 17
    chavePix.padEnd(76, ' '); // 76 - chave PIX + dados complementares

  // Preencher até exatamente 240 caracteres
  return linha.padEnd(240, ' ');
};

/**
 * Gera trailer de lote CNAB 240
 * @param {number} numeroLote - Número do lote
 * @param {number} quantidadeRegistros - Quantidade de registros no lote
 * @returns {string} Linha de trailer de lote com 240 caracteres
 */
export const gerarTrailerLote = (numeroLote = 1, quantidadeRegistros = 4) => {
  const lote = numeroLote.toString().padStart(4, '0');
  const qtdStr = quantidadeRegistros.toString().padStart(6, '0');

  let linha = '341' + // 3 - banco
    lote + // 4 - lote
    '5' + // 1 - tipo registro (trailer lote)
    ' '.repeat(9) + // 9 - uso FEBRABAN
    qtdStr + // 6 - quantidade registros
    '000000000000100000' + // 18 - somatoria valores
    '000000000000000000'; // 18 - somatoria quantidade

  // Preencher até exatamente 240 caracteres
  return linha.padEnd(240, ' ');
};

/**
 * Gera trailer de arquivo CNAB 240
 * @param {number} quantidadeLotes - Quantidade de lotes no arquivo
 * @param {number} quantidadeRegistros - Quantidade total de registros
 * @returns {string} Linha de trailer de arquivo com 240 caracteres
 */
export const gerarTrailerArquivo = (quantidadeLotes = 1, quantidadeRegistros = 6) => {
  const qtdLotes = quantidadeLotes.toString().padStart(6, '0');
  const qtdRegistros = quantidadeRegistros.toString().padStart(6, '0');

  let linha = '341' + // 3 - banco
    '9999' + // 4 - lote
    '9' + // 1 - tipo registro (trailer arquivo)
    ' '.repeat(9) + // 9 - uso FEBRABAN
    qtdLotes + // 6 - quantidade lotes
    qtdRegistros + // 6 - quantidade registros
    '000000'; // 6 - quantidade contas

  // Preencher até exatamente 240 caracteres
  return linha.padEnd(240, ' ');
};

/**
 * Gera um arquivo CNAB 240 completo com configurações personalizáveis
 * @param {Object} opcoes - Opções para personalizar o arquivo
 * @returns {string} Arquivo CNAB 240 completo
 */
export const gerarArquivoCNABCompleto = (opcoes = {}) => {
  const {
    quantidadeLotes = 1,
    incluirSegmentos = false,
    banco = '341',
    valorPagamento = 10000
  } = opcoes;

  const linhas = [];

  // Header do arquivo
  linhas.push(gerarHeaderArquivo({ banco }));

  let totalRegistros = 2; // Header arquivo + trailer arquivo

  // Gerar lotes
  for (let lote = 1; lote <= quantidadeLotes; lote++) {
    // Header do lote
    linhas.push(gerarHeaderLote(lote));
    let registrosLote = 2; // Header + trailer do lote

    if (incluirSegmentos) {
      // Segmento A
      linhas.push(gerarSegmentoA({ valorPagamento }));
      registrosLote++;

      // Segmento B
      linhas.push(gerarSegmentoB());
      registrosLote++;
    }

    // Trailer do lote
    linhas.push(gerarTrailerLote(lote, registrosLote));
    totalRegistros += registrosLote;
  }

  // Trailer do arquivo
  linhas.push(gerarTrailerArquivo(quantidadeLotes, totalRegistros));

  return linhas.join('\n');
}; 