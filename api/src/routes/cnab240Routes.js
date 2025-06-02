/**
 * Rotas da API para processamento de arquivos CNAB 240
 * 
 * Define todos os endpoints disponíveis para operações
 * de CNAB 240 incluindo processamento, validação,
 * informações de formato e webhook.
 */

import express from 'express';
import { Cnab240Controller, uploadMiddleware } from '../controllers/cnab240Controller.js';

const router = express.Router();

/**
 * @route GET /cnab240/info
 * @desc Informações gerais sobre a API CNAB 240
 */
router.get('/info', Cnab240Controller.informacoes);

/**
 * @route GET /cnab240/formatos
 * @desc Lista todos os bancos suportados para CNAB 240
 */
router.get('/formatos', Cnab240Controller.listarFormatosBancos);

/**
 * @route GET /cnab240/formatos/:banco
 * @desc Informações de formato específico do banco
 * @param {string} banco - Código do banco (3 dígitos)
 */
router.get('/formatos/:banco', Cnab240Controller.obterFormatoBanco);

/**
 * @route POST /cnab240/processar
 * @desc Processa arquivo CNAB 240 completo (via texto)
 * @body { conteudo: string, opcoes?: object }
 */
router.post('/processar', Cnab240Controller.processarArquivo);

/**
 * @route POST /cnab240/processar (upload)
 * @desc Processa arquivo CNAB 240 completo (via upload)
 * @multipart arquivo: file
 * @body { opcoes?: string } - JSON string das opções
 */
router.post('/processar/upload', uploadMiddleware, Cnab240Controller.processarArquivoUpload);

/**
 * @route POST /cnab240/validar
 * @desc Valida estrutura do arquivo CNAB 240 sem processar completamente
 * @body { conteudo: string }
 */
router.post('/validar', Cnab240Controller.validarArquivo);

/**
 * @route POST /cnab240/validar-simples
 * @desc Valida arquivo CNAB 240 de forma simples (seguindo padrão CNAB 400)
 * Verifica apenas se as linhas têm exatamente 240 caracteres
 * @body { conteudo: string }
 */
router.post('/validar-simples', Cnab240Controller.validarArquivoSimples);

/**
 * @route POST /cnab240/processar-webhook
 * @desc Processa arquivo CNAB 240 e envia dados para webhook (via texto)
 * @body { conteudo: string, webhookUrl?: string, opcoes?: object }
 */
router.post('/processar-webhook', Cnab240Controller.processarEEnviarWebhook);

/**
 * @route POST /cnab240/processar-webhook/upload
 * @desc Processa arquivo CNAB 240 e envia dados para webhook (via upload)
 * @multipart arquivo: file
 * @body { webhookUrl?: string, opcoes?: string } - opcoes como JSON string
 */
router.post('/processar-webhook/upload', uploadMiddleware, Cnab240Controller.processarEEnviarWebhook);

export default router; 