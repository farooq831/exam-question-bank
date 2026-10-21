import { env, isProd } from './config';

if (isProd && env.TRUST_PROXY !== '1') {
  console.warn(
    '[server] NODE_ENV=production uses Secure cookies, which are only sent over HTTPS. ' +
      'When running behind Nginx set TRUST_PROXY=1, otherwise sign-in will not persist.',
  );
}
import { createApp } from './app';
import { prisma } from './db';
import { closeBrowser } from './render/pdf';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`[server] SKANS Question Bank API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down...`);
  server.close();
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
