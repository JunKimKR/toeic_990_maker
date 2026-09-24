/** Node adapter: `npm run server` (reads server/.env if present). */
import http from 'node:http';
import fs from 'node:fs';
import { createHandler } from './index';

if (fs.existsSync('server/.env')) {
  for (const line of fs.readFileSync('server/.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const handle = createHandler();
const port = Number(process.env.PORT ?? 8787);
http
  .createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handle(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  })
  .listen(port, () => console.log(`TOEIC 990 backend on http://localhost:${port}`));
