// ============================================
// HyperBuild – Sidepanel HTML Templates
// ============================================

const SP_SVG = {
  sparkles: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  mic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  wrench: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  msgSquare: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  trendUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  palette: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
  box: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  wand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4 4 4-4 4-4-4Z"/><path d="m2 22 7-7"/><path d="M12 10V2"/><path d="m20 22-7-7"/><path d="M22 12h-8"/><path d="M10 12H2"/><path d="M12 22v-8"/></svg>',
  bug: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.31 0-6-2.69-6-6v-1h12v1c0 3.31-2.69 6-6 6Z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
  alertCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  fileSearch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="15" r="3"/><path d="m16 21-2.1-2.1"/></svg>',
  chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  layout: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  clip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
  settings: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  ban: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  video: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
  downloadCloud: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8"/><path d="m8 17 4 4 4-4"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><path d="M12 13V9"/></svg>',
  logOut: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  bell: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
   sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    loader: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ql-spin"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>',
    alertTriangle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    checkCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    shieldCheck: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.71-2.13.09-2.91a2.18 2.18 0 0 0-3.09-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.5-1 1-4c1.5 0 3 0 3 0"/><path d="M15 9s1 .5 4 1c0 1.5 0 3 0 3h-3"/></svg>',
    beaker: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    fileText: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg>',
    chart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    gradient: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M4.5 19.5 19.5 4.5"/></svg>',
    layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.27a1 1 0 0 0 0 1.83l8.58 4.09a2 2 0 0 0 1.66 0l8.57-4.09a1 1 0 0 0 0-1.83Z"/><path d="m2 12 10 4.76L22 12"/><path d="m2 16 10 4.76L22 16"/></svg>',
    map: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
    smartphone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
};

function spEscapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function spTemplateAlert(title, message) {
  return `
    <div class="sp-alert">
      <div class="sp-alert-content">
        <p class="sp-alert-title">${spEscapeHtml(title)}</p>
        <p class="sp-alert-message">${spEscapeHtml(message)}</p>
        <button class="sp-alert-ok">OK</button>
      </div>
    </div>
  `;
}

function spTemplateUpdateBanner(version, changelog, url) {
  return `
    <div class="sp-update-banner" style="background: var(--accent-glow); border: 1px solid var(--accent-border); padding: 12px; border-radius: 12px; margin-bottom: 15px;">
      <div class="sp-update-info">
        <strong style="color: var(--neon-purple); font-size: 13px;">Nova Versão ${version} disponível!</strong>
        <p style="font-size: 11px; color: var(--text-sub); margin-top: 4px;">${changelog || ''}</p>
      </div>
      <button class="btn-send" style="margin-top: 8px; height: 32px; font-size: 11px;" onclick="window.open('${url}', '_blank')">Atualizar Agora</button>
    </div>
  `;
}

function spTemplateLicenseHeader(userName, expiresAt, status) {
  const date = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : '11/05/2026';
  const displayName = userName || 'Usuário';
  return `
    <div class="user-card" id="sp-user-card" style="margin-bottom: 1.5rem; padding: 1rem 1.2rem;">
      <div class="rgb-border"></div>
      <div class="avatar" id="sp-avatar" title="Clique para alterar foto">
        ${SP_SVG.user}
      </div>
      <div class="user-info">
        <div class="user-name" id="sp-name">
          <span class="user-name-rgb">${spEscapeHtml(displayName)}</span>
        </div>
        <div class="user-expiry">Expira em: <strong>${date}</strong></div>
      </div>
      <div class="sp-status-badge">
        <span class="sp-status-dot"></span>
        Ativo
      </div>
    </div>
  `;
}

function spTemplateLicenseGate() {
  return `
    <div class="sp-license-gate" style="text-align: center; padding: 24px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1;">
      <div style="background: var(--accent-glow); width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 1px solid var(--accent-border);">
        <span style="color: var(--neon-purple);">${SP_SVG.zap}</span>
      </div>
      <h2 style="color: #fff; margin-bottom: 8px; font-weight: 800; font-size: 22px;">HyperBuild PRO</h2>
      <p style="color: var(--text-sub); margin-bottom: 32px; font-size: 13px;">Insira sua chave de acesso para começar.</p>
      
      <div style="margin-bottom: 16px;">
        <input id="sp-license-input" class="msg-textarea" style="min-height: 52px; text-align: center; font-family: monospace; font-size: 14px; font-weight: 700; text-transform: uppercase;" placeholder="HYPER-XXXX-XXXX">
      </div>
      
      <button type="button" id="sp-validate-btn" class="btn-send" style="width: 100%; height: 50px;">Ativar Agora</button>
      <div id="sp-license-log" class="sp-log" style="margin-top: 20px; display: none; padding: 10px; border-radius: 8px; font-size: 12px;"></div>
    </div>
  `;
}

