(function () {
   console.log("[BurpHook] Injected and running");

  let capturedToken = null;
  let capturedProjectId = null;

  function getProjectFromPage() {
    try {
      // Matches both lovable.dev/projects/ID and lovable.app/projects/ID
      const m = window.location.pathname.match(/\/projects\/([0-9a-fA-F-]{36})/i) || 
                window.location.href.match(/\/projects\/([0-9a-fA-F-]{36})/i);
      return m ? m[1] : null;
    } catch { return null; }
  }

  function extractProjectIdFromUrl(url) {
    try {
      const m = String(url).match(/\/projects\/([0-9a-fA-F-]{36})/i);
      return m ? m[1] : null;
    } catch { return null; }
  }

  function notifyFound(token, projectId, force = false) {
    const newProject = projectId || getProjectFromPage();
    let normalizedToken = typeof token === "string" ? token.replace(/^Bearer\s+/i, "").trim() : null;
    
    // If we don't have a token yet, try to find it in localStorage (Supabase pattern)
    if (!normalizedToken) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.access_token) {
              normalizedToken = data.access_token;
               console.log("[BurpHook] Found token in localStorage:", key);
              break;
            }
          }
        }
      } catch (e) {}
    }

    let changed = false;
    if (normalizedToken && normalizedToken !== capturedToken) { 
      capturedToken = normalizedToken; 
      changed = true; 
    }
    if (newProject && newProject !== capturedProjectId) { 
      capturedProjectId = newProject; 
      changed = true; 
    }

    if (!changed && !force) return;

     console.log("[BurpHook] ✅ Captured:", { 
      token: capturedToken ? "YES (starts with " + capturedToken.substring(0, 5) + "...)" : "NO", 
      projectId: capturedProjectId || "NO" 
    });

    window.postMessage({ 
      type: "lovableTokenFound", 
      token: capturedToken, 
      projectId: capturedProjectId 
    }, "*");
  }

  // Handle requests from content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "lovableRequestToken") return;
    notifyFound(capturedToken, getProjectFromPage() || capturedProjectId, true);
  });

  // Intercept Fetch
  (function wrapFetch() {
    try {
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        try {
          let reqUrl = typeof args[0] === "string" ? args[0] : ((args[0] && args[0].url) || "");
          let opts = args[1] || {};
          let auth = null;

          if (args[0] instanceof Request) {
            reqUrl = args[0].url || reqUrl;
            auth = (args[0].headers && typeof args[0].headers.get === "function") ? 
                   (args[0].headers.get("Authorization") || args[0].headers.get("authorization")) : null;
          }

          if (opts.headers) {
            if (opts.headers instanceof Headers) {
              auth = opts.headers.get("Authorization") || opts.headers.get("authorization");
            } else if (typeof opts.headers === "object") {
              auth = opts.headers.Authorization || opts.headers.authorization;
            }
          }

          const pid = extractProjectIdFromUrl(reqUrl);
          if (auth && auth.toLowerCase().startsWith("bearer ")) {
            const rawToken = auth.substring(7).trim();
            notifyFound(rawToken, pid);
          } else if (pid) {
            // Even if no auth, we found a project ID in a request
            notifyFound(null, pid);
          }
        } catch (e) {}
        return originalFetch.apply(this, args);
      };
     } catch (e) { console.warn("[BurpHook] fetch wrap error", e); }
  })();

  // Intercept XHR
  (function wrapXHR() {
    try {
      const origOpen = XMLHttpRequest.prototype.open;
      const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

      XMLHttpRequest.prototype.open = function (method, url) {
        this._lovable_url = url;
        return origOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        if (name && name.toLowerCase() === "authorization" && value && value.toLowerCase().startsWith("bearer ")) {
          const rawToken = value.substring(7).trim();
          notifyFound(rawToken, extractProjectIdFromUrl(this._lovable_url));
        }
        return origSetHeader.apply(this, arguments);
      };
     } catch (e) { console.warn("[BurpHook] XHR wrap error", e); }
  })();

   // Periodically check URL and localStorage (Every 1s for faster capture like HyperBuild Pro)
   setInterval(() => {
     notifyFound(null, getProjectFromPage());
     
     // Capture from cookies if possible (Supabase might use them)
     try {
       const cookies = document.cookie.split(';');
       for (let cookie of cookies) {
         const [name, value] = cookie.trim().split('=');
         if (name.includes('supabase-auth-token')) {
           const data = JSON.parse(decodeURIComponent(value));
           if (data && data.access_token) {
             notifyFound(data.access_token, null);
           }
         }
       }
     } catch (e) {}
   }, 1000);

  // Initial check
  setTimeout(() => notifyFound(null, getProjectFromPage()), 500);

})();