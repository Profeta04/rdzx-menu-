import { useState } from "react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export type BuildMode = "plain" | "obfuscated";

interface UseBurpReplayOptions {
  files: string[];
  version: string;
}

async function obfuscateBurpJs(content: string): Promise<string> {
  try {
    const JavaScriptObfuscator = (await import("javascript-obfuscator")).default;
    return JavaScriptObfuscator.obfuscate(content, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      stringArray: true,
      stringArrayEncoding: ["base64"],
      stringArrayThreshold: 0.75,
      identifierNamesGenerator: "hexadecimal",
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      target: "browser",
      reservedNames: ["^chrome$", "^browser$"],
    }).getObfuscatedCode();
  } catch (e) {
    console.warn("Falha ao ofuscar, retornando original:", e);
    return content;
  }
}

export function useBurpReplay({ files, version }: UseBurpReplayOptions) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildMode, setBuildMode] = useState<BuildMode | null>(null);

  const downloadExtension = async (opts: { obfuscate: boolean } = { obfuscate: false }) => {
    if (isBuilding) return;
    setIsBuilding(true);
    setBuildMode(opts.obfuscate ? "obfuscated" : "plain");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      await Promise.all(
        files.map(async (file) => {
          const res = await fetch(`${window.location.origin}/burp_src/${file}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`Falha em ${file}: HTTP ${res.status}`);
          let content = await res.text();

          if (file.endsWith(".js")) {
            if (SUPABASE_URL) {
              content = content.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi, SUPABASE_URL);
            }
            if (SUPABASE_ANON_KEY) {
              content = content.replace(
                /(const|let|var)\s+SUPABASE_ANON_KEY\s*=\s*['"][^'"]*['"]/g,
                `$1 SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}"`
              );
            }
            if (opts.obfuscate) {
              content = await obfuscateBurpJs(content);
            }
          }

          zip.file(file, content);
        })
      );

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const suffix = opts.obfuscate ? "-obfuscated" : "";
      saveAs(blob, `Hyper-RB-${version}${suffix}.zip`);
      toast.success(opts.obfuscate ? "Build ofuscado concluído!" : "Build concluído!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao gerar extensão:", err);
      toast.error("Erro no build: " + message);
    } finally {
      setIsBuilding(false);
      setBuildMode(null);
    }
  };

  return { isBuilding, buildMode, downloadExtension };
}
