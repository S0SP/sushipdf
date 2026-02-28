import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Rate limiter middleware.
 *
 * Phase 1: in-memory store (fine for single-node).
 * Phase 2: swap to rate-limit-redis for distributed limiting.
 */
export const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests. Please try again later.',
        timestamp: new Date().toISOString(),
    },
    handler: (_req, res, _next, options) => {
        logger.warn(`Rate limit exceeded for ${_req.ip}`);
        res.status(429).json(options.message);
    },
    skip: (req) => {
        // Don't rate-limit health checks
        return req.path === '/health';
    },
});

/** Stricter rate limiter for upload endpoints */
export const uploadRateLimiter = rateLimit({
    windowMs: 60_000, // 1 minute
    max: 10,          // 10 uploads per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Upload rate limit exceeded. Please wait before uploading again.',
        timestamp: new Date().toISOString(),
    },
    handler: (_req, res, _next, options) => {
        logger.warn(`Upload rate limit exceeded for ${_req.ip}`);
        res.status(429).json(options.message);
    },
});
