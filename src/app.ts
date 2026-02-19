import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './api/middlewares/error.middleware';

// Routes
import authRoutes from './api/routes/auth.routes';
import emailRoutes from './api/routes/email.routes';
import smsRoutes from './api/routes/sms.routes';
import templateRoutes from './api/routes/template.routes';
import webhookRoutes from './api/routes/webhook.routes';
import domainRoutes from './api/routes/domain.routes';

export function createApp(): Application {
  const app = express();

  // ─── Security headers ─────────────────────
  app.use(helmet());
  app.disable('x-powered-by');

  // ─── CORS ─────────────────────────────────
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));

  // ─── Body parsing ─────────────────────────
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Compression ──────────────────────────
  app.use(compression());

  // ─── HTTP Logging ─────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/health',
    }),
  );

  // ─── Global rate limit ───────────────────
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests' },
    }),
  );

  // ─── Health check ─────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
  });

  // ─── API Routes ───────────────────────────
  app.use('/v1', authRoutes);
  app.use('/v1/emails', emailRoutes);
  app.use('/v1/sms', smsRoutes);
  app.use('/v1/templates', templateRoutes);
  app.use('/v1/webhooks', webhookRoutes);
  app.use('/v1/domains', domainRoutes);

  // ─── 404 & Error handling ─────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

