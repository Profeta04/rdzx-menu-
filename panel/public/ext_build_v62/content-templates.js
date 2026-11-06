// ============================================
// HyperBuild – HTML Templates (content)
// ============================================

const SVG_ICONS = {
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  wand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4 4 4-4 4-4-4Z"/><path d="m2 22 7-7"/><path d="M12 10V2"/><path d="m20 22-7-7"/><path d="M22 12h-8"/><path d="M10 12H2"/><path d="M12 22v-8"/></svg>',
  clip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
  msgSquare: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  download: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  ban: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
  logOut: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  smartphone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  user: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  bug: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.31 0-6-2.69-6-6v-1h12v1c0 3.31-2.69 6-6 6Z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
  alertCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  palette: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
  msgCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
   moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
   sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
   mic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
   plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
   minus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
   square: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>',
   check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
   clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
   alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
   info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    sparkles: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    loader: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ql-spin"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>',
    alertTriangle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    checkCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    shieldCheck: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.71-2.13.09-2.91a2.18 2.18 0 0 0-3.09-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.5-1 1-4c1.5 0 3 0 3 0"/><path d="M15 9s1 .5 4 1c0 1.5 0 3 0 3h-3"/></svg>',
    beaker: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>',
    wrench: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    fileText: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg>',
    chart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    gradient: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M4.5 19.5 19.5 4.5"/></svg>',
    layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.27a1 1 0 0 0 0 1.83l8.58 4.09a2 2 0 0 0 1.66 0l8.57-4.09a1 1 0 0 0 0-1.83Z"/><path d="m2 12 10 4.76L22 12"/><path d="m2 16 10 4.76L22 16"/></svg>',
 };

// File type icon map for non-image files
const FILE_TYPE_ICONS = {
  'application/pdf': SVG_ICONS.fileText,
  'text/plain': SVG_ICONS.fileText,
  'text/csv': SVG_ICONS.chart,
  'application/json': SVG_ICONS.fileText,
  'application/zip': SVG_ICONS.box,
  'application/msword': SVG_ICONS.fileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': SVG_ICONS.fileText,
  'application/vnd.ms-excel': SVG_ICONS.chart,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': SVG_ICONS.chart,
  'application/vnd.ms-powerpoint': SVG_ICONS.layers,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': SVG_ICONS.layers,
  'audio/mpeg': SVG_ICONS.mic,
  'audio/wav': SVG_ICONS.mic,
  'video/mp4': SVG_ICONS.video,
  'video/webm': SVG_ICONS.video,
};

