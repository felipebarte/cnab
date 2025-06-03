/**
 * Modelos CNAB 240
 * 
 * Exporta todos os modelos de dados para processamento de arquivos CNAB 240
 */

import HeaderArquivo240 from './HeaderArquivo240.js';
import HeaderLote240 from './HeaderLote240.js';
import SegmentoA240 from './SegmentoA240.js';
import SegmentoB240 from './SegmentoB240.js';
import TrailerLote240 from './TrailerLote240.js';
import TrailerArquivo240 from './TrailerArquivo240.js';

export {
  HeaderArquivo240,
  HeaderLote240,
  SegmentoA240,
  SegmentoB240,
  TrailerLote240,
  TrailerArquivo240
};

/**
 * Factory para criar modelos baseado no tipo de registro
 * @param {string} linha - Linha CNAB 240
 * @returns {Object} Instância do modelo apropriado
 */
export function criarModelo(linha) {
  if (!linha || linha.length !== 240) {
    throw new Error('Linha deve ter exatamente 240 caracteres');
  }

  const tipoRegistro = linha[7]; // Posição 8 (índice 7)
  const lote = linha.substring(3, 7);
  const segmento = linha[13]; // Posição 14 (índice 13) para detalhes

  switch (tipoRegistro) {
  case '0': // Header de arquivo
    return HeaderArquivo240.fromLinha(linha);

  case '1': // Header de lote
    return HeaderLote240.fromLinha(linha);

  case '3': // Detalhe (segmentos A, B, etc.)
    switch (segmento) {
    case 'A':
      return SegmentoA240.fromLinha(linha);
    case 'B':
      return SegmentoB240.fromLinha(linha);
    default:
      throw new Error(`Segmento "${segmento}" não suportado`);
    }

  case '5': // Trailer de lote
    return TrailerLote240.fromLinha(linha);

  case '9': // Trailer de arquivo
    return TrailerArquivo240.fromLinha(linha);

  default:
    throw new Error(`Tipo de registro "${tipoRegistro}" não suportado`);
  }
}

/**
 * Valida um modelo CNAB 240
 * @param {Object} modelo - Instância do modelo
 * @returns {Object} Resultado da validação
 */
export function validarModelo(modelo) {
  if (!modelo || typeof modelo.validar !== 'function') {
    return {
      valido: false,
      erros: ['Modelo inválido ou sem método de validação']
    };
  }

  const erros = modelo.validar();
  return {
    valido: erros.length === 0,
    erros
  };
}

/**
 * Converte um modelo para objeto simples
 * @param {Object} modelo - Instância do modelo
 * @returns {Object} Dados do modelo como objeto
 */
export function modeloParaObjeto(modelo) {
  if (!modelo || typeof modelo.toObject !== 'function') {
    throw new Error('Modelo inválido ou sem método toObject');
  }

  return modelo.toObject();
}

export default {
  HeaderArquivo240,
  HeaderLote240,
  SegmentoA240,
  SegmentoB240,
  TrailerLote240,
  TrailerArquivo240,
  criarModelo,
  validarModelo,
  modeloParaObjeto
}; 