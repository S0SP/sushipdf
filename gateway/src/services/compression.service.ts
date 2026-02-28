import fs from 'fs';
import {
    ICompressionService,
    CompressionResult,
    CompressionOptions,
} from '../interfaces/compression.interface';
import { stirlingService } from './stirling.service';
import { logger } from '../utils/logger';

/**
 * StirlingCompressionService — Phase 1 implementation
 *
 * Implements ICompressionService by delegating to Stirling PDF.
 *
 * In Phase 2, create a `WorkerCompressionService` that implements
 * the same interface and swap it via CompressionServiceFactory.
 */
export class StirlingCompressionService implements ICompressionService {
    getEngineName(): string {
        return 'stirling';
    }

    async isHealthy(): Promise<boolean> {
        return stirlingService.isHealthy();
    }

    async compressDefault(
        filePath: string,
        options?: CompressionOptions,
    ): Promise<CompressionResult> {
        const originalStats = await fs.promises.stat(filePath);
        const originalSize = originalStats.size;

        const optimizeLevel = options?.optimizeLevel ?? this.qualityToLevel(options?.quality);
        const outputDir = filePath.substring(0, filePath.lastIndexOf('/')) || filePath.substring(0, filePath.lastIndexOf('\\'));

        logger.info(`StirlingCompression.compressDefault level=${optimizeLevel} file=${filePath}`);

        const outputPath = await stirlingService.compressPdf(filePath, outputDir, optimizeLevel);

        const compressedStats = await fs.promises.stat(outputPath);
        const compressedSize = compressedStats.size;
        const compressionRatio = Number(((compressedSize / originalSize) * 100).toFixed(2));

        const result: CompressionResult = {
            outputPath,
            originalSize,
            compressedSize,
            compressionRatio,
            engine: 'stirling',
        };

        logger.info(
            `Compression complete: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ` +
            `${(compressedSize / 1024 / 1024).toFixed(2)} MB (${compressionRatio}%)`,
        );

        return result;
    }

    async compressToTargetSize(
        _filePath: string,
        _targetMB: number,
    ): Promise<CompressionResult> {
        // Phase 2: This will be implemented by WorkerCompressionService
        // For now, throw a clear error so API consumers know it's not available yet.
        throw new Error(
            'compressToTargetSize is not available in Phase 1. ' +
            'Use compressDefault() or wait for the custom compression worker (Phase 2).',
        );
    }

    private qualityToLevel(quality?: 'low' | 'medium' | 'high' | 'lossless'): number {
        switch (quality) {
            case 'low': return 1;
            case 'medium': return 3;
            case 'high': return 5;
            case 'lossless': return 9;
            default: return 3;
        }
    }
}
