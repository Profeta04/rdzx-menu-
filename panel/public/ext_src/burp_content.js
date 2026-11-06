(() => {
  if (window.__BURP_LOVABLE_CONTENT__) return;
  window.__BURP_LOVABLE_CONTENT__ = true;

  function send(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, payload }, () => void chrome.runtime?.lastError);
    } catch (error) {
      console.warn("[Burp Lovable] sendMessage failed", error);
    }
  }

  function injectHook() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("burp_pageHook.js");
      script.async = false;
      script.onload = () => script.remove();
      (document.documentElement || document.head || document.body).appendChild(script);
    } catch (error) {
      console.warn("[Burp Lovable] failed to inject page hook", error);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "BURP_LOVABLE_PAGE") return;

    if (data.type === "HOOK_READY") {
      send("BURP_HOOK_READY", data.payload || {});
      return;
    }

    if (data.type === "AUTH_SNAPSHOT") {
      send("BURP_CAPTURE_AUTH", data.payload || {});
      return;
    }

    if (data.type === "REQUEST_COMPLETED" || data.type === "REQUEST_FAILED") {
      send("BURP_NETWORK_EVENT", data.payload || {});
    }
  });

  injectHook();
  send("BURP_HOOK_READY", { href: location.href, title: document.title });

  setTimeout(() => {
    window.postMessage({ source: "BURP_LOVABLE_CONTENT", type: "REQUEST_AUTH_SNAPSHOT" }, "*");
  }, 500);
})();
