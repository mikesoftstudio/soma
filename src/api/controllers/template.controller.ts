import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { templateService } from '../../services/template';
import { ok, created, noContent, notFound, badRequest, paginate } from '../../utils/response';
import { paginationSchema } from '../../utils/schemas';

export const templateController = {
  /**
   * POST /v1/templates
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, type, subject, html, text } = req.body;

      // Validate Handlebars syntax before saving
      if (html) {
        const { valid, error } = templateService.validate(html);
        if (!valid) { badRequest(res, `Invalid HTML template syntax: ${error}`); return; }
      }
      if (text) {
        const { valid, error } = templateService.validate(text);
        if (!valid) { badRequest(res, `Invalid text template syntax: ${error}`); return; }
      }

      const template = await prisma.templateRecord.create({
        data: { name, type, subject, html, text, userId: req.userId! },
      });

      created(res, template);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/templates
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;

      const [templates, total] = await prisma.$transaction([
        prisma.templateRecord.findMany({
          where: { userId: req.userId! },
          skip, take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.templateRecord.count({ where: { userId: req.userId! } }),
      ]);

      paginate(res, templates, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/templates/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await prisma.templateRecord.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!template) { notFound(res); return; }
      ok(res, template);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /v1/templates/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const existing = await prisma.templateRecord.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!existing) { notFound(res); return; }

      const { subject, html, text } = req.body;

      if (html) {
        const { valid, error } = templateService.validate(html);
        if (!valid) { badRequest(res, `Invalid HTML template syntax: ${error}`); return; }
      }
      if (text) {
        const { valid, error } = templateService.validate(text);
        if (!valid) { badRequest(res, `Invalid text template syntax: ${error}`); return; }
      }

      const updated = await prisma.templateRecord.update({
        where: { id: req.params.id },
        data: { subject, html, text },
      });

      ok(res, updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /v1/templates/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const existing = await prisma.templateRecord.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!existing) { notFound(res); return; }

      await prisma.templateRecord.delete({ where: { id: req.params.id } });
      noContent(res);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /v1/templates/:id/preview
   * Render a template with sample data and return the result.
   */
  async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await prisma.templateRecord.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!template) { notFound(res); return; }

      const data: Record<string, unknown> = req.body.data ?? {};
      const rendered = templateService.renderEmail(template, data);
      ok(res, rendered);
    } catch (err) {
      next(err);
    }
  },
};
