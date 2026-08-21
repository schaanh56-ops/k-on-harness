// dsh-kon-pet: K-ON! Yui desktop pet — host side.
// Serves the floating-pet client bundle + the cutout asset, exposes a startup
// on/off toggle (persisted to $DSH_HOME/kon-pet.json), and injects the loader
// into the web shell via tapIndex. Pure host plugin (no client build).
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const CONFIG_FILE = path.join(DSH_HOME, 'kon-pet.json');

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function readConfig() {
  try {
    const j = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (j && typeof j.enabled === 'boolean') return { enabled: j.enabled };
  } catch (e) { /* missing/corrupt: default on */ }
  return { enabled: true };
}
function writeConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  } catch (e) {
    console.error('[dsh-kon-pet] write config failed:', e.message);
  }
}
function readBody(req) {
  return new Promise((resolve) => {
    if (typeof req.on !== 'function') {
      resolve(typeof req.body === 'string' ? req.body : '');
      return;
    }
    const chunks = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    req.on('data', (c) => chunks.push(c));
    req.on('end', finish);
    req.on('error', finish);
  });
}

function fileHandler(file) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain' });
      res.end('method not allowed');
      return;
    }
    try {
      const buf = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : buf);
    } catch (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  };
}

module.exports = {
  inject: ['webServer'],
  apply(ctx) {
    ctx.effect(() => {
      const webServer = ctx.get('webServer');
      if (!webServer) return undefined;
      const base = __dirname;
      const disposers = [];

      const staticFiles = [
        ['/kon-pet/client.js', path.join(base, 'client.js')],
        ['/kon-pet/yui-cutout.png', path.join(base, 'assets', 'yui-cutout.png')],
      ];
      for (const [p, f] of staticFiles) {
        disposers.push(webServer.register({ kind: 'exact', path: p, handler: fileHandler(f) }));
      }

      disposers.push(webServer.register({
        kind: 'exact',
        path: '/kon-pet/config',
        handler: async (req, res) => {
          const send = (payload) => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify(payload));
          };
          try {
            if (req.method === 'GET' || req.method === 'HEAD') {
              send(readConfig());
              return;
            }
            if (req.method === 'POST') {
              const cfg = readConfig();
              try {
                const j = JSON.parse((await readBody(req)) || '{}');
                if (typeof j.enabled === 'boolean') cfg.enabled = j.enabled;
              } catch (e) { /* keep current */ }
              writeConfig(cfg);
              send(cfg);
              return;
            }
            res.writeHead(405, { 'content-type': 'text/plain' });
            res.end('method not allowed');
          } catch (err) {
            send({ enabled: true, error: String((err && err.message) || err) });
          }
        },
      }));

      disposers.push(
        webServer.tapIndex((html) => {
          if (html.indexOf('data-kon-pet') !== -1) return html;
          return html.replace(
            '</body>',
            '<script src="/kon-pet/client.js" defer></script></body>',
          );
        }),
      );
      return () => {
        for (const off of disposers) off();
      };
    }, 'dsh-kon-pet: routes + config + inject');
  },
};
