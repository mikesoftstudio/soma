import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { generateApiKey } from '../../utils/apikey';
import { ok, created, noContent, notFound, badRequest } from '../../utils/response';
import { env } from '../../config/env';

export const authController = {
  /**
   * POST /v1/auth/register
   * Create a new user account and return a root API key.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body as {
        name: string; email: string; password: string;
      };

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: { name, email, password: passwordHash },
        select: { id: true, name: true, email: true, createdAt: true },
      });

      // Auto-generate a root API key
      const { key, hash, prefix } = await generateApiKey();
      await prisma.apiKey.create({
        data: {
          name: 'Default Key',
          keyHash: hash,
          prefix,
          userId: user.id,
          permissions: [
            'email:send', 'email:read',
            'sms:send', 'sms:read',
            'template:read', 'template:write',
            'webhook:read', 'webhook:write',
            'domain:read', 'domain:write',
          ],
        },
      });

      created(res, {
        user,
        apiKey: key, // shown once — store it securely!
        note: 'Store your API key now. It will not be shown again.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/auth/me
   * Get the current user's profile.
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, name: true, email: true, isActive: true, createdAt: true },
      });
      if (!user) { notFound(res); return; }
      ok(res, user);
    } catch (err) {
      next(err);
    }
  },
};

export const apiKeyController = {
  /**
   * POST /v1/api-keys
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, permissions, rateLimit, expiresAt } = req.body;
      const { key, hash, prefix } = await generateApiKey();

      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          keyHash: hash,
          prefix,
          permissions: permissions ?? ['email:send', 'sms:send'],
          rateLimit: rateLimit ?? 1000,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          userId: req.userId!,
        },
        select: {
          id: true, name: true, prefix: true, permissions: true,
          rateLimit: true, expiresAt: true, createdAt: true,
        },
      });

      created(res, {
        ...apiKey,
        key, // shown once
        note: 'Store your API key now. It will not be shown again.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/api-keys
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { userId: req.userId! },
        select: {
          id: true, name: true, prefix: true, permissions: true,
          rateLimit: true, isActive: true, lastUsedAt: true,
          expiresAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      ok(res, keys);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /v1/api-keys/:id  — toggle active / update name
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = await prisma.apiKey.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!key) { notFound(res); return; }

      const updated = await prisma.apiKey.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name ?? key.name,
          isActive: req.body.isActive ?? key.isActive,
        },
        select: {
          id: true, name: true, prefix: true, isActive: true,
          permissions: true, rateLimit: true, updatedAt: true,
        },
      });

      ok(res, updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /v1/api-keys/:id  — revoke a key
   */
  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = await prisma.apiKey.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!key) { notFound(res); return; }

      await prisma.apiKey.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
