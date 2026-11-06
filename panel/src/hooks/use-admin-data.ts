import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================
export interface License {
  id: string; license_key: string; user_name: string | null; user_id: string | null;
  status: "active" | "trial" | "expired" | "revoked";
  device_id: string | null; activated_at: string | null; expires_at: string | null;
  max_sessions: number; created_at: string; created_by: string | null;
  prompts_count: number; editing_seconds: number;
  client_email?: string | null; client_phone?: string | null;
  duration_days?: number | null; lifetime?: boolean | null;
}
export interface CreditPackage {
  id: string; name: string; credits: number; amount: number;
  token_type: "7d" | "monthly" | "annual" | "lifetime";
  is_active: boolean; created_at: string;
}
export interface Session {
  id: string; license_id: string; session_id: string; device_id: string | null;
  last_heartbeat: string; is_active: boolean; created_at: string;
}
export interface Notification { id: string; title: string; message: string; link: string | null; created_at: string; }
export interface ExtensionVersion { id: string; version: string; changelog: string | null; file_path: string | null; is_alert_active: boolean; created_at: string; }
export interface Payment {
  id: string; customer_name: string; customer_number: string; customer_email: string | null;
  plan_name: string; payment_status: string; license_key: string | null;
  files_url: string | null; created_at: string; updated_at: string;
}
export interface Reseller {
  id: string; user_id: string | null; email: string | null; license_key: string | null;
  tokens_7d: number; tokens_monthly: number; tokens_annual: number;
  tokens_lifetime: number; tokens_daily?: number;
  created_at: string; updated_at: string;
  profiles?: { full_name: string | null } | null;
}

// ============================================================================
// Cache policy (staleTime per entity)
// ============================================================================
const STALE = {
  sessions: 10_000,       // 10s — live
  licenses: 30_000,       // 30s
  notifications: 60_000,  // 1min
  payments: 60_000,
  resellers: 300_000,     // 5min
  packages: 300_000,
  versions: 300_000,
  users: 300_000,
  headerMetrics: 30_000,
} as const;

