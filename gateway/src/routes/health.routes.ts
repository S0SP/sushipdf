import { Router, Request, Response } from 'express';
import { stirlingService, redisService } from '../services';
import { HealthStatus } from '../interfaces';

const router = Router();

const startTime = Date.now();

router.get('/', async (_req: Request, res: Response) => {
    const [stirlingHealthy, redisHealthy] = await Promise.all([
        stirlingService.isHealthy(),
        redisService.isHealthy(),
    ]);

    const status: HealthStatus = {
        status:
            stirlingHealthy && redisHealthy
                ? 'healthy'
                : stirlingHealthy
                    ? 'degraded'
                    : 'unhealthy',
        services: {
            gateway: true,
            stirling: stirlingHealthy,
            redis: redisHealthy,
        },
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
    };

    const httpCode = status.status === 'unhealthy' ? 503 : 200;
    res.status(httpCode).json(status);
});

export default router;
