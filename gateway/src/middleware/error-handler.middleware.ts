import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../interfaces';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // Multer errors
    if (err.name === 'MulterError') {
        const multerErr = err as { code?: string; message: string };
        let message = multerErr.message;
        let statusCode = 400;

        if (multerErr.code === 'LIMIT_FILE_SIZE') {
            message = 'File exceeds maximum allowed size';
            statusCode = 413;
        } else if (multerErr.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files uploaded';
            statusCode = 400;
        } else if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
            statusCode = 400;
        }

        const response: ApiResponse = {
            success: false,
            error: message,
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(response);
        return;
    }

    // File type filter errors
    if (err.message.startsWith('File type not allowed')) {
        const response: ApiResponse = {
            success: false,
            error: err.message,
            timestamp: new Date().toISOString(),
        };
        res.status(415).json(response);
        return;
    }

    // Application errors
    if (err instanceof AppError) {
        const response: ApiResponse = {
            success: false,
            error: err.message,
            timestamp: new Date().toISOString(),
        };
        res.status(err.statusCode).json(response);

        if (!err.isOperational) {
            logger.error(`Non-operational error: ${err.message}`, { stack: err.stack });
        }
        return;
    }

    // Unknown errors
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

    const response: ApiResponse = {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
}
