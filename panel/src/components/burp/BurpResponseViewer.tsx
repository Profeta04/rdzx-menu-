import { type BurpRequest } from "@/hooks/use-burp";

interface BurpResponseViewerProps {
  request: BurpRequest | null;
}

export function BurpResponseViewer({ request }: BurpResponseViewerProps) {
  return (
    <div className="border-t border-border bg-background/20">
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            API Response
          </label>
          <div className="flex gap-4">
            <span className="text-[10px] font-bold text-success/60 uppercase">
              Headers Capturados Automáticos
            </span>
            <span className="text-[10px] font-bold text-success/60 uppercase">
              Auth: Bearer Active
            </span>
          </div>
        </div>
        <div className="bg-background/60 border border-border rounded-xl p-4 min-h-[300px] overflow-auto">
          <pre className="text-xs font-mono text-success leading-relaxed">
            {request ? request.response : "// Aguardando execução..."}
          </pre>
        </div>
      </div>
    </div>
  );
}
