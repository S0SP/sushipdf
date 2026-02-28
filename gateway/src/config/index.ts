import dotenv from 'dotenv';

dotenv.config();

function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] ?? defaultValue;
}

function envIntOrDefault(key: string, defaultValue: number): number {
    const val = process.env[key];
    if (val === undefined) return defaultValue;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
    env: envOrDefault('NODE_ENV', 'development'),
    logLevel: envOrDefault('LOG_LEVEL', 'info'),

    gateway: {
        port: envIntOrDefault('GATEWAY_PORT', 3000),
        host: envOrDefault('GATEWAY_HOST', '0.0.0.0'),
    },

    stirling: {
        url: envOrDefault('STIRLING_URL', 'http://stirling:8080'),
        timeoutMs: envIntOrDefault('STIRLING_TIMEOUT_MS', 120000),
    },

    redis: {
        host: envOrDefault('REDIS_HOST', 'redis'),
        port: envIntOrDefault('REDIS_PORT', 6379),
        password: envOrDefault('REDIS_PASSWORD', 'changeme_redis_password'),
    },

    storage: {
        basePath: envOrDefault('STORAGE_BASE_PATH', '/tmp/pdf-tools-storage'),
        fileRetentionMinutes: envIntOrDefault('FILE_RETENTION_MINUTES', 30),
        maxFileSizeMB: envIntOrDefault('MAX_FILE_SIZE_MB', 100),
        cleanupIntervalMs: envIntOrDefault('CLEANUP_INTERVAL_MS', 60000),
    },

    rateLimit: {
        windowMs: envIntOrDefault('RATE_LIMIT_WINDOW_MS', 900000),
        maxRequests: envIntOrDefault('RATE_LIMIT_MAX_REQUESTS', 100),
    },

    security: {
        corsOrigin: envOrDefault('CORS_ORIGIN', '*'),
        requestTimeoutMs: envIntOrDefault('REQUEST_TIMEOUT_MS', 120000),
    },

    /** Phase 2 — set WORKER_ENABLED=true once custom worker is deployed */
    worker: {
        url: envOrDefault('WORKER_URL', 'http://compression-worker:4000'),
        enabled: envOrDefault('WORKER_ENABLED', 'false') === 'true',
    },

    /** Phase 2 — authentication */
    auth: {
        enabled: envOrDefault('AUTH_ENABLED', 'false') === 'true',
        jwtSecret: envOrDefault('JWT_SECRET', 'changeme_jwt_secret'),
        jwtExpiry: envIntOrDefault('JWT_EXPIRY', 3600),
    },
} as const;

export type AppConfig = typeof config;
