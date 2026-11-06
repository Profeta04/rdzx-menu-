



(function () {
  'use strict';

  var _NS  = 'HyperCustomize';
  var _KEY = 'hb_customize_v1';

  var _DEFAULTS = {
    accentColor:      '#bf00ff',
    cyan:             '#00fff7',
    pink:             '#ff0099',
    glowIntensity:    0.7,
    cardTransparency: 0.85,
    borderRadius:     '1.1rem',
    rgbSpeed:         4,
    userCardBg:       null,
    avatarImg:        null,
    textOnImage:      'auto',
    gradientStart:    '#0f0028',
    gradientEnd:      '#020009',
    blurAmount:       28,
    shadowBlur:       20
  };

  var _PRESETS = {
    original: {
      label: 'HyperBuild Original',
      accentColor: '#bf00ff',
      cyan: '#00fff7',
      pink: '#ff0099',
      glowIntensity: 0.78,
      cardTransparency: 0.86,
      borderRadius: '1.1rem',
      rgbSpeed: 4,
      textOnImage: 'auto',
      gradientStart: '#0f0028',
      gradientEnd: '#020009',
      blurAmount: 28,
      shadowBlur: 22
    },
    redBlack: {
      label: 'Vermelho e Preto',
      accentColor: '#ff174d',
      cyan: '#ff6b35',
      pink: '#ff003c',
      glowIntensity: 0.82,
      cardTransparency: 0.9,
      borderRadius: '1.1rem',
      rgbSpeed: 3.5,
      textOnImage: 'auto',
      gradientStart: '#190007',
      gradientEnd: '#030103',
      blurAmount: 30,
      shadowBlur: 26
    },
    goldBlack: {
      label: 'Preto Moderno com Dourado',
      accentColor: '#f6c453',
      cyan: '#ffe6a7',
      pink: '#b8892f',
      glowIntensity: 0.72,
      cardTransparency: 0.88,
      borderRadius: '1.1rem',
      rgbSpeed: 5,
      textOnImage: 'auto',
      gradientStart: '#12100a',
      gradientEnd: '#020202',
      blurAmount: 30,
      shadowBlur: 24
    },
    grayPremium: {
      label: 'Cinza Fade Premium',
      accentColor: '#c7d2fe',
      cyan: '#94a3b8',
      pink: '#f8fafc',
      glowIntensity: 0.55,
      cardTransparency: 0.84,
      borderRadius: '1.1rem',
      rgbSpeed: 5.5,
      textOnImage: 'auto',
      gradientStart: '#22242c',
      gradientEnd: '#050609',
      blurAmount: 32,
      shadowBlur: 22
    }
  };

  var _cfg       = Object.assign({}, _DEFAULTS);
  var _panelOpen = false;
  var _panelEl   = null;
  var _obs       = null;
  var _storageBound = false;
  var _AVATAR_KEY = 'ql_avatar';
  var _OPEN_REQ_KEY = 'hb_open_customize_request';

  var _SVGS = {
    palette: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    image: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    user: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    sparkles: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
    rainbow: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17a10 10 0 0 0-20 0"/><path d="M18 17a6 6 0 0 0-12 0"/><path d="M14 17a2 2 0 0 0-4 0"/></svg>',
    layers: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.27a1 1 0 0 0 0 1.83l8.58 4.09a2 2 0 0 0 1.66 0l8.57-4.09a1 1 0 0 0 0-1.83Z"/><path d="m2 12 10 4.76L22 12"/><path d="m2 16 10 4.76L22 16"/></svg>',
  };

  function _clamp(v, min, max) {
    v = Number(v);
    if (!isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function _hex(value, fallback) {
    var raw = String(value || fallback || '#000000').trim();
    if (raw.charAt(0) !== '#') raw = '#' + raw;
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      raw = '#' + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2) + raw.charAt(3) + raw.charAt(3);
    }
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : String(fallback || '#000000').toLowerCase();
  }

  function _rgb(value, fallback) {
    var h = _hex(value, fallback).slice(1);
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function _rgbStr(value, fallback) {
    var c = _rgb(value, fallback);
    return c.r + ', ' + c.g + ', ' + c.b;
  }

  function _rgba(value, alpha, fallback) {
    var c = _rgb(value, fallback);
    return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + _clamp(alpha, 0, 1) + ')';
  }

  function _mix(a, b, weight) {
    var ca = _rgb(a, '#000000');
    var cb = _rgb(b, '#000000');
    var w = _clamp(weight, 0, 1);
    var r = Math.round(ca.r * (1 - w) + cb.r * w);
    var g = Math.round(ca.g * (1 - w) + cb.g * w);
    var bl = Math.round(ca.b * (1 - w) + cb.b * w);
    return '#' + [r, g, bl].map(function (x) {
      var s = x.toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function _userCards() {
    return [
      document.getElementById('sp-user-card'),
      document.getElementById('ql-user-card-inner')
    ].filter(Boolean);
  }

  function _avatarEls() {
    return [
      document.getElementById('sp-avatar'),
      document.getElementById('ql-avatar-inner')
    ].filter(Boolean);
  }

  function _bgUrl(value) {
    if (!value) return '';
    return 'url(' + JSON.stringify(String(value)) + ')';
  }

  function _themePatch(patch) {
    var src = Object.assign({}, _DEFAULTS, _cfg || {}, patch || {});
    return Object.assign({}, src, {
      accentColor: _hex(src.accentColor, _DEFAULTS.accentColor),
      cyan: _hex(src.cyan, _DEFAULTS.cyan),
      pink: _hex(src.pink, _DEFAULTS.pink),
      gradientStart: _hex(src.gradientStart, _DEFAULTS.gradientStart),
      gradientEnd: _hex(src.gradientEnd, _DEFAULTS.gradientEnd),
      glowIntensity: _clamp(src.glowIntensity, 0, 1),
      cardTransparency: _clamp(src.cardTransparency, 0.4, 1),
      blurAmount: _clamp(src.blurAmount, 8, 60),
      shadowBlur: _clamp(src.shadowBlur, 4, 60),
      rgbSpeed: _clamp(src.rgbSpeed, 1, 12)
    });
  }

  
  var Store = {
    load: function (cb) {
      try {
        chrome.storage.local.get([_KEY, _AVATAR_KEY], function (r) {
          var saved = (r && r[_KEY]) ? _themePatch(r[_KEY]) : _themePatch(_DEFAULTS);
          var qlAvatar = (r && r[_AVATAR_KEY]) ? String(r[_AVATAR_KEY]) : null;
          if (!saved.avatarImg && qlAvatar) saved.avatarImg = qlAvatar;
          _cfg = _themePatch(saved);
          try {
            if (_cfg.avatarImg) chrome.storage.local.set({ [_AVATAR_KEY]: _cfg.avatarImg });
            else if (qlAvatar) chrome.storage.local.remove([_AVATAR_KEY]);
          } catch (e) {}
          cb && cb();
        });
      } catch (e) { cb && cb(); }
    },
    save: function (patch) {
      _cfg = _themePatch(patch);
      try {
        chrome.storage.local.set({ [_KEY]: _cfg });
        if (_cfg.avatarImg) chrome.storage.local.set({ [_AVATAR_KEY]: _cfg.avatarImg });
        else chrome.storage.local.remove([_AVATAR_KEY]);
      } catch (e) {}
    },
    reset: function () {
      _cfg = _themePatch(_DEFAULTS);
      try { chrome.storage.local.remove([_KEY]); } catch (e) {}
    }
  };

  
  var Detect = {
    run: function (b64, cb) {
      if (!b64) { cb('dark'); return; }
      try {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = c.height = 40;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, 40, 40);
          var d = ctx.getImageData(0, 0, 40, 40).data;
          var t = 0, n = 0;
          for (var i = 0; i < d.length; i += 4) {
            t += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            n++;
          }
          cb(n && (t / n) > 128 ? 'light' : 'dark');
        };
        img.onerror = function () { cb('dark'); };
        img.src = b64;
      } catch (e) { cb('dark'); }
    }
  };

  
  var Apply = {
    vars: function () {
      var r = document.documentElement;
      var accent = _hex(_cfg.accentColor, _DEFAULTS.accentColor);
      var cyan = _hex(_cfg.cyan, _DEFAULTS.cyan);
      var pink = _hex(_cfg.pink, _DEFAULTS.pink);
      var gradStart = _hex(_cfg.gradientStart, _DEFAULTS.gradientStart);
      var gradEnd = _hex(_cfg.gradientEnd, _DEFAULTS.gradientEnd);
      var purple = _mix(accent, '#000000', 0.28);
      var gi = _clamp(_cfg.glowIntensity, 0, 1);
      var alpha = _clamp(_cfg.cardTransparency, 0.4, 1);
      var accentRgb = _rgbStr(accent);
      var cyanRgb = _rgbStr(cyan);
      var pinkRgb = _rgbStr(pink);
      var surfaceRgb = _rgbStr(gradStart);
      var darkRgb = _rgbStr(gradEnd);
      var cardBg = 'rgba(' + surfaceRgb + ', ' + alpha + ')';
      var cardBgSoft = 'rgba(' + surfaceRgb + ', ' + Math.max(0.44, alpha - 0.16).toFixed(2) + ')';
      var glow = 'rgba(' + accentRgb + ', ' + (gi * 0.24).toFixed(3) + ')';
      var glowStrong = 'rgba(' + accentRgb + ', ' + (gi * 0.58).toFixed(3) + ')';
      var border = 'rgba(' + accentRgb + ', ' + (gi * 0.42).toFixed(3) + ')';
      var borderSoft = 'rgba(' + accentRgb + ', ' + (gi * 0.20).toFixed(3) + ')';
      var rgbGradient = 'linear-gradient(110deg, #fff 0%, ' + accent + ' 28%, ' + pink + ' 54%, ' + cyan + ' 78%, ' + accent + ' 100%)';
      var conic = 'conic-gradient(from var(--border-angle), ' + accent + ' 0%, ' + pink + ' 22%, ' + cyan + ' 44%, ' + purple + ' 66%, ' + pink + ' 88%, ' + accent + ' 100%)';

      r.style.setProperty('--hb-accent', accent);
      r.style.setProperty('--hb-accent-rgb', accentRgb);
      r.style.setProperty('--hb-secondary', cyan);
      r.style.setProperty('--hb-secondary-rgb', cyanRgb);
      r.style.setProperty('--hb-tertiary', pink);
      r.style.setProperty('--hb-tertiary-rgb', pinkRgb);
      r.style.setProperty('--hb-purple', purple);
      r.style.setProperty('--hb-gradient-start', gradStart);
      r.style.setProperty('--hb-gradient-end', gradEnd);
      r.style.setProperty('--hb-surface-rgb', surfaceRgb);
      r.style.setProperty('--hb-dark-rgb', darkRgb);
      r.style.setProperty('--hb-card-alpha', alpha);
      r.style.setProperty('--hb-card-bg', cardBg);
      r.style.setProperty('--hb-card-bg-soft', cardBgSoft);
      r.style.setProperty('--hb-glow', glow);
      r.style.setProperty('--hb-glow-strong', glowStrong);
      r.style.setProperty('--hb-border', border);
      r.style.setProperty('--hb-border-soft', borderSoft);
      r.style.setProperty('--hb-gradient', 'linear-gradient(145deg, ' + gradStart + ' 0%, ' + gradEnd + ' 100%)');
      r.style.setProperty('--hb-rgb-gradient', rgbGradient);
      r.style.setProperty('--hb-rgb-conic', conic);
      r.style.setProperty('--hb-rgb-conic-ql', conic);
      r.style.setProperty('--hb-card-image-overlay',
        'linear-gradient(135deg, rgba(' + darkRgb + ', .18), rgba(' + accentRgb + ', .14)), linear-gradient(180deg, rgba(0,0,0,.04) 0%, rgba(0,0,0,.36) 100%)'
      );

      r.style.setProperty('--neon-purple', accent);
      r.style.setProperty('--accent', accent);
      r.style.setProperty('--cyan', cyan);
      r.style.setProperty('--pink', pink);
      r.style.setProperty('--purple', purple);
      r.style.setProperty('--gold', accent);
      r.style.setProperty('--dark', gradEnd);
      r.style.setProperty('--dark-rgb', darkRgb);
      r.style.setProperty('--card-bg', cardBg);
      r.style.setProperty('--border', borderSoft);
      r.style.setProperty('--accent-glow', glow);
      r.style.setProperty('--accent-border', border);
      r.style.setProperty('--blur-amount', _cfg.blurAmount + 'px');
      r.style.setProperty('--card-radius', _cfg.borderRadius);
      r.style.setProperty('--shadow-blur', _cfg.shadowBlur + 'px');
      r.style.setProperty('--hb-rgb-dur', _cfg.rgbSpeed + 's');
      r.style.setProperty('--ql-primary', accent);
      r.style.setProperty('--ql-primary-glow', glow);
      r.style.setProperty('--ql-primary-border', border);
      r.style.setProperty('--ql-secondary', cyan);
      r.style.setProperty('--ql-tertiary', pink);
      r.style.setProperty('--ql-text-sub', 'var(--text-sub)');

      
      Apply._patchRgbSpin();
    },

    _patchRgbSpin: function () {
      var sid = 'hb-rgb-speed-style';
      var el  = document.getElementById(sid);
      if (!el) { el = document.createElement('style'); el.id = sid; document.head.appendChild(el); }
      el.textContent = [
        '[data-theme="dark"] .user-card .rgb-border{animation-duration:' + _cfg.rgbSpeed + 's!important;}',
        '.ql-dark .ql-rgb-border{animation-duration:' + _cfg.rgbSpeed + 's!important;}'
      ].join('\n');
    },

    cardBg: function () {
      var cards = _userCards();
      if (!cards.length) return;

      cards.forEach(function (card) {
      var prev = card.querySelector('.hb-bg-overlay');
      if (prev) prev.remove();

      if (_cfg.userCardBg) {
        card.setAttribute('data-has-bg', '1');
        card.style.backgroundImage = 'var(--hb-card-image-overlay), ' + _bgUrl(_cfg.userCardBg);
        card.style.backgroundSize     = 'cover';
        card.style.backgroundPosition = 'center';
        card.style.backgroundRepeat   = 'no-repeat';
        card.style.backgroundColor    = 'var(--hb-card-bg)';
        card.style.imageRendering = 'high-quality';

        var ov = document.createElement('div');
        ov.className = 'hb-bg-overlay';
        ov.style.cssText = 'position:absolute;inset:0;border-radius:inherit;background:var(--hb-card-image-overlay);pointer-events:none;z-index:0;';
        card.insertBefore(ov, card.firstChild);

        
        Array.from(card.children).forEach(function (ch) {
          var cls = ch.className || '';
          if (cls.indexOf('rgb-border') === -1 && cls.indexOf('hb-bg-overlay') === -1 && cls.indexOf('ql-rgb-border') === -1) {
            ch.style.position = 'relative';
            ch.style.zIndex   = '2';
          }
        });

        card.style.overflow = 'hidden';
        if (_cfg.textOnImage === 'auto') {
          Detect.run(_cfg.userCardBg, function (m) { Apply._contrast(card, m); });
        } else {
          Apply._contrast(card, _cfg.textOnImage);
        }
      } else {
        card.style.overflow = 'visible';
        card.removeAttribute('data-has-bg');
        card.style.backgroundImage    = '';
        card.style.backgroundSize     = '';
        card.style.backgroundPosition = '';
        card.style.backgroundRepeat   = '';
        card.style.backgroundColor    = '';
        card.style.imageRendering     = '';
        Array.from(card.children).forEach(function (ch) {
          var cls = ch.className || '';
          if (cls.indexOf('rgb-border') === -1 && cls.indexOf('hb-bg-overlay') === -1 && cls.indexOf('ql-rgb-border') === -1) {
            ch.style.position = '';
            ch.style.zIndex   = '';
          }
        });
        Apply._contrast(card, 'dark');
      }
      });
    },

    _contrast: function (card, mode) {
      var name = card.querySelector('.user-name-rgb, .user-name, .ql-user-name-text');
      var exp  = card.querySelector('.user-expiry, #ql-expires-date');
      var badge = card.querySelector('.sp-status-badge, .ql-status-badge');
      if (mode === 'light') {
        if (name)  { name.style.webkitTextFillColor = '#111'; name.style.backgroundImage = 'none'; }
        if (exp)   { exp.style.color = '#333'; exp.style.textShadow = 'none'; }
        if (badge) badge.style.color = '#333';
      } else {
        if (name)  { name.style.webkitTextFillColor = ''; name.style.backgroundImage = ''; }
        if (exp)   { exp.style.color = ''; exp.style.textShadow = ''; }
        if (badge) badge.style.color = '';
      }
    },

    avatar: function () {
      var avatars = _avatarEls();
      if (!avatars.length) return;
      var svg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      avatars.forEach(function (av) {
        if (_cfg.avatarImg) {
          av.innerHTML = '<img src="' + _cfg.avatarImg + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">';
          av.dataset.hbAvatar = '1';
        } else if (av.dataset.hbAvatar === '1') {
          delete av.dataset.hbAvatar;
          av.innerHTML = svg;
        }
      });
    },

    all: function () {
      Apply.vars();
      Apply.cardBg();
      Apply.avatar();
    }
  };

  
  function _processImg(file, maxPx, cb) {
    var rd = new FileReader();
    rd.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        var W = Math.round(img.width * ratio);
        var H = Math.round(img.height * ratio);
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        var ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, W, H);
        cb(cv.toDataURL('image/jpeg', 0.94));
      };
      img.onerror = function () {};
      img.src = ev.target.result;
    };
    rd.readAsDataURL(file);
  }

  
  var Panel = {
    _timer: null,

    open: function () {
      if (_panelOpen) return;
      _panelOpen = true;
      Panel._build();
    },

    close: function () {
      if (_panelEl) {
        _panelEl.style.animation = 'hbOut .18s ease-in forwards';
        var el = _panelEl;
        setTimeout(function () { el && el.remove(); }, 200);
        _panelEl = null;
      }
      _panelOpen = false;
    },

    _build: function () {
      var el = document.createElement('div');
      el.id  = 'hb-customize-panel';
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483640;background:rgba(4,0,15,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#f0e8ff;animation:hbIn .22s ease-out;overflow:hidden;';
      el.innerHTML = Panel._html();
      document.body.appendChild(el);
      _panelEl = el;
      Panel._restore();
      Panel._bind();
      Panel._preview();

      
      Apply.avatar();
    },

    _html: function () {
      return (
        
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid rgba(191,0,255,0.15);flex-shrink:0;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#bf00ff,#7c00e0);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="#fff"/><circle cx="17.5" cy="10.5" r=".5" fill="#fff"/><circle cx="8.5" cy="7.5" r=".5" fill="#fff"/><circle cx="6.5" cy="12.5" r=".5" fill="#fff"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>' +
            '</div>' +
            '<div><div style="font-size:13px;font-weight:800;color:#fff;">Personalização Visual</div><div style="font-size:10px;color:rgba(191,0,255,0.9);font-weight:700;text-transform:uppercase;letter-spacing:.09em;">HyperBuild</div></div>' +
          '</div>' +
          '<button id="hb-close" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(191,0,255,0.25);background:rgba(191,0,255,0.08);color:#bf00ff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +

        
        '<div style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:11px;">' +

          
          '<div style="position:relative;border-radius:1.1rem;overflow:hidden;flex-shrink:0;">' +
            '<div id="hb-prev-rgb" style="position:absolute;inset:-2px;border-radius:calc(1.1rem + 2px);background:linear-gradient(90deg,#bf00ff,#00fff7,#ff0099,#bf00ff);background-size:300%;animation:hbRgb 3s linear infinite;z-index:0;pointer-events:none;"></div>' +
            '<div id="hb-prev-card" style="position:relative;z-index:1;border-radius:1.1rem;padding:13px 14px;display:flex;align-items:center;gap:11px;background:rgba(15,0,40,0.92);margin:2px;">' +
              '<div id="hb-prev-av" style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,rgba(191,0,255,.3),rgba(124,0,224,.2));border:2px solid rgba(191,0,255,.4);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">' +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(191,0,255,.8)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
              '</div>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:800;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Pré-visualização</div>' +
                '<div style="font-size:10px;color:rgba(0,255,247,.85);margin-top:1px;">Expira em: 02/04/2126</div>' +
              '</div>' +
              '<div style="padding:3px 9px;border-radius:20px;background:rgba(191,0,255,.15);border:1px solid rgba(191,0,255,.3);font-size:10px;font-weight:700;color:#bf00ff;flex-shrink:0;">● Ativo</div>' +
            '</div>' +
          '</div>' +

          
          Panel._box(_SVGS.palette + ' Cores',
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">' +
              Panel._color('hb-c-accent', 'Principal',  _cfg.accentColor) +
              Panel._color('hb-c-cyan',   'Secundária', _cfg.cyan) +
              Panel._color('hb-c-pink',   'Terciária',  _cfg.pink) +
            '</div>'
          ) +

          
          Panel._box(_SVGS.image + ' Fundo do Card',
            Panel._fileLabel('hb-bg-file', 'hb-bg-lbl', 'Escolher Imagem de Fundo') +
            '<input type="file" id="hb-bg-file" accept="image/*" style="display:none;">' +
            '<div id="hb-bg-prev" style="display:none;margin-top:8px;position:relative;">' +
              '<img id="hb-bg-thumb" style="width:100%;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(191,0,255,.2);" alt="">' +
              '<button id="hb-bg-clr" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:5px;border:none;background:rgba(0,0,0,.75);color:#fff;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;">✕</button>' +
            '</div>' +
            Panel._sel('hb-textmode', 'Contraste do Texto', [
              {v:'auto',  l:'Automático'},
              {v:'dark',  l:'Claro (fundo escuro)'},
              {v:'light', l:'Escuro (fundo claro)'}
            ], _cfg.textOnImage)
          ) +

          
          Panel._box(_SVGS.user + ' Avatar',
            Panel._fileLabel('hb-av-file', 'hb-av-lbl', 'Escolher Avatar') +
            '<input type="file" id="hb-av-file" accept="image/*" style="display:none;">' +
            '<div id="hb-av-prev" style="display:none;margin-top:8px;align-items:center;gap:10px;">' +
              '<img id="hb-av-thumb" style="width:50px;height:50px;object-fit:cover;border-radius:50%;border:2px solid rgba(191,0,255,.5);" alt="">' +
              '<button id="hb-av-clr" style="padding:5px 11px;border-radius:7px;border:1px solid rgba(255,80,80,.3);background:rgba(255,50,50,.06);color:rgba(255,130,130,.95);font-size:11px;font-weight:700;cursor:pointer;">Remover</button>' +
            '</div>'
          ) +

          
          Panel._box(_SVGS.sparkles + ' Glow & Brilho',
            Panel._range('hb-glow',   'Intensidade do Glow',  0,  1,  .01, _cfg.glowIntensity) +
            Panel._range('hb-blur',   'Blur de Fundo (px)',    8, 60,  1,  _cfg.blurAmount) +
            Panel._range('hb-shadow', 'Sombra (px)',           4, 60,  1,  _cfg.shadowBlur)
          ) +

          
          Panel._box(_SVGS.rainbow + ' RGB & Animação',
            Panel._range('hb-rgbspd', 'Velocidade RGB (seg/ciclo)', 1, 12, .5, _cfg.rgbSpeed) +
            Panel._range('hb-transp', 'Transparência do Card',  .4,  1, .01, _cfg.cardTransparency) +
            Panel._sel('hb-brad', 'Arredondamento das Bordas', [
              {v:'.5rem',  l:'Pequeno'},
              {v:'1.1rem', l:'Médio (padrão)'},
              {v:'1.5rem', l:'Grande'},
              {v:'2rem',   l:'Extra Grande'}
            ], _cfg.borderRadius)
          ) +

          
          Panel._box(_SVGS.layers + ' Fundo Global',
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              Panel._color('hb-c-gs', 'Início Gradiente', _cfg.gradientStart) +
              Panel._color('hb-c-ge', 'Fim Gradiente',    _cfg.gradientEnd) +
            '</div>'
          ) +

          Panel._box('Modelos Prontos',
            '<div class="hb-preset-grid" style="display:grid;grid-template-columns:1fr;gap:8px;">' +
              Panel._preset('original', 'HyperBuild Original') +
              Panel._preset('redBlack', 'Vermelho e Preto') +
              Panel._preset('goldBlack', 'Preto Moderno com Dourado') +
              Panel._preset('grayPremium', 'Cinza Fade Premium') +
            '</div>'
          ) +

        '</div>' +

        
        '<div style="padding:12px 16px;border-top:1px solid rgba(191,0,255,.12);display:flex;gap:8px;flex-shrink:0;">' +
          '<button id="hb-reset" style="flex:0 0 auto;padding:10px 14px;border-radius:9px;border:1px solid rgba(255,80,80,.3);background:rgba(255,50,50,.06);color:rgba(255,130,130,.95);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;">↺ Reset</button>' +
          '<button id="hb-apply" style="flex:1;padding:10px;border-radius:9px;border:none;background:linear-gradient(135deg,#bf00ff,#7c00e0);color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(191,0,255,.35);transition:all .2s;">✓ Aplicar</button>' +
        '</div>'
      );
    },

    _box: function (title, content) {
      return '<div class="hb-custom-box" style="background:rgba(255,255,255,.025);border:1px solid var(--hb-border-soft);border-radius:10px;padding:12px;"><div style="font-size:10px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">' + title + '</div>' + content + '</div>';
    },

    _preset: function (key, label) {
      var p = _PRESETS[key] || {};
      var swatches = [p.accentColor || _DEFAULTS.accentColor, p.cyan || _DEFAULTS.cyan, p.pink || _DEFAULTS.pink];
      return '<button type="button" class="hb-preset-btn" data-preset="' + key + '" style="width:100%;min-height:42px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#fff;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;transition:all .2s;margin-bottom:4px;">' +
        '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;flex:1;">' + label + '</span>' +
        '<span style="display:flex;gap:5px;flex-shrink:0;">' +
          swatches.map(function (c) { return '<i style="width:16px;height:16px;border-radius:50%;background:' + c + ';border:1.5px solid rgba(255,255,255,0.2);box-shadow:0 0 8px rgba(0,0,0,0.5);"></i>'; }).join('') +
        '</span>' +
      '</button>';
    },

    _color: function (id, label, val) {
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;"><input type="color" id="' + id + '" value="' + val + '" style="width:100%;height:34px;border-radius:7px;border:1.5px solid rgba(191,0,255,.2);background:transparent;cursor:pointer;padding:2px;" title="' + label + '"><span style="font-size:10px;color:rgba(255,255,255,.45);font-weight:600;text-align:center;">' + label + '</span></div>';
    },

    _range: function (id, label, min, max, step, val) {
      return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><span style="font-size:11px;color:rgba(255,255,255,.6);font-weight:600;">' + label + '</span><span id="' + id + '-v" style="font-size:11px;color:rgba(191,0,255,.9);font-weight:700;min-width:30px;text-align:right;">' + val + '</span></div><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" style="-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;background:rgba(191,0,255,.2);outline:none;cursor:pointer;"></div>';
    },

    _sel: function (id, label, opts, sel) {
      var o = opts.map(function (x) { return '<option value="' + x.v + '"' + (x.v === sel ? ' selected' : '') + '>' + x.l + '</option>'; }).join('');
      return '<div style="margin-top:8px;"><div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:600;margin-bottom:5px;">' + label + '</div><select id="' + id + '" style="width:100%;background:rgba(8,0,25,.95);color:#e8e8ec;border:1px solid rgba(191,0,255,.2);border-radius:8px;padding:8px 10px;font-size:12px;font-weight:600;cursor:pointer;outline:none;-webkit-appearance:none;appearance:none;">' + o + '</select></div>';
    },

    _fileLabel: function (forId, id, text) {
      return '<label id="' + id + '" for="' + forId + '" style="display:flex;align-items:center;justify-content:center;gap:8px;height:40px;border-radius:9px;border:1.5px dashed rgba(191,0,255,.35);background:rgba(191,0,255,.05);cursor:pointer;font-size:12px;color:rgba(255,255,255,.6);font-weight:600;transition:all .2s;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' + text + '</label>';
    },

    _restore: function () {
      if (!_panelEl) return;
      var p = _panelEl;
      if (_cfg.userCardBg) {
        var pr = p.querySelector('#hb-bg-prev'), th = p.querySelector('#hb-bg-thumb');
        if (pr && th) { th.src = _cfg.userCardBg; pr.style.display = 'block'; }
      }
      if (_cfg.avatarImg) {
        var ap = p.querySelector('#hb-av-prev'), at = p.querySelector('#hb-av-thumb');
        if (ap && at) { at.src = _cfg.avatarImg; ap.style.display = 'flex'; }
      }
    },

    _bind: function () {
      if (!_panelEl) return;
      var p = _panelEl;
      var g = function (id) { return p.querySelector('#' + id); };

      g('hb-close').addEventListener('click', Panel.close);

      g('hb-apply').addEventListener('click', function () {
        Panel._collect();
        Apply.all();
        Panel.close();
      });

      g('hb-reset').addEventListener('click', function () {
        if (!confirm('Resetar todas as personalizações?')) return;
        Store.reset();
        Apply.all();
        Panel.close();
      });

      
      p.querySelectorAll('input[type=range]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var v = g(inp.id + '-v');
          if (v) v.textContent = parseFloat(inp.value);
          Panel._schedPrev();
        });
      });

      
      p.querySelectorAll('input[type=color]').forEach(function (inp) {
        inp.addEventListener('input', Panel._schedPrev);
      });

      
      p.querySelectorAll('select').forEach(function (s) {
        s.addEventListener('change', Panel._schedPrev);
      });

      p.querySelectorAll('.hb-preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Panel._applyPreset(btn.getAttribute('data-preset'));
        });
      });

      
      g('hb-bg-file').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        _processImg(f, 1600, function (d) {
          _cfg.userCardBg = d;
          var pr = g('hb-bg-prev'), th = g('hb-bg-thumb');
          if (pr && th) { th.src = d; pr.style.display = 'block'; }
          Panel._preview();
        });
      });
      g('hb-bg-clr').addEventListener('click', function () {
        _cfg.userCardBg = null;
        g('hb-bg-prev').style.display = 'none';
        g('hb-bg-file').value = '';
        Panel._preview();
      });

      
      g('hb-av-file').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        _processImg(f, 160, function (d) {
          _cfg.avatarImg = d;
          try { chrome.storage.local.set({ ql_avatar: d }); } catch (e) {}
          var ap = g('hb-av-prev'), at = g('hb-av-thumb');
          if (ap && at) { at.src = d; ap.style.display = 'flex'; }
          Panel._preview();
        });
      });
      g('hb-av-clr').addEventListener('click', function () {
        _cfg.avatarImg = null;
        g('hb-av-prev').style.display = 'none';
        g('hb-av-file').value = '';
        try { chrome.storage.local.remove(['ql_avatar']); } catch (e) {}
        Panel._preview();
      });

      
      ['hb-bg-lbl', 'hb-av-lbl'].forEach(function (id) {
        var el = g(id);
        if (!el) return;
        el.addEventListener('mouseenter', function () {
          el.style.borderColor = 'var(--hb-border)';
          el.style.background  = 'var(--hb-glow)';
        });
        el.addEventListener('mouseleave', function () {
          el.style.borderColor = 'var(--hb-border-soft)';
          el.style.background  = 'rgba(var(--hb-accent-rgb), .05)';
        });
      });

      
      function onEsc(e) {
        if (e.key === 'Escape') { Panel.close(); document.removeEventListener('keydown', onEsc); }
      }
      document.addEventListener('keydown', onEsc);
    },

    _schedPrev: function () {
      if (Panel._timer) cancelAnimationFrame(Panel._timer);
      Panel._timer = requestAnimationFrame(function () {
        Panel._timer = null;
        Panel._preview();
      });
    },

    _readForm: function () {
      if (!_panelEl) return;
      var p  = _panelEl;
      var gv = function (id) { var e = p.querySelector('#' + id); return e ? e.value : null; };
      var gf = function (id) { var v = gv(id); return v !== null ? parseFloat(v) : null; };
      var fv = function (a, b) { return a != null && !isNaN(a) ? a : b; };

      return {
        accentColor:      gv('hb-c-accent') || _cfg.accentColor,
        cyan:             gv('hb-c-cyan')   || _cfg.cyan,
        pink:             gv('hb-c-pink')   || _cfg.pink,
        glowIntensity:    fv(gf('hb-glow'),   _cfg.glowIntensity),
        blurAmount:       fv(gf('hb-blur'),   _cfg.blurAmount),
        shadowBlur:       fv(gf('hb-shadow'), _cfg.shadowBlur),
        rgbSpeed:         fv(gf('hb-rgbspd'), _cfg.rgbSpeed),
        cardTransparency: fv(gf('hb-transp'), _cfg.cardTransparency),
        borderRadius:     gv('hb-brad')     || _cfg.borderRadius,
        textOnImage:      gv('hb-textmode') || _cfg.textOnImage,
        gradientStart:    gv('hb-c-gs')     || _cfg.gradientStart,
        gradientEnd:      gv('hb-c-ge')     || _cfg.gradientEnd,
        userCardBg:       _cfg.userCardBg,
        avatarImg:        _cfg.avatarImg
      };
    },

    _preview: function () {
      if (!_panelEl) return;
      var patch = Panel._readForm();
      if (patch) {
        Store.save(patch);
        Apply.all();
      }

      var p  = _panelEl;
      var gv = function (id) { var e = p.querySelector('#' + id); return e ? e.value : null; };

      var accent = gv('hb-c-accent') || _cfg.accentColor;
      var cyan   = gv('hb-c-cyan')   || _cfg.cyan;
      var pink   = gv('hb-c-pink')   || _cfg.pink;
      var spd    = parseFloat(gv('hb-rgbspd') || _cfg.rgbSpeed);
      var br     = gv('hb-brad')     || _cfg.borderRadius;

      var pc = p.querySelector('#hb-prev-card');
      if (pc) {
        pc.style.borderRadius = br;
        if (_cfg.userCardBg) {
          pc.style.backgroundImage = 'var(--hb-card-image-overlay), ' + _bgUrl(_cfg.userCardBg);
          pc.style.backgroundSize = 'cover';
          pc.style.backgroundPosition = 'center';
        } else {
          pc.style.backgroundImage = '';
          pc.style.background      = 'var(--hb-card-bg)';
        }
      }
      var rgb = p.querySelector('#hb-prev-rgb');
      if (rgb) {
        rgb.style.background       = 'linear-gradient(90deg,' + accent + ',' + cyan + ',' + pink + ',' + accent + ')';
        rgb.style.backgroundSize   = '300%';
        rgb.style.animationDuration = spd + 's';
      }
      var av = p.querySelector('#hb-prev-av');
      if (av && _cfg.avatarImg) {
        av.innerHTML = '<img src="' + _cfg.avatarImg + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
      } else if (av) {
        av.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(191,0,255,.8)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      }
    },

    _collect: function () {
      if (!_panelEl) return;
      var patch = Panel._readForm();

      Store.save(patch);

      
      if (patch.avatarImg) {
        try { chrome.storage.local.set({ ql_avatar: patch.avatarImg }); } catch (e) {}
      }
    },

    _setForm: function (patch) {
      if (!_panelEl || !patch) return;
      var p = _panelEl;
      Object.keys({
        'hb-c-accent': 'accentColor',
        'hb-c-cyan': 'cyan',
        'hb-c-pink': 'pink',
        'hb-glow': 'glowIntensity',
        'hb-blur': 'blurAmount',
        'hb-shadow': 'shadowBlur',
        'hb-rgbspd': 'rgbSpeed',
        'hb-transp': 'cardTransparency',
        'hb-brad': 'borderRadius',
        'hb-textmode': 'textOnImage',
        'hb-c-gs': 'gradientStart',
        'hb-c-ge': 'gradientEnd'
      }).forEach(function (id) {
        var key = {
          'hb-c-accent': 'accentColor',
          'hb-c-cyan': 'cyan',
          'hb-c-pink': 'pink',
          'hb-glow': 'glowIntensity',
          'hb-blur': 'blurAmount',
          'hb-shadow': 'shadowBlur',
          'hb-rgbspd': 'rgbSpeed',
          'hb-transp': 'cardTransparency',
          'hb-brad': 'borderRadius',
          'hb-textmode': 'textOnImage',
          'hb-c-gs': 'gradientStart',
          'hb-c-ge': 'gradientEnd'
        }[id];
        var el = p.querySelector('#' + id);
        if (el && patch[key] != null) {
          el.value = patch[key];
          var val = p.querySelector('#' + id + '-v');
          if (val) val.textContent = patch[key];
        }
      });
    },

    _applyPreset: function (key) {
      var preset = _PRESETS[key];
      if (!preset) return;
      var patch = Object.assign({}, preset, {
        userCardBg: _cfg.userCardBg,
        avatarImg: _cfg.avatarImg
      });
      Panel._setForm(patch);
      Store.save(patch);
      Apply.all();
      Panel._preview();
      if (_panelEl) {
        _panelEl.querySelectorAll('.hb-preset-btn').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-preset') === key);
        });
      }
    }
  };

  
  var Card = {
    _bound: false,

    attach: function () {
      var card = document.getElementById('sp-user-card');
      if (!card || card.dataset.hbInit) return;
      card.dataset.hbInit = '1';
      Card._bound = true;

      
      card.style.cursor = 'pointer';
      card.style.position = 'relative';
      card.style.borderColor = 'transparent';
      card.style.overflow = card.getAttribute('data-has-bg') ? 'hidden' : 'visible';

      
      var hint = document.createElement('div');
      hint.id = 'hb-card-hint';
      hint.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> Personalizar';
      hint.style.cssText = 'position:absolute;bottom:5px;right:8px;font-size:9px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:4px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:5;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 0 10px var(--accent-glow);';
      card.appendChild(hint);

      card.addEventListener('mouseenter', function () {
        hint.style.opacity = '1';
      });
      card.addEventListener('mouseleave', function () {
        hint.style.opacity = '0';
      });

      card.addEventListener('click', function (e) {
        var av = document.getElementById('sp-avatar');
        if (av && av.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        Panel.open();
      });
    },

    watch: function () {
      if (_obs) _obs.disconnect();

      _obs = new MutationObserver(function () {
        var card = document.getElementById('sp-user-card');
        if (card && !card.dataset.hbInit) {
          Card.attach();
          Apply.all();
        }
      });

      var targets = [
        document.getElementById('sp-profile-header'),
        document.getElementById('sp-body'),
        document.body
      ].filter(Boolean);

      targets.forEach(function (t) {
        _obs.observe(t, { childList: true, subtree: true });
      });
    }
  };

  
  function _injectStyles() {
    if (document.getElementById('hb-styles')) return;
    var s = document.createElement('style');
    s.id = 'hb-styles';
    s.textContent = [
      '@keyframes hbIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes hbOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(10px)}}',
      '@keyframes hbRgb{0%{background-position:0% center}100%{background-position:300% center}}',
      '#hb-customize-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));cursor:pointer;box-shadow:0 0 8px var(--hb-glow-strong);}',
      '#hb-customize-panel input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));cursor:pointer;border:none;box-shadow:0 0 8px var(--hb-glow-strong);}',
      '#hb-customize-panel::-webkit-scrollbar{width:3px;}',
      '#hb-customize-panel::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--accent),var(--pink));border-radius:2px;}',
      '#sp-user-card[data-has-bg]{isolation:isolate;}',
      '#sp-user-card .hb-bg-overlay{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;}',
      '#sp-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;}',
      '[data-theme="dark"] #sp-avatar:has(img){animation:avatarPulse 3s ease-in-out infinite;}',
      '#hb-apply:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--hb-glow-strong)!important;}',
      '#hb-reset:hover{background:rgba(255,50,50,.14)!important;border-color:rgba(255,80,80,.45)!important;}',
      '#hb-close:hover{background:var(--hb-glow)!important;}',
      '.hb-preset-btn:hover{border-color:var(--hb-border)!important;box-shadow:0 0 18px var(--accent-glow)!important;transform:translateY(-1px);}',
      '.hb-preset-btn.is-active{border-color:var(--accent)!important;background:linear-gradient(135deg,var(--accent-glow),rgba(var(--hb-surface-rgb),.72))!important;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  
  function _consumeOpenCustomizeRequest() {
    try {
      chrome.storage.local.get([_OPEN_REQ_KEY], function (r) {
        var req = Number((r && r[_OPEN_REQ_KEY]) || 0);
        if (!req) return;
        try { chrome.storage.local.remove([_OPEN_REQ_KEY]); } catch (e) {}
        setTimeout(function () {
          Card.attach();
          Panel.open();
        }, 180);
      });
    } catch (e) {}
  }

  function _init() {
    _injectStyles();
    Store.load(function () {
      Apply.all();
      if (!_storageBound && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        _storageBound = true;
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'local') return;

          if (changes[_KEY]) {
            _cfg = _themePatch(changes[_KEY].newValue || _DEFAULTS);
            Apply.all();
            if (_panelEl) {
              Panel._setForm(_cfg);
            }
          }

          if (changes[_AVATAR_KEY]) {
            var nextAvatar = changes[_AVATAR_KEY].newValue || null;
            if ((_cfg.avatarImg || null) !== nextAvatar) {
              _cfg.avatarImg = nextAvatar;
              Apply.avatar();
              if (_panelEl) {
                var ap = _panelEl.querySelector('#hb-av-prev');
                if (ap) ap.style.display = nextAvatar ? 'flex' : 'none';
                Panel._restore();
                Panel._preview();
              }
            }
          }

          if (changes[_OPEN_REQ_KEY] && changes[_OPEN_REQ_KEY].newValue) {
            try { chrome.storage.local.remove([_OPEN_REQ_KEY]); } catch (e) {}
            setTimeout(function () {
              Card.attach();
              Panel.open();
            }, 180);
          }
        });
      }

      function boot() {
    Card.attach();
    Card.watch();
    _consumeOpenCustomizeRequest();
    
    document.addEventListener('click', function (e) {
      var c = e.target && e.target.closest ? e.target.closest('#sp-user-card') : null;
      if (!c) return;
      var av = document.getElementById('sp-avatar');
      if (av && av.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      Panel.open();
    }, true);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
        
        setTimeout(function () { Card.attach(); Card.watch(); }, 350);
        setTimeout(function () { Card.attach(); Apply.all(); }, 900);
        setTimeout(function () { Card.attach(); }, 1800);
      }
    });
  }

  
  window[_NS] = {
    open:      function ()      { Panel.open(); },
    close:     function ()      { Panel.close(); },
    apply:     function (patch) { Store.save(patch); Apply.all(); },
    reset:     function ()      { Store.reset(); Apply.all(); },
    getConfig: function ()      { return Object.assign({}, _cfg); }
  };

  _init();

})();
