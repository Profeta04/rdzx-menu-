import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Activity, AlertOctagon, AlertTriangle, CheckCircle2, Copy, Download, Eye, Inbox,
  Loader2, Pause, Pencil, Play, RefreshCw, ShieldCheck, Signal, Wifi, WifiOff, Search, Skull,
} from "lucide-react";
import { PilantrinhasTab } from "@/components/PilantrinhasTab";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Tooltip as RTooltip,
  XAxis, YAxis, CartesianGrid,
} from "recharts";

// ───────────────────────────── Types ─────────────────────────────
type Metrics = {
  devices_online: number;
  errors_24h: number;
  pings_today: number;
  failed_validations_24h: number;
  errors_7d: { day: string; count: number }[];
  errors_24h_series: { hour: string; count: number }[];
};
type ErrorRow = {
  id: string; license_key: string | null; device_id: string | null;
  event_type: string; severity: string; details: any;
  endpoint: string | null; user_agent: string | null; ip_address: string | null;
  created_at: string; resolved: boolean;
};
type HeartbeatRow = {
  device_id: string; license_key: string | null; version: string | null;
  url: string | null; user_agent: string | null; ip_address: string | null;
  pings_today: number; pings_total: number; first_seen: string; last_seen: string;
  status: "online" | "idle" | "offline";
};
type ValidationRow = {
  id: string; license_key: string | null; device_id: string | null;
  success: boolean; reason: string | null; ip_address: string | null;
  user_agent: string | null; created_at: string;
};
type TopAgg = {
  top_errors: { event_type: string; severity: string; count: number; last_at: string }[];
  top_licenses: { license_key: string; count: number; last_at: string }[];
  top_ips: { ip: string; count: number; distinct_licenses: number; last_at: string }[];
  validation_rate: { total: number; success: number; failed: number };
  since: string;
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/25 text-destructive-foreground border-destructive/60",
  error:    "bg-destructive/15 text-destructive-foreground border-destructive/40",
  warn:     "bg-warning/15 text-warning border-warning/40",
  info:     "bg-primary/15 text-primary border-primary/40",
};
const STATUS_STYLES: Record<string, string> = {
  online:  "bg-success/15 text-success border-success/40",
  idle:    "bg-warning/15 text-warning border-warning/40",
  offline: "bg-muted/40 text-muted-foreground border-border",
};
const PERIOD_HOURS = [1, 6, 24, 168] as const;
const PERIOD_LABEL: Record<number, string> = { 1: "1h", 6: "6h", 24: "24h", 168: "7d" };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function maskLicense(lk: string | null, revealed: boolean) {
  if (!lk) return "—";
  if (revealed) return lk;
  if (lk.length <= 8) return "•".repeat(lk.length);
  return lk.slice(0, 4) + "•••••" + lk.slice(-4);
}
function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) { toast.info("Nada para exportar"); return; }
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => escape(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ───────────────────────────── KPI Card ─────────────────────────────
const KpiCard = memo(function KpiCard({
  icon, label, value, accent, hint, pulse,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; accent: string; hint?: string; pulse?: boolean }) {
  return (
    <Card className={cn("glass-card border-border overflow-hidden relative", accent, pulse && "animate-pulse")}>
      <CardContent className="p-4 sm:p-5 flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-muted/60 border border-border">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-2xl sm:text-3xl font-black mt-0.5 truncate">{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground mt-1 truncate">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
});

// ───────────────────────────── Component ─────────────────────────────
export function MonitoringTab() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSub = (() => {
    const s = searchParams.get("sub");
    return s && ["errors", "heartbeats", "validations", "fraud"].includes(s) ? s : "errors";
  })();
  const [sub, setSubState] = useState(initialSub);
  const setSub = useCallback((v: string) => {
    setSubState(v);
    const next = new URLSearchParams(searchParams);
    next.set("sub", v);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  // Sync on external URL changes
  useEffect(() => {
    const s = searchParams.get("sub");
    if (s && s !== sub && ["errors", "heartbeats", "validations", "fraud"].includes(s)) {
      setSubState(s);
    }
  }, [searchParams, sub]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selectedError, setSelectedError] = useState<ErrorRow | null>(null);
  const [live, setLive] = useState(true);
  const [periodH, setPeriodH] = useState<number>(24);

  // Errors filters
  const [errSearch, setErrSearch] = useState("");
  const [errSearchDebounced, setErrSearchDebounced] = useState("");
  const [errSeverities, setErrSeverities] = useState<Set<string>>(new Set(["critical", "error", "warn"]));
  const [errPage, setErrPage] = useState(0);
  const PAGE = 50;

  // Heartbeats / validations filters
  const [hbSearch, setHbSearch] = useState("");
  const [hbStatus, setHbStatus] = useState<string | null>(null);
  const [vSearch, setVSearch] = useState("");
  const [vOnlyFailed, setVOnlyFailed] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setErrSearchDebounced(errSearch); setErrPage(0); }, 300);
    return () => clearTimeout(t);
  }, [errSearch]);

  const sinceISO = useMemo(() => new Date(Date.now() - periodH * 3600_000).toISOString(), [periodH]);

  // ──────────────── Queries ────────────────
  const metricsQ = useQuery<Metrics>({
    queryKey: ["mon-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monitoring_metrics" as any);
      if (error) throw error;
      return data as Metrics;
    },
    refetchInterval: live ? 30_000 : false,
    staleTime: 15_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const topQ = useQuery<TopAgg>({
    queryKey: ["mon-top", periodH],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monitoring_top" as any, { p_hours: periodH });
      if (error) throw error;
      return data as TopAgg;
    },
    refetchInterval: live ? 60_000 : false,
    staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const errorsQ = useQuery<{ rows: ErrorRow[]; total: number }>({
    queryKey: ["mon-errors", errSearchDebounced, [...errSeverities].sort().join(","), periodH, errPage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monitoring_errors" as any, {
        p_search: errSearchDebounced || null,
        p_severities: errSeverities.size ? Array.from(errSeverities) : null,
        p_since: sinceISO,
        p_limit: PAGE, p_offset: errPage * PAGE,
      });
      if (error) throw error;
      return data as { rows: ErrorRow[]; total: number };
    },
    enabled: sub === "errors",
    staleTime: 20_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const heartbeatsQ = useQuery<{ rows: HeartbeatRow[]; total: number }>({
    queryKey: ["mon-heartbeats", hbSearch, hbStatus],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monitoring_heartbeats" as any, {
        p_search: hbSearch || null, p_status: hbStatus, p_limit: 200, p_offset: 0,
      });
      if (error) throw error;
      return data as { rows: HeartbeatRow[]; total: number };
    },
    enabled: sub === "heartbeats",
    refetchInterval: live && sub === "heartbeats" ? 20_000 : false,
    staleTime: 10_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const validationsQ = useQuery<{ rows: ValidationRow[]; total: number }>({
    queryKey: ["mon-validations", vSearch, vOnlyFailed, periodH],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monitoring_validations" as any, {
        p_search: vSearch || null, p_only_failed: vOnlyFailed, p_since: sinceISO,
        p_limit: 200, p_offset: 0,
      });
      if (error) throw error;
      return data as { rows: ValidationRow[]; total: number };
    },
    enabled: sub === "validations",
    staleTime: 20_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });
  // A9: separate always-enabled query for critical banner (independent of sub-tab)
  const criticalBannerQ = useQuery<{ rows: ErrorRow[]; total: number }>({
    queryKey: ["mon-critical-banner"],
    queryFn: async () => {
      const since5min = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data, error } = await supabase.rpc("get_monitoring_errors" as any, {
        p_search: null,
        p_severities: ["critical"],
        p_since: since5min,
        p_limit: 50, p_offset: 0,
      });
      if (error) throw error;
      return data as { rows: ErrorRow[]; total: number };
    },
    refetchInterval: live ? 30_000 : false,
    staleTime: 15_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });


  // ──────────────── Realtime (filtered + debounced) ────────────────
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleInvalidate = useCallback((keys: string[]) => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
    invalidateTimer.current = setTimeout(() => {
      keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    }, 500);
  }, [qc]);

  useEffect(() => {
    if (!live) return;
    const ch = supabase.channel("monitoring-rt")
      .on("postgres_changes" as any,
        // C2: removed channel filter (buggy in Realtime v2 for in.()) — filter applied in callback
        { event: "INSERT", schema: "public", table: "fraud_events" },
        (payload: any) => {
          if (!["critical","error"].includes(payload?.new?.severity)) return;
          scheduleInvalidate(["mon-errors", "mon-metrics", "mon-top", "mon-critical-banner"]);
          if (payload?.new?.severity === "critical") {
            toast.error(`Crítico: ${String(payload?.new?.details?.message || payload?.new?.event_type || "").slice(0, 100)}`);
          }
        })
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "license_validation_attempts" },
        () => scheduleInvalidate(["mon-validations", "mon-metrics"]))
      .subscribe();
    return () => { supabase.removeChannel(ch); if (invalidateTimer.current) clearTimeout(invalidateTimer.current); };
  }, [live, scheduleInvalidate]);

  // ──────────────── Helpers ────────────────
  const toggleReveal = useCallback((k: string) => {
    setRevealed(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }, []);
  const toggleSeverity = (s: string) => {
    setErrSeverities(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
    setErrPage(0);
  };

  const refreshAll = () => {
    ["mon-metrics", "mon-top", "mon-errors", "mon-heartbeats", "mon-validations"]
      .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    toast.success("Atualizado");
  };

  const markResolved = async (e: ErrorRow) => {
    try {
      const { error } = await supabase.rpc("mark_fraud_event_resolved" as any, {
        p_event_id: e.id, p_resolved: !e.resolved, p_note: null,
      });
      if (error) throw error;
      toast.success(e.resolved ? "Reaberto" : "Marcado como resolvido");
      qc.invalidateQueries({ queryKey: ["mon-errors"] });
    } catch (err: any) { toast.error(err.message || "Falha ao atualizar"); }
  };

  const copyTxt = async (txt: string, label = "Copiado") => {
    try { await navigator.clipboard.writeText(txt); toast.success(label); }
    catch { toast.error("Falha ao copiar"); }
  };

  const m = metricsQ.data;
  const top = topQ.data;

  // A9: critical-in-last-5min from dedicated always-enabled query
  const criticalRecent = useMemo(() => {
    const rows = criticalBannerQ.data?.rows || [];
    return rows.filter(r => r.severity === "critical").length;
  }, [criticalBannerQ.data]);

  // Chart data
  const errors7d = useMemo(() => (m?.errors_7d || []).map(d => ({
    label: new Date(d.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    count: d.count,
  })), [m?.errors_7d]);
  const errors24h = useMemo(() => (m?.errors_24h_series || []).map(d => ({
    label: new Date(d.hour).toLocaleTimeString("pt-BR", { hour: "2-digit" }) + "h",
    count: d.count,
  })), [m?.errors_24h_series]);

  const totalErrors = errorsQ.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalErrors / PAGE));

  // ──────────────── Render ────────────────
  return (
    <div className="space-y-6">
      {/* Critical alert banner */}
      {criticalRecent > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-destructive/50 bg-destructive/10 text-destructive">
          <AlertOctagon className="h-5 w-5 shrink-0 animate-pulse" />
          <div className="flex-1 text-sm">
            <span className="font-black">{criticalRecent}</span> erro{criticalRecent > 1 ? "s" : ""} crítico{criticalRecent > 1 ? "s" : ""} nos últimos 5 minutos
          </div>
          <Button size="sm" variant="outline" className="border-destructive/40" onClick={() => { setSub("errors"); setErrSeverities(new Set(["critical"])); }}>
            Ver detalhes
          </Button>
        </div>
      )}

      {/* Top bar: live + period */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={live ? "default" : "outline"} onClick={() => setLive(v => !v)} className="gap-2">
            {live ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {live ? "Pausar live" : "Retomar live"}
          </Button>
          {live && (
            <span className="flex items-center gap-1.5 text-[11px] text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> ao vivo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-1">
          {PERIOD_HOURS.map(h => (
            <button key={h} onClick={() => setPeriodH(h)}
              className={cn("px-3 py-1 text-[11px] font-bold uppercase rounded-md transition-colors",
                periodH === h ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {PERIOD_LABEL[h]}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wifi className="h-5 w-5 text-success" />}
          label="Devices Online" value={metricsQ.isLoading ? "—" : m?.devices_online ?? 0}
          accent="bg-gradient-to-br from-success/10 to-transparent border-success/20"
          hint="Últimos 5 min"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          label="Erros 24h" value={metricsQ.isLoading ? "—" : m?.errors_24h ?? 0}
          accent="bg-gradient-to-br from-warning/10 to-transparent border-warning/20"
          pulse={(m?.errors_24h ?? 0) > 50}
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-primary" />}
          label="Pings Hoje" value={metricsQ.isLoading ? "—" : m?.pings_today ?? 0}
          accent="bg-gradient-to-br from-primary/10 to-transparent border-primary/20"
        />
        <KpiCard
          icon={<ShieldCheck className="h-5 w-5 text-destructive" />}
          label="Validações Falhas 24h" value={metricsQ.isLoading ? "—" : m?.failed_validations_24h ?? 0}
          accent="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/20"
          pulse={(m?.failed_validations_24h ?? 0) > 100}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="glass-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Erros · 7 dias</CardTitle>
          </CardHeader>
          <CardContent className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={errors7d} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g7d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.45}/>
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3}/>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28}/>
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}/>
                <Area type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#g7d)"/>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Erros · 24h</CardTitle>
          </CardHeader>
          <CardContent className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errors24h} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3}/>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28}/>
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}/>
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top aggregations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TopList title="Top tipos de erro" empty="Sem erros no período"
          rows={(top?.top_errors || []).map(r => ({ key: r.event_type, primary: r.event_type, secondary: `${r.count}× · ${timeAgo(r.last_at)}`, badge: r.severity }))}/>
        <TopList title="Licenças com mais falhas" empty="Nenhuma licença em falha"
          rows={(top?.top_licenses || []).map(r => ({ key: r.license_key, primary: maskLicense(r.license_key, false), secondary: `${r.count}× · ${timeAgo(r.last_at)}` }))}/>
        <TopList title="IPs suspeitos" empty="Nenhum IP suspeito"
          rows={(top?.top_ips || []).map(r => ({ key: r.ip, primary: r.ip, secondary: `${r.count}× · ${r.distinct_licenses} licenças` }))}/>
      </div>

      {/* Sub-tabs */}
      <Card className="glass-card border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/15 border border-primary/30">
              <Signal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-widest">Monitoramento</CardTitle>
              <CardDescription>Erros, devices ativos e validações em tempo real</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={sub} onValueChange={(v) => { setSub(v); }} className="space-y-4">
            <TabsList className="bg-muted/40 border border-border flex-wrap h-auto">
              <TabsTrigger value="errors" className="text-xs font-black uppercase tracking-wider gap-1.5">
                <AlertOctagon className="h-3.5 w-3.5" /> Erros
              </TabsTrigger>
              <TabsTrigger value="heartbeats" className="text-xs font-black uppercase tracking-wider gap-1.5">
                <Wifi className="h-3.5 w-3.5" /> Heartbeat
              </TabsTrigger>
              <TabsTrigger value="validations" className="text-xs font-black uppercase tracking-wider gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Validações
              </TabsTrigger>
              <TabsTrigger value="fraud" className="text-xs font-black uppercase tracking-wider gap-1.5 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive-foreground">
                <Skull className="h-3.5 w-3.5" /> Antifraude
              </TabsTrigger>
            </TabsList>

            {/* ───────── ERROS ───────── */}
            <TabsContent value="errors" className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={errSearch} onChange={(e) => setErrSearch(e.target.value)}
                    placeholder="Buscar mensagem, tipo, licença, device, IP..." className="pl-10" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(["critical", "error", "warn", "info"] as const).map(s => (
                    <button key={s} onClick={() => toggleSeverity(s)}
                      className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                        errSeverities.has(s) ? SEVERITY_STYLES[s] : "border-border text-muted-foreground hover:text-foreground")}>
                      {s}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCsv(`erros-${Date.now()}.csv`, errorsQ.data?.rows || [])}>
                  <Download className="h-4 w-4 mr-1.5" /> CSV
                </Button>
              </div>

              {errorsQ.isLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : !errorsQ.data?.rows?.length ? (
                <EmptyState icon={<CheckCircle2 className="h-10 w-10 text-success" />} title="Nenhum erro" hint="Tudo limpo no período selecionado." />
              ) : (
                <>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Sev</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Tipo</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Mensagem</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Licença</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest">Quando</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errorsQ.data.rows.map((e) => (
                          <TableRow key={e.id} className={cn("border-border hover:bg-muted/40", e.resolved && "opacity-50")}>
                            <TableCell>
                              <Badge className={cn("border text-[9px] font-mono uppercase", SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info)}>
                                {e.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">{e.event_type}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[420px]">
                              <div className="truncate">{e.details?.message || e.event_type}</div>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-primary/90">
                              {e.license_key ? (
                                <button onClick={() => toggleReveal(e.id)} className="hover:underline">
                                  {maskLicense(e.license_key, revealed.has(e.id))}
                                </button>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{timeAgo(e.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-1">
                                <Button size="icon" variant="ghost" title={e.resolved ? "Reabrir" : "Marcar resolvido"} onClick={() => markResolved(e)}>
                                  {e.resolved ? <Pencil className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setSelectedError(e)} title="Detalhes">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{totalErrors} registro{totalErrors !== 1 ? "s" : ""} · página {errPage + 1}/{totalPages}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={errPage === 0} onClick={() => setErrPage(p => Math.max(0, p - 1))}>Anterior</Button>
                      <Button size="sm" variant="outline" disabled={errPage + 1 >= totalPages} onClick={() => setErrPage(p => p + 1)}>Próxima</Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ───────── HEARTBEATS ───────── */}
            <TabsContent value="heartbeats" className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={hbSearch} onChange={(e) => setHbSearch(e.target.value)} placeholder="Buscar device, licença ou IP..." className="pl-10" />
                </div>
                <div className="flex gap-1.5">
                  {(["online", "idle", "offline"] as const).map(s => (
                    <button key={s} onClick={() => setHbStatus(prev => prev === s ? null : s)}
                      className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                        hbStatus === s ? STATUS_STYLES[s] : "border-border text-muted-foreground hover:text-foreground")}>
                      {s}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCsv(`devices-${Date.now()}.csv`, heartbeatsQ.data?.rows || [])}>
                  <Download className="h-4 w-4 mr-1.5" /> CSV
                </Button>
              </div>

              {heartbeatsQ.isLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : !heartbeatsQ.data?.rows?.length ? (
                <EmptyState icon={<WifiOff className="h-10 w-10 text-muted-foreground" />} title="Nenhum device" hint="Sem heartbeats no filtro atual." />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Device</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Licença</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Versão</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Pings Hoje</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Última</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {heartbeatsQ.data.rows.map((h) => (
                        <TableRow key={h.device_id} className="border-border hover:bg-muted/40">
                          <TableCell>
                            <Badge className={cn("border text-[9px] font-mono uppercase", STATUS_STYLES[h.status])}>
                              {h.status === "offline" ? <WifiOff className="h-3 w-3 mr-1" /> : <Wifi className="h-3 w-3 mr-1" />}
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[200px] truncate">{h.device_id}</TableCell>
                          <TableCell className="font-mono text-[11px] text-primary/80">
                            {h.license_key ? (
                              <button onClick={() => toggleReveal(h.device_id)} className="hover:underline">
                                {maskLicense(h.license_key, revealed.has(h.device_id))}
                              </button>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{h.version || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.pings_today}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{timeAgo(h.last_seen)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ───────── VALIDAÇÕES ───────── */}
            <TabsContent value="validations" className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={vSearch} onChange={(e) => setVSearch(e.target.value)} placeholder="Buscar licença, device, IP ou motivo..." className="pl-10" />
                </div>
                <button onClick={() => setVOnlyFailed(v => !v)}
                  className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                    vOnlyFailed ? "bg-destructive/15 text-destructive border-destructive/40" : "border-border text-muted-foreground hover:text-foreground")}>
                  Só falhas
                </button>
                <Button variant="outline" size="sm" onClick={() => exportCsv(`validacoes-${Date.now()}.csv`, validationsQ.data?.rows || [])}>
                  <Download className="h-4 w-4 mr-1.5" /> CSV
                </Button>
              </div>

              {top && (
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1">
                  <span>Total: <span className="text-foreground font-bold">{top.validation_rate.total}</span></span>
                  <span className="text-success">OK: <span className="font-bold">{top.validation_rate.success}</span></span>
                  <span className="text-destructive">Falhas: <span className="font-bold">{top.validation_rate.failed}</span></span>
                  {top.validation_rate.total > 0 && (
                    <span>Sucesso: <span className="text-success font-bold">{((top.validation_rate.success / top.validation_rate.total) * 100).toFixed(1)}%</span></span>
                  )}
                </div>
              )}

              {validationsQ.isLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : !validationsQ.data?.rows?.length ? (
                <EmptyState icon={<Inbox className="h-10 w-10 text-muted-foreground" />} title="Sem tentativas" hint="Nenhuma validação registrada no filtro." />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Resultado</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Licença</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Device</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Motivo</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">IP</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Quando</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationsQ.data.rows.map((v) => (
                        <TableRow key={v.id} className="border-border hover:bg-muted/40">
                          <TableCell>
                            <Badge className={cn("border text-[9px] font-mono uppercase",
                              v.success ? STATUS_STYLES.online : "bg-destructive/15 text-destructive border-destructive/40")}>
                              {v.success ? "OK" : "FAIL"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-primary/80">
                            {v.license_key ? (
                              <button onClick={() => toggleReveal(v.id)} className="hover:underline">
                                {maskLicense(v.license_key, revealed.has(v.id))}
                              </button>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[180px] truncate">{v.device_id || "—"}</TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{v.reason || "—"}</TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{v.ip_address || "—"}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{timeAgo(v.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ───────── ANTIFRAUDE ───────── */}
            <TabsContent value="fraud" className="space-y-3 -mx-2 sm:-mx-4">
              <PilantrinhasTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedError} onOpenChange={(o) => !o && setSelectedError(null)}>
        <DialogContent className="max-w-2xl glass-card border-border">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest">Detalhes do erro</DialogTitle>
            <DialogDescription>Inspecione contexto completo e stack trace</DialogDescription>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn("border text-[10px] font-mono uppercase", SEVERITY_STYLES[selectedError.severity] || SEVERITY_STYLES.info)}>
                  {selectedError.severity}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">{selectedError.event_type}</Badge>
                <span className="text-[11px] text-muted-foreground">{new Date(selectedError.created_at).toLocaleString("pt-BR")}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => copyTxt(JSON.stringify(selectedError, null, 2), "JSON copiado")}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> JSON
                  </Button>
                  <Button size="sm" variant={selectedError.resolved ? "outline" : "default"} onClick={() => markResolved(selectedError)}>
                    {selectedError.resolved ? "Reabrir" : "Resolver"}
                  </Button>
                </div>
              </div>
              <div className="font-mono text-sm bg-background/40 p-3 rounded-lg border border-border break-words">
                {selectedError.details?.message || selectedError.event_type}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                <div><span className="text-foreground/40">Licença:</span> {selectedError.license_key || "—"}</div>
                <div><span className="text-foreground/40">Device:</span> {selectedError.device_id || "—"}</div>
                <div className="col-span-2"><span className="text-foreground/40">Endpoint:</span> {selectedError.endpoint || "—"}</div>
                <div className="col-span-2 break-all"><span className="text-foreground/40">UA:</span> {selectedError.user_agent || "—"}</div>
                <div><span className="text-foreground/40">IP:</span> {selectedError.ip_address || "—"}</div>
              </div>
              {selectedError.details?.stack && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Stack trace</span>
                    <Button size="sm" variant="ghost" onClick={() => copyTxt(selectedError.details.stack, "Stack copiado")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <pre className="text-[10px] text-muted-foreground bg-background/60 p-3 rounded-lg border border-border overflow-x-auto max-h-[280px]">
                    {selectedError.details.stack}
                  </pre>
                </div>
              )}
              {selectedError.details && Object.keys(selectedError.details).length > 0 && (
                <pre className="text-[10px] text-muted-foreground bg-background/60 p-3 rounded-lg border border-border overflow-x-auto max-h-[200px]">
                  {JSON.stringify(selectedError.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────────────── Helpers ─────────────────────────────
function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon}
      <div className="text-sm font-bold text-foreground/80">{title}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type TopRow = { key: string; primary: string; secondary: string; badge?: string };
const TopList = memo(function TopList({ title, rows, empty }: { title: string; rows: TopRow[]; empty: string }) {
  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <div className="text-xs text-muted-foreground py-3 text-center">{empty}</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key + i} className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}.</span>
                <span className="flex-1 font-mono truncate" title={r.primary}>{r.primary}</span>
                {r.badge && (
                  <Badge className={cn("border text-[9px] font-mono uppercase", SEVERITY_STYLES[r.badge] || SEVERITY_STYLES.info)}>
                    {r.badge}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{r.secondary}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});