import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';

export const app = createApp();
export const DEMO_PASSWORD = 'SkansDemo2026';

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  get(url: string): request.Test;
  post(url: string, body?: object): request.Test;
  put(url: string, body?: object): request.Test;
  del(url: string): request.Test;
}

function wrap(agent: ReturnType<typeof request.agent>, csrf: string): Session {
  return {
    agent,
    csrf,
    get: (url) => agent.get(url),
    post: (url, body = {}) => agent.post(url).set('x-csrf-token', csrf).send(body),
    put: (url, body = {}) => agent.put(url).set('x-csrf-token', csrf).send(body),
    del: (url) => agent.delete(url).set('x-csrf-token', csrf),
  };
}

/** An anonymous browser session that already holds a CSRF token. */
export async function anonymous(): Promise<Session> {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken as string;
  return wrap(agent, csrf);
}

export async function login(username: string, password = DEMO_PASSWORD): Promise<Session> {
  const s = await anonymous();
  const res = await s.post('/api/auth/login', { username, password });
  if (res.status !== 200) throw new Error(`Login as ${username} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return wrap(s.agent, res.body.csrfToken);
}

export async function subjectId(code: string) {
  return (await prisma.subject.findUniqueOrThrow({ where: { code } })).id;
}

export async function userId(username: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { username } })).id;
}

let counter = 0;
/** Unique suffix so tests never collide on usernames, codes or topics. */
export const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function shortQuestion(subject: number, overrides: Record<string, unknown> = {}) {
  return {
    subjectId: subject,
    type: 'SHORT',
    topic: unique('Topic '),
    marks: 5,
    difficulty: 'MEDIUM',
    source: 'Test source',
    body: '<p>Explain the matching principle.</p>',
    answer: '<p>Expenses are matched with related revenue.</p>',
    advice: '<p>Look for a clear link to revenue.</p>',
    comments: 'Internal note',
    content: {},
    ...overrides,
  };
}

/** Supertest parser that collects a binary (PDF) response body into a Buffer. */
export const binaryParser = ((res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}) as unknown as (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => void;

/** Extracts the text of every page, joined per page, using pdf.js. */
export async function pdfText(pdf: Buffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  await doc.destroy();
  return pages;
}
