// 本地预览工具；部署到服务器不需要 Node.js。
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const port = Number(process.env.PORT || 4178);
const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/script.js', ['script.js', 'application/javascript; charset=utf-8']],
  ['/assets/logo.png', ['assets/logo.png', 'image/png']],
  ...['local-home', 'online-music', 'netease', 'lyrics', 'mini-player'].map(name => [
    `/assets/screenshots/${name}.png`, [`assets/screenshots/${name}.png`, 'image/png'],
  ]),
]);
const installerPath = '/updates/windows/Tiaolv-Setup-0.1.4.exe';
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === installerPath) {
    res.writeHead(302, { Location: `https://wqty.online${installerPath}` });
    return res.end();
  }
  const route = routes.get(pathname);
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('页面不存在');
  }
  try {
    const data = await readFile(new URL(route[0], root));
    res.writeHead(200, { 'Content-Type': route[1], 'Content-Length': data.length, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('无法读取页面文件');
  }
});
server.on('error', error => { console.error(`预览启动失败：${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`调律音乐官网预览：http://127.0.0.1:${port}`));
