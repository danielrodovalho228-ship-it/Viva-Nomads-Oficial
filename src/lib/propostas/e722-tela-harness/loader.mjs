// Harness de teste (Pista 3, lote 2 — E1/E7 e valores por papel): renderiza o .tsx REAL da proposta
// (proposta-detalhe.tsx) no node --test com renderToStaticMarkup, trocando só as bordas — ações do servidor, roteador,
// link, ícones e componentes de UI de terceiros — por dublês. As regras (preços, totais, textos do pré-aceite) entram de
// verdade. Também carrega os módulos de servidor do aceite e do contrato com Supabase falso. Só os testes o registram.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";
import ts from "typescript";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const H = `import { createElement as h, Fragment } from "react";\n`;
const PASSA = (nomes) => H + nomes.map((n) => `export const ${n} = ({ children, title, href, ...p }) => h("div", { "data-c": "${n}", "data-title": title, "data-href": href, "data-testid": p["data-testid"] }, title ? h("h2", null, title) : null, children);`).join("\n");
const STUBS = {
  "server-only": `export {};`,
  "next/link": H + `export default ({ href, children, ...p }) => h("a", { href, "data-testid": p["data-testid"] }, children);`,
  "next/navigation": `export function useRouter() { return { push() {}, refresh() {}, replace() {} }; } export function useSearchParams() { return new URLSearchParams(); } export function usePathname() { return "/"; }`,
  "lucide-react": `const nada = () => null; export default new Proxy({}, { get: () => nada }); ${["ArrowRight", "Check", "Clock", "Download", "Loader2", "Repeat", "X", "Info", "ChevronDown", "ChevronUp", "Calendar", "Minus", "Plus", "PawPrint", "Linkedin", "BadgeCheck", "ShieldCheck", "Building2", "Briefcase"].map((n) => `export const ${n} = nada;`).join(" ")}`,
  "@/lib/data/propostas-actions": `export async function reabrirPreAceitacao() { return { ok: true }; } export async function responderProposta() { return { ok: true }; }`,
  "@/components/dashboard/primitives": PASSA(["Panel", "PageTitle"]),
  "@/components/ui/button": H + `export const Button = ({ children, ...p }) => h("button", { "data-testid": p["data-testid"] }, children); export const ButtonLink = ({ children, href, ...p }) => h("a", { href, "data-testid": p["data-testid"] }, children);`,
  "@/components/ui/campo-data": `export const CampoData = () => null;`,
  "@/components/ui/campo-reais": `export const CampoReais = () => null;`,
  "@/components/propostas/status-chip": H + `export const StatusChip = ({ status }) => h("span", { "data-testid": "status-chip" }, status);`,
  "@/components/confianca/selo-linkedin": `export const SeloLinkedin = () => null;`,
  "@/components/confianca/selo-vinculo": `export const SeloVinculo = () => null;`,
  "@/components/pets/ficha-pet-candidatura": `export const FichaPetCandidatura = () => null;`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e722-tela:" + spec, shortCircuit: true };
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
  // Os dublês importam "react": resolve a partir deste arquivo.
  if (ctx.parentURL?.startsWith("e722-tela:")) return next(spec, { ...ctx, parentURL: import.meta.url });
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("e722-tela:")) return { format: "module", source: STUBS[url.slice("e722-tela:".length)], shortCircuit: true };
  if (url.endsWith(".tsx")) {
    const src = readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, ctx);
}
