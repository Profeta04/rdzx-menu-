#!/usr/bin/env node
/**
 * ws-correlator.js — correlaciona frames WebSocket em janelas de tempo configuráveis.
 * Usage: node scripts/ws-correlator.js <ws-url> [--window=5000] [--output=<file.ndjson>]
 *
 * FIXES (Wave 1 · Agent E):
 *   - Detecção binária robusta: usa heurística de entropia em vez de toString() frágil.
 *   - Correlação BIDIRECIONAL: SEND→RECV e RECV→SEND (server-push que dispara resposta).
 *   - Múltiplos campos de correlação: id, requestId, correlationId, seq, msgId.
 *   - Flag --output=<file.ndjson> para exportar todos os frames com metadados.
 *   - Frames mantidos com limite MAX_FRAMES para evitar crescimento ilimitado de memória.
 *   - Estatísticas por janela: RTT médio, frames não correlacionados, server-push count.
 */
import WebSocket from 'ws';
import fs from 'fs';

const WS_URL = process.argv[2];
const WINDOW_ARG = process.argv.find(a => a.startsWith('--window='));
const WINDOW_MS = WINDOW_ARG ? parseInt(WINDOW_ARG.split('=')[1]) : 5000;
const OUTPUT_ARG = process.argv.find(a => a.startsWith('--output='));
const OUTPUT_FILE = OUTPUT_ARG ? OUTPUT_ARG.split('=').slice(1).join('=') : null;
const MAX_FRAMES = 10_000; // memory guard

if (!WS_URL) {
  console.error('Usage: node scripts/ws-correlator.js <ws-url> [--window=5000] [--output=file.ndjson]');
  process.exit(1);
}

const frames = [];
const allFrames = []; // for NDJSON export
let windowTimer = null;
let windowSeq = 0;

function formatDelta(ms) {
  return ms >= 0 ? `+${ms}ms` : `${ms}ms`;
}

/** Extract correlation ID from a parsed payload, checking multiple common fields. */
function extractCorrId(parsed) {
  if (!parsed || typeof parsed !== 'object') return undefined;
  return parsed.id ?? parsed.requestId ?? parsed.correlationId ?? parsed.seq ?? parsed.msgId ?? parsed.message_id;
}

/** FIX: robust binary detection using printable-char ratio instead of fragile toString().startsWith */
function isBinaryBuffer(buf) {
  if (!Buffer.isBuffer(buf)) return false;
  // Sample up to 256 bytes for speed
  const sample = buf.slice(0, 256);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    // Allow tab (9), LF (10), CR (13), printable ASCII (32-126)
    if (b !== 9 && b !== 10 && b !== 13 && (b < 32 || b > 126)) nonPrintable++;
  }
  return (nonPrintable / sample.length) > 0.3;
}

function correlateWindow(windowFrames) {
  windowSeq++;
  console.log(`\n🔗 Correlation window #${windowSeq} [${WINDOW_MS}ms] — ${windowFrames.length} frame(s)`);
  if (windowFrames.length === 0) return;

  const base = windowFrames[0].ts;
  const sends = windowFrames.filter(f => f.direction === 'send');
  const recvs = windowFrames.filter(f => f.direction === 'recv');

  const matchedRecvIds = new Set();
  const matchedSendIds = new Set();
  const rtts = [];

  // ── SEND → RECV (request/response) ──────────────────────────────────────
  for (const req of sends) {
    const reqId = extractCorrId(req.parsed);
    const match = recvs.find(r => {
      const rId = extractCorrId(r.parsed);
      return reqId != null && reqId === rId;
    });

    if (match) {
      const rtt = match.ts - req.ts;
      rtts.push(rtt);
      matchedRecvIds.add(extractCorrId(match.parsed));
      matchedSendIds.add(reqId);
      console.log(`  ↔  CORR  SEND→RECV  id=${reqId}  RTT=${rtt}ms`);
    } else {
      console.log(`  →  UNMATCHED SEND  ${formatDelta(req.ts - base)}  ${JSON.stringify(req.raw).slice(0, 80)}`);
    }
  }

  // FIX: ── RECV → SEND (server-push that triggers a client ack/response) ──
  let serverPushCount = 0;
  for (const res of recvs) {
    const resId = extractCorrId(res.parsed);
    // Already matched in SEND→RECV pass?
    if (resId != null && matchedRecvIds.has(resId)) continue;

    // Check if any SEND after this RECV references the same id (ack pattern)
    const ackSend = sends.find(s => {
      const sId = extractCorrId(s.parsed);
      // ACK field: ackId, replyTo, in_reply_to
      const ackId = s.parsed?.ackId ?? s.parsed?.replyTo ?? s.parsed?.in_reply_to ?? sId;
      return resId != null && (ackId === resId) && s.ts > res.ts;
    });

    if (ackSend) {
      const rtt = ackSend.ts - res.ts;
      matchedSendIds.add(extractCorrId(ackSend.parsed));
      console.log(`  ↩  CORR  RECV→SEND  id=${resId}  ACK_DELAY=${rtt}ms`);
    } else {
      serverPushCount++;
      console.log(`  ←  SERVER-PUSH  ${formatDelta(res.ts - base)}  ${JSON.stringify(res.raw).slice(0, 80)}`);
    }
  }

  // Stats
  if (rtts.length > 0) {
    const avg = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);
    const max = Math.max(...rtts);
    console.log(`  📊 RTT avg=${avg}ms  max=${max}ms  correlated=${rtts.length}  server-push=${serverPushCount}`);
  }
}

