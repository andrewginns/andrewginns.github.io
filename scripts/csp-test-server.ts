import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const basePort = 3001;

interface CSPHashes {
  scriptHashes: string[];
  styleHashes: string[];
  generatedAt: string;
}

interface CSPTestResult {
  success: boolean;
  violations: string[];
  warnings: string[];
}

class CSPTestServer {
  private app: express.Application;
  private server: any;
  private cspHashes: CSPHashes | null = null;
  private port: number = 0;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.loadCSPHashes();
  }

  private loadCSPHashes(): void {
    const hashesPath = path.join(__dirname, '..', 'csp-hashes.json');

    if (!fs.existsSync(hashesPath)) {
      console.error('❌ CSP hashes file not found. Run "npm run build" first.');
      process.exit(1);
    }

    try {
      const hashesContent = fs.readFileSync(hashesPath, 'utf8');
      this.cspHashes = JSON.parse(hashesContent);
      console.log(
        `✅ Loaded ${this.cspHashes!.scriptHashes.length} script hashes and ${this.cspHashes!.styleHashes.length} style hashes`
      );
    } catch (error) {
      console.error('❌ Failed to load CSP hashes:', error);
      process.exit(1);
    }
  }

  private generateStrictCSP(): string {
    if (!this.cspHashes) {
      throw new Error('CSP hashes not loaded');
    }

    const { scriptHashes, styleHashes } = this.cspHashes;

    // Build strict CSP policy using hashes instead of 'unsafe-inline'
    const scriptSrc = [
      "'self'",
      ...scriptHashes.map((hash) => `'sha256-${hash}'`),
      'https://cdn.plot.ly',
      'https://static.cloudflareinsights.com',
    ].join(' ');

    const styleSrc = [
      "'self'",
      ...styleHashes.map((hash) => `'sha256-${hash}'`),
      'https://fonts.googleapis.com',
    ].join(' ');

    return [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://api.github.com https://api.rss2json.com https://cloudflareinsights.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
      'block-all-mixed-content',
    ].join('; ');
  }

  private setupMiddleware(): void {
    // CSP violation reporting endpoint
    this.app.use('/csp-violation-report', express.json({ type: 'application/csp-report' }));
    this.app.post('/csp-violation-report', (req: Request, res: Response) => {
      const report = req.body;
      console.log('🚨 CSP Violation:', JSON.stringify(report, null, 2));
      res.status(204).end();
    });

    // Strict CSP headers for all content
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const strictCSP = this.generateStrictCSP();

      // Add CSP violation reporting
      const cspWithReporting = `${strictCSP}; report-uri /csp-violation-report`;

      res.setHeader('Content-Security-Policy', cspWithReporting);

      // Add other security headers similar to _headers file
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      next();
    });

    // Serve static files from dist directory
    this.app.use(
      express.static(distDir, {
        setHeaders: (res: Response, filepath: string) => {
          if (filepath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          }
          if (filepath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
          }
        },
      })
    );

    // Handle SPA routing - serve index.html for non-asset requests
    this.app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(distDir)) {
        reject(new Error('❌ dist directory not found. Run "npm run build" first.'));
        return;
      }

      // Try to find an available port starting from basePort
      this.tryStartServer(basePort, resolve, reject);
    });
  }

  private tryStartServer(port: number, resolve: () => void, reject: (error: Error) => void): void {
    this.server = this.app.listen(port, () => {
      this.port = port;
      console.log(`🧪 CSP Test Server running at http://localhost:${this.port}`);
      console.log(`📋 Using strict CSP policy (no 'unsafe-inline')`);
      console.log(`🔍 CSP violations will be logged to console`);
      resolve();
    });

    this.server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        // Try next port
        if (port < basePort + 50) {
          this.tryStartServer(port + 1, resolve, reject);
        } else {
          reject(new Error(`❌ Could not find available port after trying ${basePort}-${port}`));
        }
      } else {
        reject(error);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 CSP Test Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CSPTestServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down CSP test server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  // Start server
  server.start().catch((error) => {
    console.error('❌ Failed to start CSP test server:', error.message);
    process.exit(1);
  });
}

export { CSPTestServer, CSPTestResult };
