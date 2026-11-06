import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Subscribes to realtime changes on critical admin tables and invalidates
 * the matching React Query caches so the UI stays live without polling.
 *
 * Security/stability notes:
 *  - Channel name includes a random suffix to prevent collision under React
 *    StrictMode double-mount (which calls setup+teardown+setup in dev).
 *  - subscribe() callback logs errors so silent failures are visible.
 *  - Cleanup calls removeChannel() which properly unsubscribes from Postgres.
 */
export function useAdminRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const tables: Array<{ table: string; keys: string[] }> = [
      { table: "licenses",      keys: ["licenses", "header-metrics"] },
      { table: "sessions",      keys: ["sessions", "header-metrics"] },
      { table: "notifications", keys: ["notifications"] },
      { table: "resellers",     keys: ["resellers", "header-metrics"] },
      { table: "payments",      keys: ["payments", "header-metrics"] },
      { table: "fraud_events",  keys: ["header-metrics"] },
    ];

    // Unique channel name avoids collisions in React StrictMode double-mount
    const channelName = `admin-realtime-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelName);

    for (const { table, keys } of tables) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      );
    }

    channel.subscribe((status, err) => {
      if (err) {
        console.error("[useAdminRealtime] subscription error:", err);
      } else if (status === "SUBSCRIBED") {
        console.debug("[useAdminRealtime] subscribed →", channelName);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
