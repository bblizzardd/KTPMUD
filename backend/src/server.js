import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';
import { tickMedication } from './medication.js';
import { tickClinical } from './clinical.js';

const { app, ctx, close } = await createApp();
const server = createServer(app);
const stopRealtime = attachRealtime(server, ctx);
let inFlight = null;
let stopping = false;
function runWorker() {
  if (inFlight || stopping) return;
  inFlight = Promise.resolve().then(() => {
    tickMedication(ctx);
    return tickClinical(ctx);
  }).catch(error => console.error('Worker failed:', error.message)).finally(() => { inFlight = null; });
}
const timer = setInterval(runWorker, ctx.config.schedulerIntervalMs);
timer.unref();
// Start a requested PDF right away instead of waiting for the next scheduler round.
ctx.events.on('report-requested', () => setTimeout(runWorker, 200).unref());
server.listen(ctx.config.port, ctx.config.host, () => {
  if (existsSync(path.join(ctx.config.frontendDir, 'index.html'))) console.log(`An Tâm v1.0: ${ctx.config.baseUrl}/`);
  console.log(`An Tâm API: ${ctx.config.baseUrl}/api/v1`);
  if (ctx.config.devTools) console.log('Dev tools: bật (đồng hồ tua nhanh cho kiểm thử)');
  console.log(`Health: ${ctx.config.baseUrl}/health`);
  runWorker();
});
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  stopRealtime();
  server.close(async () => { if (inFlight) await inFlight; close(); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('error', async error => {
  console.error(`Không thể mở cổng API: ${error.message}`);
  clearInterval(timer);
  stopRealtime();
  if (inFlight) await inFlight;
  close();
  process.exitCode = 1;
});
