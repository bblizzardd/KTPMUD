import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Local demo only: wipe the database, generated PDFs and the dev clock, then seed again.
// Stop the server first; Windows keeps the SQLite file locked while it runs.
if (process.env.NODE_ENV === 'production') throw new Error('Demo reset is disabled in production');

const dataDir = resolve(process.env.DATA_DIR || 'data');
const database = resolve(process.env.DATABASE_PATH || resolve(dataDir, 'antam.sqlite'));
const targets = [database, `${database}-wal`, `${database}-shm`, resolve(dataDir, 'dev-clock.json'), resolve(dataDir, 'reports')];
try {
  for (const target of targets) if (existsSync(target)) rmSync(target, { recursive: true, force: true });
} catch (error) {
  console.error(`Không xóa được dữ liệu cũ (${error.code || error.message}). Hãy tắt máy chủ An Tâm rồi chạy lại.`);
  process.exit(1);
}
console.log('Đã xóa dữ liệu cũ, đồng hồ trở về giờ thực.');
await import('./seed.js');
