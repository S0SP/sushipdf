import axios, { AxiosInstance, AxiosResponse } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * StirlingService — thin HTTP client wrapping the Stirling PDF REST API.
 *
 * Every public method sends a multipart request to Stirling and returns
 * the raw binary response streamed to a file on disk.
 *
 * This service is intentionally kept transport-only: no business logic,
 * no retry policies.  Higher-level orchestration lives in the route handlers
 * and the CompressionService abstraction.
 */
export class StirlingService {
    private readonly client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: config.stirling.url,
            timeout: config.stirling.timeoutMs,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        logger.info(`StirlingService initialised → ${config.stirling.url}`);
    }

    // ─── Health ─────────────────────────────────────────────
    async isHealthy(): Promise<boolean> {
        try {
            const res = await this.client.get('/api/v1/info/status', { timeout: 5000 });
            return res.status === 200;
        } catch {
            return false;
        }
    }

    // ─── Compress ───────────────────────────────────────────
    async compressPdf(
        inputFilePath: string,
        outputDir: string,
        optimizeLevel: number = 3,
    ): Promise<string> {
        const form = new FormData();
        form.append('fileInput', fs.createReadStream(inputFilePath));
        form.append('optimizeLevel', String(optimizeLevel));

        return this.postAndSave('/api/v1/misc/compress-pdf', form, outputDir, 'compressed.pdf');
    }

    // ─── Merge ─────────────────────────────────────────────
    async mergePdfs(inputFilePaths: string[], outputDir: string): Promise<string> {
        const form = new FormData();
        for (const filePath of inputFilePaths) {
            form.append('fileInput', fs.createReadStream(filePath));
        }

        return this.postAndSave('/api/v1/general/merge-pdfs', form, outputDir, 'merged.pdf');
    }

    // ─── Split ─────────────────────────────────────────────
    async splitPdf(
        inputFilePath: string,
        outputDir: string,
        pages: string,
    ): Promise<string> {
        const form = new FormData();
        form.append('fileInput', fs.createReadStream(inputFilePath));
        form.append('pageNumbers', pages);

        return this.postAndSave('/api/v1/general/split-pdf-by-pages', form, outputDir, 'split.pdf');
    }

    // ─── Convert to PDF ────────────────────────────────────
    async convertToPdf(inputFilePath: string, outputDir: string): Promise<string> {
        const form = new FormData();
        form.append('fileInput', fs.createReadStream(inputFilePath));

        return this.postAndSave('/api/v1/convert/file/pdf', form, outputDir, 'converted.pdf');
    }

    // ─── Convert PDF to Image ─────────────────────────────
    async pdfToImage(
        inputFilePath: string,
        outputDir: string,
        imageFormat: string = 'png',
    ): Promise<string> {
        const form = new FormData();
        form.append('fileInput', fs.createReadStream(inputFilePath));
        form.append('imageFormat', imageFormat);
        form.append('singleOrMultiple', 'multiple');

        return this.postAndSave('/api/v1/convert/pdf/img', form, outputDir, `output.${imageFormat}`);
    }

    // ─── Generic Stirling API Proxy ────────────────────────
    async proxyRequest(
        endpoint: string,
        formData: FormData,
        outputDir: string,
        outputFilename: string,
    ): Promise<string> {
        return this.postAndSave(endpoint, formData, outputDir, outputFilename);
    }

    // ─── Private helpers ──────────────────────────────────
    private async postAndSave(
        endpoint: string,
        form: FormData,
        outputDir: string,
        filename: string,
    ): Promise<string> {
        const outputPath = path.join(outputDir, filename);

        logger.info(`Stirling POST ${endpoint}`);

        const response: AxiosResponse = await this.client.post(endpoint, form, {
            headers: {
                ...form.getHeaders(),
            },
            responseType: 'stream',
        });

        await fs.promises.mkdir(outputDir, { recursive: true });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise<string>((resolve, reject) => {
            writer.on('finish', () => {
                logger.info(`Stirling response saved → ${outputPath}`);
                resolve(outputPath);
            });
            writer.on('error', (err: Error) => {
                logger.error(`Failed to write Stirling response: ${err.message}`);
                reject(err);
            });
        });
    }
}

/** Singleton */
export const stirlingService = new StirlingService();
