import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity, Ban, CheckCircle2, Cpu, Download, Flame, Globe, Info, Loader2,
  LogOut, Pause, Play, RefreshCw, RotateCcw, Search, ShieldAlert, Skull,
  Trash2, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Tooltip as RTooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

// ───────────────────────── Types ─────────────────────────
type SuspectRow = {
  key: string;
  license_key: string | null;
  device_id: string | null;
  ip_address: string | null;
  cnt: number;
  last_seen: string;
  first_seen: string;
  event_types: string[];
  worst_severity: string;
  risk_score: number;
  patterns: string[];
};
type SuspectPage = { rows: SuspectRow[]; total: number };
type FraudEvent = {
  id: string; event_type: string; severity: string;
  license_key: string | null; device_id: string | null; ip_address: string | null;
  user_agent: string | null; endpoint: string | null; details: any; created_at: string;
};
type Aggregates = {
  severity_breakdown: { severity: string; count: number }[];
  top_events: { event_type: string; severity: string; count: number }[];
  top_ips: { ip: string; count: number; distinct_licenses: number }[];
  top_hwids: { device_id: string; count: number; distinct_licenses: number }[];
  top_licenses: { license_key: string; count: number }[];
  daily_series: { bucket: string; critical: number; error: number; warn: number; info: number }[];
  hwid_multi_licenses: { device_id: string; licenses: string[]; count: number }[];
  ip_multi_devices: { ip: string; devices: string[]; count: number }[];
};
type BanRow = { id: string; ban_type: string; value: string; reason: string | null; created_at: string };
type ReviewRow = { id: string; event_key: string; status: string; note: string | null; created_at: string; admin_email: string | null };

// ───────────────────────── Styles ─────────────────────────
const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/25 text-destructive-foreground border-destructive/60",
  error:    "bg-destructive/15 text-destructive-foreground border-destructive/40",
  warn:     "bg-warning/15 text-warning border-warning/40",
  info:     "bg-primary/15 text-primary border-primary/40",
};
const SEVERITY_FILL: Record<string, string> = {
  critical: "hsl(var(--destructive))",
  error:    "hsl(var(--destructive) / 0.7)",
  warn:     "hsl(var(--warning))",
  info:     "hsl(var(--primary))",
};
const PATTERN_OPTS = ["reincidente", "vpn", "bot", "clone", "multi-acct", "replay"] as const;
const PERIOD_HOURS = [{ h: 1, l: "1h" }, { h: 24, l: "24h" }, { h: 168, l: "7d" }, { h: 720, l: "30d" }];

function riskColor(score: number) {
  if (score >= 75) return "bg-destructive/30 text-destructive-foreground border-destructive/60";
  if (score >= 45) return "bg-warning/25 text-warning border-warning/50";
  if (score >= 20) return "bg-warning/15 text-warning border-warning/30";
  return "bg-success/15 text-success border-success/30";
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function exportCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) { toast.info("Nada para exportar"); return; }
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
  const u = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = u; a.download = name; a.click();
  URL.revokeObjectURL(u);
}

