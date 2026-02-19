import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { ok, created, noContent, notFound, badRequest } from '../../utils/response';

/**
 * Domain Controller
 *
 * Domains represent verified sending domains for email.
 * After adding a domain, the user must publish DNS records (DKIM, SPF)
 * and then call /verify to confirm ownership.
 *
 * The DKIM key pair is generated here and stored — configure your outbound
 * SMTP server (e.g. Postfix) to use the private key for signing.
 */
export const domainController = {
  /**
   * POST /v1/domains
   */
  async add(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { domain } = req.body as { domain: string };

      // Generate DKIM key pair
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const selector = `soma${Date.now()}`;
      // Extract raw base64 for DKIM DNS record
      const dkimPublicKey = publicKey
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\n/g, '');

      const record = await prisma.domain.create({
        data: {
          domain,
          userId: req.userId!,
          dkimSelector: selector,
          dkimPublicKey,
          dkimPrivateKey: privateKey, // TODO: encrypt at rest in production
          spfRecord: `v=spf1 mx a ~all`,
        },
        select: {
          id: true, domain: true, status: true,
          dkimSelector: true, dkimPublicKey: true, spfRecord: true,
          createdAt: true,
        },
      });

      created(res, {
        ...record,
        dns: {
          dkim: {
            type: 'TXT',
            name: `${selector}._domainkey.${domain}`,
            value: `v=DKIM1; k=rsa; p=${dkimPublicKey}`,
          },
          spf: {
            type: 'TXT',
            name: `@`,
            value: `v=spf1 mx a ~all`,
          },
          dmarc: {
            type: 'TXT',
            name: `_dmarc.${domain}`,
            value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
          },
        },
        instructions: 'Publish the DNS records above, then call POST /v1/domains/:id/verify',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/domains
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domains = await prisma.domain.findMany({
        where: { userId: req.userId! },
        select: {
          id: true, domain: true, status: true,
          dkimSelector: true, verifiedAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      ok(res, domains);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/domains/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domain = await prisma.domain.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        select: {
          id: true, domain: true, status: true,
          dkimSelector: true, dkimPublicKey: true,
          spfRecord: true, dmarcRecord: true,
          verifiedAt: true, createdAt: true,
        },
      });
      if (!domain) { notFound(res); return; }
      ok(res, domain);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /v1/domains/:id/verify
   * Check DNS records via Node's built-in dns module.
   */
  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await prisma.domain.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!record) { notFound(res); return; }

      const dns = await import('dns/promises');
      const checks: { name: string; passed: boolean; reason?: string }[] = [];

      // Check DKIM TXT record
      try {
        const dkimHost = `${record.dkimSelector}._domainkey.${record.domain}`;
        const txtRecords = await dns.resolveTxt(dkimHost);
        const flat = txtRecords.map((r) => r.join('')).join(' ');
        const passed = flat.includes('v=DKIM1') && flat.includes(record.dkimPublicKey ?? '');
        checks.push({ name: 'DKIM', passed, reason: passed ? undefined : 'TXT record not found or mismatch' });
      } catch {
        checks.push({ name: 'DKIM', passed: false, reason: 'DNS lookup failed' });
      }

      // Check SPF TXT record
      try {
        const spfRecords = await dns.resolveTxt(record.domain);
        const flat = spfRecords.map((r) => r.join('')).join(' ');
        const passed = flat.includes('v=spf1');
        checks.push({ name: 'SPF', passed, reason: passed ? undefined : 'No SPF record found' });
      } catch {
        checks.push({ name: 'SPF', passed: false, reason: 'DNS lookup failed' });
      }

      const allPassed = checks.every((c) => c.passed);

      await prisma.domain.update({
        where: { id: record.id },
        data: {
          status: allPassed ? 'VERIFIED' : 'FAILED',
          verifiedAt: allPassed ? new Date() : undefined,
        },
      });

      ok(res, { verified: allPassed, checks });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /v1/domains/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await prisma.domain.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!record) { notFound(res); return; }

      await prisma.domain.delete({ where: { id: req.params.id } });
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