function getFileIcon(mimeType) {
  if (!mimeType) return SVG_ICONS.fileText;
  if (mimeType.startsWith('image/')) return SVG_ICONS.image;
  if (mimeType.startsWith('audio/')) return SVG_ICONS.mic;
  if (mimeType.startsWith('video/')) return SVG_ICONS.video;
  return FILE_TYPE_ICONS[mimeType] || SVG_ICONS.fileText;
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function templateLicenseGate(minimized) {
  // SVG do raio (zap) inline para compatibilidade com ofuscação
  var zapSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  var minimizeIcon = minimized ? SVG_ICONS.square : SVG_ICONS.minus;
  var minimizeTitle = minimized ? 'Expandir' : 'Minimizar';
  return (
    '<div id="ql-header" style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem 0.6rem;border-bottom:1px solid var(--ql-primary-border);">' +
      /* Logo com anel RGB girando – lado esquerdo */
      '<div class="ql-gate-logo-wrap" style="display:flex;align-items:center;gap:9px;">' +
        '<div class="ql-gate-logo-icon" style="position:relative;width:32px;height:32px;flex-shrink:0;">' +
          /* Pseudo-anel não funciona com JS, usamos um elemento real */
          '<div class="ql-gate-logo-ring" style="position:absolute;inset:-3px;border-radius:11px;z-index:0;"></div>' +
          '<div style="position:absolute;inset:1.5px;border-radius:8px;background:rgba(3,0,15,0.97);z-index:1;"></div>' +
          '<div class="ql-gate-logo-svg" style="position:relative;z-index:2;display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--ql-primary);">' +
            zapSvg +
          '</div>' +
        '</div>' +
        '<span class="ql-gate-logo-text">HyperBuild</span>' +
      '</div>' +
      /* Botões – lado direito */
      '<div style="display:flex;gap:6px;align-items:center;">' +
        '<button id="ql-minimize" class="ql-icon-btn" title="' + minimizeTitle + '">' + minimizeIcon + '</button>' +
      '</div>' +
    '</div>' +
    '<div id="ql-body" class="ql-gate-body" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem 1.5rem; text-align:center;">' +
      '<h2 class="ql-gate-title" style="margin-bottom:0.5rem; font-weight:900; font-size:1.6rem; color:#fff;">HyperBuild PRO</h2>' +
      '<p class="ql-gate-subtitle" style="margin-bottom:2rem; font-size:0.9rem; color:var(--ql-text-sub); opacity:0.8;">Insira sua chave de licença para começar.</p>' +
      '<input id="ql-license-input" class="ql-gate-input" placeholder="HYPER-XXXX-XXXX" autocomplete="off" spellcheck="false" style="width:100%; text-align:center; font-family:monospace; margin-bottom:1rem; height:52px; border-radius:14px; border:1px solid var(--ql-primary-border); background:rgba(0,0,0,0.2); color:#fff; font-size:1rem; font-weight:700;">' +
      '<button type="button" id="ql-validate-btn" class="ql-gate-btn" style="width:100%; height:52px; border-radius:14px; border:none; background:linear-gradient(135deg, var(--ql-primary), var(--purple)); color:#fff; font-weight:800; font-size:1rem; cursor:pointer; box-shadow:0 4px 15px var(--ql-primary-glow);">Ativar Agora</button>' +
      '<div id="ql-license-log" class="ql-gate-log" style="margin-top:1.2rem; min-height:20px; font-size:0.85rem;"></div>' +
    '</div>'
  );
}

function templateMainUI(greeting, statusBadge, minimized) {
  const displayName = greeting || 'Usuário';
  return `
    <div id="ql-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0.6rem 0.85rem;border-bottom:1px solid var(--ql-primary-border);min-width:0;">
      <div class="logo" style="min-width:0;flex-shrink:0;">
        <span class="logo-icon ql-logo-icon" style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;">
          ${SVG_ICONS.zap}
        </span>
        <span class="logo-text ql-logo-text" style="font-size:0.95rem;letter-spacing:0.8px;">HyperBuild</span>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">
        <div class="ql-method-selector" style="position:relative;">
          <button type="button" id="ql-method-btn" title="Método de envio" style="display:inline-flex; align-items:center; gap:3px; padding:0 7px; height:26px; border-radius:999px; border:1px solid var(--ql-primary-border); background:rgba(191,0,255,0.10); cursor:pointer; font-weight:800; font-size:9px; text-transform:uppercase; letter-spacing:.04em; color:var(--ql-primary);">
            <span id="ql-method-icon" style="display:inline-flex; align-items:center; justify-content:center; width:11px; height:11px; color:var(--ql-primary);"></span>
            <span id="ql-method-label">Fast</span>
            <span style="font-size:8px;">▾</span>
          </button>
          <div id="ql-method-menu" style="display:none; position:fixed; min-width:140px; background:rgba(18,18,20,0.95); backdrop-filter:blur(24px); border:1px solid var(--ql-primary-border); border-radius:12px; padding:4px; z-index:2147483646; box-shadow:0 8px 24px rgba(0,0,0,.5);"></div>
        </div>
        <button id="ql-sidepanel-btn" class="ql-icon-btn" title="Painel Lateral">${SVG_ICONS.smartphone}</button>
        <button id="ql-minimize" class="ql-icon-btn" title="${minimized ? 'Expandir' : 'Minimizar'}">${minimized ? SVG_ICONS.square : SVG_ICONS.minus}</button>
        <button id="ql-logout-btn" class="ql-icon-btn">${SVG_ICONS.logOut}</button>
      </div>
    </div>
    <div id="ql-body" style="padding:0 1.1rem 1.1rem;">

      <!-- USER CARD COPIED FROM SIDEPANEL STRUCTURE -->
      <div class="ql-user-card-wrap">
        <div class="user-card ql-user-card" id="ql-user-card-inner" title="Perfil da licença ativa">
          <div class="rgb-border ql-rgb-border" id="ql-rgb-border-el"></div>
          <div class="avatar ql-avatar" id="ql-avatar-btn" title="Clique para alterar foto">
            <span id="ql-avatar-inner" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${SVG_ICONS.user}</span>
          </div>
          <div class="user-info">
            <div class="user-name" id="ql-user-display-name">
              <span class="user-name-rgb ql-user-name-text">${escapeHtml(displayName)}</span>
            </div>
            <div class="user-expiry">Expira em: <strong id="ql-expires-date">—</strong></div>
          </div>
          <div class="sp-status-badge">
            <span class="sp-status-dot"></span>
            Ativo
          </div>
        </div>
      </div>

      <!-- TABS -->
      <div style="display:flex;background:rgba(var(--hb-accent-rgb),0.05);border-radius:12px;padding:4px;gap:4px;margin-bottom:1rem;border:1px solid var(--ql-primary-border);">
      <button class="ql-tab ql-tab-active" data-tab="prompt" style="flex:1;border:none;background:linear-gradient(135deg,var(--purple),var(--ql-primary));color:#fff;padding:6px;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer;letter-spacing:0.5px;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 0 14px var(--ql-primary-glow);">${SVG_ICONS.zap} Chat</button>
        <button class="ql-tab" data-tab="history" style="flex:1;border:none;background:transparent;color:rgba(168,120,216,0.6);padding:6px;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer;letter-spacing:0.5px;transition:all 0.2s ease;">Histórico</button>
      </div>

      <div id="ql-tab-content"></div>
    </div>
  `;
}

function templatePromptContent() {
  return `
    <div class="msg-wrap" id="ql-drop-zone">
      <div id="ql-drop-overlay" style="
        display: none;
        position: absolute;
        inset: 0;
        background: var(--ql-primary-glow);
        border: 2px dashed var(--ql-primary);
        border-radius: 1rem;
        z-index: 10;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 6px;
        pointer-events: none;
        backdrop-filter: blur(4px);
      ">
        <div style="font-size: 22px; color: var(--ql-primary);">${SVG_ICONS.clip}</div>
        <div style="color: var(--ql-primary); font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Soltar arquivos aqui</div>
        <div style="color: var(--ql-text-sub); font-size: 10px;">máx. 10 imagens · 20MB por arquivo</div>
      </div>

      <textarea id="ql-msg" class="ql-msg-textarea" placeholder="Digite seu comando ou arraste arquivos aqui..."></textarea>

      <!-- ATTACHMENT PREVIEW AREA -->
      <div id="ql-attach-preview" style="
        display: none;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 0 4px;
        max-height: 130px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--ql-primary-border) transparent;
      "></div>

      <!-- ATTACH COUNT BADGE -->
      <div id="ql-attach-count-bar" style="display:none; align-items:center; justify-content:space-between; padding: 4px 2px 2px; margin-top: 2px;">
        <span style="font-size:9px; font-weight:800; color:var(--ql-text-sub); text-transform:uppercase; letter-spacing:1px;">
          <span id="ql-attach-count">0</span> arquivo(s) anexado(s)
        </span>
         <button id="ql-attach-clear-all" style="background:none; border:none; color:#ff4466; font-size:9px; font-weight:800; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:4px">${SVG_ICONS.close} Limpar todos</button>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 8px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="ql-attach-btn" class="ql-icon-btn" title="Anexar arquivo (máx. 10 arquivos · 20MB cada)" style="position:relative;">
            ${SVG_ICONS.clip}
            <span id="ql-attach-badge" style="
              display:none;
              position:absolute;
              top:-5px; right:-5px;
              background: var(--ql-primary);
              color:#fff;
              font-size:8px;
              font-weight:900;
              width:14px; height:14px;
              border-radius:50%;
              align-items:center;
              justify-content:center;
            "></span>
          </button>
          <input type="file" id="ql-file-input" multiple style="display:none" accept="*/*">
          <button id="ql-optimize-btn" class="ql-icon-btn" title="Otimizar">${SVG_ICONS.wand}</button>
           <button id="ql-speech-btn" class="ql-icon-btn" title="Digitação por voz">${SVG_ICONS.mic}</button>
           <button id="ql-download-project-btn" class="ql-icon-btn" title="Baixar projeto (.zip)">${SVG_ICONS.download}</button>
        </div>
        <button id="ql-send-btn" class="ql-btn-send">Enviar</button>
        <button id="ql-clear-msg" class="ql-icon-btn" title="Limpar">${SVG_ICONS.trash}</button>
      </div>
    </div>

     <div id="ql-response-area" style="margin-top: 10px; padding: 10px; border-radius: 12px; background: rgba(0,0,0,0.3); font-size: 11px; color: var(--ql-text-sub); display: none;"></div>

     <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
       <button id="ql-new-project-btn" style="height: 40px; background: var(--ql-primary-glow); border: 1px solid var(--ql-primary-border); border-radius: 12px; color: #fff; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
         ${SVG_ICONS.plus} Novo Projeto
       </button>
      <button id="ql-remove-watermark" style="height: 40px; background: var(--ql-primary-glow); border: 1px solid var(--ql-primary-border); border-radius: 12px; color: #fff; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">${SVG_ICONS.ban} Remover marca D'água</button>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
      <button id="ql-shield-btn" style="height: 40px; background: var(--ql-primary-glow); border: 1px solid var(--ql-primary-border); border-radius: 12px; color: var(--ql-text-sub); font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        ${SVG_ICONS.shield}
        <span id="ql-shield-label">Ativar Escudo</span>
      </button>
      <button id="ql-native-chat-btn" class="ql-native-chat-btn" style="height: 40px; background: var(--ql-primary-glow); border: 1px solid var(--ql-primary-border); border-radius: 12px; color: var(--ql-primary); font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 1px;">
        ${SVG_ICONS.msgSquare} Chat Nativo
      </button>
    </div>

    <div class="ql-divider"></div>
    <div class="ql-section-title">${SVG_ICONS.zap} Ações Rápidas</div>
    <div class="ql-quick-grid">
      <button class="ql-quick-btn" data-ql-prompt="Realize uma auditoria completa de segurança identificando vulnerabilidades, falhas de autenticação, exposição de dados e problemas de permissão. Corrija as falhas aplicando boas práticas modernas.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.shieldCheck}</span>Segurança
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Refatore o código para deixá-lo mais limpo, modular e organizado seguindo SOLID e Clean Code, reduzindo complexidade sem alterar a funcionalidade original.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.chart}</span>Refatorar
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Transforme a interface atual em um design premium moderno. Melhore tipografia, espaçamento, cores, hierarquia visual, animações e responsividade mantendo a identidade do projeto.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.palette}</span>UI/UX
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Identifique falhas, bugs e erros de lógica no código. Corrija cada problema encontrado explicando a causa raiz e a solução aplicada.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.wrench}</span>Corrigir
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Otimize o código focando em performance, escalabilidade e boas práticas. Reduza re-renders, melhore carregamento e eficiência geral do sistema.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.rocket}</span>Otimizar
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Explique detalhadamente o funcionamento do código, descrevendo funções, componentes, fluxo de dados e arquitetura de forma técnica e didática.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.search}</span>Explicar
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Crie testes unitários completos cobrindo cenários principais e casos extremos, utilizando boas práticas de isolamento e alta cobertura de código.">
        <span class="ql-quick-btn-icon">${SVG_ICONS.beaker}</span>Testes
      </button>
      <button class="ql-quick-btn" data-ql-prompt="Refatore a interface utilizando mobile-first para garantir responsividade total em qualquer resolução, melhorando grids, flexbox, tipografia fluida e experiência touch.">
        <span class="ql-quick-btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg></span>Responsivo
      </button>
    </div>

   `;
}

const PROMPT_TEMPLATES = [
  { icon: SVG_ICONS.bug, label: "Debug", color: "#ff7a00", prompt: "Analise o código e identifique todos os bugs, erros e falhas. Corrija cada um deles explicando o problema e a solução aplicada." },
  { icon: SVG_ICONS.wand, label: "Refatorar", color: "#a855f7", prompt: "Elabore um plano completo de refatoração e otimização do sistema em etapas." },
  { icon: SVG_ICONS.alertCircle, label: "Erros", color: "#ec4899", prompt: "Implemente tratamento de erros robusto em todo o código, incluindo try/catch, validações e mensagens de erro amigáveis para o usuário." },
  { icon: SVG_ICONS.zap, label: "Otimizar", color: "#3b82f6", prompt: "Analise e otimize a performance do sistema, identificando gargalos, melhorando queries, reduzindo re-renders e aplicando boas práticas." },
  { icon: SVG_ICONS.msgCircle, label: "Comentários", color: "#10b981", prompt: "Adicione comentários claros e documentação em todo o código, explicando a lógica, parâmetros e retornos de cada função." }
];