// ───────────────────────── KPI Card ─────────────────────────
const KpiCard = memo(function KpiCard({
  icon, label, value, accent, hint, pulse,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; accent: string; hint?: string; pulse?: boolean }) {
  return (
    <Card className={cn("glass-card border-border overflow-hidden relative", accent)}>
      <CardContent className="p-4 sm:p-5 flex items-center gap-4">
        <div className={cn("p-3 rounded-2xl bg-muted/60 border border-border", pulse && "animate-pulse")}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-2xl sm:text-3xl font-black mt-0.5 truncate">{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground mt-1 truncate">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
});

// ───────────────────────── Component ─────────────────────────
export function PilantrinhasTab() {
  const qc = useQueryClient();

  // Top controls
  const [live, setLive] = useState(true);
  const [periodH, setPeriodH] = useState(168);
  const sinceISO = useMemo(() => new Date(Date.now() - periodH * 3600_000).toISOString(), [periodH]);

  // Sub tab
  const [sub, setSub] = useState<"suspeitos" | "correlacoes" | "banidos" | "falsos">("suspeitos");

  // Filters
  const [search, setSearch] = useState("");
  const [searchD, setSearchD] = useState("");
  const [severities, setSeverities] = useState<Set<string>>(new Set(["critical", "error", "warn"]));
  const [patterns, setPatterns] = useState<Set<string>>(new Set());
  const [riskRange, setRiskRange] = useState<[number, number]>([0, 100]);
  const [hideFp, setHideFp] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE = 50;

  useEffect(() => {
    const t = setTimeout(() => { setSearchD(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // A15: debounce riskRange to avoid flooding RPC on every slider move
  const [riskRangeD, setRiskRangeD] = useState<[number, number]>([0, 100]);
  useEffect(() => {
    const t = setTimeout(() => { setRiskRangeD(riskRange); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [riskRange]);

  // Selection (bulk)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  // Action dialogs state
  type Action =
    | { kind: "logout"; license: string }
    | { kind: "revoke"; license: string }
    | { kind: "ban-ip"; value: string }
    | { kind: "ban-hwid"; value: string }
    | { kind: "fp-bulk"; keys: string[] }
    | { kind: "purge" }
    | { kind: "unban"; ban_type: string; value: string }
    | { kind: "unmark-fp"; event_key: string };
  const [action, setAction] = useState<Action | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ──────────────── Queries ────────────────
  const aggQ = useQuery<Aggregates>({
    queryKey: ["pil-agg", periodH],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pilantrinhas_aggregates" as any, { p_since: sinceISO });
      if (error) throw error;
      return data as Aggregates;
    },
    refetchInterval: live ? 60_000 : false,
    staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const listQ = useQuery<SuspectPage>({
    queryKey: ["pil-list", periodH, searchD, [...severities].sort().join(","), [...patterns].sort().join(","), riskRangeD[0], riskRangeD[1], hideFp, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pilantrinhas" as any, {
        p_since: sinceISO,
        p_severities: severities.size ? Array.from(severities) : null,
        p_search: searchD || null,
        p_patterns: patterns.size ? Array.from(patterns) : null,
        p_min_risk: riskRangeD[0],
        p_max_risk: riskRangeD[1],
        p_hide_fp: hideFp,
        p_limit: PAGE, p_offset: page * PAGE,
      });
      if (error) throw error;
      return data as SuspectPage;
    },
    enabled: sub === "suspeitos",
    refetchInterval: live && sub === "suspeitos" ? 30_000 : false,
    staleTime: 15_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const eventsQ = useQuery<FraudEvent[]>({
    queryKey: ["pil-events", expanded, periodH],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pilantrinhas_events" as any, {
        p_key: expanded, p_since: sinceISO, p_limit: 200,
      });
      if (error) throw error;
      return (data as FraudEvent[]) || [];
    },
    enabled: !!expanded,
    staleTime: 30_000, gcTime: 5 * 60_000,
  });

  const bansQ = useQuery<BanRow[]>({
    queryKey: ["pil-bans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("security_bans" as any)
        .select("id,ban_type,value,reason,created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data as unknown as BanRow[]) || [];
    },
    enabled: sub === "banidos",
    staleTime: 60_000, gcTime: 5 * 60_000,
  });

  const reviewsQ = useQuery<ReviewRow[]>({
    queryKey: ["pil-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fraud_event_reviews" as any)
        .select("id,event_key,status,note,created_at,admin_email")
        .eq("status", "false_positive")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data as unknown as ReviewRow[]) || [];
    },
    enabled: sub === "falsos",
    staleTime: 60_000, gcTime: 5 * 60_000,
  });

  // ──────────────── Realtime (filtered + debounced) ────────────────
  const invTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleInvalidate = useCallback(() => {
    if (invTimer.current) clearTimeout(invTimer.current);
    invTimer.current = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["pil-list"] });
      qc.invalidateQueries({ queryKey: ["pil-agg"] });
    }, 500);
  }, [qc]);

  useEffect(() => {
    if (!live) return;
    const ch = supabase.channel("pilantrinhas-rt")
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "fraud_events", filter: "severity=in.(critical,error)" },
        (payload: any) => {
          scheduleInvalidate();
          if (payload?.new?.severity === "critical") {
            const ev = payload.new as FraudEvent;
            toast.error(`Pilantrinha crítico: ${ev.event_type}`, {
              description: ev.license_key ? `Licença ${ev.license_key.slice(0, 12)}…` : ev.device_id || ev.ip_address || "",
            });
          }
        }).subscribe();
    return () => { supabase.removeChannel(ch); if (invTimer.current) clearTimeout(invTimer.current); };
  }, [live, scheduleInvalidate]);

  // ──────────────── Helpers ────────────────
  const refreshAll = () => {
    ["pil-list", "pil-agg", "pil-events", "pil-bans", "pil-reviews"]
      .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    toast.success("Atualizado");
  };

  const toggleSev = (s: string) =>
    setSeverities(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); setPage(0); return n; });
  const togglePat = (p: string) =>
    setPatterns(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); setPage(0); return n; });

  const toggleRow = (k: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const allOnPageSelected = (listQ.data?.rows || []).length > 0 &&
    (listQ.data?.rows || []).every(r => selected.has(r.key));

  const toggleSelectAll = () => {
    const rows = listQ.data?.rows || [];
    setSelected(prev => {
      const n = new Set(prev);
      if (allOnPageSelected) rows.forEach(r => n.delete(r.key));
      else rows.forEach(r => n.add(r.key));
      return n;
    });
  };

  const runAction = async () => {
    if (!action) return;
    setActionLoading(true);
    try {
      if (action.kind === "logout") {
        const { data: lic, error: e1 } = await supabase.from("licenses" as any)
          .select("id").eq("license_key", action.license).maybeSingle();
        if (e1 || !lic) throw new Error("Licença não encontrada");
        const { error } = await supabase.rpc("force_remote_logout" as any, { p_license_id: (lic as any).id });
        if (error) throw error;
        toast.success("Logout remoto enviado");
      } else if (action.kind === "revoke") {
        const { error } = await supabase.from("licenses" as any)
          .update({ status: "revoked" }).eq("license_key", action.license);
        if (error) throw error;
        toast.success("Licença revogada");
        qc.invalidateQueries({ queryKey: ["licenses"] });
      } else if (action.kind === "ban-ip" || action.kind === "ban-hwid") {
        const type = action.kind === "ban-ip" ? "ip" : "hwid";
        const { error } = await supabase.rpc("ban_identifier" as any, {
          p_type: type, p_value: action.value, p_reason: null,
        });
        if (error) throw error;
        toast.success(`${type.toUpperCase()} banido`);
        qc.invalidateQueries({ queryKey: ["pil-bans"] });
      } else if (action.kind === "fp-bulk") {
        const rows = action.keys.map(k => ({ event_key: k, status: "false_positive", note: "Marcado em lote" }));
        const { error } = await supabase.from("fraud_event_reviews" as any).insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} marcados como falso positivo`);
        setSelected(new Set());
        qc.invalidateQueries({ queryKey: ["pil-list"] });
        qc.invalidateQueries({ queryKey: ["pil-reviews"] });
      } else if (action.kind === "purge") {
        const { data, error } = await supabase.rpc("purge_old_fraud_events" as any, { p_days: 30 });
        if (error) throw error;
        toast.success(`${data || 0} eventos antigos removidos`);
        qc.invalidateQueries({ queryKey: ["pil-list"] });
        qc.invalidateQueries({ queryKey: ["pil-agg"] });
      } else if (action.kind === "unban") {
        const { error } = await supabase.rpc("unban_identifier" as any, {
          p_type: action.ban_type, p_value: action.value,
        });
        if (error) throw error;
        toast.success("Banimento removido");
        qc.invalidateQueries({ queryKey: ["pil-bans"] });
      } else if (action.kind === "unmark-fp") {
        const { error } = await supabase.rpc("unmark_fraud_event_review" as any, { p_event_key: action.event_key });
        if (error) throw error;
        toast.success("Falso positivo revertido");
        qc.invalidateQueries({ queryKey: ["pil-reviews"] });
        qc.invalidateQueries({ queryKey: ["pil-list"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Falha");
    } finally {
      setActionLoading(false);
      setAction(null);
    }
  };

  const agg = aggQ.data;
  const rows = listQ.data?.rows || [];
  const total = listQ.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  // KPIs derived from agg
  const sevMap = useMemo(() => {
    const m: Record<string, number> = { critical: 0, error: 0, warn: 0, info: 0 };
    (agg?.severity_breakdown || []).forEach(s => { m[s.severity] = s.count; });
    return m;
  }, [agg]);

  const dailyChart = useMemo(() => (agg?.daily_series || []).map(d => ({
    label: new Date(d.bucket).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    critical: d.critical, error: d.error, warn: d.warn, info: d.info,
  })), [agg]);

  const topEventsChart = useMemo(() => (agg?.top_events || []).map(e => ({
    name: e.event_type.length > 24 ? e.event_type.slice(0, 22) + "…" : e.event_type,
    value: e.count, severity: e.severity,
  })), [agg]);

  // ──────────────── Render ────────────────
  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      {/* Header card */}
      <Card className="glass-card border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-destructive/15 border border-destructive/30">
                <Skull className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-widest">Pilantrinhas</CardTitle>
                <CardDescription>Suspeitos com risk score, padrões detectados e correlações</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant={live ? "default" : "outline"} onClick={() => setLive(v => !v)} className="gap-2">
                {live ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {live ? "Pausar" : "Retomar"}
              </Button>
              {live && (
                <span className="flex items-center gap-1.5 text-[11px] text-success">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> ao vivo
                </span>
              )}
              <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-1">
                {PERIOD_HOURS.map(p => (
                  <button key={p.h} onClick={() => setPeriodH(p.h)}
                    className={cn("px-3 py-1 text-[11px] font-bold uppercase rounded-md transition-colors",
                      periodH === p.h ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {p.l}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={refreshAll} disabled={listQ.isFetching || aggQ.isFetching}>
                <RefreshCw className={cn("h-4 w-4", (listQ.isFetching || aggQ.isFetching) && "animate-spin")} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: "purge" })}>
                <Trash2 className="h-4 w-4 mr-1" /> Purge 30d
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Flame className="h-5 w-5 text-destructive" />}
          label="Críticos" value={sevMap.critical}
          accent="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/30"
          pulse={sevMap.critical > 0}
          hint={`Período: ${periodH}h`}
        />
        <KpiCard
          icon={<ShieldAlert className="h-5 w-5 text-destructive/80" />}
          label="Erros" value={sevMap.error}
          accent="bg-gradient-to-br from-destructive/5 to-transparent border-destructive/20"
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-warning" />}
          label="Alertas" value={sevMap.warn}
          accent="bg-gradient-to-br from-warning/10 to-transparent border-warning/20"
        />
        <KpiCard
          icon={<Info className="h-5 w-5 text-primary" />}
          label="Suspeitos únicos" value={listQ.isLoading ? "—" : total}
          accent="bg-gradient-to-br from-primary/10 to-transparent border-primary/20"
          hint={`Página ${page + 1}/${totalPages}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="glass-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Severidade</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            {agg && (agg.severity_breakdown || []).length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={agg.severity_breakdown} dataKey="count" nameKey="severity" innerRadius={40} outerRadius={70} strokeWidth={1}>
                    {agg.severity_breakdown.map((s, i) => <Cell key={i} fill={SEVERITY_FILL[s.severity] || "hsl(var(--muted))"} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart loading={aggQ.isLoading} />}
          </CardContent>
        </Card>

        <Card className="glass-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Top 5 eventos</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            {topEventsChart.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={topEventsChart} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis type="category" dataKey="name" width={130} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topEventsChart.map((e, i) => <Cell key={i} fill={SEVERITY_FILL[e.severity] || "hsl(var(--primary))"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart loading={aggQ.isLoading} />}
          </CardContent>
        </Card>

        <Card className="glass-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Histórico ({periodH >= 24 ? `${Math.floor(periodH / 24)}d` : `${periodH}h`})</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            {dailyChart.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={dailyChart} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="hsl(var(--destructive))" fill="url(#gCrit)" />
                  <Area type="monotone" dataKey="error"    stackId="1" stroke="hsl(var(--destructive) / 0.6)" fill="hsl(var(--destructive) / 0.2)" />
                  <Area type="monotone" dataKey="warn"     stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.2)" />
                  <Area type="monotone" dataKey="info"     stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart loading={aggQ.isLoading} />}
          </CardContent>
        </Card>
      </div>

      {/* Sub tabs */}
      <Tabs value={sub} onValueChange={(v) => setSub(v as any)}>
        <TabsList className="bg-muted/40 border border-border">
          <TabsTrigger value="suspeitos">Suspeitos</TabsTrigger>
          <TabsTrigger value="correlacoes">Correlações</TabsTrigger>
          <TabsTrigger value="banidos">Banidos</TabsTrigger>
          <TabsTrigger value="falsos">Falsos positivos</TabsTrigger>
        </TabsList>

        {/* ───── Suspeitos ───── */}
        <TabsContent value="suspeitos" className="space-y-3">
          <Card className="glass-card border-border">
            <CardContent className="p-4 space-y-3">
              {/* Filters */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por licença, HWID, IP ou tipo de evento…"
                      value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Button variant="ghost" size="sm"
                    onClick={() => exportCsv(`pilantrinhas-${new Date().toISOString().slice(0, 10)}.csv`,
                      rows.map(r => ({ ...r, event_types: r.event_types.join("|"), patterns: r.patterns.join("|") })))}
                    disabled={!rows.length}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Severidade:</span>
                  {(["critical", "error", "warn", "info"] as const).map(s => (
                    <button key={s} onClick={() => toggleSev(s)}
                      className={cn("px-2 py-0.5 rounded border text-[10px] font-mono uppercase transition-all",
                        severities.has(s) ? SEVERITY_STYLES[s] : "border-border text-muted-foreground hover:text-muted-foreground")}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Padrão:</span>
                  {PATTERN_OPTS.map(p => (
                    <button key={p} onClick={() => togglePat(p)}
                      className={cn("px-2 py-0.5 rounded border text-[10px] font-mono uppercase transition-all",
                        patterns.has(p)
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "border-border text-muted-foreground hover:text-muted-foreground")}>
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 min-w-[260px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Risk {riskRange[0]}–{riskRange[1]}</span>
                    <Slider value={riskRange} onValueChange={(v) => { setRiskRange([v[0], v[1]] as [number, number]); setPage(0); }} min={0} max={100} step={5} className="w-48" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="hideFp" checked={hideFp} onCheckedChange={(v) => { setHideFp(!!v); setPage(0); }} />
                    <Label htmlFor="hideFp" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ocultar FP</Label>
                  </div>
                </div>
              </div>

              {/* Bulk toolbar */}
              {selected.size > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                  <span className="text-xs font-bold">{selected.size} selecionado(s)</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
                    <Button size="sm" variant="outline" className="border-success/40"
                      onClick={() => setAction({ kind: "fp-bulk", keys: Array.from(selected) })}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-success" /> Marcar como FP
                    </Button>
                  </div>
                </div>
              )}

              {/* Table */}
              {listQ.isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando suspeitos…
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ShieldAlert className="h-12 w-12 mb-3 opacity-50" />
                  <p className="font-black uppercase tracking-widest text-xs">Sistema limpo no período</p>
                  <p className="text-[11px] mt-1">Tente um período maior ou afrouxe os filtros</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="w-8">
                          <Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} />
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Risk</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Sev.</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Licença</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">HWID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">IP</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Padrões</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ocorr.</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Última</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(g => (
                        <Fragment key={g.key}>
                          <TableRow className={cn("border-border hover:bg-muted/40 cursor-pointer", g.risk_score >= 75 && "bg-destructive/5")}
                            onClick={() => setExpanded(expanded === g.key ? null : g.key)}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={selected.has(g.key)} onCheckedChange={() => toggleRow(g.key)} />
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className={cn("border font-mono text-[10px] font-black cursor-help", riskColor(g.risk_score))}>{g.risk_score}</Badge>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-xs">
                                  <div className="font-bold mb-1">Risk Score</div>
                                  <div>Σ(peso da severidade × decay 14d) + tipos distintos × 4, máx 100.</div>
                                  <div className="mt-1 text-muted-foreground">
                                    {g.cnt} eventos · {g.event_types.length} tipos · pior: {g.worst_severity}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("border font-mono uppercase text-[9px]", SEVERITY_STYLES[g.worst_severity] || SEVERITY_STYLES.info)}>
                                {g.worst_severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {g.license_key
                                ? <span className="text-primary">{g.license_key.slice(0, 20)}{g.license_key.length > 20 ? "…" : ""}</span>
                                : <span className="text-foreground/30">—</span>}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {g.device_id ? (
                                <div className="flex items-center gap-1">
                                  <Cpu className="h-3 w-3 text-primary/70 shrink-0" />
                                  <span className="truncate max-w-[140px]" title={g.device_id}>{g.device_id}</span>
                                </div>
                              ) : <span className="text-foreground/30">—</span>}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {g.ip_address ? (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3 text-primary/70 shrink-0" />
                                  <span>{g.ip_address}</span>
                                </div>
                              ) : <span className="text-foreground/30">—</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {g.patterns.map(p => (
                                  <Badge key={p} className="bg-primary/20 text-primary border-primary/40 text-[9px] font-mono uppercase">{p}</Badge>
                                ))}
                                {g.event_types.slice(0, 2).map(t => (
                                  <Badge key={t} variant="outline" className="text-[9px] font-mono">{t}</Badge>
                                ))}
                                {g.event_types.length > 2 && <Badge variant="outline" className="text-[9px]">+{g.event_types.length - 2}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className="bg-muted/60 text-foreground border-border font-black">{g.cnt}</Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground" title={new Date(g.last_seen).toLocaleString("pt-BR")}>
                              {timeAgo(g.last_seen)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                <Tooltip><TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" disabled={!g.license_key}
                                    onClick={() => g.license_key && setAction({ kind: "logout", license: g.license_key })}>
                                    <LogOut className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger><TooltipContent>Forçar logout</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" disabled={!g.license_key}
                                    onClick={() => g.license_key && setAction({ kind: "revoke", license: g.license_key })}>
                                    <Ban className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </TooltipTrigger><TooltipContent>Revogar licença</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" disabled={!g.device_id}
                                    onClick={() => g.device_id && setAction({ kind: "ban-hwid", value: g.device_id })}>
                                    <Cpu className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                </TooltipTrigger><TooltipContent>Banir HWID</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" disabled={!g.ip_address}
                                    onClick={() => g.ip_address && setAction({ kind: "ban-ip", value: g.ip_address })}>
                                    <Globe className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                </TooltipTrigger><TooltipContent>Banir IP</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost"
                                    onClick={() => setAction({ kind: "fp-bulk", keys: [g.key] })}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                  </Button>
                                </TooltipTrigger><TooltipContent>Marcar falso positivo</TooltipContent></Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expanded === g.key && (
                            <TableRow className="border-border bg-background/60">
                              <TableCell colSpan={10} className="p-4">
                                {eventsQ.isLoading ? (
                                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos…
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                      Histórico ({(eventsQ.data || []).length} eventos)
                                    </div>
                                    {(eventsQ.data || []).map(ev => (
                                      <div key={ev.id} className="rounded-lg border border-border/50 bg-muted/40 p-3 space-y-1">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <div className="flex items-center gap-2">
                                            <Badge className={cn("border text-[9px] font-mono uppercase", SEVERITY_STYLES[ev.severity] || SEVERITY_STYLES.info)}>
                                              {ev.severity}
                                            </Badge>
                                            <span className="font-mono text-xs text-foreground/80">{ev.event_type}</span>
                                            {ev.endpoint && <span className="font-mono text-[10px] text-muted-foreground">@ {ev.endpoint}</span>}
                                          </div>
                                          <span className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                                        </div>
                                        {(ev.ip_address || ev.user_agent) && (
                                          <div className="text-[10px] text-muted-foreground font-mono">
                                            {ev.ip_address && <span>IP: {ev.ip_address} </span>}
                                            {ev.user_agent && <span className="truncate">UA: {ev.user_agent.slice(0, 80)}</span>}
                                          </div>
                                        )}
                                        {ev.details && Object.keys(ev.details || {}).length > 0 && (
                                          <pre className="text-[10px] text-muted-foreground bg-background/60 p-2 rounded overflow-x-auto">
                                            {JSON.stringify(ev.details, null, 2)}
                                          </pre>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Página {page + 1} de {totalPages} · {total} suspeitos</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Correlações ───── */}
        <TabsContent value="correlacoes" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <CorrCard title="HWIDs em múltiplas licenças"
              empty={!aggQ.isLoading && !(agg?.hwid_multi_licenses?.length)}
              loading={aggQ.isLoading}>
              {(agg?.hwid_multi_licenses || []).map(r => (
                <div key={r.device_id} className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary truncate">{r.device_id}</span>
                    <Badge className="bg-warning/20 text-warning border-warning/40">{r.licenses.length} licenças</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.licenses.slice(0, 6).map(l => (
                      <Badge key={l} variant="outline" className="text-[10px] font-mono">{l.slice(0, 14)}…</Badge>
                    ))}
                    {r.licenses.length > 6 && <Badge variant="outline">+{r.licenses.length - 6}</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{r.count} eventos</div>
                </div>
              ))}
            </CorrCard>
            <CorrCard title="IPs em múltiplos HWIDs"
              empty={!aggQ.isLoading && !(agg?.ip_multi_devices?.length)}
              loading={aggQ.isLoading}>
              {(agg?.ip_multi_devices || []).map(r => (
                <div key={r.ip} className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary">{r.ip}</span>
                    <Badge className="bg-warning/20 text-warning border-warning/40">{r.devices.length} HWIDs</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.devices.slice(0, 6).map(d => (
                      <Badge key={d} variant="outline" className="text-[10px] font-mono">{d.slice(0, 14)}…</Badge>
                    ))}
                    {r.devices.length > 6 && <Badge variant="outline">+{r.devices.length - 6}</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{r.count} eventos</div>
                </div>
              ))}
            </CorrCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <CorrCard title="Top 5 IPs do período" loading={aggQ.isLoading} empty={!(agg?.top_ips?.length)}>
              {(agg?.top_ips || []).map(r => (
                <div key={r.ip} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                  <span className="font-mono text-xs text-primary">{r.ip}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{r.distinct_licenses} lic.</Badge>
                    <Badge className="bg-muted/60 border-border">{r.count}</Badge>
                  </div>
                </div>
              ))}
            </CorrCard>
            <CorrCard title="Top 5 HWIDs do período" loading={aggQ.isLoading} empty={!(agg?.top_hwids?.length)}>
              {(agg?.top_hwids || []).map(r => (
                <div key={r.device_id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                  <span className="font-mono text-xs text-primary truncate max-w-[60%]">{r.device_id}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{r.distinct_licenses} lic.</Badge>
                    <Badge className="bg-muted/60 border-border">{r.count}</Badge>
                  </div>
                </div>
              ))}
            </CorrCard>
          </div>
        </TabsContent>

        {/* ───── Banidos ───── */}
        <TabsContent value="banidos">
          <Card className="glass-card border-border">
            <CardContent className="p-4">
              {bansQ.isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando banimentos…
                </div>
              ) : !(bansQ.data || []).length ? (
                <div className="text-center py-12 text-muted-foreground text-xs">Nenhum identificador banido</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Valor</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Motivo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Quando</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(bansQ.data || []).map(b => (
                      <TableRow key={b.id} className="border-border hover:bg-muted/40">
                        <TableCell><Badge className="bg-destructive/20 text-destructive-foreground border-destructive/40 uppercase text-[9px]">{b.ban_type}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{b.value}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.reason || "—"}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost"
                            onClick={() => setAction({ kind: "unban", ban_type: b.ban_type, value: b.value })}>
                            <Undo2 className="h-3.5 w-3.5 mr-1" /> Desbanir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Falsos positivos ───── */}
        <TabsContent value="falsos">
          <Card className="glass-card border-border">
            <CardContent className="p-4">
              {reviewsQ.isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
                </div>
              ) : !(reviewsQ.data || []).length ? (
                <div className="text-center py-12 text-muted-foreground text-xs">Nenhum falso positivo marcado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase">Chave</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Nota</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Por</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Quando</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reviewsQ.data || []).map(r => (
                      <TableRow key={r.id} className="border-border hover:bg-muted/40">
                        <TableCell className="font-mono text-xs">{r.event_key}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.note || "—"}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{r.admin_email || "—"}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost"
                            onClick={() => setAction({ kind: "unmark-fp", event_key: r.event_key })}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reverter
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action confirmation dialog */}
      <AlertDialog open={!!action} onOpenChange={(o) => !o && !actionLoading && setAction(null)}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{actionTitle(action)}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {actionDesc(action)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runAction(); }} disabled={actionLoading}
              className={cn(action?.kind === "revoke" || action?.kind === "purge" || action?.kind?.startsWith("ban-")
                ? "bg-destructive hover:bg-destructive/90" : "")}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

// ──────────────────────── Helpers ────────────────────────
function actionTitle(a: any) {
  if (!a) return "";
  switch (a.kind) {
    case "logout": return "Forçar logout?";
    case "revoke": return "Revogar licença?";
    case "ban-ip": return "Banir IP?";
    case "ban-hwid": return "Banir HWID?";
    case "fp-bulk": return `Marcar ${a.keys.length} como falso positivo?`;
    case "purge": return "Apagar eventos antigos?";
    case "unban": return "Desbanir?";
    case "unmark-fp": return "Reverter falso positivo?";
  }
}
function actionDesc(a: any) {
  if (!a) return "";
  switch (a.kind) {
    case "logout": return `O dispositivo da licença ${a.license} será desconectado no próximo heartbeat.`;
    case "revoke": return `A licença ${a.license} ficará inativa imediatamente. Esta ação pode ser revertida no painel de licenças.`;
    case "ban-ip": return `Requisições do IP ${a.value} serão bloqueadas em todos os endpoints.`;
    case "ban-hwid": return `O dispositivo ${a.value} será impedido de ativar qualquer licença.`;
    case "fp-bulk": return "Os suspeitos selecionados ficarão ocultos da lista (pode ser revertido na aba Falsos positivos).";
    case "purge": return "Eventos de fraude com mais de 30 dias serão removidos permanentemente.";
    case "unban": return `O ${a.ban_type.toUpperCase()} ${a.value} poderá novamente acessar o sistema.`;
    case "unmark-fp": return "Este suspeito voltará a aparecer na lista de pilantrinhas.";
  }
}

function EmptyChart({ loading }: { loading?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sem dados no período"}
    </div>
  );
}

function CorrCard({
  title, children, loading, empty,
}: { title: string; children: React.ReactNode; loading?: boolean; empty?: boolean }) {
  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : empty ? (
          <div className="text-center py-8 text-[11px] text-muted-foreground">Nada encontrado no período</div>
        ) : children}
      </CardContent>
    </Card>
  );
}