import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * RedisService — connection manager for Redis.
 *
 * Phase 1: used for health checks and rate-limit backend (optional).
 * Phase 2: used for BullMQ job queue.
 */
export class RedisService {
    private client: IORedis | null = null;

    getClient(): IORedis {
        if (!this.client) {
            this.client = new IORedis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                maxRetriesPerRequest: 3,
                retryStrategy: (times: number) => {
                    if (times > 10) {
                        logger.error('Redis connection retry limit reached');
                        return null;
                    }
                    const delay = Math.min(times * 200, 5000);
                    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
                    return delay;
                },
                lazyConnect: true,
            });

            this.client.on('connect', () => logger.info('Redis connected'));
            this.client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
            this.client.on('close', () => logger.warn('Redis connection closed'));
        }
        return this.client;
    }

    async connect(): Promise<void> {
        const client = this.getClient();
        try {
            await client.connect();
        } catch (err) {
            logger.error(`Redis initial connection failed: ${err}`);
            // Non-fatal — gateway can operate without Redis in Phase 1
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            const client = this.getClient();
            const pong = await client.ping();
            return pong === 'PONG';
        } catch {
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            logger.info('Redis disconnected');
        }
    }
}

export const redisService = new RedisService();
