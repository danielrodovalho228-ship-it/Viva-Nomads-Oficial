// Harness de teste (Pista 3 — E971): renderiza o .tsx REAL de anexo-conversa.tsx no node --test. A galeria do imóvel
// (@/components/property-gallery) é trocada por um dublê que REGISTA que foi importada (os nomes vêm das exportações
// reais); o resto (ícones, regras do anexo) é o real. Não entra no app; só o teste o registra.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";
import ts from "typescript";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const GALERIA = "@/components/property-gallery";

function dubleDaGaleria() {
  const src = readFileSync(pr(RAIZ, "src/components/property-gallery.tsx"), "utf8");
  const nomes = new Set([...src.matchAll(/export (?:async )?(?:function|const|class) (\w+)/g)].map((m) => m[1]));
  const linhas = [`globalThis.__e971GaleriaImportada = true;`, `import { createElement as h } from "react";`];
  for (const n of nomes)
    linhas.push(
      n === "Lightbox"
        ? `export const Lightbox = (p) => h("div", { "data-testid": "galeria-lightbox", role: "dialog", "data-fotos": (p.photos ?? []).length });`
        : /^[A-Z]/.test(n) ? `export const ${n} = () => null;` : `export const ${n} = undefined;`,
    );
  return linhas.join("\n");
}

export async function resolve(spec, ctx, next) {
  if (spec === GALERIA || spec === "../property-gallery") return { url: "e971:galeria", shortCircuit: true };
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
  if (ctx.parentURL?.startsWith("e971:")) return next(spec, { ...ctx, parentURL: import.meta.url });
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url === "e971:galeria") return { format: "module", source: dubleDaGaleria(), shortCircuit: true };
  if (url.endsWith(".tsx")) {
    const src = readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, ctx);
}
