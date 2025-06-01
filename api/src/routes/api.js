import express from 'express';
import { getWelcome, getStatus } from '../controllers/apiController.js';
import cnabRoutes from './cnabRoutes.js';
import cnab240Routes from './cnab240Routes.js';
import cnabUnifiedRoutes from './cnabUnifiedRoutes.js';

const router = express.Router();

// Rotas principais
router.get('/', getWelcome);
router.get('/status', getStatus);

// Rotas específicas por recursos
router.use('/cnab', cnabRoutes);
router.use('/cnab240', cnab240Routes);

// Rotas unificadas com detecção automática (novos endpoints inteligentes)
router.use('/cnab', cnabUnifiedRoutes);

// Aqui você pode adicionar mais rotas organizadas por recursos
// Exemplo:
// router.use('/users', userRoutes);
// router.use('/products', productRoutes);
// router.use('/auth', authRoutes);

export default router;