function toastOnError(label: string) {
  return (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${label}]`, err);
    toast.error(`Erro ao carregar ${label}: ${msg}`);
  };
}

// Shared query options — retry disabled to avoid hammering DB on auth/RLS errors
const BASE_QUERY_OPTS = {
  retry: false,
  refetchOnWindowFocus: false,
  gcTime: 5 * 60_000,
} as const;

// ============================================================================
// Generic query factory keeping the legacy { data, loading, refetch } API
// ============================================================================
function makeAdminQuery<T>(opts: {
  key: string;
  staleTime: number;
  fetcher: () => Promise<T>;
  errorLabel: string;
}) {
  return () => {
    const q = useQuery<T>({
      queryKey: [opts.key],
      queryFn: async () => {
        try { return await opts.fetcher(); }
        catch (e) { toastOnError(opts.errorLabel)(e); throw e; }
      },
      staleTime: opts.staleTime,
      ...BASE_QUERY_OPTS,
    });
    return { data: q.data, loading: q.isLoading, refetch: async () => { await q.refetch(); }, error: q.error };
  };
}

// ============================================================================
// Hooks (same names + same return shape used by AdminDashboard)
// ============================================================================
export function useLicenses() {
  const q = useQuery<License[]>({
    queryKey: ["licenses"],
    queryFn: async () => {
      // Fire-and-forget sync; log but don't block on error
      supabase.rpc("sync_expired_licenses").then(({ error }) => {
        if (error) console.warn("[useLicenses] sync_expired_licenses:", error.message);
      });
      const { data, error } = await supabase.from("licenses")
        .select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data as License[]) || [];
    },
    staleTime: STALE.licenses,
    ...BASE_QUERY_OPTS,
  });
  return { licenses: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function useSessions() {
  const q = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("*").eq("is_active", true)
        .order("last_heartbeat", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data as Session[]) || [];
    },
    staleTime: STALE.sessions,
    // Polling reduzido de 15s → 60s. A limpeza de sessões expiradas roda
    // em pg_cron (cleanup-stale-sessions-2min), não precisa ser disparada
    // pelo cliente. refetchIntervalInBackground não é setado → react-query
    // pausa automaticamente quando a aba não está visível.
    refetchInterval: 60_000,
    ...BASE_QUERY_OPTS,
  });
  return { sessions: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function useNotifications() {
  const q = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications")
        .select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data as Notification[]) || [];
    },
    staleTime: STALE.notifications,
    ...BASE_QUERY_OPTS,
  });
  return { notifications: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function useExtensionVersions() {
  const q = useQuery<ExtensionVersion[]>({
    queryKey: ["extension_versions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extension_versions")
        .select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data as ExtensionVersion[]) || [];
    },
    staleTime: STALE.versions,
    ...BASE_QUERY_OPTS,
  });
  return { versions: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function usePayments() {
  const q = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments")
        .select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data as Payment[]) || [];
    },
    staleTime: STALE.payments,
    ...BASE_QUERY_OPTS,
  });
  return { payments: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function useResellers() {
  const q = useQuery<Reseller[]>({
    queryKey: ["resellers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resellers")
        .select(`*, profiles:user_id ( full_name )`)
        .order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return ((data as any[]) || []) as Reseller[];
    },
    staleTime: STALE.resellers,
    ...BASE_QUERY_OPTS,
  });
  return { resellers: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function useUsers() {
  const q = useQuery<{ id: string; full_name: string | null }[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles").select("id, full_name")
        .order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data as any[]) || [];
    },
    staleTime: STALE.users,
    ...BASE_QUERY_OPTS,
  });
  return { users: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

export function usePackages() {
  const q = useQuery<CreditPackage[]>({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reseller_credit_packages")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as CreditPackage[];
    },
    staleTime: STALE.packages,
    ...BASE_QUERY_OPTS,
  });
  return { packages: q.data || [], loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

// ============================================================================
// Header metrics (today vs yesterday)
// ============================================================================
export interface HeaderMetrics {
  licenses_today: number; licenses_yesterday: number;
  active_licenses: number; active_sessions: number;
  resellers_total: number;
  revenue_today: number; revenue_yesterday: number;
  fraud_events_24h: number; generated_at: string;
}
export function useHeaderMetrics() {
  const q = useQuery<HeaderMetrics>({
    queryKey: ["header-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_header_metrics");
      if (error) throw error;
      return data as unknown as HeaderMetrics;
    },
    staleTime: STALE.headerMetrics,
    refetchInterval: 60_000,
    ...BASE_QUERY_OPTS,
  });
  return { metrics: q.data, loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

// ============================================================================
// Server-side paginated license search
// ============================================================================
export interface SearchLicensesArgs {
  search?: string; status?: string; createdBy?: string;
  limit?: number; offset?: number;
}
export function useSearchLicenses(args: SearchLicensesArgs) {
  const { search = "", status, createdBy, limit = 50, offset = 0 } = args;
  const q = useQuery<{ rows: License[]; total: number }>({
    queryKey: ["search-licenses", search, status, createdBy, limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_licenses_admin", {
        p_search: search || null,
        p_status: status || null,
        p_created_by: createdBy || null,
        p_limit: limit, p_offset: offset,
      });
      if (error) throw error;
      const payload = data as any;
      return { rows: (payload?.rows ?? []) as License[], total: (payload?.total ?? 0) as number };
    },
    staleTime: STALE.licenses,
    ...BASE_QUERY_OPTS,
  });
  return { rows: q.data?.rows || [], total: q.data?.total || 0, loading: q.isLoading, refetch: async () => { await q.refetch(); } };
}

// Allow imperative cache invalidation from non-hook places
export function useAdminQueryClient() { return useQueryClient(); }
