import { env } from './config';
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
