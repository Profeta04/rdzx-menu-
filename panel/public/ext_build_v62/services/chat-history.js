/**
 * HBChatHistory — formatadores puros do sistema de Chat History (Wave 3, slice 2).
 *
 * Por enquanto expõe apenas formatChatDate/formatChatTime — funções puras de
 * formatação. As stateful (load/save/add/updateBadge/render) permanecem em
 * content.js porque há 4+ call sites que reatribuem `qlChatHistory = []`
 * diretamente; encapsular isso é uma slice futura dedicada.
 *
 * Carregado antes de content.js no manifest. Expostas como globais para
 * substituição drop-in dos call sites existentes.
 */
(function (root) {
  'use strict';

  function pad2(n) {
    var s = String(n);
    return s.length === 1 ? '0' + s : s;
  }

  /**
   * Rótulo curto pt-BR relativo à data atual.
   * @param {string|number|Date} dateStr
   * @param {Date} [now] — injetável para testes determinísticos
   * @returns {string}  "Hoje" | "Ontem" | "Domingo".."Sábado" | "dd/mm/aaaa"
   */
  function formatChatDate(dateStr, now) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var ref = now instanceof Date ? now : new Date();
    var today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((today - msgDay) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    if (diff > 1 && diff < 7) {
      return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()];
    }
    return d.toLocaleDateString('pt-BR');
  }

  /**
   * HH:MM zero-padded.
   * @param {string|number|Date} dateStr
   * @returns {string}
   */
  function formatChatTime(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  root.formatChatDate = formatChatDate;
  root.formatChatTime = formatChatTime;
  root.HBChatHistory = {
    formatChatDate: formatChatDate,
    formatChatTime: formatChatTime
  };
})(typeof window !== 'undefined' ? window : globalThis);