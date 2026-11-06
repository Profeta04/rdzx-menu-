import { Globe, Activity, Play, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"] as const;

interface BurpRequestFormProps {
  url: string;
  method: string;
  payload: string;
  loading: boolean;
  onUrlChange: (v: string) => void;
  onMethodChange: (v: string) => void;
  onPayloadChange: (v: string) => void;
  onExecute: () => void;
}

export function BurpRequestForm({
  url,
  method,
  payload,
  loading,
  onUrlChange,
  onMethodChange,
  onPayloadChange,
  onExecute,
}: BurpRequestFormProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <div className="w-32 shrink-0">
          <select
            value={method}
            onChange={(e) => onMethodChange(e.target.value)}
            className="w-full h-11 bg-muted/40 border border-border rounded-xl px-3 text-sm font-black uppercase tracking-widest focus:ring-primary focus:border-primary outline-none"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 relative group">
          <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="h-11 pl-11 bg-muted/40 border-border rounded-xl font-mono text-sm focus:ring-primary/40"
            placeholder="https://api.lovable.dev/..."
          />
        </div>
        <Button
          onClick={onExecute}
          disabled={loading}
          className="h-11 px-8 rounded-xl font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all gap-2 uppercase tracking-widest"
        >
          {loading ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          Executar
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Request Payload (JSON)
          </label>
          <Code2 className="w-3 h-3 text-muted-foreground/50" />
        </div>
        <Textarea
          value={payload}
          onChange={(e) => onPayloadChange(e.target.value)}
          className="min-h-[200px] bg-background/40 border-border/50 font-mono text-sm focus:ring-primary/20 rounded-xl resize-none p-4"
          placeholder={'{\n  "action": "some_action"\n}'}
        />
      </div>
    </div>
  );
}
