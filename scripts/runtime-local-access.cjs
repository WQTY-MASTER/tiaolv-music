const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { timingSafeEqual } = require('node:crypto');

function protectApiServer(server, port, options = {}) {
  const tokenFile = options.tokenFile || process.env.LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE
    || path.join(os.homedir(), '.tiaolv-music', 'local-access.token');
  const handlers = server.listeners('request');
  if (!handlers.length) throw new Error('API server has no request handler');
  server.removeAllListeners('request');
  server.on('request', function guardedRequest(request, response) {
    const reject = (status) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"error":"Local access denied"}');
    };
    const remote = request.socket.remoteAddress;
    const hostHeaders = request.rawHeaders.filter((_header, index) => index % 2 === 0 && request.rawHeaders[index].toLowerCase() === 'host').length;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
      || hostHeaders !== 1 || request.headers.host !== `127.0.0.1:${port}`
      || Object.hasOwn(request.headers, 'origin') || request.method === 'OPTIONS') {
      reject(403);
      return;
    }
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"ok":true}');
      return;
    }
    const supplied = request.headers['x-tiaolv-token'];
    let expected;
    try {
      expected = fs.readFileSync(tokenFile, 'utf8').trim();
    } catch {
      reject(401);
      return;
    }
    if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied)
      || !/^[a-f0-9]{64}$/i.test(expected)
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      reject(401);
      return;
    }
    for (const handler of handlers) handler.call(this, request, response);
  });
  return server;
}

module.exports = { protectApiServer };
