import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.middleware';

/**
 * Validate that a file was uploaded in the request.
 */
export function requireFile(req: Request, _res: Response, next: NextFunction): void {
    if (!req.file) {
        return next(new AppError('No file uploaded. Please attach a file.', 400));
    }
    next();
}

/**
 * Validate that multiple files were uploaded.
 */
export function requireFiles(minCount: number = 2) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const files = req.files as Express.Multer.File[] | undefined;
        if (!files || files.length < minCount) {
            return next(
                new AppError(
                    `At least ${minCount} files are required. Received ${files?.length ?? 0}.`,
                    400,
                ),
            );
        }
        next();
    };
}

/**
 * Validate that the uploaded file is a PDF.
 */
export function requirePdf(req: Request, _res: Response, next: NextFunction): void {
    if (!req.file) {
        return next(new AppError('No file uploaded.', 400));
    }
    if (req.file.mimetype !== 'application/pdf') {
        return next(new AppError('Only PDF files are accepted for this operation.', 415));
    }
    next();
}

/**
 * Validate required body parameters.
 */
export function requireBodyParams(...params: string[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const missing = params.filter((p) => req.body[p] === undefined || req.body[p] === '');
        if (missing.length > 0) {
            return next(
                new AppError(`Missing required parameters: ${missing.join(', ')}`, 400),
            );
        }
        next();
    };
}
