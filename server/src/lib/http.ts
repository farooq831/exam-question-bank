import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const forbidden = (msg = 'You do not have permission to do this.') => new HttpError(403, msg);
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Wraps an async route so rejected promises reach the error handler (Express 4). */
export function ah<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw r.error;
  return r.data;
}

export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}.`);
  return n;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Please correct the highlighted fields.',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  const e = err as { type?: string; status?: number; code?: string };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
  if (e?.code === 'P2002') return res.status(409).json({ error: 'A record with this value already exists.' });
  if (e?.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
  console.error('[error]', err);
  return res.status(500).json({ error: 'Unexpected server error. The problem has been logged.' });
}
