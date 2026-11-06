import { Code2, FileCode2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BurpScriptsGridProps {
  files: string[];
  version: string;
}

function fileCategory(file: string): "core" | "script" | "asset" {
  if (file.startsWith("scripts/")) return "script";
  if (file.endsWith(".js")) return "core";
  return "asset";
}

const CATEGORY_STYLE: Record<"core" | "script" | "asset", string> = {
  core: "bg-primary/10 text-primary border-primary/20",
  script: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  asset: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_LABEL: Record<"core" | "script" | "asset", string> = {
  core: "Core",
  script: "Script",
  asset: "Asset",
};

export function BurpScriptsGrid({ files, version }: BurpScriptsGridProps) {
  const scripts = files.filter((f) => f.startsWith("scripts/"));
  const core = files.filter((f) => !f.startsWith("scripts/"));

  return (
    <Card className="border-border/50 bg-card shadow-2xl">
      <CardHeader className="border-b border-border bg-muted/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-widest">
              Extension Bundle
            </CardTitle>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest">
            {version} · {files.length} arquivos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Core ({core.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {core.map((file) => {
              const cat = fileCategory(file);
              return (
                <div
                  key={file}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono truncate",
                    CATEGORY_STYLE[cat]
                  )}
                >
                  <FileCode2 className="w-3 h-3 shrink-0 opacity-60" />
                  <span className="truncate">{file}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Scripts ({scripts.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {scripts.map((file) => {
              const name = file.replace("scripts/", "");
              return (
                <div
                  key={file}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono truncate bg-blue-500/10 text-blue-400 border-blue-500/20"
                >
                  <FileCode2 className="w-3 h-3 shrink-0 opacity-60" />
                  <span className="truncate">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
