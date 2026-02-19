import 'dotenv/config'; // must be first
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  logger.info(`Soma API starting — env: ${env.NODE_ENV}`);

  // 1. Connect database
  await connectDatabase();
  logger.info('Database connected');

  // 2. Start HTTP server
  const app = createApp();
  const httpServer = app.listen(env.PORT, () => {
    logger.info(`HTTP server listening on port ${env.PORT}`);
    logger.info(`API base URL: ${env.API_BASE_URL}`);
    logger.info('Using Resend for email delivery');
    logger.info('Using Twilio for SMS delivery');
  });

  // 3. Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.warn(`Received ${signal} — shutting down gracefully`);

    httpServer.close(async () => {
      try {
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { err });
        process.exit(1);
      }
    });

    // Force exit if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after 30s timeout');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { err });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { err });
  process.exit(1);
});

