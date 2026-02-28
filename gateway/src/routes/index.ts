import { Router } from 'express';
import healthRoutes from './health.routes';
import pdfRoutes from './pdf.routes';
import compressionRoutes from './compression.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/v1/pdf', pdfRoutes);
router.use('/api/v1/pdf/compress', compressionRoutes);

export default router;
