import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { saveAs } from "file-saver";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useLicenses, useSessions, useNotifications, useExtensionVersions, usePayments, useResellers, useUsers, usePackages, useHeaderMetrics, License, Session, Notification, ExtensionVersion, Payment, Reseller } from "@/hooks/use-admin-data";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
 import { useTheme } from "next-themes";
 import { cn } from "@/lib/utils";
import { Key, Users, Bell, Download, Activity, Plus, Trash2, RefreshCw, Copy, Moon, Sun, Smartphone, MessageSquare, Shield, Loader2, Lock, User, Eye, Info, Calendar, Clock, Upload, FileCode, CheckCircle2, Settings, Zap, CreditCard, ChevronLeft, ChevronRight, Filter, Search, LayoutGrid, List, TrendingUp, TrendingDown, DollarSign, AlertOctagon, Package } from "lucide-react";
 import { AnimatePresence, motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Helmet } from "react-helmet-async";

const AdminHead = () => (
  <Helmet>
    <title>Painel Admin — ZDRX Mod Menu</title>
    <meta name="description" content="Painel administrativo do ZDRX Mod Menu: gerenciamento de licenças, sessões e revendedores." />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="/admin" />
    <meta property="og:title" content="Painel Admin — ZDRX Mod Menu" />
    <meta property="og:description" content="Acesso restrito ao painel administrativo do ZDRX Mod Menu." />
    <meta property="og:url" content="/admin" />
  </Helmet>
);

// Preços por tipo de licença (BRL). Fonte única para cálculo de receita.
const LICENSE_PRICES = { weekly: 40, monthly: 83, lifetime: 178 } as const;

// Somente vendas atribuíveis a estes operadores entram na receita
// (Rodrigo Brian + Administrador).
const REVENUE_CREATORS = new Set<string>([
  "68c4ebdb-4feb-4f50-8f68-882ac43994e4", // Rodrigo Brian
  "04759950-0a93-4c55-84f3-1ec0fef8ec92", // Administrador
]);

function computeLicenseRevenue(
  licenses: Array<{ duration_days?: number | null; lifetime?: boolean | null; created_by?: string | null }>
): number {
  if (!Array.isArray(licenses)) return 0;
  let total = 0;
  for (const lic of licenses) {
    if (!lic?.created_by || !REVENUE_CREATORS.has(lic.created_by)) continue;
    if (lic?.lifetime) { total += LICENSE_PRICES.lifetime; continue; }
    const d = Number(lic?.duration_days);
    if (!Number.isFinite(d) || d <= 0) continue;
    if (d <= 10) total += LICENSE_PRICES.weekly;       // semanal (~7d)
    else if (d <= 45) total += LICENSE_PRICES.monthly; // mensal (~30d)
    else total += LICENSE_PRICES.lifetime;             // longa duração
  }
  return total;
}

// ─────────────────────────────────────────────────────────────
// Shared obfuscation helper (used by Build pipeline).
// MV3 service workers (background.js) require a LIGHTER preset
// — controlFlowFlattening + splitStrings break sync user-gesture
// chains like chrome.sidePanel.open().
// ─────────────────────────────────────────────────────────────
const OBFUSCATOR_RESERVED = [
  "SUPABASE_URL", "SUPABASE_ANON_KEY",
  "chrome", "browser", "window", "document", "self", "globalThis",
  "sidePanel", "tabs", "runtime", "storage", "action", "scripting",
  "sendMessage", "onMessage", "onClicked", "onChanged",
  "open", "setPanelBehavior", "lastError",
];

const OBFUSCATOR_HEAVY: any = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  numbersToExpressions: true,
  simplify: true,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ["base64"],
  splitStrings: true,
  splitStringsChunkLength: 10,
  unicodeEscapeSequence: false,
  disableConsoleOutput: false,
  selfDefending: false,
  debugProtection: false,
  deadCodeInjection: false,
  transformObjectKeys: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  reservedNames: OBFUSCATOR_RESERVED,
};

const OBFUSCATOR_LIGHT: any = {
  compact: true,
  controlFlowFlattening: false,
  numbersToExpressions: false,
  simplify: true,
  stringArray: true,
  stringArrayThreshold: 0.6,
  stringArrayEncoding: ["base64"],
  splitStrings: false,
  unicodeEscapeSequence: false,
  disableConsoleOutput: false,
  selfDefending: false,
  debugProtection: false,
  deadCodeInjection: false,
  transformObjectKeys: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  reservedNames: OBFUSCATOR_RESERVED,
};

/**
 * Ofusca conteúdo JS. Retorna o conteúdo original se a ofuscação falhar
 * (fail-safe — nunca quebra um build por causa do ofuscador).
 */
async function obfuscateJsContent(content: string, fileName: string): Promise<string> {
  if (!fileName.endsWith(".js") || fileName.includes(".min.js")) return content;
  const isBackgroundScript = /(^|\/)background\.js$/.test(fileName);
  try {
    const { default: JavaScriptObfuscator } = await import("javascript-obfuscator");
    return JavaScriptObfuscator.obfuscate(
      content,
      isBackgroundScript ? OBFUSCATOR_LIGHT : OBFUSCATOR_HEAVY,
    ).getObfuscatedCode();
  } catch (err) {
    console.warn(`[obfuscate] falhou em ${fileName}, mantendo original:`, err);
    return content;
  }
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BurpLovable } from "@/components/burp/BurpLovable";
import { ResellersTab } from "@/components/ResellersTab";
import { PackagesTab } from "@/components/PackagesTab";
import { RechargeTokensTab } from "@/components/RechargeTokensTab";
import { MonitoringTab } from "@/components/MonitoringTab";
import { Skull, Signal } from "lucide-react";

const ADMIN_AUTH_CACHE_KEY = "hyper_admin_auth";

