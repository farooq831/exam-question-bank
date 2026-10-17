import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, isProd, paths } from './config';
import { errorHandler, HttpError } from './lib/http';
import { PrismaSessionStore } from './lib/sessionStore';
import { csrfProtection, loadUser, requireAuth } from './middleware/auth';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import subjectRoutes from './routes/subjects';
import templateRoutes from './routes/templates';
import questionRoutes from './routes/questions';
import paperRoutes from './routes/papers';
import dashboardRoutes from './routes/dashboard';
import auditRoutes from './routes/audit';
import importRoutes from './routes/import';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          frameSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: isProd,
    }),
  );

  app.use(express.json({ limit: '3mb' }));

  const ttlMs = env.SESSION_TTL_MINUTES * 60_000;
  app.use(
    session({
      name: 'skans.sid',
      secret: env.SESSION_SECRET,
      store: new PrismaSessionStore(ttlMs),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: isProd,
        maxAge: ttlMs,
      },
    }),
  );

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === 'test' ? 100_000 : 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  const api = express.Router();
  api.use(apiLimiter);
  api.use(loadUser);
  api.use(csrfProtection);
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRoutes);
  api.use(requireAuth);
  // Users whose password was reset by the administrator must change it before doing anything else.
  api.use((req, _res, next) => {
    if (req.user?.mustChangePassword) return next(new HttpError(403, 'Please change your password to continue.'));
    next();
  });
  api.use('/dashboard', dashboardRoutes);
  api.use('/users', userRoutes);
  api.use('/subjects', subjectRoutes);
  api.use('/templates', templateRoutes);
  api.use('/questions', questionRoutes);
  api.use('/papers', paperRoutes);
  api.use('/audit', auditRoutes);
  api.use('/import', importRoutes);
  api.use((_req, _res, next) => next(new HttpError(404, 'API endpoint not found.')));

  app.use('/api', api);

  // Production: serve the built React client from the same origin.
  if (existsSync(paths.clientDist)) {
    app.use(express.static(paths.clientDist, { index: false, maxAge: isProd ? '7d' : 0 }));
    app.get('*', (_req, res) => res.sendFile(path.join(paths.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
