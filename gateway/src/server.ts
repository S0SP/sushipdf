import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import routes from './routes';
import { rateLimiter, errorHandler } from './middleware';
import { cleanupScheduler, redisService } from './services';

const app = express();

// ─── Security ───────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.security.corsOrigin }));

// ─── Trust proxy (behind Nginx) ─────────────────────────
app.set('trust proxy', 1);

// ─── Logging ────────────────────────────────────────────
app.use(
    morgan('combined', {
        stream: {
            write: (message: string) => logger.http(message.trim()),
        },
    }),
);

// ─── Body Parsing (for non-file routes) ─────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate Limiting ──────────────────────────────────────
app.use(rateLimiter);

// ─── Routes ─────────────────────────────────────────────
app.use(routes);

// ─── 404 ────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString(),
    });
});

// ─── Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ─── Server Startup ─────────────────────────────────────
async function bootstrap(): Promise<void> {
    // Connect to Redis (non-blocking for Phase 1)
    await redisService.connect();

    // Start file cleanup scheduler
    cleanupScheduler.start();

    const server = app.listen(config.gateway.port, config.gateway.host, () => {
        logger.info('═══════════════════════════════════════════════');
        logger.info('  PDF Tools Gateway');
        logger.info(`  Environment : ${config.env}`);
        logger.info(`  Listening   : ${config.gateway.host}:${config.gateway.port}`);
        logger.info(`  Stirling    : ${config.stirling.url}`);
        logger.info(`  Redis       : ${config.redis.host}:${config.redis.port}`);
        logger.info(`  Max Upload  : ${config.storage.maxFileSizeMB} MB`);
        logger.info(`  Retention   : ${config.storage.fileRetentionMinutes} min`);
        logger.info(`  Worker      : ${config.worker.enabled ? 'enabled' : 'disabled (Phase 2)'}`);
        logger.info(`  Auth        : ${config.auth.enabled ? 'enabled' : 'disabled (Phase 2)'}`);
        logger.info('═══════════════════════════════════════════════');
    });

    // ─── Graceful Shutdown ─────────────────────────────────
    const gracefulShutdown = async (signal: string): Promise<void> => {
        logger.info(`${signal} received — shutting down gracefully...`);

        cleanupScheduler.stop();

        server.close(async () => {
            logger.info('HTTP server closed');
            await redisService.disconnect();
            logger.info('All connections closed. Exiting.');
            process.exit(0);
        });

        // Force exit after 30s
        setTimeout(() => {
            logger.error('Graceful shutdown timed out. Forcing exit.');
            process.exit(1);
        }, 30_000);
    };

    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

    // ─── Uncaught Error Handlers ───────────────────────────
    process.on('unhandledRejection', (reason) => {
        logger.error(`Unhandled Rejection: ${reason}`);
    });

    process.on('uncaughtException', (err) => {
        logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
        process.exit(1);
    });
}

bootstrap().catch((err) => {
    logger.error(`Failed to start server: ${err}`);
    process.exit(1);
});
