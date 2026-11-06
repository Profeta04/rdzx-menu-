#!/usr/bin/env node
/**
 * action-classifier.js — classifica ações HTTP via IA com mascaramento de PII no body.
 * Usa S.maskBodyForAI() de _shared.js, ou fallback inline se não existir.
 * Usage: node scripts/action-classifier.js <har-file-or-url>
 */
import fs from 'fs';
import path from 'path';

// --- Shared utilities (import or fallback) ---
let S;
try {
  S = (await import('./_shared.js')).default ?? (await import('./_shared.js'));
} catch (_) {
  S = {};
}

// Fallback inline maskBodyForAI if S.maskBodyForAI is not available
if (typeof S.maskBodyForAI !== 'function') {
  console.warn('⚠️  _shared.js missing or S.maskBodyForAI not found — using inline fallback mask.');
  const PII_PATTERNS = [
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]'],
    [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]'],
    [/\b(?:\d[ -]*?){13,16}\b/g, '[CARD]'],
    [/"password"\s*:\s*"[^"]*"/gi, '"password":"[MASKED]"'],
    [/"token"\s*:\s*"[^"]*"/gi, '"token":"[MASKED]"'],
    [/"secret"\s*:\s*"[^"]*"/gi, '"secret":"[MASKED]"'],
    [/"key"\s*:\s*"[^"]*"/gi, '"key":"[MASKED]"'],
    [/"authorization"\s*:\s*"[^"]*"/gi, '"authorization":"[MASKED]"'],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]'],
  ];
  S.maskBodyForAI = function(body) {
    if (!body) return body;
    let masked = typeof body === 'string' ? body : JSON.stringify(body);
    for (const [pattern, replacement] of PII_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  };
}

// --- Action classification heuristics ---
const RULES = [
  { test: r => r.method === 'GET' && /\/api\/.*\/list|\/search/i.test(r.url), label: 'LIST/SEARCH' },
  { test: r => r.method === 'GET' && /\/api\//i.test(r.url), label: 'READ' },
  { test: r => r.method === 'POST' && /\/login|\/auth|\/signin/i.test(r.url), label: 'AUTH' },
  { test: r => r.method === 'POST' && /\/logout|\/signout/i.test(r.url), label: 'LOGOUT' },
  { test: r => r.method === 'POST', label: 'CREATE' },
  { test: r => r.method === 'PUT' || r.method === 'PATCH', label: 'UPDATE' },
  { test: r => r.method === 'DELETE', label: 'DELETE' },
  { test: r => /websocket|upgrade/i.test(r.url), label: 'WEBSOCKET' },
  { test: r => /sse|event-stream/i.test(r.url), label: 'SSE' },
];

function classifyRequest(req) {
  for (const rule of RULES) {
    if (rule.test(req)) return rule.label;
  }
  return 'UNKNOWN';
}

function loadRequests(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let har;
  try {
    har = JSON.parse(content);
  } catch (e) {
    console.error('❌ Invalid JSON/HAR file');
    process.exit(1);
  }
  // HAR format
  if (har.log?.entries) {
    return har.log.entries.map(e => ({
      method: e.request.method,
      url: e.request.url,
      body: e.request.postData?.text ?? null,
      status: e.response.status,
    }));
  }
  // Plain array
  if (Array.isArray(har)) return har;
  console.error('❌ Unrecognised format. Provide HAR or array of {method,url,body}');
  process.exit(1);
}

async function sendToAI(prompt) {
  // Placeholder: print prompt preview instead of calling a real AI API
  console.log('\n🤖 AI Prompt (masked):\n' + prompt.slice(0, 500) + (prompt.length > 500 ? '\n…[truncated]' : ''));
  return '(AI classification skipped — no API key configured)';
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/action-classifier.js <har-file>');
    process.exit(1);
  }

  console.log(`\n🏷️  Action Classifier — ${path.basename(inputPath)}\n`);

  const requests = loadRequests(inputPath);
  const summary = {};

  for (const req of requests) {
    const label = classifyRequest(req);
    summary[label] = (summary[label] ?? 0) + 1;

    const maskedBody = req.body ? S.maskBodyForAI(req.body) : null;

    console.log(`  ${label.padEnd(14)} ${req.method.padEnd(7)} ${req.url.slice(0, 80)}`);
    if (maskedBody) {
      console.log(`    body (masked): ${maskedBody.slice(0, 120)}`);
    }
  }

  console.log('\n📊 Summary:');
  for (const [label, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(14)} ${count}`);
  }

  // Prepare masked prompt for AI
  const aiPayload = requests.slice(0, 20).map(r => ({
    method: r.method,
    url: r.url,
    body: r.body ? S.maskBodyForAI(r.body).slice(0, 200) : null,
    status: r.status,
  }));
  const aiPrompt = `Classify the following HTTP requests by business action:\n${JSON.stringify(aiPayload, null, 2)}`;
  await sendToAI(aiPrompt);
}

main().catch(err => { console.error(err); process.exit(1); });
