(function() {
  console.log("[BurpLovable] Interceptor ativo");

  // Injeta o Hook na página para interceptar tráfego
  try {
    const s = document.createElement("script");
    s.src = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL("pageHook.js") : "pageHook.js";
    s.onload = () => s.remove();
    (document.documentElement || document.head || document.body).appendChild(s);
  } catch (e) {
    console.warn("[BurpLovable] Falha ao injetar hook", e);
  }

  // Escuta as credenciais capturadas pelo Hook injetado
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === "lovableTokenFound") {
      const { token, projectId, workspaceId } = event.data;
      
      // Armazena as credenciais para que o Painel Admin possa utilizá-las
      if (token) localStorage.setItem("lovable_captured_token", token);
      if (projectId) localStorage.setItem("lovable_captured_projectId", projectId);
      if (workspaceId) localStorage.setItem("lovable_captured_workspaceId", workspaceId);
      
      console.log("[BurpLovable] Credenciais capturadas com sucesso");
    }
  });
})();
