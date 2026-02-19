import Handlebars from 'handlebars';
import { logger } from '../utils/logger';

interface RenderedEmail {
  subject?: string;
  html?: string;
  text?: string;
}

type TemplateData = {
  id: string;
  name: string;
  subject: string | null;
  html: string | null;
  text: string | null;
};

class TemplateService {
  constructor() {
    // Register built-in helpers
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper('neq', (a: unknown, b: unknown) => a !== b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    Handlebars.registerHelper('upper', (s: string) => (s ?? '').toUpperCase());
    Handlebars.registerHelper('lower', (s: string) => (s ?? '').toLowerCase());
    Handlebars.registerHelper('year', () => new Date().getFullYear());
    Handlebars.registerHelper('date', (iso: string) =>
      iso ? new Date(iso).toLocaleDateString() : '',
    );
  }

  /**
   * Render an email template with Handlebars.
   * Returns rendered subject, html, and/or text.
   */
  renderEmail(template: TemplateData, data: Record<string, unknown>): RenderedEmail {
    try {
      return {
        subject: template.subject
          ? Handlebars.compile(template.subject)(data)
          : undefined,
        html: template.html
          ? Handlebars.compile(template.html)(data)
          : undefined,
        text: template.text
          ? Handlebars.compile(template.text)(data)
          : undefined,
      };
    } catch (err) {
      logger.error('Template render error', { templateId: template.id, err });
      throw new Error(`Failed to render template "${template.name}": ${(err as Error).message}`);
    }
  }

  /**
   * Render an SMS template body.
   */
  renderSms(template: TemplateData, data: Record<string, unknown>): string {
    if (!template.text) {
      throw new Error(`SMS template "${template.name}" has no text body`);
    }
    try {
      return Handlebars.compile(template.text)(data).slice(0, 160);
    } catch (err) {
      logger.error('SMS template render error', { templateId: template.id, err });
      throw new Error(`Failed to render SMS template "${template.name}": ${(err as Error).message}`);
    }
  }

  /**
   * Validate a Handlebars template string without rendering.
   */
  validate(source: string): { valid: boolean; error?: string } {
    try {
      Handlebars.precompile(source);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }
}

export const templateService = new TemplateService();
