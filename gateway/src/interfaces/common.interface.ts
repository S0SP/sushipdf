// ════════════════════════════════════════════════
// Shared interfaces for the PDF Tools Gateway
// ════════════════════════════════════════════════

export interface JobResult {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    inputFile: string;
    outputFile?: string;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}

export interface FileMetadata {
    originalName: string;
    sanitizedName: string;
    mimeType: string;
    size: number;
    storagePath: string;
    jobId: string;
    createdAt: Date;
    expiresAt: Date;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
}

export interface PdfOperationRequest {
    jobId: string;
    inputPath: string;
    outputDir: string;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
        gateway: boolean;
        stirling: boolean;
        redis: boolean;
        worker?: boolean;
    };
    uptime: number;
    timestamp: string;
}
