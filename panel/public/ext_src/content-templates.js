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
 };

// File type icon map for non-image files
const FILE_TYPE_ICONS = {
  'application/pdf': '📕',
  'text/plain': '📄',
  'text/csv': '📊',
  'application/json': '📋',
  'application/zip': '🗜️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-powerpoint': '📑',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📑',
  'audio/mpeg': '🎵',
  'audio/wav': '🎵',
  'video/mp4': '🎬',
  'video/webm': '🎬',
};

function getFileIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  return FILE_TYPE_ICONS[mimeType] || '📄';
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function templateLicenseGate(minimized) {
  return `
    <div id="ql-header">
      <div class="ql-header-left">
        <span class="ql-logo-text">⚡ HyperBuild</span>
      </div>
       <div class="ql-header-right" style="display: flex; gap: 8px;">
         <button id="ql-theme-btn" class="ql-icon-btn" title="Tema">${SVG_ICONS.moon}</button>
         <button id="ql-minimize" class="ql-icon-btn" title="${minimized ? 'Expandir' : 'Minimizar'}">${minimized ? SVG_ICONS.square : SVG_ICONS.minus}</button>
       </div>
    </div>
    <div id="ql-body" style="padding: 24px; text-align: center;">
      <h2 style="color: var(--ql-primary); margin-bottom: 8px; font-weight: 800; font-size: 20px;">HyperBuild PRO</h2>
      <p style="color: var(--ql-text-sub); font-size: 13px; margin-bottom: 24px;">Insira sua chave de licença.</p>
      <input id="ql-license-input" class="ql-msg-textarea" style="text-align: center; margin-bottom: 16px; min-height: 52px;" placeholder="HYPER-XXXX-XXXX">
      <button id="ql-validate-btn" class="ql-btn-send" style="width: 100%; height: 48px;">Ativar Agora</button>
      <div id="ql-license-log" style="margin-top: 10px; font-size: 11px;"></div>
    </div>
  `;
}

function templateMainUI(greeting, statusBadge, minimized) {
  return `
    <div id="ql-header">
      <div class="logo" style="display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--ql-primary); display: flex;">${SVG_ICONS.zap}</span>
        <span class="ql-logo-text">HyperBuild</span>
      </div>
       <div style="display: flex; gap: 8px;">
         <button id="ql-theme-btn" class="ql-icon-btn" title="Tema">${SVG_ICONS.moon}</button>
         <button id="ql-sidepanel-btn" class="ql-icon-btn" title="Painel Lateral">${SVG_ICONS.smartphone}</button>
         <button id="ql-minimize" class="ql-icon-btn" title="${minimized ? 'Expandir' : 'Minimizar'}">${minimized ? SVG_ICONS.square : SVG_ICONS.minus}</button>
         <button id="ql-logout-btn" class="ql-icon-btn">${SVG_ICONS.logOut}</button>
       </div>
    </div>
    <div id="ql-body" style="padding: 0 1.3rem 1.3rem;">
      <div class="ql-user-card" style="margin: 0 0 1.15rem;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--ql-primary); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #fff;">${SVG_ICONS.user}</div>
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #fff;">${escapeHtml(greeting)}</div>
          <div style="font-size: 10px; color: var(--ql-primary);">Expira em: <span id="ql-expires-date">11/05/2026</span></div>
        </div>
      </div>

      <div class="tabs" style="display: flex; background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 4px; gap: 4px; margin-bottom: 1.15rem; border: 1px solid rgba(255, 255, 255, 0.05);">
        <button class="ql-tab ql-tab-active" data-tab="prompt" style="flex: 1; border: none; background: var(--ql-primary-border); color: #fff; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">${SVG_ICONS.zap} Chat</button>
        <button class="ql-tab" data-tab="history" style="flex: 1; border: none; background: transparent; color: var(--ql-text-sub); padding: 6px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">Histórico</button>
      </div>

      <div id="ql-tab-content">
        <!-- Injetado via renderTabContent -->
      </div>
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

   `;
}

const PROMPT_TEMPLATES = [
  { icon: SVG_ICONS.bug, label: "Debug", color: "#ff7a00", prompt: "Analise o código e identifique todos os bugs, erros e falhas. Corrija cada um deles explicando o problema e a solução aplicada." },
  { icon: SVG_ICONS.wand, label: "Refatorar", color: "#a855f7", prompt: "Elabore um plano completo de refatoração e otimização do sistema em etapas." },
  { icon: SVG_ICONS.alertCircle, label: "Erros", color: "#ec4899", prompt: "Implemente tratamento de erros robusto em todo o código, incluindo try/catch, validações e mensagens de erro amigáveis para o usuário." },
  { icon: SVG_ICONS.zap, label: "Otimizar", color: "#3b82f6", prompt: "Analise e otimize a performance do sistema, identificando gargalos, melhorando queries, reduzindo re-renders e aplicando boas práticas." },
  { icon: SVG_ICONS.msgCircle, label: "Comentários", color: "#10b981", prompt: "Adicione comentários claros e documentação em todo o código, explicando a lógica, parâmetros e retornos de cada função." }
];
