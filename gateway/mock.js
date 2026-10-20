import express from 'express';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import swaggerUi from 'swagger-ui-dist';

export function createMock() {
  const specPath = fileURLToPath(new URL('../docs/api/openapi.yaml', import.meta.url));
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: '100kb'}));
  app.use((req, res, next) => {
    res.set('X-Mock-Only', 'true');
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/openapi.json', (req, res) => res.json(spec));
  app.get('/docs', (req, res) => res.type('html').send(`<!doctype html>
<html lang="vi"><meta charset="utf-8"><title>An Tâm — API giả lập</title>
<link rel="stylesheet" href="/swagger/swagger-ui.css">
<body><p style="padding:12px;font-family:Arial">MOCK: dữ liệu giả lập, không lưu dữ liệu và không xác thực thật.</p>
<div id="swagger-ui"></div><script src="/swagger/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui'});</script></body></html>`));
  app.use('/swagger', express.static(swaggerUi.getAbsoluteFSPath()));
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const route = '/api/v1' + path.replace(/\{(\w+)\}/g, ':$1');
      app[method](route, (req, res) => {
        const forced = Number(req.get('X-Mock-Status'));
        if ([400, 401, 403, 404, 409, 410, 422, 500].includes(forced)) {
          return res.status(forced).json({code: forced, message: 'Lỗi giả lập — không phải kết quả nghiệp vụ', details: {mock: true}});
        }
        const status = operation['x-mock-status'];
        return res.status(status).json(operation.responses[status].content['application/json'].example);
      });
    }
  }
  app.use((req, res) => res.status(404).json({code: 404, message: 'Mock không có đường dẫn này'}));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(400).json({code: 400, message: 'JSON không hợp lệ trong yêu cầu mock'});
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.MOCK_PORT || 5188);
  createMock().listen(port, '127.0.0.1', () => {
    console.log(`MOCK ONLY: http://127.0.0.1:${port}/docs`);
  });
}
