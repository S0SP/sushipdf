import { storageService } from './storage.service';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * CleanupScheduler — periodically removes expired job files.
 *
 * Runs on a setInterval.  In Phase 2 with a job queue,
 * cleanup can also be triggered after each job completes.
 */
export class CleanupScheduler {
    private intervalId: NodeJS.Timeout | null = null;

    start(): void {
        if (this.intervalId) return;

        const intervalMs = config.storage.cleanupIntervalMs;
        logger.info(
            `CleanupScheduler started — interval=${intervalMs}ms, ` +
            `retention=${config.storage.fileRetentionMinutes}min`,
        );

        // Initial cleanup on startup
        void storageService.cleanupExpiredJobs();

        this.intervalId = setInterval(() => {
            void storageService.cleanupExpiredJobs();
        }, intervalMs);

        // Ensure interval doesn't prevent process exit
        this.intervalId.unref();
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('CleanupScheduler stopped');
        }
    }
}

export const cleanupScheduler = new CleanupScheduler();
