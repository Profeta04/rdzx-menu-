#!/usr/bin/env node
/**
 * header-probe.js — bisecção individual de headers
 * Remove um header por vez e re-testa, reportando quais são obrigatórios.
 * Usage: node scripts/header-probe.js <url> [--method GET]
 */
import fetch from 'node-fetch';

const TARGET_URL = process.argv[2] || 'http://localhost:3000';
const METHOD = (process.argv.find(a => a.startsWith('--method='))?.split('=')[1] || 'GET').toUpperCase();

const BASELINE_HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'content-type': 'application/json',
  'origin': new URL(TARGET_URL).origin,
  'referer': TARGET_URL,
  'user-agent': 'Mozilla/5.0 (header-probe/1.0)',
  'x-requested-with': 'XMLHttpRequest',
};

async function probe(url, headers, label) {
  try {
    const res = await fetch(url, { method: METHOD, headers });
    return { ok: res.ok, status: res.status, label };
  } catch (e) {
    return { ok: false, status: 0, label, error: e.message };
  }
}

async function main() {
  if (!process.argv[2]) {
    console.error('Usage: node scripts/header-probe.js <url> [--method=GET]');
    process.exit(1);
  }

  console.log(`\n🔍 Header Probe — ${METHOD} ${TARGET_URL}\n`);

  // Baseline: all headers
  const baseline = await probe(TARGET_URL, BASELINE_HEADERS, 'BASELINE (all headers)');
  console.log(`Baseline: HTTP ${baseline.status} — ${baseline.ok ? '✅ OK' : '❌ FAIL'}`);

  if (!baseline.ok) {
    console.warn('⚠️  Baseline request failed. Results may be unreliable.');
  }

  const results = { required: [], optional: [], unknown: [] };

  for (const headerKey of Object.keys(BASELINE_HEADERS)) {
    const reduced = { ...BASELINE_HEADERS };
    delete reduced[headerKey];

    const res = await probe(TARGET_URL, reduced, `without [${headerKey}]`);
    const wasOk = res.ok;
    const status = res.status;

    const symbol = wasOk ? '✅' : '❌';
    const verdict = wasOk ? 'optional' : 'REQUIRED';
    console.log(`  ${symbol} ${headerKey.padEnd(24)} → HTTP ${status}  (${verdict})`);

    if (wasOk) results.optional.push(headerKey);
    else if (res.error) results.unknown.push({ key: headerKey, error: res.error });
    else results.required.push(headerKey);
  }

  console.log('\n📋 Summary');
  console.log('  Required headers (removal broke request):');
  results.required.forEach(h => console.log(`    🔴 ${h}`));
  console.log('  Optional headers (removal had no effect):');
  results.optional.forEach(h => console.log(`    🟢 ${h}`));
  if (results.unknown.length) {
    console.log('  Unknown (network error when removed):');
    results.unknown.forEach(({ key, error }) => console.log(`    ⚪ ${key} — ${error}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
