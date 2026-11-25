import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
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

async function backendHealth(url) {
  try {
    const response = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(2000), redirect: 'error' });
    const health = response.ok && await response.json();
    return health?.status === 'ok' && health.service === 'antam-backend' ? health : null;
  } catch {
    return null;
  }
}

async function printRunningLan(port, frontendDir) {
  const indexPath = join(frontendDir, 'index.html');
  const expectedPage = existsSync(indexPath) && readFileSync(indexPath, 'utf8');
  const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
    (entries || []).filter(entry => entry.family === 'IPv4' && !entry.internal)
      .map(entry => ({ name, url: `http://${entry.address}:${port}/` })));
  const links = await Promise.all(addresses.map(async ({ name, url }) => {
    if (!(await backendHealth(url))?.testAccounts) return null;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: 'error' });
      if (response.ok && expectedPage && await response.text() === expectedPage) return `LAN (${name}): ${url}`;
    } catch { /* This interface cannot serve the LAN app. */ }
    return null;
  }));
  if (!links.some(Boolean)) throw new Error(`An Tâm đang dùng cổng ${port}, nhưng chưa truy cập được bản test qua LAN. Kiểm tra kết nối Wi-Fi hoặc Ethernet và cấu hình cổng ANTAM_LAN_PORT.`);
  console.log('Bản test An Tâm đang chạy. Mở địa chỉ sau trên các máy cùng mạng:');
  console.log(links.filter(Boolean).join('\n'));
}

try {
  if (!['start', 'lan', 'dev', 'build'].includes(mode)) throw new Error('Dùng npm start, npm run start:lan, npm run dev hoặc npm run build.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('An Tâm cần Node.js 22 trở lên.');
  const required = ['frontend/node_modules/vite/bin/vite.js'];
  if (mode !== 'build') required.push('backend/node_modules/express/package.json');
  if (required.some((file) => !existsSync(new URL(file, root)))) {
    throw new Error('Thiếu thư viện. Chạy npm run setup tại thư mục dev, rồi chạy lại.');
  }

  if (mode === 'start' || mode === 'build') await run('frontend', ['node_modules/vite/bin/vite.js', 'build']);
  if (mode !== 'build' && !stopping) {
    const envFile = new URL('backend/.env', root);
    const config = { ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}), ...process.env };
    if (mode === 'lan') {
      const dataDir = join(config.DATA_DIR || 'data', 'lan-test');
      const port = config.ANTAM_LAN_PORT || '8081';
      Object.assign(config, {
        HOST: '0.0.0.0', PORT: port, BASE_URL: `http://127.0.0.1:${port}`,
        FRONTEND_DIST: fileURLToPath(new URL('frontend/dist-lan/', root)),
        DATA_DIR: dataDir, DATABASE_PATH: join(dataDir, 'antam.sqlite'), ENABLE_TEST_ACCOUNTS: 'true',
      });
    }
    const host = ['0.0.0.0', '::'].includes(config.HOST) ? '127.0.0.1' : config.HOST || '127.0.0.1';
    const backendUrl = (mode !== 'lan' && process.env.ANTAM_BACKEND) || `http://${host.includes(':') ? `[${host}]` : host}:${config.PORT || 8080}`;
    const backendRunning = await backendHealth(backendUrl);
    if (stopping) process.exit(0);
    if (mode === 'lan') {
      if (backendRunning) {
        await printRunningLan(config.PORT, config.FRONTEND_DIST);
        process.exit(0);
      }
      await run('frontend', ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-lan']);
      if (stopping) process.exit(process.exitCode || 0);
    }
    if (backendRunning) console.log(`Dùng backend đang chạy tại ${backendUrl}`);
    console.log('\nNhấn Ctrl+C để dừng ứng dụng.');
    const backend = backendRunning ? null : run('backend', ['--env-file-if-exists=.env', 'src/server.js'], config);
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
