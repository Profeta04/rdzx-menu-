import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface BurpPreset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  method: string;
  url_template: string;
  headers_template: Record<string, string>;
  body_template: Record<string, unknown>;
  requires_hb_license: boolean;
  enabled: boolean;
  sort_order: number;
}

export type BurpPresetInput = Omit<BurpPreset, "id">;

export function usePresets() {
  const [presets, setPresets] = useState<BurpPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const list = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("burp_presets")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error("Erro ao carregar presets: " + error.message);
    else setPresets((data ?? []) as BurpPreset[]);
    setLoading(false);
  }, []);

  useEffect(() => { list(); }, [list]);

  const create = async (input: BurpPresetInput): Promise<boolean> => {
    setSaving("new");
    const { error } = await supabase.from("burp_presets").insert(input as any);
    setSaving(null);
    if (error) { toast.error("Erro: " + error.message); return false; }
    toast.success("Preset criado");
    await list();
    return true;
  };

  const update = async (id: string, input: BurpPresetInput): Promise<boolean> => {
    setSaving(id);
    const { error } = await supabase.from("burp_presets").update(input as any).eq("id", id);
    setSaving(null);
    if (error) { toast.error("Erro: " + error.message); return false; }
    toast.success("Preset atualizado");
    await list();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("burp_presets").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return false; }
    toast.success("Removido");
    await list();
    return true;
  };

  return { presets, loading, saving, list, create, update, remove };
}
