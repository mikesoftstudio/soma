import https from 'https';
import http from 'http';
import { URL } from 'url';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { signWebhookPayload } from '../utils/apikey';

interface WebhookPayload {
  event: string;
  createdAt: string;
  data: Record<string, unknown>;
}

class WebhookService {
  /**
   * Fan-out: find all active webhooks subscribed to this event
   * and deliver to each one (fire and forget).
   */
  async dispatch(userId: string, event: string, data: Record<string, unknown>): Promise<void> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: { has: event },
      },
    });

    if (!webhooks.length) return;

    const payload: WebhookPayload = {
      event,
      createdAt: new Date().toISOString(),
      data,
    };

    // Fire and forget - deliver webhooks asynchronously
    webhooks.forEach((wh) => {
      this.deliver(wh.id, event, payload as unknown as Record<string, unknown>).catch((err) => {
        logger.error('Webhook delivery failed', { webhookId: wh.id, error: err.message });
      });
    });
  }

  /**
   * Deliver a webhook payload to its target URL.
   */
  async deliver(
    webhookId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) return;

    const body = JSON.stringify(payload);
    const signature = signWebhookPayload(body, webhook.secret);
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: payload as unknown as object,
        attempts: 1,
      },
    });

    const { statusCode, responseText } = await this.post(webhook.url, body, signature);

    const success = statusCode !== undefined && statusCode >= 200 && statusCode < 300;

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode,
        response: responseText?.slice(0, 1000),
        success,
        deliveredAt: success ? new Date() : undefined,
      },
    });

    if (!success) {
      throw new Error(
        `Webhook delivery failed: HTTP ${statusCode ?? 'unknown'} — ${responseText?.slice(0, 200)}`,
      );
    }

    logger.info('Webhook delivered', { webhookId, event, statusCode });
  }

  /**
   * Performs an HTTP/HTTPS POST using Node built-ins only.
   * No third-party HTTP client needed.
   */
  private post(
    targetUrl: string,
    body: string,
    signature: string,
  ): Promise<{ statusCode?: number; responseText: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(targetUrl);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Soma-Signature': signature,
          'X-Soma-Event': 'webhook',
          'User-Agent': 'Soma-Webhooks/2.0',
        },
        timeout: 15_000, // 15s
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve({ statusCode: res.statusCode, responseText: data }));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook request timed out'));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

export const webhookService = new WebhookService();