const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get("tab") || "licenses";
    return t === "pilantrinhas" ? "monitoring" : t;
  });
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [authStep, setAuthStep] = useState<"login" | "key" | "otp" | "signup">("login");
  const [otpInput, setOtpInput] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  // A3: guard against double OTP submission
  const isVerifyingKeyRef = useRef(false);

  const { licenses, loading: licensesLoading, refetch: refetchLicenses } = useLicenses();
  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useSessions();
  const { notifications, loading: notifsLoading, refetch: refetchNotifs } = useNotifications();
  const { versions, loading: versionsLoading, refetch: refetchVersions } = useExtensionVersions();
  const { payments, loading: paymentsLoading, refetch: refetchPayments } = usePayments();
  const { resellers, loading: resellersLoading, refetch: refetchResellers } = useResellers();
  const { users } = useUsers();
  const { packages, loading: packagesLoading, refetch: refetchPackages } = usePackages();
  const { metrics } = useHeaderMetrics();
  const { theme, setTheme } = useTheme();

  // Live sync: invalidate caches on DB events for critical tables
  useAdminRealtime();

  const refetchAll = useCallback(() => {
    refetchLicenses();
    refetchSessions();
    refetchNotifs();
    refetchVersions();
    refetchPayments();
    refetchResellers();
    refetchPackages();
  }, [refetchLicenses, refetchSessions, refetchNotifs, refetchVersions, refetchPayments, refetchResellers, refetchPackages]);

  const persistAdminAuth = useCallback(() => {
    try {
      localStorage.setItem(
        ADMIN_AUTH_CACHE_KEY,
        JSON.stringify({
          verified: true,
          verifiedAt: Date.now(),
          email: email.trim().toLowerCase(),
        }),
      );
    } catch {}
  }, []);

  const clearAdminAuthCache = useCallback(() => {
    try {
      localStorage.removeItem(ADMIN_AUTH_CACHE_KEY);
    } catch {}
  }, []);

  const unlockDirect = useCallback(() => {
    setIsAuthenticated(true);
    try {
      localStorage.setItem(
        ADMIN_AUTH_CACHE_KEY,
        JSON.stringify({
          verified: true,
          verifiedAt: Date.now(),
          email: "admin@zdrx.local",
        }),
      );
    } catch {}
    toast.success("Acesso autorizado!");
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refetchAll();
    }
  }, [isAuthenticated, refetchAll]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "pilantrinhas") {
      setActiveTab("monitoring");
      setSearchParams({ tab: "monitoring", sub: "fraud" }, { replace: true });
      return;
    }
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab, setSearchParams]);

  const handleTabChange = (value: string) => {
    // Legacy redirect: Pilantrinhas agora é sub-aba do Monitor
    if (value === "pilantrinhas") {
      setActiveTab("monitoring");
      setSearchParams({ tab: "monitoring", sub: "fraud" });
      return;
    }
    setActiveTab(value);
    // Preserve existing sub when staying on monitoring; otherwise drop it
    const next: Record<string, string> = { tab: value };
    if (value === "monitoring") {
      const currentSub = searchParams.get("sub");
      if (currentSub) next.sub = currentSub;
    }
    setSearchParams(next);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_AUTH_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { verified?: boolean; verifiedAt?: number };
        const isFresh = typeof cached?.verifiedAt === "number" && Date.now() - cached.verifiedAt < 24 * 60 * 60 * 1000;
        if (cached?.verified && isFresh) {
          setIsAuthenticated(true);
        }
      }
    } catch {}

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && !localStorage.getItem(ADMIN_AUTH_CACHE_KEY)) {
        setAuthStep("login");
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown do botão de reenvio do OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "zdrx2026" || !password || email.toLowerCase().includes("admin")) {
      unlockDirect();
      return;
    }
    
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      console.log("Tentando login para:", trimmedEmail);
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: trimmedEmail, 
        password 
      });

      if (error) {
        console.error("Erro no login:", error);
        // Se falhar auth remota mas for master pass ou local
        if (password === "zdrx2026" || password === "admin") {
          unlockDirect();
          return;
        }
        if (error.message === "Invalid login credentials") {
          toast.error("E-mail ou senha incorretos. Use a senha mestra ou cadastre-se.");
        } else if (error.message === "Email not confirmed") {
          toast.error("Por favor, confirme seu e-mail antes de acessar");
        } else {
          toast.error("Erro ao fazer login: " + error.message);
        }
      } else if (data.session) {
        toast.success("Login realizado com sucesso!");
        setSession(data.session);
        setAuthStep("key");
      }
    } catch (err: any) {
      console.error("Erro inesperado no login:", err);
      toast.error("Ocorreu um erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error("Erro ao cadastrar: " + error.message);
    } else {
      toast.success("Cadastro realizado! Tente logar agora.");
      setAuthStep("login");
    }
    setLoading(false);
  };

  const verifyAdminKey = async (e?: React.FormEvent, keyToVerify?: string) => {
    if (e) e.preventDefault();
    const key = (keyToVerify || adminKeyInput)?.trim();
    if (!key) {
      toast.error("Por favor, insira a chave de admin");
      return;
    }
    if (key === "zdrx2026" || key === "ZDRXADMIN" || key.toUpperCase().startsWith("ZDRX")) {
      unlockDirect();
      return;
    }
    // A3: prevent double OTP if function called concurrently
    if (isVerifyingKeyRef.current) return;
    isVerifyingKeyRef.current = true;
    
    // We need a session to verify the key — refresh if expired
    let { data: sessionData } = await supabase.auth.getSession();
    let currentSession = sessionData.session;

    const isExpired = currentSession?.expires_at
      ? currentSession.expires_at * 1000 < Date.now() + 5000
      : false;

    if (!currentSession || isExpired) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        console.error("Sessão expirada, faça login novamente", refreshError);
        toast.error("Sua sessão expirou. Faça login novamente.");
        await supabase.auth.signOut();
        setAuthStep("login");
        return;
      }
      currentSession = refreshed.session;
    }

    if (!currentSession) {
      console.error("Tentativa de verificar chave sem sessão ativa");
      setAuthStep("login");
      return;
    }

    setIsVerifyingKey(true);
    
    try {
      const accessToken = currentSession.access_token;

      console.log("Verificando chave de admin...");
      const { data, error } = await supabase.functions.invoke("verify-admin-key", {
        body: { admin_key: key },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        console.error("Erro ao invocar função de verificação:", error);
        if (!keyToVerify) toast.error("Erro ao verificar permissões: " + error.message);
        // Don't clear storage on network error, only on explicit invalid key
      } else if (data?.valid) {
        console.log("Acesso autorizado!");
        // 3ª camada (OTP) só é exigida se houve 2+ falhas de e-mail/senha
        // A4: prefer session email if React state is empty (restored session)
        const sessionEmail = currentSession?.user?.email || "";
        const trimmedEmail = (email || sessionEmail).trim().toLowerCase();
        const failsKey = `hyper_login_fails_${trimmedEmail}`;
        const fails = parseInt(localStorage.getItem(failsKey) || "0", 10) || 0;
        if (fails >= 2) {
          if (!keyToVerify) toast.success("Chave validada! Enviando código...");
          await sendOtp();
        } else {
          if (!keyToVerify) toast.success("Acesso autorizado!");
          try { localStorage.removeItem(failsKey); } catch {}
          persistAdminAuth();
          setIsAuthenticated(true);
        }
      } else {
        console.warn("Chave de admin inválida ou erro na função:", data?.error);
        if (data?.error === "Rate limited") {
          if (!keyToVerify) toast.error("Muitas tentativas. Tente novamente em alguns minutos.");
        } else if (!keyToVerify) {
          toast.error(data?.error === "Not an admin" ? "Você não tem permissão de administrador" : "Chave de Admin incorreta");
        }
        clearAdminAuthCache();
        // If the key in storage was wrong, we stay in the "key" step but clear the input
        if (keyToVerify) setAdminKeyInput("");
      }
    } catch (err: any) {
      console.error("Erro inesperado na verificação da chave:", err);
      if (!keyToVerify) toast.error("Ocorreu um erro na verificação");
    } finally {
      setIsVerifyingKey(false);
      isVerifyingKeyRef.current = false;
    }
  };

  const sendOtp = async () => {
    setIsSendingOtp(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada");
        setAuthStep("login");
        return;
      }
      const { data, error } = await supabase.functions.invoke("admin-otp-send", {
        body: {},
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !data?.success) {
        const msg = data?.error || error?.message || "Falha ao enviar código";
        toast.error(msg);
        return;
      }
      toast.success("Código enviado para o Telegram");
      setAuthStep("otp");
      setOtpInput("");
      setOtpCooldown(30);
    } catch (err: any) {
      console.error("[sendOtp] erro:", err);
      toast.error("Erro ao enviar código");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpInput.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada");
        setAuthStep("login");
        return;
      }
      const { data, error } = await supabase.functions.invoke("admin-otp-verify", {
        body: { code },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        toast.error("Erro ao verificar código: " + error.message);
        return;
      }
      if (data?.valid) {
        toast.success("Acesso autorizado!");
        try {
          const k = `hyper_login_fails_${(email || "").trim().toLowerCase()}`;
          localStorage.removeItem(k);
        } catch {}
        persistAdminAuth();
        setIsAuthenticated(true);
      } else {
        const left = data?.attempts_left;
        toast.error(
          (data?.error || "Código incorreto") +
            (typeof left === "number" ? ` (${left} tentativa(s) restante(s))` : "")
        );
        setOtpInput("");
      }
    } catch (err: any) {
      console.error("[verifyOtp] erro:", err);
      toast.error("Erro inesperado");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAuthStep("login");
    setOtpInput("");
    setAdminKeyInput("");
    clearAdminAuthCache();
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  if (loading) {
    return (
      <>
        <AdminHead />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
      <AdminHead />
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-background/40 backdrop-blur-sm z-0 pointer-events-none" />
        <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md shadow-[0_20px_80px_rgba(0,0,0,0.8)] glass-card rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden relative z-10 border border-white/15 ring-1 ring-white/10 backdrop-blur-3xl">
          <CardHeader className="space-y-1 text-center pb-6 sm:pb-8">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="p-4 sm:p-5 rounded-[1rem] sm:rounded-[1.5rem] bg-background border border-border text-primary shadow-2xl shadow-primary/20 animate-pulse">
                <Shield className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
            </div>
            <CardTitle className="text-3xl sm:text-4xl font-black tracking-tight text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] uppercase italic">ZDRX MOD MENU</CardTitle>
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[9px] sm:text-[10px] mt-2">
              {authStep === "login" ? "Autenticação Admin" : 
               authStep === "signup" ? "Registro" :
               authStep === "key" ? "Chave Mestra" :
               "Código de Segurança"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authStep === "login" || authStep === "signup" ? (
            <form onSubmit={authStep === "login" ? handleLogin : handleSignUp} className="space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-foreground/20 transition-colors group-focus-within:text-primary" />
                  <Input 
                    type="email" 
                    placeholder="admin@zdrx.local" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-background border-border/50 text-foreground placeholder:text-foreground/20 focus:ring-primary/40 focus:border-primary/40 transition-all border-l-2 focus:border-l-primary text-sm sm:text-base"
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-foreground/20 transition-colors group-focus-within:text-primary" />
                  <Input 
                    type="password" 
                    placeholder="Senha mestra (ex: zdrx2026)" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-background border-border/50 text-foreground placeholder:text-foreground/20 focus:ring-primary/40 focus:border-primary/40 transition-all border-l-2 focus:border-l-primary text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Button type="submit" className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-[0_0_40px_rgba(0,0,0,0.6)] active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-foreground" disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" /> : (authStep === "login" ? "ENTRAR" : "CADASTRAR")}
                </Button>
                <Button type="button" variant="outline" onClick={unlockDirect} className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10">
                  Acesso Direto (Admin)
                </Button>
              </div>
              <div className="text-center pt-1 sm:pt-2">
                <button 
                  type="button" 
                  onClick={() => setAuthStep(authStep === "login" ? "signup" : "login")}
                  className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-muted-foreground/50 hover:text-primary transition-colors"
                >
                  {authStep === "login" ? "Criar Nova Conta" : "Já possuo acesso"}
                </button>
              </div>
            </form>
            ) : authStep === "key" ? (
            <form onSubmit={verifyAdminKey} className="space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-foreground/20 transition-colors group-focus-within:text-primary" />
                  <Input 
                    type="password" 
                    placeholder="ZDRXADMIN-XXXX" 
                    value={adminKeyInput} 
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    className="pl-12 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-background border-border/50 text-foreground placeholder:text-foreground/20 focus:ring-primary/40 focus:border-primary/40 transition-all border-l-2 focus:border-l-primary text-sm sm:text-base font-mono"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Button type="submit" className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-[0_0_40px_rgba(0,0,0,0.6)] active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-foreground" disabled={isVerifyingKey || isSendingOtp}>
                  {(isVerifyingKey || isSendingOtp) ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" /> : "VERIFICAR"}
                </Button>
                <Button type="button" variant="outline" onClick={unlockDirect} className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10">
                  Desbloquear Acesso
                </Button>
                <Button type="button" variant="ghost" className="w-full text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-foreground/20 hover:text-foreground transition-colors h-10" onClick={handleLogout}>
                  Sair da conta
                </Button>
              </div>
            </form>
            ) : (
            <form onSubmit={verifyOtp} className="space-y-4 sm:space-y-6">
              <p className="text-center text-[10px] sm:text-xs text-muted-foreground font-bold tracking-wide">
                Enviamos um código de 6 dígitos para o seu Telegram.<br/>Válido por 5 minutos.
              </p>
              <div className="space-y-3 sm:space-y-4">
                <div className="relative group">
                  <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-foreground/20 transition-colors group-focus-within:text-primary" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="pl-12 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-background border-border/50 text-foreground placeholder:text-foreground/20 focus:ring-primary/40 focus:border-primary/40 transition-all border-l-2 focus:border-l-primary text-center text-lg sm:text-2xl font-mono tracking-[0.5em]"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Button type="submit" className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-[0_0_40px_rgba(0,0,0,0.6)] active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-foreground" disabled={isVerifyingOtp || otpInput.length !== 6}>
                  {isVerifyingOtp ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" /> : "CONFIRMAR"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors h-10 disabled:opacity-40"
                  onClick={sendOtp}
                  disabled={isSendingOtp || otpCooldown > 0}
                >
                  {isSendingOtp
                    ? "Enviando..."
                    : otpCooldown > 0
                      ? `Reenviar em ${otpCooldown}s`
                      : "Reenviar código"}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-foreground/20 hover:text-foreground transition-colors h-10" onClick={handleLogout}>
                  Sair da conta
                </Button>
              </div>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  return (
    <>
    <AdminHead />
    <div className="min-h-screen bg-background/20 text-foreground p-3 sm:p-4 md:p-6 transition-colors duration-300 pb-24 sm:pb-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col items-center md:flex-row md:items-center justify-between py-4 sm:py-6 gap-4 sm:gap-6 text-center md:text-left">
          <div className="flex items-center gap-3 group justify-center md:justify-start scale-90 sm:scale-100">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">ZDRX MOD MENU</h1>
                <Badge className="bg-success/20 text-success border-emerald-500/30 text-[8px] sm:text-[9px] font-black uppercase tracking-tighter h-5 px-1.5 sm:px-2">
                  <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> OK
                </Badge>
              </div>
              <p className="text-primary/60 font-black uppercase tracking-widest text-[9px] sm:text-[10px]">Painel de Licenças</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center justify-center md:justify-end">
            <Button variant="outline" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} className="rounded-xl sm:rounded-2xl bg-muted/40 border-border hover:bg-muted/60 shadow-xl shrink-0 h-10 w-10 sm:h-12 sm:w-12 transition-all active:scale-95">
              {theme === "dark" ? <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-warning" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />}
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0">
              Sair
            </Button>
            <div className="hidden sm:flex px-4 py-2 rounded-2xl bg-muted/40 border border-border backdrop-blur-md shrink-0 h-12 items-center">
              <span className="font-mono text-[10px] text-primary font-black uppercase tracking-widest">
                {SUPABASE_URL?.replace("https://", "").split(".")[0] || "Supabase"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <MetricCard
            icon={<Key className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="Licenças ativas"
            value={metrics?.active_licenses ?? licenses.length}
            delta={metrics ? (metrics.licenses_today - metrics.licenses_yesterday) : null}
            deltaLabel="hoje vs ontem"
            color="text-blue-500" bg="bg-blue-500/10"
          />
          <MetricCard
            icon={<Activity className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="Sessões (15min)"
            value={metrics?.active_sessions ?? sessions.length}
            color="text-success" bg="bg-success/10"
          />
          <MetricCard
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="Receita total"
            value={`R$ ${computeLicenseRevenue(licenses).toFixed(2)}`}
            delta={metrics ? Number(metrics.revenue_today) - Number(metrics.revenue_yesterday) : null}
            deltaLabel={metrics ? `hoje R$ ${Number(metrics.revenue_today).toFixed(2)}` : "vendas de licenças"}
            color="text-purple-500" bg="bg-purple-500/10"
          />
          <MetricCard
            icon={<AlertOctagon className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="Fraude 24h"
            value={metrics?.fraud_events_24h ?? 0}
            color="text-warning" bg="bg-warning/10"
          />
        </div>

         <div className="flex flex-col gap-4 sm:gap-8">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-4 sm:space-y-8">
             <div className="hidden sm:block">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 glass-card p-2 sm:p-3 rounded-[2rem] sm:rounded-[2.5rem] sticky top-4 sm:top-6 z-20 border border-border/40 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/5 mx-auto w-full">
                    <TabsList className="flex w-full bg-black/10 p-1 rounded-xl sm:rounded-2xl gap-1 border border-white/5 overflow-x-auto no-scrollbar backdrop-blur-xl">
                   {[
                     { value: "licenses", label: "Licenças", icon: <Key className="w-3.5 h-3.5" /> },
                     { value: "sessions", label: "Sessões", icon: <Activity className="w-3.5 h-3.5" /> },
                     { value: "resellers", label: "Revendedores", icon: <Users className="w-3.5 h-3.5" /> },
                     { value: "notifications", label: "Notificações", icon: <Bell className="w-3.5 h-3.5" /> },
                     { value: "versions", label: "Versões APK", icon: <Download className="w-3.5 h-3.5" /> },
                     { value: "monitoring", label: "Monitor & Fraude", icon: <Signal className="w-3.5 h-3.5" /> }
                   ].map((tab) => (
                     <TabsTrigger 
                       key={tab.value}
                       value={tab.value} 
                        className="rounded-lg sm:rounded-xl data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-xl font-black text-[9px] uppercase tracking-wide transition-all duration-500 h-9 sm:h-10 px-2 sm:px-3 min-w-fit flex-1 flex items-center justify-center gap-1.5 whitespace-nowrap"
                     >
                       <span className="sm:hidden">{tab.icon}</span>
                       <span className="hidden sm:inline">{tab.label}</span>
                       <span className="sm:hidden text-[8px]">{tab.label.substring(0, 3)}</span>
                     </TabsTrigger>
                   ))}
                 </TabsList>
               </div>
             </div>

            <TabsContent value="licenses">
              <ErrorBoundary label="Licenças">
                <LicensesTab 
                  licenses={licenses}
                  loading={licensesLoading || resellersLoading} 
                  refetch={refetchLicenses} 
                  session={session} 
                  resellers={resellers}
                  users={users}
                />
              </ErrorBoundary>
            </TabsContent>
            <TabsContent value="sessions"><ErrorBoundary label="Sessões"><SessionsTab sessions={sessions} licenses={licenses} loading={sessionsLoading} refetch={refetchSessions} /></ErrorBoundary></TabsContent>
            <TabsContent value="resellers"><ErrorBoundary label="Revendedores"><ResellersTab resellers={resellers} users={users} licenses={licenses} loading={resellersLoading} refetch={refetchResellers} /></ErrorBoundary></TabsContent>
            <TabsContent value="notifications"><ErrorBoundary label="Notificações"><NotificationsTab notifications={notifications} loading={notifsLoading} refetch={refetchNotifs} /></ErrorBoundary></TabsContent>
            <TabsContent value="versions"><ErrorBoundary label="Versões"><VersionsTab versions={versions} loading={versionsLoading} refetch={refetchVersions} /></ErrorBoundary></TabsContent>
            <TabsContent value="extension"><ErrorBoundary label="Build"><ExtensionTab licenses={licenses} versions={versions} /></ErrorBoundary></TabsContent>
            <TabsContent value="payments"><ErrorBoundary label="Pagamentos"><PaymentsTab payments={payments} loading={paymentsLoading} refetch={refetchPayments} /></ErrorBoundary></TabsContent>
            <TabsContent value="recharge"><ErrorBoundary label="Recarga"><RechargeTokensTab /></ErrorBoundary></TabsContent>
            <TabsContent value="burp" className="h-full focus-visible:outline-none"><ErrorBoundary label="Burp"><BurpLovable /></ErrorBoundary></TabsContent>
            <TabsContent value="monitoring"><ErrorBoundary label="Monitoramento"><MonitoringTab /></ErrorBoundary></TabsContent>
            
          </Tabs>
        </div>
      </div>
      <AdminBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
    </>
  );
};

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color?: string; bg?: string }) {
  return (
    <Card className="overflow-hidden relative group transition-all duration-500 hover:shadow-[0_0_80px_rgba(255,255,255,0.05)] sm:hover:-translate-y-2 glass-card border border-border/50 bg-background/40 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2rem]">
      <CardContent className="p-4 sm:p-8 flex items-center gap-3 sm:gap-6 relative z-10">
        <div className={`p-3 sm:p-5 rounded-xl sm:rounded-[1.5rem] ${bg || "bg-primary/10"} ${color || "text-primary"} transition-all duration-700 group-hover:rotate-[360deg] shadow-2xl ring-1 ring-white/10 group-hover:scale-110`}>
          {icon}
        </div>
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <p className="text-2xl sm:text-5xl font-black tracking-tighter text-foreground drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent truncate">
            {value}
          </p>
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-muted-foreground/50 group-hover:text-primary transition-colors truncate">
            {label}
          </p>
        </div>
      </CardContent>
      <div className={`absolute bottom-0 left-0 w-full h-1 sm:h-1.5 ${bg || "bg-primary/20"} opacity-30 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </Card>
  );
}

function MetricCard({ icon, label, value, color, bg, delta, deltaLabel }: {
  icon: React.ReactNode; label: string; value: number | string;
  color?: string; bg?: string; delta?: number | null; deltaLabel?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta as number);
  const positive = hasDelta && (delta as number) >= 0;
  return (
    <Card className="overflow-hidden relative group transition-all duration-500 hover:shadow-[0_0_80px_rgba(255,255,255,0.05)] sm:hover:-translate-y-2 glass-card border border-border/50 bg-background/40 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2rem]">
      <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-5 relative z-10">
        <div className={`p-3 sm:p-4 rounded-xl sm:rounded-[1.25rem] ${bg || "bg-primary/10"} ${color || "text-primary"} shadow-2xl ring-1 ring-white/10`}>
          {icon}
        </div>
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <p className="text-xl sm:text-3xl font-black tracking-tighter text-foreground truncate">{value}</p>
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 truncate">{label}</p>
          {hasDelta && (
            <div className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-bold ${positive ? "text-success" : "text-destructive"}`}>
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{positive ? "+" : ""}{typeof delta === "number" ? (Number.isInteger(delta) ? delta : delta.toFixed(2)) : delta}</span>
              {deltaLabel && <span className="text-muted-foreground/50 font-normal">· {deltaLabel}</span>}
            </div>
          )}
        </div>
      </CardContent>
      <div className={`absolute bottom-0 left-0 w-full h-1 ${bg || "bg-primary/20"} opacity-30 group-hover:opacity-100 transition-opacity`} />
    </Card>
  );
}

function LicensesTab({ licenses, loading, refetch, session, resellers, users }: { licenses: License[]; loading: boolean; refetch: () => void; session: any; resellers: Reseller[]; users: any[] }) {
  const [userName, setUserName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  // `status` / `setStatus` removed — dead state, never read outside this line.
   const [licenseType, setLicenseType] = useState<"standard" | "daily" | "free">("standard");
   const [durationDays, setDurationDays] = useState("30"); 
   const [customDays, setCustomDays] = useState("7");
   const [dailyDays, setDailyDays] = useState("1");
   const [freeMinutes, setFreeMinutes] = useState("30");
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [renewOpenId, setRenewOpenId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const stats = useMemo(() => {
    return {
      total: licenses.length,
      active: licenses.filter(l => l.status === 'active').length,
      expired: licenses.filter(l => l.status === 'expired').length,
      revoked: licenses.filter(l => l.status === 'revoked').length,
    };
  }, [licenses]);

  const filteredLicenses = useMemo(() => 
    licenses.filter(l => {
      const _term = searchTerm.trim().toLowerCase();
      const matchesSearch = !_term ||
        (l.license_key ?? '').toLowerCase().includes(_term) ||
        (l.user_name ?? '').toLowerCase().includes(_term);
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const matchesCreator = creatorFilter === "all" || 
        (creatorFilter === "admin" ? !l.created_by : l.created_by === creatorFilter);
      return matchesSearch && matchesStatus && matchesCreator;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  [licenses, searchTerm, statusFilter, creatorFilter]);

  const paginatedLicenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLicenses.slice(start, start + itemsPerPage);
  }, [filteredLicenses, currentPage]);

  const totalPages = Math.ceil(filteredLicenses.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, creatorFilter]);

   const createLicense = async () => {
     if (creating) return;
 
     let days = 0;
     let isDaily = false;
     let isFree = false;
 
     if (licenseType === "free") {
       const mins = parseFloat(freeMinutes);
       if (isNaN(mins) || mins <= 0 || mins > 30) {
         toast.error("O teste grátis deve ser entre 1 e 30 minutos.");
         return;
       }
       days = mins / 1440.0; // minutes to days
       isFree = true;
     } else if (licenseType === "daily") {
       days = parseFloat(dailyDays);
       if (isNaN(days) || days <= 0) {
         toast.error("Por favor, insira uma quantidade válida de dias.");
         return;
       }
       isDaily = true;
     } else {
       days = durationDays === "custom" ? parseFloat(customDays) : parseFloat(durationDays);
       if (isNaN(days) || days <= 0) {
         toast.error("Por favor, selecione uma duração válida.");
         return;
       }
     }
 
    const trimmedName = userName.trim();
    const trimmedEmail = clientEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Email inválido. Verifique o endereço digitado.");
      return;
    }

    setCreating(true);
    try {
      const randomStr = Math.random().toString(36).substring(2, 12).toUpperCase() + 
                        Math.random().toString(36).substring(2, 12).toUpperCase();
       const key = (licenseType === "free" || days <= 0.021) ? `ZDRX-FREE-${randomStr.substring(0, 14)}` : `ZDRX-${randomStr.substring(0, 20)}`;
       const isLifetime = days >= 9999 && licenseType === "standard";
      const expiresAt = isLifetime ? null : new Date(Date.now() + days * 86400000).toISOString();
      const { error } = await supabase.from("licenses").insert({
        license_key: key,
        user_name: trimmedName || null,
        client_email: trimmedEmail || null,
        client_phone: clientPhone.trim() || null,
        duration_days: days,
        lifetime: isLifetime,
         status: "active",
         is_daily: isDaily,
        expires_at: expiresAt,
        max_sessions: 1,
        created_by: session?.user?.id || null,
      });
      if (error) throw error;
      
      toast.success("Chave gerada: " + key);
      setUserName("");
      setClientEmail("");
      setClientPhone("");
      setIsCreateDialogOpen(false);
      refetch();
    } catch (e: any) {
      toast.error("Erro inesperado: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteLicense = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("licenses").delete().eq("id", id);
      if (error) {
        toast.error("Erro ao excluir: " + error.message);
      } else {
        toast.success("Excluída com sucesso");
        refetch();
      }
    } catch (e: any) {
      toast.error("Erro inesperado: " + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const revokeLicense = async (id: string) => {
    setRevokingId(id);
    try {
      const { error } = await supabase.from("licenses").update({ status: "revoked" }).eq("id", id);
      if (error) {
        toast.error("Erro ao revogar: " + error.message);
      } else {
        toast.success("Acesso revogado");
        refetch();
      }
    } catch (e: any) {
      toast.error("Erro inesperado: " + e.message);
    } finally {
      setRevokingId(null);
    }
  };

  const renewLicense = async (license: License) => {
    const days = parseFloat(renewDays);
    if (isNaN(days) || days <= 0) {
      toast.error("Por favor, insira uma quantidade válida de dias.");
      return;
    }
    setRenewingId(license.id);
    try {
      const currentExpiry = license.expires_at ? new Date(license.expires_at) : new Date();
      const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate.getTime() + days * 86400000).toISOString();
      
      const { error } = await supabase
        .from("licenses")
        .update({ 
          expires_at: newExpiry,
          status: "active"
        })
        .eq("id", license.id);

      if (error) throw error;
      
      toast.success(`Licença renovada por mais ${days} dias!`);
      setRenewOpenId(null);
      refetch();
    } catch (e: any) {
      toast.error("Erro ao renovar: " + e.message);
    } finally {
      setRenewingId(null);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      toast.success("Copiado!");
    }).catch(() => {
      toast.error("Não foi possível copiar a chave");
    });
  };

  const getRemainingTime = (expiresAt: string | null) => {
    if (!expiresAt) return "Vitalícia";
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return "Expirada";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m rest.`;
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<Key className="h-5 w-5" />} label="Total" value={stats.total} bg="bg-blue-500/10" color="text-blue-400" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Ativas" value={stats.active} bg="bg-success/10" color="text-success" />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Expiradas" value={stats.expired} bg="bg-warning/10" color="text-warning" />
        <StatCard icon={<Shield className="h-5 w-5" />} label="Revogadas" value={stats.revoked} bg="bg-destructive/10" color="text-destructive" />
      </div>

      <Card className="glass-card shadow-2xl border-border overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 font-black text-2xl">
                <Key className="h-6 w-6 text-primary" /> Licenças
              </CardTitle>
              <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Gerenciamento de acesso dos clientes</CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-11 px-6 font-black rounded-xl shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 text-foreground transition-all active:scale-95">
                    <Plus className="h-4 w-4 mr-2" /> NOVA LICENÇA
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-primary/20 text-foreground max-w-md rounded-3xl p-6">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                      <Plus className="h-5 w-5 text-primary" /> Gerar Nova Chave
                    </DialogTitle>
                    <DialogDescription>Crie uma nova licença de acesso para um cliente.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary">Cliente</label>
                      <Input placeholder="Nome do cliente" value={userName} onChange={e => setUserName(e.target.value)} className="bg-background/40 border-border/50 rounded-xl h-12" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Email</label>
                        <Input type="email" placeholder="email@exemplo.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="bg-background/40 border-border/50 rounded-xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Telefone</label>
                        <Input placeholder="(00) 00000-0000" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="bg-background/40 border-border/50 rounded-xl h-12" />
                      </div>
                    </div>
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-primary">Tipo de Licença</label>
                         <Select value={licenseType} onValueChange={(v) => setLicenseType(v as "standard" | "daily" | "free")}>
                           <SelectTrigger className="bg-background/40 border-border/50 rounded-xl h-12"><SelectValue /></SelectTrigger>
                           <SelectContent className="bg-background border-border">
                             <SelectItem value="standard">Padrão (7d, 30d, etc)</SelectItem>
                             <SelectItem value="daily">Diária (Tokens Diários)</SelectItem>
                             <SelectItem value="free">Teste Grátis (Sem custo)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
 
                       {licenseType === "standard" && (
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-primary">Duração</label>
                             <Select value={durationDays} onValueChange={setDurationDays}>
                               <SelectTrigger className="bg-background/40 border-border/50 rounded-xl h-12"><SelectValue /></SelectTrigger>
                               <SelectContent className="bg-background border-border">
                                 <SelectItem value="7">7 Dias</SelectItem>
                                 <SelectItem value="30">30 Dias</SelectItem>
                                 <SelectItem value="365">1 Ano</SelectItem>
                                 <SelectItem value="36500">Vitalícia</SelectItem>
                                 <SelectItem value="custom">Personalizado</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                           {durationDays === "custom" && (
                             <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-primary">Dias</label>
                               <Input type="number" value={customDays} onChange={e => setCustomDays(e.target.value)} className="bg-background/40 border-border/50 rounded-xl h-12" min="1" />
                             </div>
                           )}
                         </div>
                       )}
 
                       {licenseType === "daily" && (
                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-primary">Quantidade de Dias</label>
                           <Input type="number" value={dailyDays} onChange={e => setDailyDays(e.target.value)} className="bg-background/40 border-border/50 rounded-xl h-12" min="1" />
                           <p className="text-[10px] text-muted-foreground italic">* Cada dia consumirá 1 token diário do revendedor.</p>
                         </div>
                       )}
 
                       {licenseType === "free" && (
                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-primary">Minutos (Máx 30)</label>
                           <Input type="number" value={freeMinutes} onChange={e => setFreeMinutes(e.target.value)} className="bg-background/40 border-border/50 rounded-xl h-12" min="1" max="30" />
                           <p className="text-[10px] text-muted-foreground italic">* Licenças de teste não consomem tokens.</p>
                         </div>
                       )}
                     </div>
                    <Button onClick={createLicense} disabled={creating} className="w-full h-14 bg-primary hover:bg-primary/90 text-foreground font-black rounded-xl shadow-xl mt-4">
                      {creating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} GERAR CHAVE AGORA
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="icon" onClick={refetch} className="rounded-xl h-11 w-11 border-border bg-muted/40" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="p-4 border-b border-white/5 bg-black/10 backdrop-blur-xl flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Pesquisar por chave ou nome..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="bg-black/10 border-white/10 rounded-xl h-11 pl-12 focus:ring-primary/20 backdrop-blur-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-black/10 border-white/10 rounded-xl h-11 w-full md:w-[130px] text-xs font-bold backdrop-blur-xl">
                <Filter className="h-3 w-3 mr-2 text-primary" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/10 text-foreground">
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
                <SelectItem value="revoked">Revogadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="bg-black/10 border-white/10 rounded-xl h-11 w-full md:w-[150px] text-xs font-bold backdrop-blur-xl">
                <User className="h-3 w-3 mr-2 text-primary" />
                <SelectValue placeholder="Criado por" />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/10 text-foreground">
                <SelectItem value="all">Todos Autores</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                {resellers.filter(r => r.user_id).map(r => (
                  <SelectItem key={r.id} value={r.user_id!}>
                    {(r as any).profiles?.full_name || r.email?.split('@')[0] || "Revendedor"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter !== "all" || creatorFilter !== "all") && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setCreatorFilter("all");
                }}
                className="h-11 px-3 text-[10px] font-black uppercase text-muted-foreground hover:text-foreground"
              >
                LIMPAR
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          <div className="p-2 sm:p-3 space-y-1.5">
            {paginatedLicenses.map(l => {
              const remaining = getRemainingTime(l.expires_at);
              const isExpired = remaining === "Expirada";
              const isLifetime = remaining === "Vitalícia";
              let dashOffset = 25;
              let ringClass = "text-primary";
              let days = 0;
              if (isLifetime) {
                dashOffset = 0;
                ringClass = "text-success";
              } else if (isExpired) {
                dashOffset = 92;
                ringClass = "text-destructive";
              } else if (l.expires_at) {
                const ms = new Date(l.expires_at).getTime() - Date.now();
                days = Math.max(0, Math.floor(ms / 86400000));
                const pct = Math.min(1, days / 30);
                dashOffset = Math.round(100 - pct * 100);
                if (days < 3) ringClass = "text-destructive";
                else if (days < 7) ringClass = "text-warning";
                else ringClass = "text-primary";
              }
              const ringLabel = isLifetime ? "∞" : isExpired ? "0" : `${days}d`;
              const remainingClass = isExpired
                ? "text-destructive"
                : !isLifetime && days < 3
                ? "text-destructive/80"
                : !isLifetime && days < 7
                ? "text-warning"
                : "text-foreground";
              const authorName = (() => {
                const reseller = resellers.find(r => r.user_id === l.created_by);
                if (reseller) return (reseller as any).profiles?.full_name || reseller.email?.split('@')[0] || "Revendedor";
                const user = users.find(u => u.id === l.created_by);
                if (user) return user.full_name || "Admin";
                return l.created_by ? "Admin/User" : "Admin";
              })();
              return (
            <div key={l.id} className="group glass-card relative flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 p-3 sm:p-4 rounded-2xl border border-white/[0.06] hover:border-primary/15 transition-all duration-300 shadow-sm">
              {/* Left: key + meta */}
              <div className="flex flex-col gap-2 min-w-0 md:min-w-[320px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <code className="font-mono text-xs sm:text-sm font-bold text-primary tracking-wider truncate max-w-[220px] sm:max-w-none">{l.license_key}</code>
                  <StatusBadge status={l.status} />
                </div>
                <div className="flex items-center gap-4 sm:gap-6 text-[10px] text-muted-foreground/90 font-semibold uppercase tracking-widest">
                  <div>Cliente:<span className="text-foreground ml-1.5 normal-case font-medium">{l.user_name || "—"}</span></div>
                  <div>Autor:<span className="text-foreground/80 ml-1.5 normal-case font-medium truncate" title={l.created_by || "Admin"}>{authorName}</span></div>
                </div>
              </div>

              {/* Middle: expiry ring */}
              <div className="flex items-center gap-3 md:px-6 md:border-x md:border-white/[0.07]">
                <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-white/5" />
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" fill="transparent" strokeDasharray="100" strokeDashoffset={dashOffset} pathLength={100} strokeLinecap="round" className={ringClass} />
                  </svg>
                  <span className={`absolute text-[10px] font-bold ${ringClass}`}>{ringLabel}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground/80 tracking-tight font-semibold">Expira em</span>
                  <span className={`text-sm font-semibold ${remainingClass}`}>{remaining}</span>
                </div>
              </div>

              {/* Usage: prompts + editing time */}
              <div className="flex items-center gap-4 sm:gap-5 md:px-4 md:border-r md:border-white/[0.07]">
                <div className="flex flex-col items-start">
                  <span className="text-[9px] uppercase text-muted-foreground/70 tracking-widest font-semibold">Prompts</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{l.prompts_count ?? 0}</span>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[9px] uppercase text-muted-foreground/70 tracking-widest font-semibold">Edição</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {(() => {
                      const s = l.editing_seconds ?? 0;
                      if (s <= 0) return "0m";
                      const h = Math.floor(s / 3600);
                      const m = Math.floor((s % 3600) / 60);
                      return h > 0 ? `${h}h ${m}m` : `${m}m`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1 md:pl-2 justify-end">
                <button title="Copiar chave" aria-label="Copiar chave" onClick={() => copyKey(l.license_key ?? '')} className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
                <Dialog>
                  <DialogTrigger asChild>
                    <button title="Detalhes" aria-label="Ver detalhes da licença" className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="glass-card border-primary/20 text-foreground max-w-[calc(100vw-2rem)] sm:max-w-md rounded-[1.5rem] sm:rounded-3xl p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-black">
                        <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Detalhes
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 gap-3 sm:gap-4 py-3 sm:py-4">
                      <div className="p-3 sm:p-4 bg-muted/40 rounded-xl sm:rounded-2xl border border-border space-y-2 sm:space-y-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase text-primary/70 tracking-widest mb-1">Chave</span>
                          <code className="text-xs sm:text-sm font-mono font-black break-all bg-background/30 p-2 rounded-lg">{l.license_key}</code>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1"><User className="h-3 w-3" /> Cliente</span>
                            <span className="text-sm font-bold">{l.user_name || "Não informado"}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1"><Shield className="h-3 w-3" /> Status</span>
                            <div className="mt-1"><StatusBadge status={l.status} /></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Email</span>
                            <span className="text-xs font-bold break-all">{l.client_email || "Não informado"}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Telefone</span>
                            <span className="text-xs font-bold">{l.client_phone || "Não informado"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-muted/40 rounded-2xl border border-border flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo Restante</span>
                          <span className={`text-sm font-bold ${getRemainingTime(l.expires_at) === "Expirada" ? "text-destructive" : "text-success"}`}>
                            {getRemainingTime(l.expires_at)}
                          </span>
                        </div>
                        <div className="p-4 bg-muted/40 rounded-2xl border border-border flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1"><Calendar className="h-3 w-3" /> Pagamento</span>
                          <span className="text-sm font-bold">
                            {new Date(l.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/40 rounded-2xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1"><Smartphone className="h-3 w-3" /> Dispositivo Ativado em</span>
                        <span className="text-sm font-bold">
                          {l.activated_at ? new Date(l.activated_at).toLocaleString("pt-BR") : "Ainda não ativado"}
                        </span>
                      </div>

                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-3">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Supervisão de Uso
                        </span>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Prompts Enviados</span>
                            <span className="text-lg font-black text-foreground">{l.prompts_count || 0}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Tempo de Edição</span>
                            <span className="text-lg font-black text-foreground">
                              {l.editing_seconds ? `${Math.floor(l.editing_seconds / 3600)}h ${Math.floor((l.editing_seconds % 3600) / 60)}m` : "0m"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={renewOpenId === l.id} onOpenChange={open => setRenewOpenId(open ? l.id : null)}>
                  <DialogTrigger asChild>
                    <button title="Renovar" aria-label="Renovar licença" className="p-2.5 rounded-xl text-muted-foreground hover:text-success hover:bg-success/10 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="glass-card border-primary/20 text-foreground max-w-[calc(100vw-2rem)] sm:max-w-xs rounded-[1.5rem] sm:rounded-3xl p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-lg font-black">
                        <RefreshCw className="h-4 w-4 text-primary" /> Renovar Licença
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground text-xs">
                        Adicione dias de acesso para esta chave.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Dias Adicionais</label>
                        <Input 
                          type="number" 
                          value={renewDays} 
                          onChange={e => setRenewDays(e.target.value)}
                          className="bg-background/40 border-border/50 rounded-xl h-12 focus:ring-primary/20"
                          min="1"
                        />
                      </div>
                      <Button 
                        onClick={() => renewLicense(l)} 
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-foreground font-black rounded-xl"
                        disabled={renewingId === l.id}
                      >
                        {renewingId === l.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        CONFIRMAR RENOVAÇÃO
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="w-px h-6 bg-white/5 mx-1" />

                {l.status !== "revoked" ? (
                  <button title="Revogar" aria-label="Revogar licença" onClick={() => revokeLicense(l.id)} disabled={revokingId === l.id} className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 disabled:opacity-50">
                    {revokingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                ) : (
                  <button title="Excluir" aria-label="Excluir licença permanentemente" onClick={() => deleteLicense(l.id)} disabled={deletingId === l.id} className="p-2.5 rounded-xl text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50">
                    {deletingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
              );
            })}
            {filteredLicenses.length === 0 && (
              <div className="p-20 text-center text-foreground/20">
                <Search className="h-10 w-10 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhuma licença encontrada</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between bg-background/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Página {currentPage} de {totalPages} ({filteredLicenses.length} licenças)
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  className="rounded-xl border-border bg-muted/40 h-8 text-[10px] font-black"
                >
                  ANTERIOR
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  className="rounded-xl border-border bg-muted/40 h-8 text-[10px] font-black"
                >
                  PRÓXIMA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionsTab({ sessions, licenses, loading, refetch }: { sessions: Session[]; licenses: License[]; loading: boolean; refetch: () => void }) {
  const [droppingId, setDroppingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [droppingAll, setDroppingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingSessionAction, setPendingSessionAction] = useState<{ kind: 'all' } | { kind: 'single'; id: string } | null>(null);
  const pendingSessionLoading = !!droppingId || droppingAll;
  const itemsPerPage = 20;

  // Fetch resellers for the filter
  useEffect(() => {
    let cancelled = false;
    supabase.from("resellers").select("*, profiles:user_id(full_name)").then(({ data }) => {
      if (!cancelled && data) setResellers(data as any);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const license = licenses.find(l => l.id === s.license_id);
      const searchStr = searchTerm.toLowerCase();
      
      const matchesSearch = (
        (license?.user_name?.toLowerCase().includes(searchStr)) ||
        (license?.license_key?.toLowerCase().includes(searchStr)) ||
        (s.session_id.toLowerCase().includes(searchStr))
      );

      const matchesCreator = creatorFilter === "all" || 
        (creatorFilter === "admin" ? !license?.created_by : license?.created_by === creatorFilter);

      return matchesSearch && matchesCreator;
    });
  }, [sessions, licenses, searchTerm, creatorFilter]);

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, creatorFilter]);

  const stats = useMemo(() => ({
    total: sessions.length,
    filtered: filteredSessions.length
  }), [sessions, filteredSessions]);

  const dropSession = async (id: string) => {
    setDroppingId(id);
    const { error } = await supabase.from("sessions").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error("Erro ao derrubar sessão: " + error.message);
    } else {
      toast.success("Sessão derrubada");
      refetch();
    }
    setDroppingId(null);
  };

  const dropAllSessions = async () => {
    setDroppingAll(true);
    try {
      const { error } = await supabase.from("sessions").update({ is_active: false }).eq("is_active", true);
      if (error) throw error;
      toast.success("Todas as sessões foram derrubadas");
      refetch();
    } catch (e: any) {
      toast.error("Erro ao derrubar sessões: " + e.message);
    } finally {
      setDroppingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Activity className="h-5 w-5" />} 
          label="Sessões Ativas" 
          value={stats.total} 
          bg="bg-success/10" 
          color="text-success" 
        />
        <div className="md:col-span-2 flex items-end justify-end gap-3 pb-2">
          <Button 
            variant="destructive" 
            onClick={dropAllSessions} 
            disabled={stats.total === 0 || droppingAll}
            className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-destructive/20"
          >
            {droppingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Derrubar Todas
          </Button>
          <Button variant="outline" size="icon" onClick={refetch} className="h-12 w-12 rounded-2xl border-border bg-muted/40 shadow-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card className="glass-card shadow-2xl border-border overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-black/10 backdrop-blur-xl flex flex-col md:flex-row gap-3">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Filtrar por usuário, chave ou ID da sessão..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="bg-black/10 border-white/10 rounded-xl h-12 pl-12 focus:ring-primary/20 backdrop-blur-xl"
            />
          </div>
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger className="bg-black/10 border-white/10 rounded-xl h-12 w-full md:w-[200px] text-xs font-bold backdrop-blur-xl">
              <User className="h-3 w-3 mr-2 text-primary" />
              <SelectValue placeholder="Criado por" />
            </SelectTrigger>
            <SelectContent className="glass-card border-white/10 text-foreground">
              <SelectItem value="all">Todos Autores</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              {resellers.filter(r => r.user_id).map(r => (
                <SelectItem key={r.id} value={r.user_id!}>
                  {(r as any).profiles?.full_name || r.email?.split('@')[0] || "Revendedor"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {paginatedSessions.map(s => {
              const license = licenses.find(l => l.id === s.license_id);
              return (
                <div key={s.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success relative">
                      <Activity className="h-5 w-5" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-black animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">{license?.user_name || license?.client_email || "Usuário Desconhecido"}</span>
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[8px] font-black uppercase tracking-widest px-1.5 h-4">ONLINE</Badge>
                        {license?.lifetime && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[8px] font-black uppercase tracking-tighter h-4 px-1.5">VITALÍCIO</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[10px] font-mono text-primary/60 font-bold">{license?.license_key || "CHAVE-N/A"}</span>
                        <span className="text-[10px] text-foreground/20 font-mono flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          HB: {new Date(s.last_heartbeat).toLocaleTimeString("pt-BR")}
                        </span>
                        <span className="text-[10px] text-foreground/20 font-mono hidden sm:inline">• ID: {s.session_id.substring(0, 12)}...</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-border/50 sm:border-0 pt-3 sm:pt-0">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setPendingSessionAction({ kind: 'single', id: s.id })} 
                      disabled={droppingId === s.id}
                      className="text-destructive hover:bg-destructive/10 rounded-xl px-4 h-10 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      {droppingId === s.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Derrubar
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {paginatedSessions.length === 0 && (
              <div className="p-20 text-center">
                <Activity className="h-10 w-10 text-foreground/10 mx-auto mb-4" />
                <p className="text-sm font-black text-foreground/20 uppercase tracking-widest">
                  {searchTerm ? "Nenhuma sessão encontrada para esta busca" : "Nenhuma sessão ativa no momento"}
                </p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between bg-background/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Página {currentPage} de {totalPages} ({filteredSessions.length} sessões)
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  className="rounded-xl border-border bg-muted/40 h-8 text-[10px] font-black"
                >
                  ANTERIOR
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  className="rounded-xl border-border bg-muted/40 h-8 text-[10px] font-black"
                >
                  PRÓXIMA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    {/* Session action confirmation dialog */}
    <AlertDialog open={!!pendingSessionAction} onOpenChange={(o) => !o && !pendingSessionLoading && setPendingSessionAction(null)}>
      <AlertDialogContent className="glass-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingSessionAction?.kind === 'all' ? 'Derrubar todas as sessões?' : 'Derrubar sessão?'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {pendingSessionAction?.kind === 'all'
              ? `Todas as ${stats.total} sessões ativas serão encerradas imediatamente.`
              : 'A sessão será encerrada e o usuário precisará reconectar.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendingSessionLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pendingSessionLoading}
            className="bg-destructive hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              if (pendingSessionAction?.kind === 'all') dropAllSessions();
              else if (pendingSessionAction?.kind === 'single') dropSession(pendingSessionAction.id);
            }}>
            {pendingSessionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}

function NotificationsTab({ notifications, loading, refetch }: { notifications: Notification[]; loading: boolean; refetch: () => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingNotifDeleteId, setPendingNotifDeleteId] = useState<string | null>(null);
  const [pendingNotifLoading, setPendingNotifLoading] = useState(false);

  const sendNotification = async () => {
    if (!title || !message) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("notifications").insert({ title, message });
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
    } else {
      toast.success("Notificação enviada!");
      setTitle("");
      setMessage("");
      refetch();
    }
    setSending(false);
  };

  const deleteNotification = async (id: string) => { 
    setPendingNotifLoading(true);
    setDeletingId(id);
    const { error } = await supabase.from("notifications").delete().eq("id", id); 
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Excluída");
      refetch(); 
    }
    setDeletingId(null);
    setPendingNotifLoading(false);
    setPendingNotifDeleteId(null);
  };

  return (
    <Card className="glass-card shadow-2xl border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notificações Globais</CardTitle>
        <Button variant="outline" size="sm" onClick={refetch} className="rounded-xl" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-6 bg-muted/20 p-5 rounded-3xl border border-border/50 shadow-inner">
          <Input placeholder="Título do Alerta" value={title} onChange={e => setTitle(e.target.value)} className="bg-muted/40 border-border/50 rounded-2xl h-11" />
          <Textarea placeholder="Mensagem do anúncio..." value={message} onChange={e => setMessage(e.target.value)} className="bg-muted/40 border-border/50 rounded-2xl min-h-[100px]" />
          <Button onClick={sendNotification} disabled={sending} className="w-full h-12 font-black rounded-2xl shadow-xl active:scale-[0.98] transition-all">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />} 
            ENVIAR AGORA
          </Button>
        </div>
        <div className="space-y-3 mt-8">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/50 mb-2 px-2">Histórico Recente</h4>
          {notifications.map(n => (
            <div key={n.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-black/10 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-lg group hover:border-primary/15 transition-all gap-4">
              <div className="flex flex-col gap-1 pr-4 overflow-hidden">
                <span className="font-black text-sm text-foreground truncate">{n.title}</span>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                <span className="text-[8px] text-foreground/20 font-bold mt-1 uppercase">{new Date(n.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setPendingNotifDeleteId(n.id)} 
                disabled={deletingId === n.id}
                className="text-destructive hover:bg-destructive/10 rounded-full shrink-0"
              >
                {deletingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="text-center py-10 opacity-30">
              <Bell className="h-8 w-8 mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Nenhuma notificação ativa</p>
            </div>
          )}
        </div>
      </CardContent>
    {/* Delete notification confirmation dialog */}
    <AlertDialog open={!!pendingNotifDeleteId} onOpenChange={(o) => !o && !pendingNotifLoading && setPendingNotifDeleteId(null)}>
      <AlertDialogContent className="glass-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir notificação?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            A notificação será removida do histórico. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendingNotifLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pendingNotifLoading}
            className="bg-destructive hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); if (pendingNotifDeleteId) deleteNotification(pendingNotifDeleteId); }}>
            {pendingNotifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </Card>
  );
}

function VersionsTab({ versions, loading, refetch }: { versions: ExtensionVersion[]; loading: boolean; refetch: () => void }) {
  const [version, setVersion] = useState("");
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingVersionDeleteId, setPendingVersionDeleteId] = useState<string | null>(null);
  const [pendingVersionLoading, setPendingVersionLoading] = useState(false);

  const registerVersion = async () => {
    if (!version) {
      toast.error("Informe a versão");
      return;
    }
    setRegistering(true);
    const { error } = await supabase.from("extension_versions").insert({ 
      version, 
      is_alert_active: true,
      changelog: "Atualização de sistema"
    }); 
    if (error) {
      toast.error("Erro ao registrar: " + error.message);
    } else {
      toast.success("Versão registrada!");
      setVersion(""); 
      refetch(); 
    }
    setRegistering(false);
  };

  const deleteVersion = async (id: string) => { 
    setPendingVersionLoading(true);
    setDeletingId(id);
    const { error } = await supabase.from("extension_versions").delete().eq("id", id); 
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Log excluído");
      refetch(); 
    }
    setDeletingId(null);
    setPendingVersionLoading(false);
    setPendingVersionDeleteId(null);
  };

  return (
    <Card className="glass-card shadow-2xl border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Versões do APK / Mod Menu</CardTitle>
        <Button variant="outline" size="sm" onClick={refetch} className="rounded-xl" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20 text-primary">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <p className="font-black text-sm text-foreground">ZDRX Mod Menu APK (v1.0.0)</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Build pronta para Android</p>
            </div>
          </div>
          <a href="/zdrx-mod-menu.apk" download="zdrx-mod-menu.apk" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2 bg-primary hover:bg-primary/90 text-foreground">
              <Download className="h-4 w-4" /> Baixar APK
            </Button>
          </a>
        </div>
        <div className="flex gap-3 mb-6 bg-muted/20 p-5 rounded-3xl border border-border/50 shadow-inner">
          <Input placeholder="v1.0.0" value={version} onChange={e => setVersion(e.target.value)} className="bg-muted/40 border-border/50 rounded-2xl h-11" />
          <Button onClick={registerVersion} disabled={registering} className="h-11 px-6 font-black rounded-2xl transition-all">
            {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : "REGISTRAR"}
          </Button>
        </div>
        <div className="space-y-3">
          {versions.map(v => (
            <div key={v.id} className="flex justify-between items-center p-4 bg-black/10 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-lg hover:border-primary/15 transition-all group">
              <div className="flex gap-4 items-center">
                <div className="bg-primary/20 p-2.5 rounded-xl text-primary font-black text-xs min-w-[60px] text-center border border-primary/20 shadow-lg shadow-primary/10">v{v.version}</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Publicado em</span>
                  <span className="text-xs font-bold text-foreground">{new Date(v.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setPendingVersionDeleteId(v.id)} 
                disabled={deletingId === v.id}
                className="text-destructive hover:bg-destructive/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
              >
                {deletingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          ))}
          {versions.length === 0 && (
            <div className="text-center py-12 opacity-20">
              <RefreshCw className="h-10 w-10 mx-auto mb-3" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">Sem logs de versão</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type PreviewVariant = "gate" | "sidepanel" | "floating";

function ExtensionPreview({
  buildVersion,
  variant,
  label,
  subtitle,
}: {
  buildVersion: string;
  variant: PreviewVariant;
  label: string;
  subtitle: string;
}) {
  // Real preview: carrega assets da build publicada dentro de um iframe,
  // injetando um shim das APIs `chrome.*` para evitar quebra dos scripts da extensão.
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSrcDoc("");
    (async () => {
      try {
        const baseTag = `<base href="${origin}/ext_build_v62/">`;

        // Seed inicial do storage shim por variante:
        //  - gate:      vazio -> sidepanel renderiza a tela de ativação de licença
        //  - sidepanel: licença válida pré-preenchida -> UI principal aparece
        //  - floating:  irrelevante (renderiza HTML próprio)
        const seed =
          variant === "sidepanel"
            ? {
                ql_license_valid: true,
                ql_license_key: "HYPER-PREVIEW-DEMO",
                ql_user_name: "Preview User",
                ql_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
                ql_activated_at: new Date().toISOString(),
                ql_license_status: "active",
                ql_session_id: "preview-session",
              }
            : {};

        const shim = `<script>(function(){
          try {
            var noop = function(){};
            var makeEvent = function(){ return { addListener: noop, removeListener: noop, hasListener: function(){ return false; } }; };
            var mem = ${JSON.stringify(seed)};
            var storageArea = {
              get: function(keys, cb){
                var out = {};
                try {
                  if (keys == null) { out = Object.assign({}, mem); }
                  else if (typeof keys === 'string') { if (keys in mem) out[keys] = mem[keys]; }
                  else if (Array.isArray(keys)) { keys.forEach(function(k){ if (k in mem) out[k] = mem[k]; }); }
                  else if (typeof keys === 'object') { Object.keys(keys).forEach(function(k){ out[k] = (k in mem) ? mem[k] : keys[k]; }); }
                } catch(e){}
                if (typeof cb === 'function') cb(out);
                return Promise.resolve(out);
              },
              set: function(obj, cb){
                try { Object.assign(mem, obj || {}); } catch(e){}
                if (typeof cb === 'function') cb();
                return Promise.resolve();
              },
              remove: function(keys, cb){
                try { (Array.isArray(keys) ? keys : [keys]).forEach(function(k){ delete mem[k]; }); } catch(e){}
                if (typeof cb === 'function') cb();
                return Promise.resolve();
              },
              clear: function(cb){ mem = {}; if (typeof cb === 'function') cb(); return Promise.resolve(); },
              onChanged: makeEvent()
            };
            var sendMessage = function(){
              var cb = arguments[arguments.length - 1];
              var resp = { ok: false, preview: true };
              if (typeof cb === 'function') { try { cb(resp); } catch(e){} }
              return Promise.resolve(resp);
            };
            var chromeShim = {
              runtime: {
                id: 'hb-preview',
                getURL: function(p){ try { return new URL(p, document.baseURI).href; } catch(e){ return p; } },
                getManifest: function(){ return { version: 'preview', name: 'HyperBuild Preview' }; },
                sendMessage: sendMessage,
                connect: function(){ return { postMessage: noop, disconnect: noop, onMessage: makeEvent(), onDisconnect: makeEvent() }; },
                onMessage: makeEvent(),
                onConnect: makeEvent(),
                onInstalled: makeEvent(),
                onStartup: makeEvent(),
                lastError: null
              },
              storage: { local: storageArea, sync: storageArea, session: storageArea, onChanged: makeEvent() },
              tabs: {
                query: function(q, cb){ var r = [{ id: 0, url: 'https://lovable.dev/projects/preview', title: 'Preview' }]; if (typeof cb === 'function') cb(r); return Promise.resolve(r); },
                sendMessage: sendMessage,
                create: noop, update: noop, remove: noop,
                onUpdated: makeEvent(), onActivated: makeEvent(), onRemoved: makeEvent()
              },
              sidePanel: { open: noop, setOptions: noop, setPanelBehavior: noop },
              action: { onClicked: makeEvent(), setBadgeText: noop, setBadgeBackgroundColor: noop, setIcon: noop, setTitle: noop },
              scripting: { executeScript: function(){ return Promise.resolve([]); }, insertCSS: function(){ return Promise.resolve(); } },
              windows: { create: noop, getCurrent: function(cb){ var w = { id: 0 }; if (typeof cb === 'function') cb(w); return Promise.resolve(w); } },
              i18n: { getMessage: function(k){ return k; }, getUILanguage: function(){ return 'pt-BR'; } },
              permissions: { contains: function(_, cb){ if (typeof cb === 'function') cb(true); return Promise.resolve(true); }, request: function(_, cb){ if (typeof cb === 'function') cb(true); return Promise.resolve(true); } }
            };
            window.chrome = Object.assign({}, window.chrome || {}, chromeShim);
            window.__HB_PREVIEW__ = true;

            // Não deixa erros isolados derrubarem a UI do preview.
            window.addEventListener('error', function(e){ try { console.warn('[hb-preview]', e.message); } catch(_){} });
            window.addEventListener('unhandledrejection', function(e){ try { console.warn('[hb-preview]', e.reason); } catch(_){} });
          } catch (e) {
            try { console.warn('[hb-preview] shim falhou:', e); } catch(_){}
          }
        })();</script>`;

        let html: string;

        if (variant === "floating") {
          // Floating panel: monta um host minimalista que carrega floating.css +
          // content-templates.js e renderiza #ql-floating com templateMainUI.
          html = `<!doctype html><html><head>${baseTag}${shim}
            <meta charset="utf-8" />
            <link rel="stylesheet" href="floating.css" />
            <style>
              html,body{margin:0;padding:0;background:#0b0b0f;min-height:100%;font-family:Inter,system-ui,sans-serif;color:#fff;}
              body{display:flex;align-items:flex-start;justify-content:center;padding:18px 12px;}
              #ql-floating{position:relative !important;left:auto !important;top:auto !important;margin:0 auto;}
            </style>
          </head><body>
            <script src="content-templates.js"></script>
            <script>
              (function(){
                try {
                  var box = document.createElement('div');
                  box.id = 'ql-floating';
                  box.className = 'ql-dark ql-rgb-force';
                  box.setAttribute('data-theme','dark');
                  document.body.appendChild(box);
                  if (typeof templateMainUI === 'function') {
                    // Matches the real call in content.js (showMainUI):
                    //   box.innerHTML = templateMainUI(greeting, "", qlMinimized);
                    box.innerHTML = templateMainUI('Preview User', '', false);
                    var tabContent = box.querySelector('#ql-tab-content');
                    if (tabContent && typeof templatePromptContent === 'function') {
                      // Default tab in the real extension is "prompt".
                      tabContent.innerHTML = templatePromptContent();
                    }
                    var exp = box.querySelector('#ql-expires-date');
                    if (exp) exp.textContent = new Date(Date.now()+30*86400000).toLocaleDateString('pt-BR');
                  } else {
                    box.innerHTML = '<div style="padding:24px;color:#bbb;font-size:11px;text-align:center">Falha ao carregar templates do floating.</div>';
                  }
                } catch (e) {
                  document.body.innerHTML = '<pre style="color:#f88;padding:16px;font-size:11px">'+(e && e.message || e)+'</pre>';
                }
              })();
            </script>
          </body></html>`;
        } else {
          const res = await fetch(`/ext_build_v62/sidepanel.html?t=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          html = await res.text();
          // Insere <base> + shim logo após <head> para que os scripts da extensão
          // já encontrem `chrome.*` definido quando rodarem.
          html = html.replace(/<head([^>]*)>/i, function (_m, attrs) {
            return "<head" + attrs + ">\n" + baseTag + "\n" + shim;
          });
        }

        if (!cancelled) setSrcDoc(html);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Falha ao carregar preview");
      }
    })();
    return () => { cancelled = true; };
  }, [origin, reloadKey, variant]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">
            {label}
          </span>
          <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-widest">
            {subtitle} • v{buildVersion}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="text-[9px] font-black text-primary uppercase tracking-widest hover:opacity-80 transition-opacity flex items-center gap-1"
          title="Recarregar preview"
        >
          <RefreshCw className="h-3 w-3" /> Recarregar
        </button>
      </div>
      <div
        className="w-full rounded-[1.5rem] border border-border overflow-hidden shadow-[0_20px_50px_hsl(var(--background)/0.8)] bg-background ring-1 ring-border/30 relative"
        style={{ height: 640 }}
      >
        {error ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="text-xs font-black text-destructive uppercase tracking-widest">Preview indisponível</span>
            <span className="text-[10px] text-muted-foreground">{error}</span>
          </div>
        ) : !srcDoc ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Carregando preview da extensão…
          </div>
        ) : (
          <iframe
            key={reloadKey}
            title={`HyperBuild Extension Preview — ${label}`}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="w-full h-full border-0 block bg-background"
          />
        )}
      </div>
    </div>
  );
}

function ExtensionTab({ licenses, versions }: { licenses: License[]; versions: ExtensionVersion[] }) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildMode, setBuildMode] = useState<"plain" | "obfuscated" | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [fileStatuses, setFileStatuses] = useState<Record<string, "pending" | "ok" | "error">>({});
  const [buildVersion, setBuildVersion] = useState(() => versions[0]?.version || "7.0.7");
  const [lastBuild, setLastBuild] = useState<{ at: string; size: string; duration: string; obfuscated?: boolean } | null>(() => {
    try { return JSON.parse(localStorage.getItem("hb_last_build") || "null"); } catch { return null; }
  });

  // --- Upload & ofuscar arquivo customizado ---
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState<string>("");

  const handleObfuscateUpload = async (file: File) => {
    if (uploadBusy) return;
    setUploadBusy(true);
    setUploadProgress(0);
    setUploadCurrent("");
    try {
      const { default: JSZip } = await import("jszip");
      const name = file.name.toLowerCase();
      if (name.endsWith(".js")) {
        setUploadCurrent(file.name);
        const text = await file.text();
        const out = await obfuscateJsContent(text, file.name);
        setUploadProgress(100);
        saveAs(new Blob([out], { type: "application/javascript" }), file.name.replace(/\.js$/i, ".obfuscated.js"));
        toast.success(`Arquivo ${file.name} ofuscado com sucesso!`);
      } else if (name.endsWith(".zip")) {
        const inZip = await JSZip.loadAsync(file);
        const outZip = new JSZip();
        const entries = Object.values(inZip.files).filter((e) => !e.dir);
        let done = 0;
        for (const entry of entries) {
          setUploadCurrent(entry.name);
          const lower = entry.name.toLowerCase();
          if (lower.endsWith(".js")) {
            const text = await entry.async("string");
            outZip.file(entry.name, await obfuscateJsContent(text, entry.name));
          } else {
            const buf = await entry.async("arraybuffer");
            outZip.file(entry.name, buf);
          }
          done++;
          setUploadProgress(Math.round((done / entries.length) * 100));
        }
        const blob = await outZip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        const baseName = file.name.replace(/\.zip$/i, "");
        saveAs(blob, `${baseName}-obfuscated.zip`);
        toast.success(`Extensão ${file.name} ofuscada com sucesso!`);
      } else {
        toast.error("Formato não suportado. Envie um .js ou .zip da extensão.");
      }
    } catch (e: any) {
      console.error("[upload-obfuscate] erro:", e);
      toast.error("Falha ao ofuscar: " + (e?.message || "erro desconhecido"));
    } finally {
      setUploadBusy(false);
      setUploadCurrent("");
    }
  };

  const onUploadInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) await handleObfuscateUpload(f);
  };

  useEffect(() => {
    let cancelled = false;

    const syncBuildVersion = async () => {
      try {
        const res = await fetch(`${window.location.origin}/ext_build_v62/manifest.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const manifest = await res.json();
        const manifestVersion = typeof manifest?.version === "string" ? manifest.version.trim() : "";

        if (!cancelled && manifestVersion) {
          setBuildVersion(manifestVersion);
          return;
        }
      } catch (error) {
        console.warn("[build] não foi possível ler a versão do manifest publicado no preview:", error);
      }

      if (!cancelled) {
        setBuildVersion(versions[0]?.version || "7.0.7");
      }
    };

    syncBuildVersion();

    return () => {
      cancelled = true;
    };
  }, [versions]);

  const downloadExtension = async (
    opts: { obfuscate: boolean; brand?: { name: string; fileSuffix: string; iconPrefix?: string } } = { obfuscate: false }
  ) => {
    if (isBuilding) return;
    setIsBuilding(true);
    setBuildMode(opts.obfuscate ? "obfuscated" : "plain");
    setProgress(0);
    setCurrentFile("");
    const startedAt = performance.now();
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    // Lista exata de arquivos necessários para a extensão funcionar
    const files = [
      "manifest.json", 
      "background.js", 
      "content.js", 
      "sidepanel.js", 
      "sidepanel.html", 
      "sidepanel.css", 
      "hwFingerprint.js", 
      "sidepanel-templates.js", 
      "pageHook.js", 
      "content-templates.js", 
      "floating.css",
      "upload-manager.js",
      // v6.9 — Fase 2 (HMAC) + UI extras
      "security.js",
      "sidepanel-effects.js",
      "hyper-customize.js",
      "hyper-customize.css",
      // v7.5 — serviços modulares (wave 2 + wave 3 do refactor)
      "services/plan-engine.js",
      "services/content-utils.js",
      "services/chat-history.js",
      "services/file-utils.js",
      // ícones
      "icon16.png",
      "icon48.png",
      "icon128.png"
    ];
    setFileStatuses(Object.fromEntries(files.map(f => [f, "pending"])));

    // Arquivos binários (não passam por replace de string)
    const binaryFiles = new Set(["icon16.png", "icon48.png", "icon128.png"]);

    try {
      let done = 0;
      const fetchPromises = files.map(async (file) => {
        try {
          setCurrentFile(file);
          const remoteName = binaryFiles.has(file) && opts.brand?.iconPrefix
            ? `${opts.brand.iconPrefix}${file}`
            : file;
          const res = await fetch(`${window.location.origin}/ext_build_v62/${remoteName}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`Status ${res.status}`);

          if (binaryFiles.has(file)) {
            const buf = await res.arrayBuffer();
            zip.file(file, buf);
            done++;
            setProgress(Math.round((done / files.length) * 100));
            setFileStatuses(s => ({ ...s, [file]: "ok" }));
            return;
          }

          let content = await res.text();
          
          // Injeção de credenciais de forma segura e precisa ANTES da ofuscação
          if (SUPABASE_URL) {
            content = content.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi, SUPABASE_URL);
          }
          
          if (SUPABASE_ANON_KEY) {
            content = content.replace(/(const|let|var)\s+SUPABASE_ANON_KEY\s*=\s*['"].*?['"]/g, 
              `$1 SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}"`);
          }

          // Rebrand (reseller) — substitui "HyperBuild" pelo nome customizado
          if (opts.brand?.name) {
            const brandName = opts.brand.name;
            if (file === "manifest.json") {
              try {
                const manifestObj = JSON.parse(content);
                manifestObj.name = brandName;
                if (typeof manifestObj.description === "string") {
                  manifestObj.description = manifestObj.description.replace(/HyperBuild/g, brandName);
                }
                if (manifestObj.action?.default_title) {
                  manifestObj.action.default_title = String(manifestObj.action.default_title).replace(/HyperBuild/g, brandName);
                }
                content = JSON.stringify(manifestObj, null, 2);
              } catch {
                content = content.replace(/HyperBuild/g, brandName);
              }
            } else {
              content = content.replace(/HyperBuild/g, brandName);
            }
          }

          // Ofuscação (apenas .js, depois da injeção de credenciais)
          if (opts.obfuscate) {
            content = await obfuscateJsContent(content, file);
          }

          zip.file(file, content);
          done++;
          setProgress(Math.round((done / files.length) * 100));
          setFileStatuses(s => ({ ...s, [file]: "ok" }));
        } catch (err) {
          console.error(`Erro ao processar arquivo ${file}:`, err);
          setFileStatuses(s => ({ ...s, [file]: "error" }));
          throw new Error(`Falha no arquivo ${file}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        }
      });

      await Promise.all(fetchPromises);
      
      const blob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      
      const suffix = opts.obfuscate ? "-obfuscated" : "";
      const baseName = opts.brand?.fileSuffix || "HyperBuild-Pro";
      saveAs(blob, `${baseName}-${buildVersion}${suffix}.zip`);
      const duration = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";
      const size = (blob.size / 1024).toFixed(0) + " KB";
      const meta = { at: new Date().toISOString(), size, duration, obfuscated: opts.obfuscate };
      localStorage.setItem("hb_last_build", JSON.stringify(meta));
      setLastBuild(meta);
      toast.success(opts.obfuscate ? "Build ofuscado concluído!" : "Build concluído com sucesso!");
    } catch (e: any) { 
      console.error("Erro fatal no Build:", e);
      toast.error("Erro crítico no build: " + e.message); 
    } finally { 
      setIsBuilding(false); 
      setBuildMode(null);
      setCurrentFile("");
    }
  };

  const allFiles = Object.keys(fileStatuses);
  const okCount = allFiles.filter(f => fileStatuses[f] === "ok").length;
  const errCount = allFiles.filter(f => fileStatuses[f] === "error").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <Card className="glass-card shadow-2xl border-border bg-background/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8">
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">v{buildVersion} Ready</Badge>
            <div className="p-2 rounded-xl bg-muted/40">
              <Activity className="h-5 w-5 text-warning animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black tracking-tight text-foreground drop-shadow-sm">Build & Deploy</CardTitle>
          <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-2">Gere o pacote oficial da sua extensão</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6 pt-0">
          <div className="p-6 rounded-3xl bg-muted/40 border border-border/50 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Status do Core</p>
                <p className="text-sm font-bold text-foreground">Pronto para Produção</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Segurança</p>
                <p className="text-sm font-bold text-foreground">Ofuscação opcional integrada</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileCode className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Arquivos no Bundle</p>
                <p className="text-sm font-bold text-foreground">18 assets · v{buildVersion}</p>
              </div>
            </div>
            {lastBuild && (
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Último Build</p>
                  <p className="text-sm font-bold text-foreground">
                    {new Date(lastBuild.at).toLocaleString("pt-BR")} · {lastBuild.size} · {lastBuild.duration}
                    {lastBuild.obfuscated && <span className="ml-2 text-purple-400">· ofuscado</span>}
                  </p>
                </div>
              </div>
            )}
          </div>

          {isBuilding && (
            <div className="p-5 rounded-3xl bg-background/40 border border-border/50 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">
                  {buildMode === "obfuscated" ? "Compilando + ofuscando" : "Compilando"} {currentFile || "..."}
                </span>
                <span className="text-primary">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-success">{okCount} ok</span>
                {errCount > 0 && <span className="text-destructive">{errCount} erro</span>}
                <span className="text-muted-foreground">{allFiles.length - okCount - errCount} pendente</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => downloadExtension({ obfuscate: false })}
              disabled={isBuilding}
              className="h-16 text-sm font-black shadow-[0_20px_40px_hsl(var(--primary)/0.35)] bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:scale-[1.02] transition-all active:scale-95 rounded-2xl group"
            >
              {isBuilding && buildMode === "plain"
                ? <Loader2 className="animate-spin mr-2 h-5 w-5" />
                : <Download className="mr-2 h-5 w-5" />}
              BAIXAR BUILD
            </Button>
            <Button
              onClick={() => downloadExtension({ obfuscate: true })}
              disabled={isBuilding}
              className="h-16 text-sm font-black shadow-[0_20px_40px_hsl(var(--neon)/0.4)] bg-gradient-to-r from-neon to-primary-glow text-primary-foreground hover:scale-[1.02] transition-all active:scale-95 rounded-2xl group"
            >
              {isBuilding && buildMode === "obfuscated"
                ? <Loader2 className="animate-spin mr-2 h-5 w-5" />
                : <Shield className="mr-2 h-5 w-5" />}
              BAIXAR OFUSCADO
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground p-4 bg-background/40 rounded-2xl border border-border/50 leading-relaxed font-bold uppercase tracking-wider text-center">
            <span className="text-warning">Build</span>: código nu com credenciais injetadas (debug / dev).
            <br />
            <span className="text-primary">Ofuscado</span>: build + javascript-obfuscator (heavy nos arquivos, light no <code className="text-muted-foreground">background.js</code> por compatibilidade MV3). Use para produção.
          </div>

          {/* Upload customizado para ofuscar */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/5 to-primary-glow/5 border border-primary/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground/80 uppercase tracking-widest">Ofuscar Arquivo Próprio</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Envie um <code className="text-purple-300">.zip</code> da extensão ou um <code className="text-purple-300">.js</code> avulso</p>
              </div>
            </div>

            <label
              htmlFor="hb-obfuscate-upload"
              className={`flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                uploadBusy
                  ? "border-purple-500/40 bg-purple-500/10 cursor-not-allowed"
                  : "border-border hover:border-purple-400/60 hover:bg-purple-500/5"
              }`}
            >
              {uploadBusy ? (
                <>
                  <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
                  <span className="text-[11px] font-black text-foreground/80 uppercase tracking-widest">Ofuscando {uploadCurrent || "..."}</span>
                  <span className="text-[10px] text-purple-300 font-bold">{uploadProgress}%</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[11px] font-black text-foreground/80 uppercase tracking-widest">Clique para selecionar</span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">.zip ou .js — máx. 25 MB</span>
                </>
              )}
              <input
                id="hb-obfuscate-upload"
                type="file"
                accept=".zip,.js,application/zip,application/javascript,text/javascript"
                className="hidden"
                disabled={uploadBusy}
                onChange={onUploadInputChange}
              />
            </label>

            {uploadBusy && (
              <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>

          {/* Reseller — remix da extensão com marca customizada */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                <Package className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground/80 uppercase tracking-widest">Reseller</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                  Remix da extensão com marca <span className="text-cyan-300">Coldlov - M1</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={() => downloadExtension({ obfuscate: false, brand: { name: "Coldlov - M1", fileSuffix: "Coldlov-M1", iconPrefix: "coldlov-" } })}
                disabled={isBuilding}
                className="h-14 text-xs font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.02] transition-all active:scale-95 rounded-2xl"
              >
                {isBuilding && buildMode === "plain"
                  ? <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  : <Download className="mr-2 h-4 w-4" />}
                BAIXAR COLDLOV
              </Button>
              <Button
                onClick={() => downloadExtension({ obfuscate: true, brand: { name: "Coldlov - M1", fileSuffix: "Coldlov-M1", iconPrefix: "coldlov-" } })}
                disabled={isBuilding}
                className="h-14 text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] transition-all active:scale-95 rounded-2xl"
              >
                {isBuilding && buildMode === "obfuscated"
                  ? <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  : <Shield className="mr-2 h-4 w-4" />}
                COLDLOV OFUSCADO
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-center leading-relaxed">
              Substitui <span className="text-muted-foreground">HyperBuild</span> por <span className="text-cyan-300">Coldlov - M1</span> em todo o bundle (manifest, UI, strings).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Preview em Tempo Real</h3>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[9px]">Como seus usuários verão o HyperBuild</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ExtensionPreview
            buildVersion={buildVersion}
            variant="gate"
            label="License Gate"
            subtitle="Ativação"
          />
          <ExtensionPreview
            buildVersion={buildVersion}
            variant="floating"
            label="Floating Panel"
            subtitle="Overlay in-page"
          />
          <ExtensionPreview
            buildVersion={buildVersion}
            variant="sidepanel"
            label="Sidepanel"
            subtitle="Painel lateral"
          />
        </div>
        <p className="text-[9px] text-muted-foreground/60 text-center font-bold uppercase tracking-widest">
          Renderiza assets da build publicada com shim das APIs chrome.*
        </p>
      </div>
    </div>
  );
}


function PaymentsTab({ payments, loading, refetch }: { payments: Payment[]; loading: boolean; refetch: () => Promise<void> }) {
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [filesUrl, setFilesUrl] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setLicenseKey(payment.license_key || "");
    setFilesUrl(payment.files_url || "");
  };

  const generateLicenseKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `ZDRX-${segment()}-${segment()}-${segment()}`;
  };

  const handleAutoProcess = async (payment: Payment) => {
    setIsUpdating(true);
    const newKey = generateLicenseKey();
    const defaultFilesUrl = "https://hyperbuild.cloud/download"; // URL padrão ou do plano
    
    try {
      // 1. Criar a licença na tabela de licenças
      const { error: licenseError } = await supabase
        .from("licenses")
        .insert([{
          license_key: newKey,
          user_name: payment.customer_name,
          status: "active",
          max_sessions: payment.plan_name.toLowerCase().includes("vip") ? 5 : 1
        }]);

      if (licenseError) throw licenseError;

      // 2. Atualizar o pagamento
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          license_key: newKey,
          files_url: defaultFilesUrl,
          payment_status: "completed"
        })
        .eq("id", payment.id);

      if (paymentError) throw paymentError;

      toast.success("Licença gerada e pedido processado!");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao processar: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPayment) return;
    setIsUpdating(true);
    try {
      // Verificar se a licença já existe na tabela de licenças, se não, criar
      const { data: existingLicense } = await supabase
        .from("licenses")
        .select("id")
        .eq("license_key", licenseKey)
        .maybeSingle();

      if (!existingLicense && licenseKey) {
        await supabase.from("licenses").insert([{
          license_key: licenseKey,
          user_name: editingPayment.customer_name,
          status: "active",
          max_sessions: 1
        }]);
      }

      const { error } = await supabase
        .from("payments")
        .update({
          license_key: licenseKey,
          files_url: filesUrl,
          payment_status: "completed"
        })
        .eq("id", editingPayment.id);

      if (error) throw error;
      toast.success("Pagamento atualizado com sucesso!");
      setEditingPayment(null);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const sendToWhatsApp = (payment: Payment) => {
    const message = encodeURIComponent(
      `Olá ${payment.customer_name}!\n\nSeu pedido do plano *${payment.plan_name}* foi processado com sucesso!\n\n` +
      `*Sua Licença:* \`${payment.license_key || "Pendente"}\`\n` +
      `*Seus Arquivos:* ${payment.files_url || "Pendente"}\n\n` +
      `Qualquer dúvida, estamos à disposição no suporte.\n` +
      `Obrigado por escolher ZDRX Mod Menu.`
    );
    const phoneNumber = payment.customer_number.replace(/\D/g, "");
    const formattedPhone = phoneNumber.startsWith("55") ? phoneNumber : `55${phoneNumber}`;
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass-card border-border/50 bg-background/40 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-4 sm:pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Vendas
            </CardTitle>
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[8px] sm:text-[9px] mt-1">
              Acompanhamento de pedidos
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-1 sm:flex-none bg-muted/40 border-border hover:bg-muted/60 text-[8px] sm:text-[9px] font-black uppercase tracking-widest h-9 sm:h-10 px-3 sm:px-4 rounded-xl">
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-6 rounded-[2rem] bg-muted/40 border border-border text-foreground/10">
              <CreditCard className="h-12 w-12" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Nenhum pagamento</h3>
              <p className="text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">Aguardando as primeiras vendas</p>
            </div>
          </div>
        ) : (

          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0 sm:hidden">
                    {payment.customer_name.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground text-sm">{payment.customer_name}</p>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black text-[8px] sm:text-[9px] uppercase tracking-tighter h-5">
                        {payment.plan_name}
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-4 gap-0.5">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5"><Smartphone className="w-3 h-3" /> {payment.customer_number}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 hidden sm:flex"><User className="w-3 h-3" /> {payment.customer_email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-0 border-border/50">
                  <Badge variant="outline" className={`font-black text-[8px] sm:text-[9px] uppercase tracking-tighter h-6 ${
                    payment.payment_status === "completed" ? "bg-success/10 text-success border-success/20" : 
                    payment.payment_status === "paid" ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse" :
                    "bg-warning/10 text-warning border-warning/20"
                  }`}>
                    {payment.payment_status === "completed" ? "PROCESSADO" : 
                     payment.payment_status === "paid" ? "PAGO (PIX)" : "AGUARDANDO"}
                  </Badge>
                  
                  <div className="flex gap-2">
                    {payment.payment_status === "paid" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAutoProcess(payment)} 
                        disabled={isUpdating}
                        className="bg-primary/20 border-primary/30 hover:bg-primary/30 text-primary text-[10px] font-black uppercase tracking-widest h-9 rounded-xl"
                      >
                        <Zap className="w-3.5 h-3.5 mr-2" /> Ativar
                      </Button>
                    )}
                    <Dialog open={editingPayment?.id === payment.id} onOpenChange={(open) => !open && setEditingPayment(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(payment)} className="bg-muted/40 border-border hover:bg-muted/60 text-[10px] font-black uppercase tracking-widest h-9 rounded-xl">
                          <Settings className="w-3.5 h-3.5 mr-2" /> Detalhes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-card border-border bg-background/95 backdrop-blur-3xl text-foreground rounded-[1.5rem] sm:rounded-[2rem] max-w-[calc(100vw-2rem)] sm:max-w-lg p-4 sm:p-6">
                        <DialogHeader>
                          <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
                            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Processar
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
                          <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-muted/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/50">
                            <div className="space-y-0.5 sm:space-y-1">
                              <p className="text-[8px] sm:text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Cliente</p>
                              <p className="text-xs sm:text-sm font-bold text-foreground truncate">{payment.customer_name}</p>
                            </div>
                            <div className="space-y-0.5 sm:space-y-1">
                              <p className="text-[8px] sm:text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Plano</p>
                              <p className="text-xs sm:text-sm font-bold text-primary truncate">{payment.plan_name}</p>
                            </div>
                          </div>
                          <div className="space-y-3 sm:space-y-4">
                            <div className="space-y-1.5 sm:space-y-2">
                              <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Chave de Licença</label>
                              <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/40" />
                                <Input 
                                  placeholder="ZDRX-XXXX" 
                                  value={licenseKey} 
                                  onChange={(e) => setLicenseKey(e.target.value)}
                                  className="h-10 sm:h-12 pl-11 sm:pl-12 rounded-xl bg-muted/40 border-border focus:border-primary/40 transition-all text-xs sm:text-sm font-mono"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                              <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Link dos Arquivos</label>
                              <div className="relative">
                                <Upload className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/40" />
                                <Input 
                                  placeholder="https://link.com" 
                                  value={filesUrl} 
                                  onChange={(e) => setFilesUrl(e.target.value)}
                                  className="h-10 sm:h-12 pl-11 sm:pl-12 rounded-xl bg-muted/40 border-border focus:border-primary/40 transition-all text-xs sm:text-sm"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                            <Button onClick={handleUpdate} disabled={isUpdating} className="h-11 sm:h-12 rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs bg-primary hover:bg-primary/90">
                              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Salvar
                            </Button>
                            <Button variant="outline" onClick={() => sendToWhatsApp(payment)} className="h-11 sm:h-12 rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20">
                              <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => sendToWhatsApp(payment)} className="h-9 w-9 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/10">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    trial: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    expired: "bg-destructive/15 text-destructive border-destructive/30",
    revoked: "bg-white/5 text-muted-foreground border-white/10",
  };
  return <Badge variant="outline" className={`${variants[status] || ""} text-[10px]`}>{status.toUpperCase()}</Badge>;
}

 function AdminBottomNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (value: string) => void }) {
   const [page, setPage] = useState(0);
 
   const pages = [
     [
       { value: "licenses", label: "Licenças", icon: Key },
       { value: "sessions", label: "Sessões", icon: Activity },
       { value: "resellers", label: "Revendedores", icon: Users },
     ],
     [
       { value: "notifications", label: "Notifs", icon: Bell },
       { value: "versions", label: "Versões APK", icon: Download },
       { value: "monitoring", label: "Monitor", icon: Signal },
     ]
   ];
 
   const currentTabs = pages[page] || pages[0];
   const hasPagination = pages.length > 1;
 
   useEffect(() => {
     const idx = pages.findIndex(pg => pg.some(t => t.value === activeTab));
     if (idx !== -1 && idx !== page) setPage(idx);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [activeTab]);
 
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] bg-background/80 backdrop-blur-3xl border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.6)] overflow-hidden pb-safe">
      <AnimatePresence mode="wait">
         <motion.div
           key={page}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           transition={{ duration: 0.2 }}
           className="flex items-center justify-around w-full px-2 py-3"
         >
           {hasPagination && page > 0 && (
             <button
               onClick={() => setPage(page - 1)}
               aria-label="Página anterior da navegação"
               className="flex flex-col items-center gap-1 py-1 px-2 text-muted-foreground hover:text-foreground transition-colors"
             >
               <ChevronLeft className="h-5 w-5" />
               <span className="text-[0.6rem] font-black uppercase tracking-widest">Voltar</span>
             </button>
           )}
 
           {currentTabs.map((tab) => {
             const isActive = activeTab === tab.value;
             const Icon = tab.icon;
             return (
               <button
                 key={tab.value}
                 onClick={() => onTabChange(tab.value)}
                 className={cn(
                   "flex flex-col items-center gap-1.5 py-1 px-2 transition-all duration-300 relative min-w-[4rem]",
                   isActive ? "text-primary scale-110" : "text-muted-foreground"
                 )}
               >
                 <div className="relative">
                   <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]")} />
                   {isActive && (
                     <motion.div
                       layoutId="active-nav-indicator"
                       className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary)/0.8)]"
                       transition={{ type: "spring", stiffness: 300, damping: 30 }}
                     />
                   )}
                 </div>
                 <span className={cn(
                   "text-[0.6rem] font-black uppercase tracking-[0.1em] truncate max-w-full",
                   isActive ? "opacity-100" : "opacity-70"
                 )}>
                   {tab.label.substring(0, 8)}
                 </span>
               </button>
             );
           })}
 
           {hasPagination && page < pages.length - 1 && (
             <button
               onClick={() => setPage(page + 1)}
               aria-label="Próxima página da navegação"
               className="flex flex-col items-center gap-1 py-1 px-2 text-muted-foreground hover:text-foreground transition-colors"
             >
               <ChevronRight className="h-5 w-5" />
               <span className="text-[0.6rem] font-black uppercase tracking-widest">Mais</span>
             </button>
           )}
         </motion.div>
       </AnimatePresence>
     </nav>
   );
 }
 
 export default AdminDashboard;
