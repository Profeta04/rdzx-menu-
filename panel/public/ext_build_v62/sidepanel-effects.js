// ============================================
// HyperBuild – Sidepanel Visual Effects
// Avatar upload + 3D tilt. RGB/tema dinâmico removidos em v7.6.0
// (visual fixo via CSS; storage keys de tema são limpas no background.js).
// ============================================

(function () {
  'use strict';


  /* ── 3D TILT EFFECT ── */
  function initTiltEffect(card) {
    if (!card || card.dataset.tiltInit) return;
    card.dataset.tiltInit = '1';

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateY = ((x - cx) / cx) * 8;
      const rotateX = -((y - cy) / cy) * 5;
      card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.015)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
  }

  /* ── AVATAR UPLOAD ── */
  function initAvatarUpload(avatarEl) {
    if (!avatarEl || avatarEl.dataset.avatarInit) return;
    avatarEl.dataset.avatarInit = '1';

    // Load saved avatar
    chrome.storage.local.get(['ql_avatar'], (res) => {
      if (res.ql_avatar) setAvatarImg(avatarEl, res.ql_avatar);
    });

    // Hidden file input
    let fileInput = document.getElementById('sp-avatar-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'sp-avatar-file-input';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    avatarEl.style.cursor = 'pointer';

    avatarEl.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const SIZE = 80;
          const canvas = document.createElement('canvas');
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          // Square center crop
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
          ctx.restore();
          const dataURL = canvas.toDataURL('image/jpeg', 0.92);
          chrome.storage.local.set({ ql_avatar: dataURL });
          setAvatarImg(avatarEl, dataURL);
          // Also update popup avatar if present
          const popupAvatar = document.getElementById('ql-avatar-img');
          if (popupAvatar) popupAvatar.src = dataURL;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setAvatarImg(avatarEl, src) {
    avatarEl.innerHTML = `<img src="${src}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
  }

  /* ── USER NAME RGB (popup sync) ── */
  function updatePopupAvatarFromStorage() {
    const popupAvatar = document.getElementById('ql-avatar-inner');
    if (!popupAvatar) return;
    chrome.storage.local.get(['ql_avatar'], (res) => {
      if (res.ql_avatar) {
        popupAvatar.innerHTML = `<img src="${res.ql_avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
      }
    });
  }

  /* ── INIT ON DOM READY ── */
  function tryInit() {
    const card = document.querySelector('.user-card');
    if (card) {
      initTiltEffect(card);
      const avatar = document.querySelector('#sp-avatar');
      if (avatar) initAvatarUpload(avatar);
    }

    updatePopupAvatarFromStorage();
  }

  // Run on load and watch for DOM changes (SPA re-renders)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

  // MutationObserver to re-init when user card is re-rendered (cheap + idempotent)
  const observer = new MutationObserver(() => {
    const card = document.querySelector('.user-card');
    if (card) initTiltEffect(card);
    const avatar = document.querySelector('#sp-avatar');
    if (avatar) initAvatarUpload(avatar);
  });

  const root = document.getElementById('sp-body') || document.body;
  observer.observe(root, { childList: true, subtree: true });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.ql_avatar) return;
      const avatar = document.getElementById('sp-avatar');
      if (!avatar) return;
      if (changes.ql_avatar.newValue) {
        setAvatarImg(avatar, changes.ql_avatar.newValue);
      } else {
        avatar.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      }
    });
  }

})();
