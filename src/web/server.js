import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create and configure the Express server
 * @param {string} dataDir - Path to .govtrack directory
 * @returns {express.Application} Configured Express app
 */
export function createServer(dataDir) {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS for localhost
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Store dataDir for routes
  app.locals.dataDir = dataDir;

  // API routes
  app.use('/api', createApiRouter(dataDir));

  // Static files
  app.use(express.static(join(__dirname, 'public')));

  // Page routes
  app.get('/gov/:slug', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'gov.html'));
  });

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  });

  return app;
}