function spTemplateTabs(activeTab, historyCount) {
  return `
    <div class="tabs" style="display: flex; background: rgba(var(--dark-rgb), 0.05); border-radius: 12px; padding: 4px; gap: 4px; margin-bottom: 1.15rem; border: 1px solid var(--border);">
      <button class="tab-btn ${activeTab === 'prompt' ? 'active' : ''}" data-tab="prompt" style="flex: 1; border: none; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">${SP_SVG.zap} Chat</button>
      <button class="tab-btn ${activeTab === 'plan' ? 'active' : ''}" data-tab="plan" style="flex: 1; border: none; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; position:relative;"><span class="sp-tab-plan-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span> Plano<span id="sp-plan-badge" style="display:none; position:absolute; top:2px; right:2px; width:7px; height:7px; background:var(--neon-purple); border-radius:50%; box-shadow:0 0 6px var(--neon-purple);"></span></button>
      <button class="tab-btn ${activeTab === 'history' ? 'active' : ''}" data-tab="history" style="flex: 1; border: none; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">Histórico</button>
    </div>
  `;
}

function spTemplatePromptContent() {
  return `
    <div class="tab-panel active" style="animation: qlFadeIn 0.3s ease;">
      <div class="msg-wrap" id="sp-drop-zone" style="position: relative;">
        <div id="sp-drop-overlay" style="display: none; position: absolute; inset: 0; background: var(--accent-glow); backdrop-filter: blur(4px); border: 2px dashed var(--neon-purple); border-radius: 16px; z-index: 50; flex-direction: column; align-items: center; justify-content: center; color: var(--neon-purple); font-weight: 800; pointer-events: none;">
          <span style="margin-bottom: 8px;">${SP_SVG.downloadCloud}</span>
          <span>Solte para anexar</span>
        </div>
        <textarea class="msg-textarea" id="sp-msg" placeholder="Digite sua mensagem para o Lovable..." style="min-height: 120px;"></textarea>
        <div id="sp-attach-preview" class="sp-attach-preview-container" style="display: none; flex-wrap: wrap; gap: 8px; margin-top: 8px; padding: 8px; background: rgba(var(--dark-rgb), 0.2); border-radius: 12px; border: 1px solid var(--accent-border);"></div>
        <!-- Method selector moved to header -->

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; gap: 8px;">
          <div style="display: flex; gap: 8px; align-items: center; flex-shrink:0;">
            <button class="btn-action-icon" id="sp-attach" title="Anexar arquivo">
              ${SP_SVG.clip}
            </button>
            <input type="file" id="sp-file-input" multiple style="display:none">
            <button class="btn-action-icon" id="sp-optimize" title="Otimizar Prompt">
              ${SP_SVG.wand}
            </button>
            <button class="btn-action-icon" id="sp-speech" title="Digitação por voz">
              ${SP_SVG.mic}
            </button>
            <button class="btn-action-icon" id="sp-download-project" title="Baixar projeto (.zip)">
              ${SP_SVG.download}
            </button>
          </div>
         <button class="btn-send" id="sp-send" style="flex: 1; min-width:120px; height: 56px; font-size: 1.1rem;">Enviar</button>
         <button class="btn-action-icon" id="sp-clear-msg" title="Limpar">${SP_SVG.trash}</button>
       </div>
     </div>

     <div class="response-area" id="sp-response-box"></div>

     <div class="divider"></div>
      <div class="section-title">${SP_SVG.zap} Funcionalidades Rápidas</div>
      <div class="sp-quick-actions-grid">
        <button class="sp-quick-btn" data-prompt="Realize uma auditoria completa de segurança identificando vulnerabilidades, falhas de autenticação, exposição de dados, XSS, CSRF e problemas de permissão. Corrija as falhas aplicando boas práticas modernas de segurança.">
          <span class="sp-quick-icon">${SP_SVG.shieldCheck}</span><span class="sp-quick-label">Segurança</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Refatore o código para deixá-lo mais limpo, modular e organizado seguindo SOLID e Clean Code, reduzindo complexidade sem alterar a funcionalidade original.">
          <span class="sp-quick-icon">${SP_SVG.chart}</span><span class="sp-quick-label">Refatorar</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Transforme a interface atual em um design premium moderno, refinado e fluido. Melhore tipografia, espaçamento, cores, hierarquia visual, animações, microinterações, responsividade e organização do CSS mantendo a identidade do projeto.">
          <span class="sp-quick-icon">${SP_SVG.palette}</span><span class="sp-quick-label">Melhorar UI</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Explique detalhadamente o funcionamento do código, descrevendo funções, componentes, fluxo de dados, arquitetura e lógica de negócio de forma técnica e didática.">
          <span class="sp-quick-icon">${SP_SVG.search}</span><span class="sp-quick-label">Explicar</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Otimize o código focando em performance, escalabilidade e boas práticas. Reduza re-renders, melhore carregamento, organização arquitetural, tipagem, cache, segurança e eficiência geral do sistema.">
          <span class="sp-quick-icon">${SP_SVG.rocket}</span><span class="sp-quick-label">Otimizar</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Identifique falhas, bugs e erros de lógica no código. Corrija cada problema encontrado explicando a causa raiz e a solução aplicada, garantindo funcionamento estável e sem erros.">
          <span class="sp-quick-icon">${SP_SVG.wrench}</span><span class="sp-quick-label">Corrigir</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Crie testes unitários completos cobrindo cenários principais e casos extremos, utilizando boas práticas de isolamento, organização e alta cobertura de código.">
          <span class="sp-quick-icon">${SP_SVG.beaker}</span><span class="sp-quick-label">Testes</span>
        </button>
        <button class="sp-quick-btn" data-prompt="Refatore a interface utilizando abordagem mobile-first para garantir responsividade total em qualquer resolução, melhorando grids, flexbox, tipografia fluida, imagens adaptativas e experiência touch.">
          <span class="sp-quick-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg></span><span class="sp-quick-label">Responsivo</span>
        </button>
      </div>

     <div class="divider"></div>
      <div class="section-title">Ações</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <button id="sp-new-project-btn" style="height: 44px; background: var(--accent-glow); border: 1px solid var(--accent-border); border-radius: 12px; color: #fff; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          ${SP_SVG.plus} Novo Projeto
        </button>
        <button class="btn-watermark" id="sp-remove-watermark" style="height: 44px; background: var(--accent-glow); border: 1px solid var(--accent-border); border-radius: 12px; color: #fff; font-weight: 700; font-size: 11px; cursor: pointer;">
          <span>${SP_SVG.ban}</span> Remover marca D'água
        </button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <button class="btn-shield" id="sp-shield-btn" style="height: 44px; background: var(--accent-glow); border: 1px solid var(--accent-border); border-radius: 12px; color: var(--text-sub); font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span class="shield-dot" style="width: 6px; height: 6px; background: var(--neon-purple); border-radius: 50%;"></span>
          <span id="sp-shield-label">Ativar Escudo</span>
        </button>
        <button id="sp-native-chat-btn" style="height: 44px; background: var(--accent-glow); border: 1px solid var(--accent-border); border-radius: 12px; color: var(--neon-purple); font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;">
          ${SP_SVG.msgSquare} Chat Nativo
        </button>
      </div>
  `;
}

