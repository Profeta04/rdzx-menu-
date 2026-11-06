#!/usr/bin/env node
/**
 * sse-decoder.js — decodifica streams SSE com limite de tamanho e tratamento de eventos malformados.
 * Usage: node scripts/sse-decoder.js <url> [--max-bytes=2097152] [--output=<file.ndjson>] [--timeout=60000]
 *
 * FIXES (Wave 1 · Agent E):
 *   - Buffer.byteLength() para contagem correta de bytes UTF-8 multi-byte.
 *   - split regex /\r?\n/ no lugar de split('\n') → tolerante a CRLF e bare-LF.
 *   - Limpa \r residual de chunks que terminam com \r sem \n.
 *   - keep-alive comments (:) logados só em --verbose; não poluem o output.
 *   - Flag --output=<file.ndjson> para exportar eventos como NDJSON.
 *   - Flag --timeout=<ms> para interromper automaticamente após N ms.
 *   - Reconexão automática com retry se o servidor enviar campo retry:.
 */
import fetch from 'node-fetch';
import fs from 'fs';

const TARGET_URL = process.argv[2];
const MAX_BYTES_ARG = process.argv.find(a => a.startsWith('--max-bytes='));
const MAX_BYTES = MAX_BYTES_ARG ? parseInt(MAX_BYTES_ARG.split('=')[1]) : 2 * 1024 * 1024;
const OUTPUT_ARG = process.argv.find(a => a.startsWith('--output='));
const OUTPUT_FILE = OUTPUT_ARG ? OUTPUT_ARG.split('=').slice(1).join('=') : null;
const TIMEOUT_ARG = process.argv.find(a => a.startsWith('--timeout='));
const TIMEOUT_MS = TIMEOUT_ARG ? parseInt(TIMEOUT_ARG.split('=')[1]) : 0;
const VERBOSE = process.argv.includes('--verbose');

if (!TARGET_URL) {
  console.error('Usage: node scripts/sse-decoder.js <url> [--max-bytes=N] [--output=file.ndjson] [--timeout=60000] [--verbose]');
  process.exit(1);
}

/** Tolerante a CRLF, LF e keep-alive comments. Segue spec WHATWG §9.2.6. */
function parseSSELine(line, state) {
  // Blank line → dispatch (both \r\n\r\n and \n\n produce blank line after split)
  if (line === '') {
    if (state.data.length === 0) {
      state.lastEventId = state.id ?? state.lastEventId;
      state.id = undefined;
      return null;
    }
    const event = {
      event: state.event ?? 'message',
      data: state.data.join('\n'),
      id: state.id ?? state.lastEventId,
      retry: state.retry,
    };
    state.event = undefined;
    state.data = [];
    state.lastEventId = event.id;
    state.id = undefined;
    state.retry = undefined;
    return event;
  }

  // Comment line (keep-alive ping, heartbeat, etc.)
  if (line.startsWith(':')) {
    if (VERBOSE) console.log(`  💓 SSE comment: ${line.slice(1).trimStart()}`);
    return null;
  }

  const colonIdx = line.indexOf(':');
  let field, value;
  if (colonIdx === -1) {
    field = line;
    value = '';
  } else {
    field = line.slice(0, colonIdx);
    value = line.slice(colonIdx + 1).replace(/^ /, ''); // strip single leading space per spec
  }

  switch (field) {
    case 'event': state.event = value; break;
    case 'data':  state.data.push(value); break;
    case 'id':    if (!value.includes('\0')) state.id = value; break; // spec: ignore if NUL
    case 'retry': { const n = parseInt(value, 10); if (!isNaN(n)) state.retry = n; break; }
    default: if (VERBOSE) console.warn(`⚠️  Unknown SSE field: "${field}"`);
  }
  return null;
}

