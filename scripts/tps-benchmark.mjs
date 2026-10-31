import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const workerUrl = process.argv[2] || 'https://halgheh.mohammadjavadsharifi98.workers.dev';
const key = () => randomBytes(16).toString('base64url');

async function post(path, token, body) {
  const t0 = performance.now();
  const res = await fetch(workerUrl + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const t1 = performance.now();
  const ok = res.status >= 200 && res.status < 300;
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok, status: res.status, latencyMs: t1 - t0, body: json };
}

function stats(latencies) {
  if (!latencies.length) return {};
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { avg, min, p50, p95, max };
}

async function runWorkerBenchmark() {
  console.log(`=== شروع تست TPS روی سرور ورکر (${workerUrl}) ===\n`);

  // 1. Create a test account
  const testKey = key();
  const regRes = await post('/api/register', testKey, { mode: 'register' });
  if (!regRes.ok) {
    console.error('ثبت‌نام کاربر آزمایشی ناموفق بود:', regRes);
    process.exit(1);
  }

  // Seed 1 row so pulls return something
  await post('/api/sync', testKey, {
    since: 0,
    changes: [{ t: 'tasks', id: 'init', updatedAt: Date.now(), data: JSON.stringify({ id: 'init', title: 'init' }) }],
  });

  // --- Test 1: Sequential Read TPS (1 connection) ---
  console.log('1. تست تراکنش‌های خواندن متوالی (Read - Concurrency 1)...');
  const readSeqLatencies = [];
  const seqReadCount = 30;
  const startSeqRead = performance.now();
  for (let i = 0; i < seqReadCount; i++) {
    const res = await post('/api/sync', testKey, { since: 0, changes: [] });
    if (res.ok) readSeqLatencies.push(res.latencyMs);
  }
  const durSeqRead = (performance.now() - startSeqRead) / 1000;
  const tpsSeqRead = (readSeqLatencies.length / durSeqRead).toFixed(2);
  const stSeqRead = stats(readSeqLatencies);
  console.log(`   - تعداد درخواست: ${readSeqLatencies.length} در ${durSeqRead.toFixed(2)} ثانیه`);
  console.log(`   - TPS متوالی خواندن: ${tpsSeqRead} req/s`);
  console.log(`   - میانگین تاخیر: ${stSeqRead.avg.toFixed(1)}ms (p50: ${stSeqRead.p50.toFixed(1)}ms, p95: ${stSeqRead.p95.toFixed(1)}ms)\n`);

  // --- Test 2: Concurrent Read TPS (Concurrency 10) ---
  console.log('2. تست تراکنش‌های خواندن هم‌روند (Read - Concurrency 10)...');
  const conReadLatencies = [];
  const conReadCount = 50;
  const con = 10;
  const startConRead = performance.now();
  
  for (let i = 0; i < conReadCount; i += con) {
    const batch = Array.from({ length: Math.min(con, conReadCount - i) }, () =>
      post('/api/sync', testKey, { since: 0, changes: [] })
    );
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.ok) conReadLatencies.push(r.latencyMs);
    }
  }
  const durConRead = (performance.now() - startConRead) / 1000;
  const tpsConRead = (conReadLatencies.length / durConRead).toFixed(2);
  const stConRead = stats(conReadLatencies);
  console.log(`   - تعداد درخواست: ${conReadLatencies.length} در ${durConRead.toFixed(2)} ثانیه`);
  console.log(`   - TPS هم‌روند خواندن: ${tpsConRead} req/s`);
  console.log(`   - میانگین تاخیر: ${stConRead.avg.toFixed(1)}ms (p50: ${stConRead.p50.toFixed(1)}ms, p95: ${stConRead.p95.toFixed(1)}ms)\n`);

  // --- Test 3: Sequential Write TPS (D1 Insert/Update - Concurrency 1) ---
  console.log('3. تست تراکنش‌های نوشتن متوالی (Write / D1 Transaction - Concurrency 1)...');
  const writeSeqLatencies = [];
  const seqWriteCount = 20;
  const startSeqWrite = performance.now();
  for (let i = 0; i < seqWriteCount; i++) {
    const res = await post('/api/sync', testKey, {
      since: 0,
      changes: [{ t: 'tasks', id: `task-seq-${i}`, updatedAt: Date.now() + i, data: JSON.stringify({ id: `task-seq-${i}`, title: `test ${i}` }) }],
    });
    if (res.ok) writeSeqLatencies.push(res.latencyMs);
  }
  const durSeqWrite = (performance.now() - startSeqWrite) / 1000;
  const tpsSeqWrite = (writeSeqLatencies.length / durSeqWrite).toFixed(2);
  const stSeqWrite = stats(writeSeqLatencies);
  console.log(`   - تعداد درخواست: ${writeSeqLatencies.length} در ${durSeqWrite.toFixed(2)} ثانیه`);
  console.log(`   - TPS متوالی نوشتن: ${tpsSeqWrite} txn/s`);
  console.log(`   - میانگین تاخیر: ${stSeqWrite.avg.toFixed(1)}ms (p50: ${stSeqWrite.p50.toFixed(1)}ms, p95: ${stSeqWrite.p95.toFixed(1)}ms)\n`);

  // --- Test 4: Concurrent Write TPS (Concurrency 5) ---
  console.log('4. تست تراکنش‌های نوشتن هم‌روند (Write / D1 Transaction - Concurrency 5)...');
  const conWriteLatencies = [];
  const conWriteCount = 25;
  const writeCon = 5;
  const startConWrite = performance.now();
  
  for (let i = 0; i < conWriteCount; i += writeCon) {
    const batch = Array.from({ length: Math.min(writeCon, conWriteCount - i) }, (_, idx) => {
      const id = `task-con-${i + idx}`;
      return post('/api/sync', testKey, {
        since: 0,
        changes: [{ t: 'tasks', id, updatedAt: Date.now() + i + idx, data: JSON.stringify({ id, title: `test ${id}` }) }],
      });
    });
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.ok) conWriteLatencies.push(r.latencyMs);
    }
  }
  const durConWrite = (performance.now() - startConWrite) / 1000;
  const tpsConWrite = (conWriteLatencies.length / durConWrite).toFixed(2);
  const stConWrite = stats(conWriteLatencies);
  console.log(`   - تعداد درخواست: ${conWriteLatencies.length} در ${durConWrite.toFixed(2)} ثانیه`);
  console.log(`   - TPS هم‌روند نوشتن: ${tpsConWrite} txn/s`);
  console.log(`   - میانگین تاخیر: ${stConWrite.avg.toFixed(1)}ms (p50: ${stConWrite.p50.toFixed(1)}ms, p95: ${stConWrite.p95.toFixed(1)}ms)\n`);

  console.log('=== پایان تست بنچمارک ===');
}

runWorkerBenchmark().catch(console.error);
