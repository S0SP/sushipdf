# 📄 PDF Tools Platform

A production-grade, microservice-based PDF and image tools platform powered by [Stirling PDF](https://github.com/Stirling-Tools/Stirling-PDF) with an extensible API gateway architecture.

---

## 🏗 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Client    │────▶│    Nginx     │────▶│  API Gateway   │
│             │     │  (reverse    │     │  (Node.js +    │
│             │     │   proxy)     │     │   TypeScript)  │
└─────────────┘     └──────────────┘     └───────┬────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                              ▼                  ▼                  ▼
                    ┌──────────────┐    ┌──────────────┐  ┌──────────────┐
                    │  Stirling    │    │    Redis     │  │   Worker    │
                    │  PDF Engine  │    │  (job queue) │  │  (Phase 2)  │
                    └──────────────┘    └──────────────┘  └──────────────┘
```

### Services

| Service | Description | Port |
|---------|-------------|------|
| **Nginx** | Reverse proxy, rate limiting, security headers | 80, 443 |
| **API Gateway** | TypeScript API layer, routing, validation | 3000 (internal) |
| **Stirling PDF** | Core PDF processing engine | 8080 (internal) |
| **Redis** | Cache & future job queue | 6379 (internal) |
| **Worker** | Custom compression microservice (Phase 2) | 4000 (internal) |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- 4GB+ RAM (Stirling PDF is Java-based)

### 1. Clone and configure
```bash
cp .env.example .env
# Edit .env as needed
```

### 2. Start all services
```bash
docker-compose up -d
```

### 3. Verify health
```bash
curl http://localhost/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": { "gateway": true, "stirling": true, "redis": true },
  "uptime": 42,
  "timestamp": "2026-03-01T00:00:00.000Z"
}
```

---

## 📡 API Endpoints

### Health Check
```
GET /health
```

### PDF Operations

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/v1/pdf/compress` | Compress a PDF | `file` (multipart), `optimizeLevel` (1-9) |
| POST | `/api/v1/pdf/compress/target-size` | Compress to target size (Phase 2) | `file`, `targetMB` |
| GET | `/api/v1/pdf/compress/engine` | Show compression engine info | — |
| POST | `/api/v1/pdf/merge` | Merge multiple PDFs | `files` (multipart, ≥2) |
| POST | `/api/v1/pdf/split` | Split a PDF by pages | `file`, `pages` (e.g., "1,3,5") |
| POST | `/api/v1/pdf/convert-to-pdf` | Convert file to PDF | `file` |
| POST | `/api/v1/pdf/pdf-to-image` | Convert PDF to images | `file`, `format` (png/jpg) |

### Example: Compress a PDF
```bash
curl -X POST http://localhost/api/v1/pdf/compress \
  -F "file=@document.pdf" \
  -F "optimizeLevel=5" \
  --output compressed.pdf
```

### Example: Merge PDFs
```bash
curl -X POST http://localhost/api/v1/pdf/merge \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.pdf" \
  --output merged.pdf
```

### Response Headers
All PDF operation responses include:
- `X-Job-Id` — unique job identifier
- `X-Original-Size` — original file size (compression only)
- `X-Compressed-Size` — compressed size (compression only)
- `X-Compression-Ratio` — ratio as percentage (compression only)
- `X-Compression-Engine` — engine used (`stirling` or `custom-worker`)

---

## 🔐 Security

- **Filename sanitization** — prevents path traversal attacks
- **MIME type validation** — only allowed file types accepted
- **File size limits** — configurable max upload size
- **Rate limiting** — Nginx + application-level dual protection
- **Auto-deletion** — files removed after configurable retention period
- **Security headers** — Helmet + CSP + X-Frame-Options via Nginx
- **Non-root Docker** — gateway runs as unprivileged user
- **No permanent storage** — all files are ephemeral

---

## 🔮 Phase 2 Migration Guide

### Adding Custom Compression Worker

1. **Create** `WorkerCompressionService` implementing `ICompressionService`
2. **Implement** `compressToTargetSize()` with adaptive multi-pass logic
3. **Update** `CompressionServiceFactory` to return worker service when `WORKER_ENABLED=true`
4. **Uncomment** the `compression-worker` service in `docker-compose.yml`
5. **Set** `WORKER_ENABLED=true` in `.env`

The interface contract:
```typescript
interface ICompressionService {
  compressDefault(filePath: string, options?: CompressionOptions): Promise<CompressionResult>;
  compressToTargetSize(filePath: string, targetMB: number): Promise<CompressionResult>;
  getEngineName(): string;
  isHealthy(): Promise<boolean>;
}
```

No route changes needed — the factory handles routing automatically.

---

## 📁 Project Structure

```
pdf-tools/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── docker/
│   └── nginx/
│       ├── nginx.conf
│       └── conf.d/
│           └── default.conf
└── gateway/
    ├── Dockerfile
    ├── .dockerignore
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── server.ts
        ├── config/
        │   └── index.ts
        ├── interfaces/
        │   ├── index.ts
        │   ├── common.interface.ts
        │   └── compression.interface.ts
        ├── middleware/
        │   ├── index.ts
        │   ├── auth.middleware.ts
        │   ├── error-handler.middleware.ts
        │   ├── rate-limiter.middleware.ts
        │   ├── timeout.middleware.ts
        │   ├── upload.middleware.ts
        │   └── validation.middleware.ts
        ├── routes/
        │   ├── index.ts
        │   ├── compression.routes.ts
        │   ├── health.routes.ts
        │   └── pdf.routes.ts
        ├── services/
        │   ├── index.ts
        │   ├── cleanup.service.ts
        │   ├── compression.factory.ts
        │   ├── compression.service.ts
        │   ├── redis.service.ts
        │   ├── stirling.service.ts
        │   └── storage.service.ts
        └── utils/
            └── logger.ts
```

---

## ⚙️ Environment Variables

See [`.env.example`](./.env.example) for all configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `GATEWAY_PORT` | `3000` | Gateway listen port |
| `STIRLING_URL` | `http://stirling:8080` | Stirling PDF URL |
| `REDIS_PASSWORD` | `changeme_redis_password` | Redis auth password |
| `MAX_FILE_SIZE_MB` | `100` | Max upload file size |
| `FILE_RETENTION_MINUTES` | `30` | Auto-delete files after |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Requests per window |
| `WORKER_ENABLED` | `false` | Enable custom compression worker |
| `AUTH_ENABLED` | `false` | Enable JWT authentication |

---

## 📋 License

MIT
