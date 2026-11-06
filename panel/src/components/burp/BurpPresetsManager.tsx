import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePresets, type BurpPreset, type BurpPresetInput } from "@/hooks/usePresets";

// ─── helpers ────────────────────────────────────────────────────────────────

function emptyDraft(): BurpPresetInput {
  return {
    slug: "",
    name: "",
    description: null,
    method: "POST",
    url_template: "",
    headers_template: {},
    body_template: {},
    requires_hb_license: false,
    enabled: true,
    sort_order: 0,
  };
}

function parseJson<T>(str: string, fallback: T): T | null {
  try { return JSON.parse(str || "{}") as T; } catch { return null; }
}

// ─── PresetRow ───────────────────────────────────────────────────────────────

interface PresetRowProps {
  preset: BurpPreset;
  saving: boolean;
  onSave: (id: string, input: BurpPresetInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function PresetRow({ preset, saving, onSave, onDelete }: PresetRowProps) {
  const [p, setP] = useState<BurpPreset>(preset);
  const [headersText, setHeadersText] = useState(
    JSON.stringify(preset.headers_template ?? {}, null, 2)
  );
  const [bodyText, setBodyText] = useState(
    JSON.stringify(preset.body_template ?? {}, null, 2)
  );

  const handleSave = async () => {
    const headers = parseJson<Record<string, string>>(headersText, {});
    const body = parseJson<Record<string, unknown>>(bodyText, {});
    if (headers === null) { return; /* toast is handled in hook */ }
    if (body === null) { return; }
    const { id, ...rest } = p;
    await onSave(id, { ...rest, headers_template: headers, body_template: body });
  };

  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-card">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="font-mono text-[10px]">{p.slug}</Badge>
        <Input
          className="h-8 flex-1 min-w-[200px]"
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
        />
        <Input
          className="h-8 w-24"
          value={p.method}
          onChange={(e) => setP({ ...p, method: e.target.value.toUpperCase() })}
        />
        <label className="flex items-center gap-1 text-[10px]">
          <Switch checked={p.enabled} onCheckedChange={(v) => setP({ ...p, enabled: v })} />
          ativo
        </label>
        <label className="flex items-center gap-1 text-[10px]">
          <Switch
            checked={p.requires_hb_license}
            onCheckedChange={(v) => setP({ ...p, requires_hb_license: v })}
          />
          HB
        </label>
      </div>
      <Input
        className="h-8 font-mono text-xs"
        value={p.url_template}
        onChange={(e) => setP({ ...p, url_template: e.target.value })}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Textarea
          className="font-mono text-[11px] min-h-[80px]"
          value={headersText}
          onChange={(e) => setHeadersText(e.target.value)}
        />
        <Textarea
          className="font-mono text-[11px] min-h-[80px]"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" className="gap-2">
              <Trash2 className="w-3 h-3" /> Remover
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover preset?</AlertDialogTitle>
              <AlertDialogDescription>
                O preset <strong>{p.name}</strong> ({p.slug}) será excluído permanentemente. Esta
                ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(p.id)}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── BurpPresetsManager ──────────────────────────────────────────────────────

export function BurpPresetsManager() {
  const { presets, loading, saving, create, update, remove } = usePresets();

  const [draft, setDraft] = useState<BurpPresetInput>(emptyDraft());
  const [headersText, setHeadersText] = useState("{}");
  const [bodyText, setBodyText] = useState("{}");

  const handleCreate = async () => {
    const headers = parseJson<Record<string, string>>(headersText, {});
    const body = parseJson<Record<string, unknown>>(bodyText, {});
    if (headers === null) { return; }
    if (body === null) { return; }
    if (!draft.slug || !draft.name || !draft.url_template) {
      return;
    }
    const ok = await create({ ...draft, headers_template: headers, body_template: body });
    if (ok) {
      setDraft(emptyDraft());
      setHeadersText("{}");
      setBodyText("{}");
    }
  };

  const handleUpdate = async (id: string, input: BurpPresetInput) => {
    await update(id, input);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  return (
    <div className="space-y-6">
      {/* ── Criar novo ── */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo preset
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="slug (ex: lovable-chat)"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
          <Input
            placeholder="name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            placeholder="method"
            value={draft.method}
            onChange={(e) => setDraft({ ...draft, method: e.target.value.toUpperCase() })}
          />
          <Input
            placeholder="url_template (suporta {projectId})"
            value={draft.url_template}
            onChange={(e) => setDraft({ ...draft, url_template: e.target.value })}
          />
          <Textarea
            placeholder="headers JSON"
            className="font-mono text-xs min-h-[100px] md:col-span-2"
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
          />
          <Textarea
            placeholder="body JSON"
            className="font-mono text-xs min-h-[140px] md:col-span-2"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
          <Input
            placeholder="description"
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value || null })}
          />
          <Input
            type="number"
            placeholder="sort_order"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={draft.requires_hb_license}
              onCheckedChange={(v) => setDraft({ ...draft, requires_hb_license: v })}
            />
            Requer licença HyperBuild
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
            Habilitado
          </label>
          <div className="md:col-span-2">
            <Button
              onClick={handleCreate}
              disabled={saving === "new"}
              className="gap-2"
            >
              {saving === "new" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Criar preset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Lista ── */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-sm font-black uppercase tracking-widest">
            Presets ({presets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            presets.map((p) => (
              <PresetRow
                key={p.id}
                preset={p}
                saving={saving === p.id}
                onSave={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
