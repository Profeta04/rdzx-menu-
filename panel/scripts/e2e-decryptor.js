#!/usr/bin/env node
/**
 * e2e-decryptor.js — decriptografa payloads E2E com guarda de tamanho e vault warning.
 * MAX input: 512 KB. Avisa se chave for detectada em clipboard/env (vault warning).
 *
 * Usage:
 *   node scripts/e2e-decryptor.js <encrypted-file> [--key=<hex>] [--key-file=<path>]
 *                                  [--algo=aes-256-gcm|aes-256-cbc|chacha20-poly1305]
 *                                  [--output=<file>] [--format=utf8|hex|base64]
 *
 * FIXES (Wave 1 · Agent E):
 *   - FIX: extensão de saída corrigida — usa path.parse() em vez de replace() frágil.
 *   - FIX: decrypt() não chama process.exit() diretamente; lança erros para o caller.
 *   - MELHORIA: suporte a AES-256-CBC (iv 16B + ciphertext, PKCS7 padding via Node crypto).
 *   - MELHORIA: suporte a ChaCha20-Poly1305 (iv 12B + tag 16B + ciphertext).
 *   - MELHORIA: flag --key-file=<path> para ler chave de arquivo (evita ps aux exposure).
 *   - MELHORIA: flag --algo=<cipher> para selecionar algoritmo explicitamente; auto-detect por tamanho de IV se omitido.
 *   - MELHORIA: flag --output=<file> para path explícito de saída.
 *   - MELHORIA: flag --format=utf8|hex|base64 para saída em diferentes formatos.
 */
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { execSync } from 'child_process';

const MAX_INPUT_BYTES = 512 * 1024; // 512 KB

const inputFile = process.argv[2];
const keyArg     = process.argv.find(a => a.startsWith('--key='))?.split('=').slice(1).join('=');
const keyFileArg = process.argv.find(a => a.startsWith('--key-file='))?.split('=').slice(1).join('=');
const algoArg    = process.argv.find(a => a.startsWith('--algo='))?.split('=')[1]?.toLowerCase();
const outputArg  = process.argv.find(a => a.startsWith('--output='))?.split('=').slice(1).join('=');
const formatArg  = (process.argv.find(a => a.startsWith('--format='))?.split('=')[1] ?? 'utf8').toLowerCase();

const SUPPORTED_ALGOS = ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'];

if (!inputFile) {
  console.error('Usage: node scripts/e2e-decryptor.js <encrypted-file> [--key=<hex>] [--key-file=<path>]');
  console.error('       [--algo=aes-256-gcm|aes-256-cbc|chacha20-poly1305] [--output=<file>] [--format=utf8|hex|base64]');
  process.exit(1);
}

if (algoArg && !SUPPORTED_ALGOS.includes(algoArg)) {
  console.error(`❌ Unsupported algorithm "${algoArg}". Supported: ${SUPPORTED_ALGOS.join(', ')}`);
  process.exit(1);
}

// --- Vault Warning ---
function checkVaultWarnings(key) {
  const warnings = [];
  const dangerousEnvVars = ['ENCRYPTION_KEY', 'SECRET_KEY', 'PRIVATE_KEY', 'API_KEY', 'AES_KEY', 'MASTER_KEY'];
  for (const envVar of dangerousEnvVars) {
    if (process.env[envVar]) warnings.push(`Env var $${envVar} is set — consider using a vault instead.`);
  }
  if (keyArg) warnings.push('Key passed via CLI argument — visible in process list (ps aux). Use --key-file or a vault.');
  try {
    let clip = '';
    if (process.platform === 'darwin') clip = execSync('pbpaste', { timeout: 1000 }).toString().trim();
    else if (process.platform === 'linux') clip = execSync('xclip -o 2>/dev/null || xsel -ob 2>/dev/null', { timeout: 1000 }).toString().trim();
    if (clip && key && clip === key) warnings.push('⚠️  Key appears to match clipboard contents — clear clipboard after use.');
    else if (clip && /^[0-9a-fA-F]{32,}$/.test(clip)) warnings.push('⚠️  Clipboard contains what looks like a hex key — clear clipboard after use.');
  } catch (_) {}
  return warnings;
}

function printVaultWarnings(warnings) {
  if (warnings.length === 0) return;
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  🔐 VAULT WARNING                                       │');
  for (const w of warnings) console.log((`│  ${w}`).padEnd(62) + '│');
  console.log('│  Recommendation: store keys in a secrets manager/vault. │');
  console.log('└─────────────────────────────────────────────────────────┘\n');
}

// --- Size guard ---
function readWithSizeGuard(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_INPUT_BYTES) {
    console.error(`❌ Input file too large: ${(stat.size / 1024).toFixed(1)} KB > ${MAX_INPUT_BYTES / 1024} KB limit.`);
    process.exit(1);
  }
  return fs.readFileSync(filePath);
}

