import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { badRequest } from '../../utils/response';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 * Usage: validate(sendEmailSchema)
 *        validate(paginationSchema, 'query')
 */
export function validate<T>(schema: ZodSchema<T>, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      badRequest(res, formatted);
      return;
    }
    // Replace with coerced / defaulted values
    (req as Request & Record<string, unknown>)[target] = result.data;
    next();
  };
}

function formatZodError(err: ZodError): string {
  return err.errors
    .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
    .join('; ');
}
