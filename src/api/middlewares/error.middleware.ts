import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Resource already exists (unique constraint)' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Resource not found' });
      return;
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ success: false, error: 'Invalid data provided' });
    return;
  }

  // Generic error
  const message = err instanceof Error ? err.message : 'Internal server error';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error('Unhandled error', {
    method: req.method,
    url: req.url,
    message,
    stack,
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
}
