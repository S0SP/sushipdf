// ── Future: Authentication Middleware ──
// Uncomment and implement when AUTH_ENABLED=true

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Authentication middleware placeholder.
 *
 * Phase 1: passes through all requests.
 * Phase 2: validates JWT tokens from the Authorization header.
 */
export function authMiddleware(_req: Request, _res: Response, next: NextFunction): void {
    if (!config.auth.enabled) {
        return next();
    }

    // Phase 2 implementation:
    // const authHeader = req.headers.authorization;
    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //   res.status(401).json({
    //     success: false,
    //     error: 'Authentication required',
    //     timestamp: new Date().toISOString(),
    //   });
    //   return;
    // }
    //
    // try {
    //   const token = authHeader.split(' ')[1];
    //   const decoded = jwt.verify(token, config.auth.jwtSecret);
    //   (req as any).user = decoded;
    //   next();
    // } catch {
    //   res.status(401).json({
    //     success: false,
    //     error: 'Invalid or expired token',
    //     timestamp: new Date().toISOString(),
    //   });
    // }

    next();
}
