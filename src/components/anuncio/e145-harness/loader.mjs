// Harness de teste (Pista 3 — E145): renderiza o .tsx REAL de blocos-cadastro.tsx (ProximidadesAutomaticas) no node --test,
// trocando só os componentes de UI vizinhos por dublês vazios (os nomes vêm das exportações reais deles); ícones, regras e
// textos são os reais. Não entra no app; só o teste o registra.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";
import ts from "typescript";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const H = `import { createElement as h } from "react";\n`;
// Componentes vizinhos trocados por dublês: o caminho real só serve para ler os nomes exportados.
const VAZIOS = {
  "@/components/ui/skeleton": "src/components/ui/skeleton.tsx",
  "@/components/ui/campo-reais": "src/components/ui/campo-reais.tsx",
  "@/components/anuncio/escolha-assistente": "src/components/anuncio/escolha-assistente.tsx",
  "@/components/anuncio/marca-obrigatorio": "src/components/anuncio/marca-obrigatorio.tsx",
  "@/components/property/manual-proximities": "src/components/property/manual-proximities.tsx",
  "./medir-internet": "src/components/anuncio/medir-internet.tsx",
};
const BOTAO = H + `export const Button = ({ children, ...p }) => h("button", { "data-testid": p["data-testid"] }, children);`;

function vazio(caminho) {
  const src = readFileSync(pr(RAIZ, caminho), "utf8");
  const nomes = new Set([...src.matchAll(/export (?:async )?(?:function|const|class) (\w+)/g)].map((m) => m[1]));
  return [...nomes].map((n) => (/^[A-Z]/.test(n) ? `export const ${n} = () => null;` : `export const ${n} = undefined;`)).join("\n");
}

export async function resolve(spec, ctx, next) {
  if (spec in VAZIOS || spec === "@/components/ui/button") return { url: "e145:" + spec, shortCircuit: true };
  const tentar = (base) => {
    for (const ext of ["", ".ts", ".tsx"]) if (existsSync(base + ext) && /\.\w+$/.test(base + ext)) return pathToFileURL(base + ext).href;
    return null;
  };
  if (spec.startsWith("@/")) {
    const url = tentar(pr(RAIZ, "src", spec.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && !/\.\w+$/.test(spec)) {
    const url = tentar(pr(dirname(fileURLToPath(ctx.parentURL)), spec));
    if (url) return { url, shortCircuit: true };
  }
  if (ctx.parentURL?.startsWith("e145:")) return next(spec, { ...ctx, parentURL: import.meta.url });
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("e145:")) {
    const spec = url.slice(5);
    return { format: "module", source: spec === "@/components/ui/button" ? BOTAO : vazio(VAZIOS[spec]), shortCircuit: true };
  }
  if (url.endsWith(".tsx")) {
    const src = readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, ctx);
}
