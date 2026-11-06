import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, ShieldCheck, ShieldAlert, Download } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useBurp, type BurpRequest } from "@/hooks/use-burp";
import { useBurpReplay } from "@/hooks/useBurpReplay";
import { BurpRequestForm } from "./BurpRequestForm";
import { BurpResponseViewer } from "./BurpResponseViewer";
import { BurpHistoryList } from "./BurpHistoryList";
import { BurpScriptsGrid } from "./BurpScriptsGrid";
import { BurpPresetsManager } from "./BurpPresetsManager";

const BURP_VERSION = "v4.4.6";

const BURP_FILES = [
  "manifest.json",
  "burp_background.js",
  "burp_ai_client.js",
  "burp_content.js",
  "burp_pageHook.js",
  "burp_sidepanel.css",
  "burp_sidepanel.html",
  "burp_sidepanel.js",
  "burp_ws_console.js",
  "burp_floating.js",
  "burp_floating.css",
  "burp_chains.js",
  // ── Bloco B (12 scripts) ──
  "scripts/_shared.js",
  "scripts/_registry.js",
  "scripts/cartographer.js",
  "scripts/payload-diff.js",
  "scripts/action-classifier.js",
  "scripts/dep-graph.js",
  "scripts/cost-profiler.js",
  "scripts/replay-mutate.js",
  "scripts/header-probe.js",
  "scripts/sse-decoder.js",
  "scripts/drift-monitor.js",
  "scripts/error-miner.js",
  "scripts/composer-explain.js",
  "scripts/postman-export.js",
  "scripts/curl-exporter.js",
  "scripts/response-schema.js",
  "scripts/token-lifecycle.js",
  "scripts/dedup-detector.js",
  "scripts/ai-prompt-lens.js",
  "scripts/smart-replay-fuzz.js",
  "scripts/e2e-decryptor.js",
  "scripts/chat-replay.js",
  "scripts/ws-correlator.js",
  "scripts/har-exporter.js",
  "scripts/openapi-exporter.js",
  "scripts/admin-bypass-prober.js",
  "scripts/claim-leak-detector.js",
];

export function BurpLovable() {
  const { history, loading, authStatus, projectId, workspaceId, executeRequest, clearHistory } =
    useBurp();
  const { isBuilding, buildMode, downloadExtension } = useBurpReplay({
    files: BURP_FILES,
    version: BURP_VERSION,
  });

  const [url, setUrl] = useState("https://api.lovable.dev/v1/projects");
  const [method, setMethod] = useState("GET");
  const [payload, setPayload] = useState("{\n  \n}");
  const [selectedRequest, setSelectedRequest] = useState<BurpRequest | null>(null);

  const handleExecute = async () => {
    const req = await executeRequest(url, method, payload);
    if (req) setSelectedRequest(req);
  };

  const handleSelectFromHistory = (req: BurpRequest) => {
    setUrl(req.url);
    setMethod(req.method);
    setPayload(req.payload);
    setSelectedRequest(req);
  };

  return (
    <Tabs defaultValue="playground" className="w-full">
      <TabsList className="bg-muted/40 border border-border">
        <TabsTrigger value="playground">Playground & Build</TabsTrigger>
        <TabsTrigger value="presets">Presets ({BURP_VERSION})</TabsTrigger>
        <TabsTrigger value="scripts">Scripts</TabsTrigger>
      </TabsList>

      <TabsContent value="presets" className="mt-4">
        <BurpPresetsManager />
      </TabsContent>

      <TabsContent value="scripts" className="mt-4">
        <BurpScriptsGrid files={BURP_FILES} version={BURP_VERSION} />
      </TabsContent>

      <TabsContent value="playground" className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[800px]">
          {/* Coluna Esquerda: Editor de Request */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-border/50 bg-card shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/40 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <Terminal className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black italic tracking-tighter uppercase">
                        Hyper RB
                      </CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Request Engine {BURP_VERSION}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    {authStatus === "connected" ? (
                      <Badge className="bg-success/10 text-success border-success/20 px-3 py-1 gap-1.5 uppercase font-black text-[9px] tracking-widest">
                        <ShieldCheck className="w-3 h-3" /> Conectado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-warning border-warning/20 px-3 py-1 gap-1.5 uppercase font-black text-[9px] tracking-widest animate-pulse"
                      >
                        <ShieldAlert className="w-3 h-3" /> Aguardando Captura
                      </Badge>
                    )}
                    {projectId && (
                      <Badge
                        variant="secondary"
                        className="bg-muted/40 border-border px-3 py-1 gap-1.5 uppercase font-black text-[9px] tracking-widest"
                      >
                        PID: {projectId.substring(0, 8)}...
                      </Badge>
                    )}
                    {workspaceId && (
                      <Badge
                        variant="secondary"
                        className="bg-muted/40 border-border px-3 py-1 gap-1.5 uppercase font-black text-[9px] tracking-widest"
                      >
                        WID: {workspaceId.substring(0, 8)}...
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadExtension({ obfuscate: false })}
                      disabled={isBuilding}
                      className="h-8 bg-warning/10 border-warning/20 hover:bg-warning/20 text-warning rounded-lg font-black uppercase tracking-widest text-[9px] transition-all active:scale-95"
                    >
                      {isBuilding && buildMode === "plain" ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                      ) : (
                        <Download className="w-3 h-3 mr-1.5" />
                      )}
                      Baixar Build
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadExtension({ obfuscate: true })}
                      disabled={isBuilding}
                      className="h-8 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary rounded-lg font-black uppercase tracking-widest text-[9px] transition-all active:scale-95"
                    >
                      {isBuilding && buildMode === "obfuscated" ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                      ) : (
                        <Download className="w-3 h-3 mr-1.5" />
                      )}
                      Baixar Ofuscado
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <BurpRequestForm
                  url={url}
                  method={method}
                  payload={payload}
                  loading={loading}
                  onUrlChange={setUrl}
                  onMethodChange={setMethod}
                  onPayloadChange={setPayload}
                  onExecute={handleExecute}
                />
                <BurpResponseViewer request={selectedRequest} />
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita: Logs e Histórico */}
          <div className="lg:col-span-4 space-y-6 h-full flex flex-col">
            <BurpHistoryList
              history={history}
              selectedRequest={selectedRequest}
              onSelect={handleSelectFromHistory}
              onClear={clearHistory}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