function scheduleWindow() {
  if (windowTimer) clearTimeout(windowTimer);
  windowTimer = setTimeout(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const windowFrames = frames.filter(f => f.ts >= cutoff);
    correlateWindow(windowFrames);
    frames.length = 0;
    scheduleWindow();
  }, WINDOW_MS);
}

function handleFrame(direction, data) {
  const ts = Date.now();

  // FIX: robust binary detection
  if (Buffer.isBuffer(data) && isBinaryBuffer(data)) {
    console.log(`  ⚡ Binary frame (${direction}, ${data.length}B) — skipped`);
    return;
  }

  let raw, parsed = null;
  try {
    raw = typeof data === 'string' ? data : data.toString('utf8');
  } catch (err) {
    console.warn(`⚠️  Could not decode frame as UTF-8 (${direction}): ${err.message}`);
    return;
  }

  try { parsed = JSON.parse(raw); } catch (_) {}

  const arrow = direction === 'send' ? '→' : '←';
  console.log(`${arrow} [${direction.toUpperCase()}] ${raw.slice(0, 120)}`);

  const frame = { ts, direction, raw, parsed };
  frames.push(frame);

  // Memory guard
  if (frames.length > MAX_FRAMES) frames.splice(0, MAX_FRAMES / 2);

  if (OUTPUT_FILE) allFrames.push(frame);
}

async function main() {
  console.log(`\n🔌 WS Correlator — ${WS_URL}`);
  console.log(`   Correlation window: ${WINDOW_MS}ms${OUTPUT_FILE ? `  Output: ${OUTPUT_FILE}` : ''}\n`);

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected\n');
    scheduleWindow();
  });

  ws.on('message', (data) => {
    try { handleFrame('recv', data); }
    catch (err) { console.warn(`⚠️  Frame handler error (recv): ${err.message}`); }
  });

  // Monkey-patch send to capture outgoing frames
  const origSend = ws.send.bind(ws);
  ws.send = (data, ...args) => {
    try { handleFrame('send', data); }
    catch (err) { console.warn(`⚠️  Frame handler error (send): ${err.message}`); }
    return origSend(data, ...args);
  };

  ws.on('error', (err) => console.error(`❌ WS error: ${err.message}`));

  ws.on('close', (code, reason) => {
    if (windowTimer) clearTimeout(windowTimer);
    correlateWindow(frames);

    // Write NDJSON export
    if (OUTPUT_FILE && allFrames.length > 0) {
      const lines = allFrames.map(f => JSON.stringify({
        ts: f.ts,
        direction: f.direction,
        corrId: extractCorrId(f.parsed) ?? null,
        raw: f.raw.slice(0, 1024),
        parsed: f.parsed,
      }));
      fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf8');
      console.log(`\n💾 Exported ${allFrames.length} frame(s) → ${OUTPUT_FILE}`);
    }

    console.log(`\n🔌 Disconnected — code=${code} reason=${reason}`);
    process.exit(0);
  });

  process.on('SIGINT', () => { ws.close(); });
}

main().catch(err => { console.error(err); process.exit(1); });
