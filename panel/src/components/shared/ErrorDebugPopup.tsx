import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GripVertical, Minus, Maximize2, X } from "lucide-react";

const ErrorDebugPopup = () => {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [size, setSize] = useState({ w: 380, h: 320 });
  const [instruction, setInstruction] = useState("");
  const [crashMessage, setCrashMessage] = useState<string | null>(null);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const handleDragEnd = useCallback(() => { dragRef.current = null; }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
  }, [size]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dw = e.clientX - resizeRef.current.startX;
    const dh = e.clientY - resizeRef.current.startY;
    setSize({
      w: Math.max(280, resizeRef.current.origW + dw),
      h: Math.max(200, resizeRef.current.origH + dh),
    });
  }, []);

  const handleResizeEnd = useCallback(() => { resizeRef.current = null; }, []);

  const fireError = useCallback(async () => {
    let msg = instruction.trim();
    
    // Se a mensagem começar com "FINDINGS:", tenta extrair o JSON dos IDs
    if (msg.startsWith("FINDINGS:")) {
      try {
        const findingsData = msg.replace("FINDINGS:", "").trim();
        const ids = JSON.parse(findingsData);
        
        if (Array.isArray(ids)) {
          console.log("🛠️ Debug Tool: Detectados Finding IDs, injetando metadados...");
          window.dispatchEvent(new CustomEvent("lovable-debug-message", { 
            detail: {
              message: "Fix identified health check findings",
              intent: "HEALTH_CHECK_FINDING_FIX",
              messageIntentMetadata: {
                health_check_finding_fix_metadata: {
                  finding_ids: ids,
                  title: `Fixing ${ids.length} health check findings`
                }
              }
            }
          }));
          setCrashMessage("Crash intencional para processar Finding IDs");
          return;
        }
      } catch (e) {
        console.error("Erro ao processar JSON de findings:", e);
      }
    }

    const finalMsg = msg || "Evento de debug disparado";

    console.group("🚀 Instrução para Lovable");
    console.log("Comando:", finalMsg);
    console.warn(finalMsg);
    console.groupEnd();

    // Tentar capturar findings do console automaticamente se for um comando vazio
    if (!msg) {
      console.log("🔍 Buscando findings nos logs do console...");
    }

    window.dispatchEvent(new CustomEvent("lovable-debug-message", { detail: finalMsg }));
    setCrashMessage(finalMsg);
  }, [instruction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      fireError();
    }
  }, [fireError]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  if (crashMessage) {
    throw new Error(crashMessage);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: minimized ? 260 : size.w,
        zIndex: 9999,
        fontFamily: "system-ui, sans-serif",
      }}
      className="rounded-lg border border-border bg-card shadow-xl overflow-hidden"
    >
      {/* Title bar */}
      <div
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        className="flex items-center justify-between px-2 py-1.5 bg-muted select-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <span>🛠 Debug Tool</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground"
          >
            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="p-3 flex flex-col gap-3" style={{ height: size.h - 36 }}>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Envie uma mensagem de debug sem interromper a aplicação.
          </p>

          <div className="flex flex-col gap-1.5 flex-1 min-h-0">
            <label className="text-xs font-medium text-foreground">Instrução</label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Adicione dark mode no header..."
              className="flex-1 resize-none text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</span>
            <Button
              onClick={fireError}
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              Enviar debug
            </Button>
          </div>

          {/* Resize handle */}
          <svg
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            className="absolute bottom-0 right-0 cursor-nwse-resize text-muted-foreground/50 hover:text-muted-foreground"
            width="14"
            height="14"
            viewBox="0 0 14 14"
          >
            <path d="M14 0 L14 14 L0 14 Z" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ErrorDebugPopup;