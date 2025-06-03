import express from 'express';
import { CnabController, uploadMiddleware } from '../controllers/cnabController.js';

const router = express.Router();

/**
 * @route GET /cnab/info
 * @desc Informações sobre a API CNAB
 */
router.get('/info', CnabController.informacoes);

/**
 * @route POST /cnab/processar
 * @desc Processa conteúdo CNAB 400 enviado como texto
 * @body { conteudo: string }
 */
router.post('/processar', CnabController.processarConteudoTexto);

/**
 * @route POST /cnab/upload
 * @desc Processa arquivo CNAB 400 via upload
 * @multipart arquivo: file
 */
router.post('/upload', uploadMiddleware, CnabController.processarArquivoUpload);

/**
 * @route POST /cnab/processar-webhook
 * @desc Processa CNAB e envia dados estruturados para webhook (via texto)
 * @body { conteudo: string, webhookUrl?: string }
 */
router.post('/processar-webhook', CnabController.processarCnabEEnviarWebhook);

/**
 * @route POST /cnab/processar-webhook/upload
 * @desc Processa CNAB e envia dados estruturados para webhook (via upload)
 * @multipart arquivo: file
 * @body { webhookUrl?: string }
 */
router.post('/processar-webhook/upload', uploadMiddleware, CnabController.processarCnabEEnviarWebhook);

/**
 * @route POST /cnab/codigos-barras
 * @desc Extrai códigos de barras de arquivo CNAB
 * @body { conteudo: string }
 */
router.post('/codigos-barras', CnabController.extrairCodigosBarras);

/**
 * @route POST /cnab/linhas-digitaveis
 * @desc Extrai linhas digitáveis de arquivo CNAB
 * @body { conteudo: string }
 */
router.post('/linhas-digitaveis', CnabController.extrairLinhasDigitaveis);

/**
 * @route POST /cnab/validar
 * @desc Valida arquivo CNAB
 * @body { conteudo: string }
 */
router.post('/validar', CnabController.validarArquivo);

// ===== ROTAS DE PERSISTÊNCIA =====

/**
 * @route GET /cnab/historico
 * @desc Lista histórico de arquivos CNAB 400 processados
 * @query { page?, limit?, startDate?, endDate?, status?, banco? }
 */
router.get('/historico', CnabController.listarHistorico);

/**
 * @route GET /cnab/historico/:hash
 * @desc Busca arquivo processado por hash SHA-256
 * @param { hash } Hash SHA-256 do arquivo
 */
router.get('/historico/:hash', CnabController.buscarPorHash);

/**
 * @route GET /cnab/estatisticas
 * @desc Estatísticas do banco de dados e processamentos
 */
router.get('/estatisticas', CnabController.obterEstatisticas);

/**
 * @route GET /cnab/operacoes/:operationId
 * @desc Detalhes de operação específica por ID
 * @param { operationId } ID único da operação
 */
router.get('/operacoes/:operationId', CnabController.buscarOperacao);

export default router; 