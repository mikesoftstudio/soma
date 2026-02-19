import { Response } from 'express';
import { ApiResponse } from '../types';

export function ok<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function badRequest(res: Response, error: string): void {
  const body: ApiResponse = { success: false, error };
  res.status(400).json(body);
}

export function unauthorized(res: Response, error = 'Unauthorized'): void {
  const body: ApiResponse = { success: false, error };
  res.status(401).json(body);
}

export function forbidden(res: Response, error = 'Forbidden'): void {
  const body: ApiResponse = { success: false, error };
  res.status(403).json(body);
}

export function notFound(res: Response, error = 'Not found'): void {
  const body: ApiResponse = { success: false, error };
  res.status(404).json(body);
}

export function tooManyRequests(res: Response, error = 'Too many requests'): void {
  const body: ApiResponse = { success: false, error };
  res.status(429).json(body);
}

export function serverError(res: Response, error = 'Internal server error'): void {
  const body: ApiResponse = { success: false, error };
  res.status(500).json(body);
}

export function paginate<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  const body: ApiResponse<{ items: T[]; meta: object }> = {
    success: true,
    data: {
      items: data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
  res.status(200).json(body);
}
