/**
 * HBContentUtils — utilidades puras extraídas de content.js (Wave 3, slice 1).
 *
 * Carregado ANTES de content.js no manifest, expondo as funções como globais
 * (mesmo padrão que content.js já usava). Resultado: zero call sites alterados,
 * mas funções agora têm um único ponto de definição testável fora do Chrome
 * (ver src/extension-lib/content-utils.ts).
 *
 * REGRAS:
 * - Apenas funções PURAS (sem closures, sem variáveis mutáveis externas).
 * - Dependem só de APIs nativas (URL, atob, document.createElement, Blob, URL.createObjectURL).
 * - NÃO mover daqui funções com estado (hbCurrentTheme, floatingBox, etc.) — risco alto.
 */
(function (root) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function sanitizeUrl(url) {
    if (!url) return '';
    try {
      var parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
      return '';
    } catch (_) { return ''; }
  }

  function decodeJwtPayload(token) {
    try {
      var raw = String(token || '').replace(/^Bearer\s+/i, '').trim();
      var parts = raw.split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch (_) { return null; }
  }

  function hbClamp(v, min, max) {
    v = Number(v);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function hbHex(value, fallback) {
    var raw = String(value || fallback || '#000000').trim();
    if (!raw.startsWith('#')) raw = '#' + raw;
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      raw = '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    }
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : String(fallback || '#000000').toLowerCase();
  }

  function hbRgb(value, fallback) {
    var hex = hbHex(value, fallback).slice(1);
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function hbRgbStr(value, fallback) {
    var c = hbRgb(value, fallback);
    return c.r + ', ' + c.g + ', ' + c.b;
  }

  function hbMix(a, b, weight) {
    var ca = hbRgb(a, '#000000');
    var cb = hbRgb(b, '#000000');
    var w = hbClamp(weight, 0, 1);
    return '#' + [ca.r, ca.g, ca.b].map(function (v, i) {
      var target = [cb.r, cb.g, cb.b][i];
      var s = Math.round(v * (1 - w) + target * w).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function hbBase64ToBlob(base64, contentType) {
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: contentType || 'application/zip' });
  }

  function hbTriggerBlobDownload(blob, fileName) {
    var href = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = href;
    a.download = fileName || 'HyperBuild-Project.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
  }

  // Drop-in replacement: também expor como globais para call sites legados.
  root.escapeHtml = escapeHtml;
  root.sanitizeUrl = sanitizeUrl;
  root.decodeJwtPayload = decodeJwtPayload;
  root.hbClamp = hbClamp;
  root.hbHex = hbHex;
  root.hbRgb = hbRgb;
  root.hbRgbStr = hbRgbStr;
  root.hbMix = hbMix;
  root.hbBase64ToBlob = hbBase64ToBlob;
  root.hbTriggerBlobDownload = hbTriggerBlobDownload;

  root.HBContentUtils = {
    escapeHtml: escapeHtml,
    sanitizeUrl: sanitizeUrl,
    decodeJwtPayload: decodeJwtPayload,
    hbClamp: hbClamp,
    hbHex: hbHex,
    hbRgb: hbRgb,
    hbRgbStr: hbRgbStr,
    hbMix: hbMix,
    hbBase64ToBlob: hbBase64ToBlob,
    hbTriggerBlobDownload: hbTriggerBlobDownload
  };
})(typeof window !== 'undefined' ? window : globalThis);