import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = new URL('../', import.meta.url);
const mode = process.argv[2] || 'dev';
const children = new Set();
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

function run(directory, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: fileURLToPath(new URL(`${directory}/`, root)),
      stdio: 'inherit',
      windowsHide: true,
      env,
    });
    children.add(child);
    child.once('error', (error) => {
      children.delete(child);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (stopping || code === 0) resolve();
      else reject(new Error(`${directory} dừng (${signal || `mã lỗi ${code}`}). Xem lỗi phía trên.`));
    });
  });
}

try {
  if (!['start', 'dev', 'build'].includes(mode)) throw new Error('Dùng npm start, npm run dev hoặc npm run build.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('An Tâm cần Node.js 24 trở lên.');
  const required = ['frontend/node_modules/vite/bin/vite.js'];
  if (mode !== 'build') required.push('backend/node_modules/express/package.json');
  if (required.some((file) => !existsSync(new URL(file, root)))) {
    throw new Error('Thiếu thư viện. Chạy npm run setup tại thư mục dev, rồi chạy lại.');
  }

  if (mode !== 'dev') await run('frontend', ['node_modules/vite/bin/vite.js', 'build']);
  if (mode !== 'build' && !stopping) {
    const envFile = new URL('backend/.env', root);
    const config = { ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}), ...process.env };
    const host = ['0.0.0.0', '::'].includes(config.HOST) ? '127.0.0.1' : config.HOST || '127.0.0.1';
    const backendUrl = process.env.ANTAM_BACKEND || `http://${host.includes(':') ? `[${host}]` : host}:${config.PORT || 8080}`;
    let backendRunning = false;
    try {
      const response = await fetch(new URL('/health', backendUrl), { signal: AbortSignal.timeout(2000) });
      const health = await response.json();
      backendRunning = response.ok && health.status === 'ok' && health.service === 'antam-backend';
    } catch { /* No healthy An Tâm service: start our own backend below. */ }
    if (stopping) process.exit(0);
    if (backendRunning) console.log(`Dùng backend đang chạy tại ${backendUrl}`);
    console.log('\nNhấn Ctrl+C để dừng ứng dụng.');
    const backend = backendRunning ? null : run('backend', ['--env-file-if-exists=.env', 'src/server.js']);
    if (mode === 'dev') {
      // Both services share this terminal and stop together if either fails/exits.
      const frontend = run('frontend', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { ...process.env, ANTAM_BACKEND: backendUrl });
      const services = backend ? [backend, frontend] : [frontend];
      await Promise.race(services);
      stop();
      await Promise.all(services);
    } else {
      if (backend) await backend;
      else console.log(`Mở ứng dụng: ${backendUrl}`);
    }
  }
} catch (error) {
  console.error(`\nKhông chạy được An Tâm: ${error.message}`);
  stop(1);
}
