/*
 * 喝酒转盘 · 静态服务端
 * ------------------------------------------------------------------
 * 零依赖，直接 `node server.js` 启动。绑定 0.0.0.0，
 * 同一 WiFi 下的手机/电脑都能用「局域网 IP:端口」打开玩。
 *
 * 用法：
 *   node server.js            默认 8080 端口
 *   PORT=3000 node server.js  指定端口
 *
 * 想让外网（家里公网 IP）也能访问，见 README 的「远程访问」一节。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 默认用不常见端口 8555（避开 HomeAssistant 占用的 8123，也不好被扫到）
// 可用 PORT 环境变量或命令行参数覆盖，例如：node server.js 9000
const PORT = process.env.PORT || process.argv[2] || 8555;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
};

const CUSTOM_FILE = path.join(ROOT, 'data', 'custom.json');
const EMPTY_CUSTOM = '{"added":[],"edited":{},"deleted":[]}';

const server = http.createServer((req, res) => {
  // 只取路径部分，去掉查询串
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // —— 自定义词条接口：全场共享，存 data/custom.json ——
  if (urlPath === '/api/custom') {
    if (req.method === 'GET') {
      fs.readFile(CUSTOM_FILE, (err, data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(err ? EMPTY_CUSTOM : data);
      });
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 2_000_000) req.destroy(); // 防超大 body
      });
      req.on('end', () => {
        try {
          JSON.parse(body); // 校验是合法 JSON
          fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
          fs.writeFile(CUSTOM_FILE, body, (err) => {
            res.writeHead(err ? 500 : 200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(err ? '{"ok":false}' : '{"ok":true}');
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end('{"ok":false,"error":"invalid json"}');
        }
      });
      return;
    }
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';

  // 防路径穿越：解析后必须仍在 ROOT 内
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 · 找不到 ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🍻 喝酒转盘服务端已启动\n');
  console.log('  本机访问：   http://localhost:' + PORT);
  // 打印所有局域网地址，方便手机连
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log('  局域网访问： http://' + net.address + ':' + PORT + '   (同 WiFi 的手机用这个)');
      }
    }
  }
  console.log('\n  Ctrl+C 停止。');
});
