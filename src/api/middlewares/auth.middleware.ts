import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { verifyApiKey } from '../../utils/apikey';
import { unauthorized, forbidden } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Extracts the API key from the Authorization header.
 * Expected format:  Authorization: Bearer sk_<token>
 */
function extractToken(req: Request): string | null {
  const header = req.headers['authorization'];
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Authenticate middleware — validates the API key and attaches
 * userId, apiKeyId, and apiKeyPermissions to the request.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  (async () => {
    const token = extractToken(req);
    if (!token) {
      unauthorized(res, 'Missing API key. Include: Authorization: Bearer <key>');
      return;
    }

    // Fetch all active keys (we must hash-compare each one).
    // Optimisation: the key prefix (first 12 chars) is stored plainly — filter first.
    const prefix = token.slice(0, 12);
    const candidates = await prisma.apiKey.findMany({
      where: { prefix, isActive: true },
    });

    let matchedKey: (typeof candidates)[0] | null = null;
    for (const candidate of candidates) {
      if (await verifyApiKey(token, candidate.keyHash)) {
        matchedKey = candidate;
        break;
      }
    }

    if (!matchedKey) {
      unauthorized(res, 'Invalid or revoked API key');
      return;
    }

    if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
      unauthorized(res, 'API key has expired');
      return;
    }

    // Update lastUsedAt non-blocking
    prisma.apiKey
      .update({ where: { id: matchedKey.id }, data: { lastUsedAt: new Date() } })
      .catch((err: Error) => logger.warn('Could not update lastUsedAt', { err }));

    req.userId = matchedKey.userId;
    req.apiKeyId = matchedKey.id;
    req.apiKeyPermissions = matchedKey.permissions as string[];

    next();
  })().catch(next);
}

/**
 * Permission guard — call after authenticate().
 * Usage: requirePermission('email:send')
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKeyPermissions?.includes(permission)) {
      forbidden(res, `API key does not have permission: ${permission}`);
      return;
    }
    next();
  };
}
