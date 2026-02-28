// ════════════════════════════════════════════════════════════════
// CompressionService Interface
// ════════════════════════════════════════════════════════════════
//
// This is the core abstraction that enables Phase 2 migration.
//
// Phase 1 (current):
//   compressDefault()  → forwards to Stirling PDF
//
// Phase 2 (future):
//   compressDefault()        → Stirling or Worker (configurable)
//   compressToTargetSize()   → custom adaptive compression worker
//
// All implementations MUST conform to this interface.
// ════════════════════════════════════════════════════════════════

export interface CompressionResult {
    /** Path to the compressed file on disk */
    outputPath: string;
    /** Original file size in bytes */
    originalSize: number;
    /** Compressed file size in bytes */
    compressedSize: number;
    /** Compression ratio as a percentage (e.g., 45.2 means 45.2% of original) */
    compressionRatio: number;
    /** Engine that performed the compression */
    engine: 'stirling' | 'custom-worker';
}

export interface CompressionOptions {
    /** Optimization level (1-9, where 9 is maximum compression) */
    optimizeLevel?: number;
    /** Expected quality level for lossy compression */
    quality?: 'low' | 'medium' | 'high' | 'lossless';
}

export interface ICompressionService {
    /**
     * Compress a PDF using default settings.
     * Phase 1: forwards to Stirling PDF.
     * Phase 2: can be routed to custom worker.
     */
    compressDefault(
        filePath: string,
        options?: CompressionOptions,
    ): Promise<CompressionResult>;

    /**
     * Compress a PDF to a target file size in MB.
     * Phase 1: throws NotImplemented (or falls back to compressDefault).
     * Phase 2: uses custom adaptive compression worker with iterative passes.
     */
    compressToTargetSize(
        filePath: string,
        targetMB: number,
    ): Promise<CompressionResult>;

    /**
     * Returns the name of the engine backing this service.
     */
    getEngineName(): string;

    /**
     * Health check for the underlying compression engine.
     */
    isHealthy(): Promise<boolean>;
}