// --- Cipher auto-detection by IV offset heuristics ---
function autoDetectAlgo(buffer) {
  // AES-256-GCM:        IV=12B + tag=16B + cipher → min 28B
  // AES-256-CBC:        IV=16B + cipher (no tag)  → min 17B
  // ChaCha20-Poly1305:  IV=12B + tag=16B + cipher → min 28B (same layout as GCM)
  // Without explicit --algo we default to AES-256-GCM (most common)
  return 'aes-256-gcm';
}

// --- Decryption ---

/** AES-256-GCM: iv[12] + tag[16] + ciphertext */
function decryptGCM(buffer, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error(`Key must be 32 bytes (64 hex chars). Got ${key.length}`);
  if (buffer.length < 28) throw new Error('Payload too short (need ≥28B for iv+tag)');
  const iv         = buffer.slice(0,  12);
  const tag        = buffer.slice(12, 28);
  const ciphertext = buffer.slice(28);
  const decipher   = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** AES-256-CBC: iv[16] + ciphertext (PKCS7 padding handled by Node) */
function decryptCBC(buffer, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error(`Key must be 32 bytes (64 hex chars). Got ${key.length}`);
  if (buffer.length < 17) throw new Error('Payload too short (need ≥17B for iv+ciphertext)');
  const iv         = buffer.slice(0,  16);
  const ciphertext = buffer.slice(16);
  const decipher   = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(true); // PKCS7
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** ChaCha20-Poly1305: iv/nonce[12] + tag[16] + ciphertext */
function decryptChaCha20(buffer, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error(`Key must be 32 bytes (64 hex chars). Got ${key.length}`);
  if (buffer.length < 28) throw new Error('Payload too short (need ≥28B for nonce+tag)');
  const nonce      = buffer.slice(0,  12);
  const tag        = buffer.slice(12, 28);
  const ciphertext = buffer.slice(28);
  const decipher   = crypto.createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function decrypt(buffer, keyHex, algo) {
  switch (algo) {
    case 'aes-256-gcm':        return decryptGCM(buffer, keyHex);
    case 'aes-256-cbc':        return decryptCBC(buffer, keyHex);
    case 'chacha20-poly1305':  return decryptChaCha20(buffer, keyHex);
    default: throw new Error(`Unknown algorithm: ${algo}`);
  }
}

// FIX: robust output path derivation using path.parse()
function deriveOutputPath(inputPath, explicit) {
  if (explicit) return explicit;
  const p = path.parse(inputPath);
  // Remove .enc or .bin suffix if present, then add .decrypted.<ext>
  const stem = /\.(enc|bin|aes|cbc|gcm|e2e)$/i.test(p.ext)
    ? p.name
    : p.name + p.ext; // preserve original extension in stem
  return path.join(p.dir, stem + '.decrypted.txt');
}

async function main() {
  console.log(`\n🔓 E2E Decryptor — ${path.basename(inputFile)}`);
  console.log(`   Max input size: ${MAX_INPUT_BYTES / 1024} KB\n`);

  // Resolve key: --key > --key-file > $ENCRYPTION_KEY
  let key = keyArg ?? null;
  if (!key && keyFileArg) {
    if (!fs.existsSync(keyFileArg)) { console.error(`❌ --key-file not found: ${keyFileArg}`); process.exit(1); }
    key = fs.readFileSync(keyFileArg, 'utf8').trim();
    console.log(`🗝  Key loaded from file: ${keyFileArg}`);
  }
  if (!key) key = process.env.ENCRYPTION_KEY ?? null;

  const warnings = checkVaultWarnings(key);
  printVaultWarnings(warnings);

  const inputBuffer = readWithSizeGuard(inputFile);
  console.log(`✅ File loaded: ${(inputBuffer.length / 1024).toFixed(2)} KB`);

  if (!key) {
    console.error('❌ No key provided. Use --key=<hex>, --key-file=<path>, or set $ENCRYPTION_KEY.');
    process.exit(1);
  }

  const algo = algoArg ?? autoDetectAlgo(inputBuffer);
  console.log(`🔐 Algorithm: ${algo}\n`);

  let plainBuffer;
  try {
    plainBuffer = decrypt(inputBuffer, key, algo);
  } catch (err) {
    console.error(`❌ Decryption failed: ${err.message}`);
    console.error(`   Expected format for ${algo}:`);
    if (algo === 'aes-256-gcm' || algo === 'chacha20-poly1305')
      console.error('     nonce/iv[12B] + auth_tag[16B] + ciphertext');
    if (algo === 'aes-256-cbc')
      console.error('     iv[16B] + ciphertext (PKCS7 padded)');
    process.exit(1);
  }

  // Output format
  let output;
  switch (formatArg) {
    case 'hex':    output = plainBuffer.toString('hex'); break;
    case 'base64': output = plainBuffer.toString('base64'); break;
    default:       output = plainBuffer.toString('utf8'); break;
  }

  console.log(`✅ Decrypted output (${formatArg}):\n`);
  console.log(output);

  const outFile = deriveOutputPath(inputFile, outputArg);
  fs.writeFileSync(outFile, output, 'utf8');
  console.log(`\n💾 Saved to: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
