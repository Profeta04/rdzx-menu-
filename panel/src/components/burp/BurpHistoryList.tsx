import { History, Trash2, Zap, ChevronRight, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type BurpRequest } from "@/hooks/use-burp";

interface BurpHistoryListProps {
  history: BurpRequest[];
  selectedRequest: BurpRequest | null;
  onSelect: (req: BurpRequest) => void;
  onClear: () => void;
}

function methodColorClass(method: string): string {
  if (method === "GET") return "bg-success/10 text-success border-success/20";
  if (method === "POST") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return "bg-warning/10 text-warning border-warning/20";
}

export function BurpHistoryList({
  history,
  selectedRequest,
  onSelect,
  onClear,
}: BurpHistoryListProps) {
  return (
    <Card className="border-border/50 bg-card shadow-2xl flex-1 flex flex-col overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-widest">
              Logs de Tráfego
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-400px)] lg:h-[700px]">
          <div className="p-3 space-y-2">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 rounded-full bg-muted/40 border border-border">
                  <Zap className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">
                    Sem histórico
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground/30">
                    Capture requests do Lovable.dev
                  </p>
                </div>
              </div>
            ) : (
              history.map((req) => (
                <div
                  key={req.id}
                  onClick={() => onSelect(req)}
                  className={cn(
                    "group p-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98]",
                    selectedRequest?.id === req.id
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/40 border-border/50 hover:border-border hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter",
                          methodColorClass(req.method)
                        )}
                      >
                        {req.method}
                      </span>
                      <span
                        className={cn(
                          "text-[8px] font-bold uppercase",
                          req.status < 400 ? "text-success" : "text-destructive"
                        )}
                      >
                        {req.status} {req.status < 400 ? "OK" : "ERR"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground/50">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="text-[8px] font-bold">
                        {new Date(req.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-mono text-muted-foreground truncate group-hover:text-foreground transition-colors">
                        {req.url}
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <div className="p-4 border-t border-border bg-background/40 shrink-0">
        <Button
          variant="outline"
          className="w-full h-10 border-border/50 bg-muted/40 hover:bg-muted/60 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
          onClick={() => window.open("https://lovable.dev", "_blank")}
        >
          <ExternalLink className="w-3 h-3" /> Abrir Lovable Dashboard
        </Button>
      </div>
    </Card>
  );
}