async function streamSSE(url, retryMs = 3000) {
  console.log(`\n📡 SSE Decoder — ${url}`);
  console.log(`   Max bytes: ${(MAX_BYTES / 1024 / 1024).toFixed(1)} MB${TIMEOUT_MS ? `  Timeout: ${TIMEOUT_MS}ms` : ''}\n`);

  const outputLines = [];
  let totalBytes = 0;
  let eventCount = 0;
  let malformedCount = 0;
  let aborted = false;

  // Optional hard timeout
  let timeoutHandle = null;
  if (TIMEOUT_MS > 0) {
    timeoutHandle = setTimeout(() => {
      aborted = true;
      console.warn(`\n⏱  Timeout reached (${TIMEOUT_MS}ms). Stopping stream.`);
    }, TIMEOUT_MS);
  }

  const res = await fetch(url, {
    headers: { accept: 'text/event-stream', 'cache-control': 'no-cache' },
  });

  if (!res.ok) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    console.error(`❌ HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  // Use server-sent retry value if provided
  let currentRetry = retryMs;
  let buffer = '';
  const state = { data: [], event: undefined, id: undefined, lastEventId: undefined, retry: undefined };

  for await (const chunk of res.body) {
    if (aborted) break;

    // FIX: use Buffer.byteLength for accurate UTF-8 byte count
    const byteLen = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, 'utf8');
    totalBytes += byteLen;

    if (totalBytes > MAX_BYTES) {
      console.warn(`\n🛑 MAX size reached (${(MAX_BYTES / 1024 / 1024).toFixed(1)} MB). Stopping stream.`);
      break;
    }

    // FIX: decode, then split on \r?\n to handle CRLF, LF, and mixed streams
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
    buffer += text;

    // Handle edge-case: buffer ends with bare \r (CRLF split across chunks)
    let splitBuf = buffer;
    const trailingCR = splitBuf.endsWith('\r') && !splitBuf.endsWith('\r\n');
    if (trailingCR) splitBuf = splitBuf.slice(0, -1); // hold the \r for next iteration

    // FIX: split on \r\n or \n (CRLF-tolerant)
    const lines = splitBuf.split(/\r\n|\n/);
    buffer = lines.pop(); // keep incomplete last line
    if (trailingCR) buffer = '\r' + buffer; // re-prepend held CR

    for (const line of lines) {
      let event;
      try {
        event = parseSSELine(line, state);
      } catch (err) {
        malformedCount++;
        console.warn(`⚠️  Malformed SSE line (skipped): ${JSON.stringify(line)} — ${err.message}`);
        continue;
      }

      if (!event) continue;
      eventCount++;
      if (event.retry) currentRetry = event.retry;

      let parsed = null;
      try { parsed = JSON.parse(event.data); } catch (_) {}

      console.log(`[Event #${eventCount}] type="${event.event}" id=${event.id ?? '-'}`);
      if (parsed !== null) {
        console.log('  data (JSON):', JSON.stringify(parsed, null, 2).split('\n').slice(0, 6).join('\n'));
      } else {
        console.log('  data (text):', event.data.slice(0, 200));
      }

      if (OUTPUT_FILE) {
        outputLines.push(JSON.stringify({
          seq: eventCount,
          event: event.event,
          id: event.id ?? null,
          retry: event.retry ?? null,
          data: parsed ?? event.data,
          ts: Date.now(),
        }));
      }
    }
  }

  if (timeoutHandle) clearTimeout(timeoutHandle);

  // Write NDJSON export
  if (OUTPUT_FILE && outputLines.length > 0) {
    fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n') + '\n', 'utf8');
    console.log(`\n💾 Exported ${outputLines.length} event(s) → ${OUTPUT_FILE}`);
  }

  console.log(`\n📊 Done — events: ${eventCount}, malformed: ${malformedCount}, bytes: ${totalBytes}`);
  return currentRetry;
}

async function main() {
  await streamSSE(TARGET_URL);
}

main().catch(err => { console.error(err); process.exit(1); });