// Removed spTemplateBuildContent function as the Project tab is no longer needed.

function spTemplateChatHistory(history) {
  if (!history || !history.length) {
    return `
      <div class="tab-panel active">
        <div class="response-area visible">
          Nenhum histórico disponível.
        </div>
      </div>
    `;
  }
  
  return `
    <div class="tab-panel active">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span class="section-title">Comandos Recentes</span>
        <button id="sp-chat-clear" class="btn-action-icon" style="width: auto; height: auto; padding: 4px 8px; border-radius: 6px; font-size: 10px;">Limpar</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${history.slice().reverse().map(item => `
          <div class="user-card" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px;">
            <p style="font-size: 12px; color: var(--text-main); line-height: 1.4;">${spEscapeHtml(item.text)}</p>
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-top: 5px;">
              <span style="font-size: 9px; color: var(--text-sub);">${item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '---'}</span>
              <button class="sp-history-use" data-text="${spEscapeHtml(item.text)}" style="background: var(--accent-glow); border: 1px solid var(--neon-purple); color: var(--neon-purple); font-size: 9px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">Usar</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function spTemplateNotifItem(n) {
  return `
    <div class="sp-notif-item">
      <div class="sp-notif-title">${spEscapeHtml(n.title)}</div>
      <div class="sp-notif-body">${spEscapeHtml(n.message)}</div>
    </div>
  `;
}

function spTemplateAttachItem(f, i) {
  const isImg = UploadManager.isImageType(f.file_type);
  const isVid = UploadManager.isVideoType(f.file_type);
  const icon = UploadManager.getFileIcon(f.file_type, f.file_name);
  const staggerDelay = (i * 0.05) + 's';

  let thumbHtml;
  if (isImg && f.previewUrl) {
    thumbHtml = `<img src="${f.previewUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
  } else if (isVid) {
    thumbHtml = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); font-size: 14px;">${SP_SVG.video}</div>`;
  } else {
    thumbHtml = `<div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; background: var(--accent-glow); gap: 2px;">
      <span style="font-size: 14px;">${SP_SVG[icon] || SP_SVG.file}</span>
    </div>`;
  }

  return `
    <div class="sp-attach-item" 
         title="${spEscapeHtml(f.file_name)} (${f.sizeLabel})" 
         style="animation-delay: ${staggerDelay}; position: relative; width: 52px; height: 52px; border-radius: 10px; overflow: hidden; border: 1px solid ${f.uploadFailed ? '#ff0055' : 'var(--accent-border)'}; background: rgba(var(--dark-rgb),0.4);">
      ${thumbHtml}
       <button class="sp-attach-remove" data-idx="${i}">${SP_SVG.close}</button>
      ${f.uploading ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;"><div class="sp-spin" style="width: 14px; height: 14px; border: 2px solid var(--accent-border); border-top-color: var(--neon-purple); border-radius: 50%;"></div></div>` : ''}
      ${f.uploadFailed ? `<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255,0,0,0.8); color: #fff; font-size: 8px; text-align: center; font-weight: 900; padding: 1px 0;">ERRO</div>` : ''}
    </div>
  `;
}



function spTemplateCountdown(label, timeStr, pct, urgentClass) {
  return `
    <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
      <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
        <span style="color: var(--text-sub); font-size: 9px;">${label}</span>
        <span style="color: var(--neon-purple); font-size: 9px;">${timeStr}</span>
      </div>
      <div style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
        <div style="width: ${pct}%; height: 100%; background: var(--neon-purple); transition: width 1s linear;" class="${urgentClass}"></div>
      </div>
    </div>
  `;
}



// ============================================================
// HyperBuild – Plan Engine Templates
// ============================================================

function spTemplatePlanIdle() {
  return `
    <div class="tab-panel active sp-plan-idle" style="animation: qlFadeIn 0.3s ease;">
      <div style="text-align:center; padding: 28px 16px 20px;">
        <div style="width:56px; height:56px; margin:0 auto 16px; border-radius:18px; background:var(--accent-glow); border:1px solid var(--accent-border); display:flex; align-items:center; justify-content:center; color:var(--neon-purple);">${SP_SVG.map.replace('width="14"','width="28"').replace('height="14"','height="28"')}</div>
        <div style="font-size:14px; font-weight:800; color:var(--text-main); margin-bottom:6px;">Engine de Planejamento</div>
        <div style="font-size:11px; color:var(--text-sub); line-height:1.6; max-width:220px; margin:0 auto;">Descreva seu objetivo e a IA vai criar um plano em etapas otimizadas automaticamente.</div>
      </div>

      <div style="background:var(--accent-glow); border:1px solid var(--accent-border); border-radius:14px; padding:14px; margin-bottom:12px;">
        <div style="font-size:10px; font-weight:800; color:var(--neon-purple); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; align-items:center; gap:4px;">${SP_SVG.zap} Gerar Plano</div>
        <textarea id="sp-plan-input" class="msg-textarea" style="min-height:80px; font-size:12px;" placeholder='Exemplo: "Crie uma landing page premium para uma IA SaaS"&#10;&#10;A IA vai dividir em etapas e criar prompts otimizados.'></textarea>
        <button id="sp-plan-generate-btn" class="btn-send" style="width:100%; margin-top:10px; height:44px; font-size:12px; font-weight:800;">
          <span style="display:flex; align-items:center; justify-content:center; gap:6px;">${SP_SVG.zap} Gerar Plano com IA</span>
        </button>
      </div>

      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:12px;">
        <div style="font-size:10px; font-weight:700; color:var(--text-sub); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.4px;">Como funciona</div>
        <div style="display:flex; flex-direction:column; gap:7px;">
          <div style="display:flex; gap:10px; align-items:flex-start; font-size:11px; color:var(--text-sub);">
            <span style="width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,var(--neon-purple),var(--purple)); color:#fff; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0;">1</span>
            <span>Digite seu objetivo em linguagem natural</span>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; font-size:11px; color:var(--text-sub);">
            <span style="width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,var(--neon-purple),var(--purple)); color:#fff; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0;">2</span>
            <span>A IA analisa e cria etapas com prompts otimizados</span>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; font-size:11px; color:var(--text-sub);">
            <span style="width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,var(--neon-purple),var(--purple)); color:#fff; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0;">3</span>
            <span>Execute cada etapa com um clique — automático</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function spTemplatePlanLoading() {
  return `
    <div class="tab-panel active" style="animation: qlFadeIn 0.3s ease; text-align:center; padding:48px 16px;">
      <div style="width:52px; height:52px; margin:0 auto 20px; position:relative;">
        <div style="width:52px; height:52px; border-radius:50%; border:2px solid var(--accent-border); border-top-color:var(--neon-purple); animation:ql-spin 0.9s linear infinite;"></div>
        <div style="position:absolute; inset:8px; border-radius:50%; border:2px solid transparent; border-bottom-color:rgba(191,0,255,0.4); animation:ql-spin 1.4s linear infinite reverse;"></div>
      </div>
      <div style="font-size:13px; font-weight:800; color:var(--text-main); margin-bottom:6px;">Analisando seu objetivo...</div>
      <div style="font-size:11px; color:var(--text-sub); line-height:1.6;" id="sp-plan-loading-msg">A IA está criando seu plano em etapas</div>
    </div>
  `;
}

function spTemplatePlanResult(steps, goalText) {
  const stepsHtml = steps.map((step, i) => `
    <div class="sp-plan-card" data-step-index="${i}" style="animation-delay:${i * 0.08}s;">
      <div class="sp-plan-card-header">
        <div class="sp-plan-step-num">${i + 1}</div>
        <div style="flex:1; min-width:0;">
          <div class="sp-plan-card-title">${spEscapeHtml(step.title)}</div>
          <div class="sp-plan-card-desc">${spEscapeHtml(step.description)}</div>
        </div>
        <div class="sp-plan-card-status" id="sp-plan-status-${i}"></div>
      </div>
      <div class="sp-plan-card-prompt" id="sp-plan-prompt-${i}">${spEscapeHtml(step.prompt)}</div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="sp-plan-send-btn" data-idx="${i}" data-prompt="${spEscapeHtml(step.prompt)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Executar Etapa
        </button>
        <button class="sp-plan-copy-btn" data-prompt="${spEscapeHtml(step.prompt)}" title="Copiar prompt">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  return `
    <div class="tab-panel active" style="animation: qlFadeIn 0.3s ease;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div>
          <div style="font-size:12px; font-weight:800; color:var(--text-main);">Plano Gerado</div>
          <div style="font-size:10px; color:var(--text-sub); margin-top:2px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${spEscapeHtml(goalText)}">${spEscapeHtml(goalText)}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <div style="background:var(--accent-glow); border:1px solid var(--accent-border); padding:3px 9px; border-radius:20px; font-size:10px; font-weight:800; color:var(--neon-purple); display:flex; align-items:center; gap:4px;">${SP_SVG.chart} ${steps.length} etapas</div>
          <button id="sp-plan-reset-btn" style="background:transparent; border:1px solid var(--border); border-radius:8px; color:var(--text-sub); font-size:10px; font-weight:700; padding:4px 8px; cursor:pointer; display:flex; align-items:center; gap:4px;" title="Novo plano">${SP_SVG.refresh} Novo</button>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; padding:10px 12px; background:rgba(191,0,255,0.06); border:1px solid rgba(191,0,255,0.15); border-radius:10px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--neon-purple)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style="font-size:10px; color:var(--text-sub);">Execute as etapas em ordem para melhores resultados</span>
      </div>

      <div class="sp-plan-steps" id="sp-plan-steps-container">
        ${stepsHtml}
      </div>

      <button id="sp-plan-run-all-btn" class="btn-send" style="width:100%; margin-top:12px; height:44px; font-size:12px; font-weight:800; background:linear-gradient(135deg, var(--neon-purple), var(--purple));">
        &#9889; Executar Todas as Etapas
      </button>
      <button id="sp-plan-reset-btn2" style="width:100%; margin-top:8px; height:36px; background:transparent; border:1px solid var(--border); border-radius:10px; color:var(--text-sub); font-size:11px; font-weight:700; cursor:pointer;">
        ↩ Gerar Novo Plano
      </button>
    </div>
  `;
}
