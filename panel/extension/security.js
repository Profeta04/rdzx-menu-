// ============================================================
// HyperBuild – Security Module (Fase 2)
// ------------------------------------------------------------
// Provê assinatura HMAC-SHA256 das requisições da extensão para
// o backend (Supabase Edge Functions). Compatível com service
// worker (background) via importScripts e com contextos DOM
// (sidepanel/content) via <script>.
//
// Headers gerados:
//   x-ext-version    : versão da extensão
//   x-ext-timestamp  : epoch ms (validade 60s no backend)
//   x-ext-nonce      : 32 chars aleatórios (anti-replay)
//   x-ext-signature  : HMAC-SHA256(secret, msg) em hex
//                      msg = `${METHOD}|${PATHNAME}|${ts}|${nonce}|${sha256(body)}`
//
// IMPORTANTE: o segredo é embedado e protegido pela ofuscação
// pesada da Fase 3 + JWT/hardware-lock. Nunca tratar isolado.
// ============================================================

(function (root) {
  "use strict";

  // ---- CONFIG ----
  var HB_EXT_VERSION = "6.9.0";
  // Segredo compartilhado com o backend (EXTENSION_HMAC_SECRET).
  // Será ofuscado/string-array na Fase 3.
  var HB_HMAC_SECRET = "HyperbuildR3zxyPr0fet188290994567$&...!!!";
  // Endpoints que devem ser assinados (somente Supabase functions do projeto).
  var HB_SIGN_HOST = "cvbgrjauqjawrsyknhyj.supabase.co";
  var HB_SIGN_PATH_PREFIX = "/functions/v1/";

  // ---- UTIL ----
  function _toHex(buf) {
    var b = new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < b.length; i++) {
      var h = b[i].toString(16);
      s += h.length === 1 ? "0" + h : h;
    }
    return s;
  }

  function _randNonce() {
    var a = new Uint8Array(16);
    (root.crypto || root.msCrypto).getRandomValues(a);
    return _toHex(a.buffer);
  }

  function _enc(s) {
    return new TextEncoder().encode(s == null ? "" : String(s));
  }

  async function _sha256Hex(text) {
    var buf = await (root.crypto.subtle).digest("SHA-256", _enc(text));
    return _toHex(buf);
  }

  async function _hmacHex(secret, message) {
    var key = await root.crypto.subtle.importKey(
      "raw",
      _enc(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    var sig = await root.crypto.subtle.sign("HMAC", key, _enc(message));
    return _toHex(sig);
  }

  function _shouldSign(url) {
    try {
      var u = new URL(url);
      return u.host === HB_SIGN_HOST && u.pathname.indexOf(HB_SIGN_PATH_PREFIX) === 0;
    } catch (_) {
      return false;
    }
  }

  /**
   * Calcula headers HMAC para uma requisição.
   * @param {string} method  HTTP method (POST, GET, ...)
   * @param {string} url     URL completa
   * @param {string|null} body  body cru (string) ou null
   * @returns {Promise<Object>} headers a serem mesclados na request
   */
  async function signRequest(method, url, body) {
    var u = new URL(url);
    var ts = String(Date.now());
    var nonce = _randNonce();
    var bodyHash = await _sha256Hex(body || "");
    var msg = (method || "POST").toUpperCase() + "|" + u.pathname + "|" + ts + "|" + nonce + "|" + bodyHash;
    var sig = await _hmacHex(HB_HMAC_SECRET, msg);
    return {
      "x-ext-version": HB_EXT_VERSION,
      "x-ext-timestamp": ts,
      "x-ext-nonce": nonce,
      "x-ext-signature": sig,
    };
  }

  /**
   * Aplica assinatura num init de fetch se o destino for backend nosso.
   * Mantém comportamento original para qualquer outro host.
   */
  async function withSignedHeaders(url, init) {
    init = init || {};
    if (!_shouldSign(url)) return init;
    var bodyText = "";
    if (init.body != null) {
      bodyText = typeof init.body === "string" ? init.body : "";
    }
    var sig = await signRequest(init.method || "POST", url, bodyText);
    var merged = Object.assign({}, init.headers || {}, sig);
    return Object.assign({}, init, { headers: merged });
  }

  var api = {
    VERSION: HB_EXT_VERSION,
    signRequest: signRequest,
    withSignedHeaders: withSignedHeaders,
    shouldSign: _shouldSign,
  };

  // Expor em qualquer contexto (window OU service worker self)
  root.__HB_SECURITY = api;
})(typeof self !== "undefined" ? self : this);