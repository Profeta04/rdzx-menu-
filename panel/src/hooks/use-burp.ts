import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface BurpRequest {
  id: string;
  url: string;
  method: string;
  payload: string;
  response: string;
  status: number;
  timestamp: string;
}

export function useBurp() {
  const [history, setHistory] = useState<BurpRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

   const fetchAuthStatus = useCallback(async () => {
     const token = localStorage.getItem("lovable_captured_token");
     const pid = localStorage.getItem("lovable_captured_projectId");
     const wid = localStorage.getItem("lovable_captured_workspaceId");

     if (token && token !== "null" && token !== "undefined") {
       setAuthStatus("connected");
       setProjectId(pid);
       setWorkspaceId(wid);
     } else {
       setAuthStatus("disconnected");
       setProjectId(null);
       setWorkspaceId(null);
     }
   }, []);

   // Sync credentials via storage event (sem polling de 1 s).
   // window.storage cobre tabs normais; chrome.storage.onChanged cobre extensão Chrome.
   useEffect(() => {
     const handleStorage = (e: StorageEvent) => {
       if (
         e.key === "lovable_captured_token" ||
         e.key === "lovable_captured_projectId" ||
         e.key === "lovable_captured_workspaceId"
       ) {
         fetchAuthStatus();
       }
     };

     window.addEventListener("storage", handleStorage);

      // Suporte a Chrome Extension: chrome.storage.onChanged disponível em background/sidepanel.
      const chromeApi = (globalThis as any).chrome;
      let chromeStorageListener: ((changes: Record<string, unknown>, area: string) => void) | null = null;
      if (chromeApi?.storage?.onChanged) {
        chromeStorageListener = (changes: Record<string, unknown>, area: string) => {
         if (area === "local") {
           const watched = ["lovable_captured_token", "lovable_captured_projectId", "lovable_captured_workspaceId"];
           if (Object.keys(changes).some((k) => watched.includes(k))) {
             fetchAuthStatus();
           }
         }
       };
        chromeApi.storage.onChanged.addListener(chromeStorageListener);
     }

     return () => {
       window.removeEventListener("storage", handleStorage);
        if (chromeStorageListener && chromeApi?.storage?.onChanged) {
          chromeApi.storage.onChanged.removeListener(chromeStorageListener);
       }
     };
   }, [fetchAuthStatus]);

  useEffect(() => {
    fetchAuthStatus();
    // Load history from local storage
    const saved = localStorage.getItem("burp_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [fetchAuthStatus]);

  const executeRequest = async (
    url: string,
    method: string,
    payload: string,
  ): Promise<BurpRequest | null> => {
    setLoading(true);
    try {
      // Get captured credentials
      const token = localStorage.getItem("lovable_captured_token");
      
      if (!token) {
        toast.error("Nenhuma credencial capturada. Abra o Lovable.dev para capturar.");
        setLoading(false);
        return null;
      }

      const { data, error } = await supabase.functions.invoke("burp", {
        body: { 
          url, 
          method, 
          body: method !== "GET" ? JSON.parse(payload || "{}") : undefined,
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      });

      if (error) throw error;

      // Status real vem do edge function (proxy-command devolve { status, body, ... }).
      // Fallback para 200 apenas quando o backend não envia status no payload.
      const realStatus: number =
        typeof (data as any)?.status === "number" ? (data as any).status : 200;

      const newRequest: BurpRequest = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        method,
        payload,
        response: JSON.stringify(data, null, 2),
        status: realStatus,
        timestamp: new Date().toISOString()
      };

      // Updater funcional evita stale closure quando há replays concorrentes.
      setHistory((prev) => {
        const next = [newRequest, ...prev].slice(0, 50);
        localStorage.setItem("burp_history", JSON.stringify(next));
        return next;
      });

      toast.success("Requisição executada com sucesso!");
      return newRequest;
    } catch (err: any) {
      console.error("Burp Request Error:", err);
      toast.error("Erro na requisição: " + err.message);
      
      const failedRequest: BurpRequest = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        method,
        payload,
        response: err.message || "Erro desconhecido",
        status: 500,
        timestamp: new Date().toISOString()
      };
      
      setHistory((prev) => {
        const next = [failedRequest, ...prev].slice(0, 50);
        localStorage.setItem("burp_history", JSON.stringify(next));
        return next;
      });
      return failedRequest;
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("burp_history");
    toast.success("Histórico limpo");
  };

  return { 
    history, 
    loading, 
    authStatus, 
    projectId, 
    workspaceId, 
    executeRequest, 
    clearHistory, 
    refreshAuth: fetchAuthStatus 
  };
}
