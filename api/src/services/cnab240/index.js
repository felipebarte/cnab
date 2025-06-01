/**
 * Módulo principal para serviços CNAB 240
 * 
 * Este arquivo serve como ponto de entrada para todos os serviços
 * relacionados ao processamento de arquivos CNAB 240.
 * 
 * Estrutura a ser implementada:
 * - cnab240Service.js: Serviço principal de processamento
 * - parsers/: Parsers específicos para cada tipo de registro
 * - validators/: Validadores específicos
 * - generators/: Geradores de arquivos CNAB 240
 */

import Cnab240Service from './cnab240Service.js';
import Cnab240BaseParser from './cnab240BaseParser.js';
import { CNAB240Parser } from './parsers/index.js';

/**
 * Exportações principais do módulo CNAB 240
 */
export {
  // Serviço principal de processamento
  Cnab240Service,

  // Parser base
  Cnab240BaseParser,

  // Parsers especializados
  CNAB240Parser
};

// Export default do serviço principal
export default Cnab240Service; 