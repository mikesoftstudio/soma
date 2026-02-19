import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from '../config/env';

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
  }),
);

const fileFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports: [
    // Console — pretty in dev, JSON in prod
    new winston.transports.Console({
      format: env.NODE_ENV === 'development' ? consoleFormat : fileFormat,
    }),

    // Rotating file — errors
    new DailyRotateFile({
      filename: path.join(env.LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxFiles: '30d',
      zippedArchive: true,
    }),

    // Rotating file — combined
    new DailyRotateFile({
      filename: path.join(env.LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],
});
