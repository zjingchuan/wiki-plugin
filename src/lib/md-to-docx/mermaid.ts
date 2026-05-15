import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export class MermaidNotInstalledError extends Error {
  constructor() {
    super("mermaid-cli 未安装。请运行: npm install --save-optional @mermaid-js/mermaid-cli");
    this.name = "MermaidNotInstalledError";
  }
}

let cachedAvailable: boolean | null = null;

export function isMermaidAvailable(): boolean {
  if (cachedAvailable !== null) return cachedAvailable;
  try {
    const mmdcPath = path.join(process.cwd(), "node_modules", "@mermaid-js", "mermaid-cli");
    fs.accessSync(mmdcPath);
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

export async function renderMermaidToPng(code: string, outputDir: string): Promise<string> {
  if (!isMermaidAvailable()) {
    throw new MermaidNotInstalledError();
  }

  const hash = crypto.createHash("md5").update(code).digest("hex").slice(0, 8);
  const mmdFile = path.join(outputDir, `mermaid_${hash}.mmd`);
  const pngFile = path.join(outputDir, `mermaid_${hash}.png`);

  if (fs.existsSync(pngFile)) return pngFile;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(mmdFile, code, "utf-8");

  const isWindows = process.platform === "win32";
  const mmdcBin = path.join(
    process.cwd(), "node_modules", ".bin", isWindows ? "mmdc.cmd" : "mmdc"
  );
  const shell = isWindows ? (process.env.ComSpec || "C:\\Windows\\system32\\cmd.exe") : undefined;
  execSync(`"${mmdcBin}" -i "${mmdFile}" -o "${pngFile}" -b transparent`, {
    stdio: "pipe",
    timeout: 30000,
    ...(shell ? { shell } : {}),
  });

  return pngFile;
}
