import { ICompressionService } from '../interfaces/compression.interface';
import { StirlingCompressionService } from './compression.service';
import { config } from '../config';
import { logger } from '../utils/logger';

// ════════════════════════════════════════════════════════════════
// CompressionServiceFactory
// ════════════════════════════════════════════════════════════════
//
// Phase 1  →  returns StirlingCompressionService
// Phase 2  →  when WORKER_ENABLED=true, returns WorkerCompressionService
//
// Usage in route handlers:
//   const compressionService = CompressionServiceFactory.create();
//   await compressionService.compressDefault(filePath);
//
// This is the ONLY place where concrete implementation selection happens.
// Every consumer depends on ICompressionService, never on the concrete class.
// ════════════════════════════════════════════════════════════════

export class CompressionServiceFactory {
    private static instance: ICompressionService | null = null;

    static create(): ICompressionService {
        if (this.instance) return this.instance;

        if (config.worker.enabled) {
            // Phase 2: Uncomment once WorkerCompressionService exists
            // import { WorkerCompressionService } from './worker-compression.service';
            // this.instance = new WorkerCompressionService();
            // logger.info('CompressionServiceFactory → WorkerCompressionService');

            // Until Phase 2, fall back to Stirling even if flag is toggled
            logger.warn(
                'WORKER_ENABLED=true but WorkerCompressionService not yet implemented. ' +
                'Falling back to StirlingCompressionService.',
            );
            this.instance = new StirlingCompressionService();
        } else {
            this.instance = new StirlingCompressionService();
            logger.info('CompressionServiceFactory → StirlingCompressionService');
        }

        return this.instance;
    }

    /** Reset singleton (useful for testing) */
    static reset(): void {
        this.instance = null;
    }
}
