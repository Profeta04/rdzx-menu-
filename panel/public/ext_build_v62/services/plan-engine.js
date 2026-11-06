/**
 * HBPlanEngine — Plan Engine extraído do sidepanel.js via dependency injection.
 *
 * Responsabilidades:
 *  - Gerar plano via Groq (GROQ_KEY + GROQ_URL embutidos, mesmo modelo do legado)
 *  - Persistir / restaurar plano em chrome.storage.local
 *  - Renderizar a aba Plan (idle / loading / result) com templates fornecidos
 *  - Executar etapas (uma a uma ou todas), reaproveitando handleSend do sidepanel
 *
 * As closures privadas do sidepanel (showAlert, switchTab, handleSend, document,
 * spTemplate*, spEscapeHtml) entram exclusivamente via `deps` — nada de globais
 * implícitas. Isso permite testes fora do Chrome (ver src/extension-lib/plan-engine.ts).
 *
 * Contrato público (mesma superfície do PlanEngine antigo):
 *    HBPlanEngine.create(deps) => { renderTab, loadFromStorage, updateBadge }
 */
(function (root) {
  'use strict';

  function requireDep(deps, name) {
    if (!deps || typeof deps[name] === 'undefined') {
      throw new Error('[HBPlanEngine] missing dependency: ' + name);
    }
    return deps[name];
  }

  function parsePlan(text) {
    if (!text) return null;
    var iStart = text.indexOf('[PLAN_START]');
    var iEnd = text.indexOf('[PLAN_END]');
    if (iStart === -1 || iEnd === -1 || iEnd <= iStart) return null;
    var planBlock = text.substring(iStart + '[PLAN_START]'.length, iEnd);
    var parts = planBlock.split('[STEP]');
    var steps = [];
    for (var pi = 1; pi < parts.length; pi++) {
      var block = parts[pi];
      var iClose = block.indexOf('[/STEP]');
      if (iClose !== -1) block = block.substring(0, iClose);
      var title = getField(block, 'title');
      var description = getField(block, 'description');
      var prompt = getField(block, 'prompt');
      if (title && prompt) {
        steps.push({ title: title, description: description, prompt: prompt, done: false });
      }
    }
    return steps.length > 0 ? steps : null;
  }

  function getField(block, key) {
    var lines = block.split('\n');
    var result = '';
    var collecting = false;
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var trimmed = line.trim();
      if (trimmed.indexOf(key + '=') === 0) {
        result = trimmed.substring(key.length + 1);
        collecting = true;
      } else if (collecting) {
        if (/^(title|description|prompt)=/.test(trimmed)) break;
        result += '\n' + line;
      }
    }
    return result.trim();
  }

  var SYSTEM_PROMPT = [
    'Voce e uma Engine de Planejamento de Prompts para desenvolvimento de software.',
    '',
    'Quando o usuario descrever um objetivo, responda EXCLUSIVAMENTE no formato:',
    '',
    '[PLAN_START]',
    '',
    '[STEP]',
    'title=Titulo curto (max 40 chars)',
    'description=Descricao resumida do resultado (max 80 chars)',
    'prompt=Prompt completo e otimizado para enviar ao Lovable AI para executar esta etapa. Deve ser detalhado, tecnico e auto-contido.',
    '[/STEP]',
    '',
    '[PLAN_END]',
    '',
    'REGRAS:',
    '- Responda APENAS com o bloco [PLAN_START]...[PLAN_END], sem texto extra',
    '- Crie entre 3 e 6 etapas dependendo da complexidade',
    '- Cada prompt deve ser completo e autossuficiente',
    '- Prompts em portugues, altamente detalhados',
    '- Organize etapas em ordem logica de execucao'
  ].join('\n');

  // GROQ_KEY ofuscado (mesmo método do legado — debt rastreada em mem://security/findings).
  var GROQ_KEY = (function () {
    try {
      return atob('=ImNzR2NTV3S2F2ULNkV1kWQkpmQ20GZYllRzIWekd0VVJldy52R1EGcVFDeo5kYYJmcnZ2XrN3Z'.split('').reverse().join(''));
    } catch (_) { return ''; }
  })();
  var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  var STORAGE_KEY = 'ql_plan_current';
  var LOADING_MESSAGES = [
    'Analisando seu objetivo...',
    'Estruturando o fluxo...',
    'Criando prompts otimizados...',
    'Organizando etapas...',
    'Finalizando o plano...'
  ];

  function create(deps) {
    // Hard deps — falhar cedo se faltar.
    var doc = requireDep(deps, 'document');
    var storage = requireDep(deps, 'storage');           // { get(keys, cb), set(obj, cb?), remove(keys, cb?) }
    var showAlert = requireDep(deps, 'showAlert');
    var switchTab = requireDep(deps, 'switchTab');
    var handleSend = requireDep(deps, 'handleSend');
    var templates = requireDep(deps, 'templates');       // { idle, loading, result(steps, goal) }
    var escapeHtml = requireDep(deps, 'escapeHtml');
    // Soft deps com defaults — facilita o teste.
    var fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetchFn) throw new Error('[HBPlanEngine] no fetch implementation available');
    var sleep = deps.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var setIntervalFn = deps.setInterval || setInterval;
    var clearIntervalFn = deps.clearInterval || clearInterval;
    var interStepDelay = typeof deps.interStepDelay === 'number' ? deps.interStepDelay : 3000;

    var currentPlan = null;
    var isRunningAll = false;

    async function generate(goal) {
      var container = doc.getElementById('sp-tab-content');
      if (!container) return;
      container.innerHTML = templates.loading();
      var mi = 0;
      var msgInterval = setIntervalFn(function () {
        mi = (mi + 1) % LOADING_MESSAGES.length;
        var el = doc.getElementById('sp-plan-loading-msg');
        if (el) el.textContent = LOADING_MESSAGES[mi];
      }, 1800);
      try {
        var response = await fetchFn(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.6,
            max_tokens: 2048,
            stream: false,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: goal }
            ]
          })
        });
        clearIntervalFn(msgInterval);
        if (!response.ok) {
          var ed;
          try { ed = await response.json(); } catch (_) { ed = {}; }
          throw new Error(ed && ed.error && ed.error.message ? ed.error.message : 'Groq API error ' + response.status);
        }
        var data = await response.json();
        var raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        var steps = parsePlan(raw);
        if (!steps) throw new Error('Formato de resposta invalido. Tente novamente.');
        currentPlan = { goal: goal, steps: steps, executedIndexes: [] };
        storage.set(makeStorageObj(currentPlan));
        renderResult();
        updateBadge();
      } catch (err) {
        clearIntervalFn(msgInterval);
        console.error('[HBPlanEngine] generate error:', err);
        var safeMsg = escapeHtml(err && err.message ? err.message : String(err));
        container.innerHTML =
          '<div class="tab-panel active" style="animation:qlFadeIn .3s ease;text-align:center;padding:40px 16px;">' +
            '<div style="font-size:28px;margin-bottom:12px;">\u26a0\ufe0f</div>' +
            '<div style="font-size:13px;font-weight:800;color:var(--text-main);margin-bottom:6px;">Falha ao gerar plano</div>' +
            '<div style="font-size:11px;color:var(--text-sub);margin-bottom:20px;line-height:1.5;">' + safeMsg + '</div>' +
            '<button id="sp-plan-retry-btn" class="btn-send" style="width:100%;height:42px;font-size:12px;">Tentar novamente</button>' +
          '</div>';
        var retryBtn = doc.getElementById('sp-plan-retry-btn');
        if (retryBtn) retryBtn.addEventListener('click', function () { currentPlan = null; renderTab(); });
      }
    }

    function renderTab() {
      var container = doc.getElementById('sp-tab-content');
      if (!container) return;
      if (currentPlan && currentPlan.steps && currentPlan.steps.length > 0) {
        renderResult();
        return;
      }
      container.innerHTML = templates.idle();
      var btn = doc.getElementById('sp-plan-generate-btn');
      var input = doc.getElementById('sp-plan-input');
      if (btn) {
        btn.addEventListener('click', function () {
          var goal = input ? input.value.trim() : '';
          if (!goal) { showAlert('Atencao', 'Descreva seu objetivo antes de gerar o plano.'); return; }
          generate(goal);
        });
      }
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            var goal = input.value.trim();
            if (goal) generate(goal);
          }
        });
      }
    }

    function renderResult() {
      var container = doc.getElementById('sp-tab-content');
      if (!container || !currentPlan) return;
      container.innerHTML = templates.result(currentPlan.steps, currentPlan.goal);
      bindResultEvents();
      currentPlan.executedIndexes.forEach(function (idx) { markStepDone(idx); });
    }

    function bindResultEvents() {
      var sendBtns = doc.querySelectorAll('.sp-plan-send-btn');
      sendBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var prompt = btn.getAttribute('data-prompt');
          executeStep(idx, prompt, btn);
        });
      });
      var copyBtns = doc.querySelectorAll('.sp-plan-copy-btn');
      copyBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var prompt = btn.getAttribute('data-prompt');
          if (!navigator || !navigator.clipboard) return;
          navigator.clipboard.writeText(prompt).then(function () {
            btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00ffb4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(function () {
              btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
            }, 1500);
          }).catch(function () {});
        });
      });
      var runAllBtn = doc.getElementById('sp-plan-run-all-btn');
      if (runAllBtn) runAllBtn.addEventListener('click', function () { if (!isRunningAll) runAll(); });
      ['sp-plan-reset-btn', 'sp-plan-reset-btn2'].forEach(function (id) {
        var b = doc.getElementById(id);
        if (b) b.addEventListener('click', function () {
          currentPlan = null;
          storage.remove([STORAGE_KEY]);
          updateBadge();
          renderTab();
        });
      });
    }

    async function executeStep(idx, prompt, btnEl) {
      var card = doc.querySelector('.sp-plan-card[data-step-index="' + idx + '"]');
      var statusEl = doc.getElementById('sp-plan-status-' + idx);
      if (card) card.classList.add('sp-plan-sending');
      if (btnEl) { btnEl.disabled = true; btnEl.textContent = '\u26a1 Enviando...'; }
      if (statusEl) statusEl.textContent = '\u23f3';
      try {
        switchTab('prompt');
        await sleep(200);
        var msgInput = doc.getElementById('sp-msg');
        if (msgInput) {
          msgInput.value = prompt;
          try { msgInput.dispatchEvent(new Event('input')); } catch (_) {}
        }
        await handleSend();
        if (currentPlan && currentPlan.executedIndexes.indexOf(idx) === -1) {
          currentPlan.executedIndexes.push(idx);
          storage.set(makeStorageObj(currentPlan));
        }
        if (currentPlan && currentPlan.steps[idx]) currentPlan.steps[idx].done = true;
        await sleep(600);
        switchTab('plan');
      } catch (err) {
        console.error('[HBPlanEngine] executeStep error:', err);
        switchTab('plan');
        showAlert('Erro', 'Falha ao executar etapa: ' + (err && err.message ? err.message : ''));
        if (card) card.classList.remove('sp-plan-sending');
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Executar Etapa'; }
        if (statusEl) statusEl.textContent = '\u274c';
      }
    }

    function markStepDone(idx) {
      var card = doc.querySelector('.sp-plan-card[data-step-index="' + idx + '"]');
      var statusEl = doc.getElementById('sp-plan-status-' + idx);
      var btn = doc.querySelector('.sp-plan-send-btn[data-idx="' + idx + '"]');
      if (card) { card.classList.remove('sp-plan-sending'); card.classList.add('sp-plan-done'); }
      if (statusEl) statusEl.textContent = '\u2705';
      if (btn) {
        btn.textContent = '\u2705 Enviado';
        btn.style.background = 'rgba(0,255,180,0.15)';
        btn.style.color = '#00ffb4';
        btn.style.border = '1px solid rgba(0,255,180,0.3)';
      }
    }

    async function runAll() {
      if (!currentPlan) return;
      isRunningAll = true;
      var runAllBtn = doc.getElementById('sp-plan-run-all-btn');
      if (runAllBtn) { runAllBtn.classList.add('sp-running'); runAllBtn.textContent = '\u23f3 Executando...'; runAllBtn.disabled = true; }
      var pendingSteps = currentPlan.steps
        .map(function (s, i) { return { idx: i, prompt: s.prompt, done: currentPlan.executedIndexes.indexOf(i) !== -1 }; })
        .filter(function (s) { return !s.done; });
      for (var si = 0; si < pendingSteps.length; si++) {
        var step = pendingSteps[si];
        var btn = doc.querySelector('.sp-plan-send-btn[data-idx="' + step.idx + '"]');
        await executeStep(step.idx, step.prompt, btn);
        if (si < pendingSteps.length - 1) await sleep(interStepDelay);
      }
      isRunningAll = false;
      var rb = doc.getElementById('sp-plan-run-all-btn');
      if (rb) { rb.classList.remove('sp-running'); rb.textContent = '\u2705 Todas as etapas concluidas!'; }
    }

    function updateBadge() {
      var badge = doc.getElementById('sp-plan-badge');
      if (badge) badge.style.display = (currentPlan && currentPlan.steps && currentPlan.steps.length > 0) ? 'block' : 'none';
    }

    function loadFromStorage(cb) {
      storage.get([STORAGE_KEY], function (res) {
        if (res && res[STORAGE_KEY] && res[STORAGE_KEY].steps && res[STORAGE_KEY].steps.length > 0) {
          currentPlan = res[STORAGE_KEY];
        }
        if (cb) cb();
      });
    }

    function makeStorageObj(plan) {
      var o = {};
      o[STORAGE_KEY] = plan;
      return o;
    }

    return {
      renderTab: renderTab,
      loadFromStorage: loadFromStorage,
      updateBadge: updateBadge,
      // Exposto para tests / debug — não usado pelo sidepanel.
      _internal: { parsePlan: parsePlan, getCurrent: function () { return currentPlan; } }
    };
  }

  root.HBPlanEngine = { create: create, parsePlan: parsePlan, STORAGE_KEY: 'ql_plan_current' };
})(typeof window !== 'undefined' ? window : globalThis);