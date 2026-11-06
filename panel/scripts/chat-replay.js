#!/usr/bin/env node
/**
 * chat-replay.js — replays mensagens de chat com sleep mínimo, cap total e botão de abort.
 * Sleep mínimo entre replays: 300ms. Cap: 50 replays. Abort via SIGINT (Ctrl+C) ou stdin 'q'.
 * Usage: node scripts/chat-replay.js <messages-file.json> [--delay=500] [--cap=50]
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const MIN_SLEEP_MS = 300;
const DEFAULT_DELAY_MS = 500;
const DEFAULT_CAP = 50;

const inputFile = process.argv[2];
const delayArg = process.argv.find(a => a.startsWith('--delay='));
const capArg = process.argv.find(a => a.startsWith('--cap='));

const delayMs = Math.max(MIN_SLEEP_MS, delayArg ? parseInt(delayArg.split('=')[1]) : DEFAULT_DELAY_MS);
const cap = Math.min(DEFAULT_CAP, capArg ? parseInt(capArg.split('=')[1]) : DEFAULT_CAP);

if (!inputFile) {
  console.error('Usage: node scripts/chat-replay.js <messages-file.json> [--delay=500] [--cap=50]');
  process.exit(1);
}

// --- Abort controller ---
let aborted = false;

function setupAbort() {
  // SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Abort signal received (SIGINT). Stopping replay...');
    aborted = true;
  });

  // Stdin 'q' key
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
      if (str === 'q' || (key && key.name === 'q')) {
        console.log('\n\n🛑 Abort key pressed (q). Stopping replay...');
        aborted = true;
      }
    });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadMessages(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error('❌ Invalid JSON file');
    process.exit(1);
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  console.error('❌ Expected array of messages or { messages: [] }');
  process.exit(1);
}

function formatMessage(msg, idx) {
  const role = (msg.role ?? msg.from ?? msg.sender ?? 'unknown').padEnd(10);
  const content = (msg.content ?? msg.text ?? msg.body ?? '').slice(0, 120);
  const ts = msg.timestamp ? `  [${new Date(msg.timestamp).toISOString()}]` : '';
  return `  #${String(idx + 1).padStart(3)} ${role} │ ${content}${ts}`;
}

async function main() {
  console.log(`\n💬 Chat Replay — ${path.basename(inputFile)}`);
  console.log(`   Delay: ${delayMs}ms (min ${MIN_SLEEP_MS}ms) | Cap: ${cap} messages`);
  console.log('   Press Ctrl+C or "q" to abort\n');

  setupAbort();

  const messages = loadMessages(inputFile);
  const total = Math.min(messages.length, cap);

  if (messages.length > cap) {
    console.log(`⚠️  ${messages.length} messages found — capped at ${cap}.\n`);
  }

  let replayed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    if (aborted) break;

    const msg = messages[i];
    console.log(formatMessage(msg, i));
    replayed++;

    if (i < total - 1 && !aborted) {
      await sleep(delayMs);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${ aborted ? '🛑 Replay aborted' : '✅ Replay complete'}`);
  console.log(`   Replayed: ${replayed}/${messages.length} messages in ${elapsed}s`);

  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch (_) {}
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
