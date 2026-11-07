// Harness de teste (E682): carrega o .tsx real do bloco do dono no node --test, trocando só as bordas (Supabase, chave,
// ações, UI de terceiros) por dublês. Não entra no app; só o teste o registra.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";
import ts from "typescript";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const H = `import { createElement as h } from "react";\n`;
const NOOP = (nomes) => nomes.map((n) => `export const ${n} = async () => ({ ok: true });`).join("\n");
const STUBS = {
  "next/link": H + `export default ({ href, children, ...p }) => h("a", { href }, children);`,
  "lucide-react": `export const CheckCircle2 = () => null; export const Circle = () => null;`,
  "@/lib/supabase/server": `export async function createClient() { return { auth: { getUser: async () => ({ data: { user: globalThis.__VN.user } }) } }; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__VN.admin; }`,
  "@/lib/vistoria/chave": `export async function vistoriaAtiva() { return globalThis.__VN.chave; }`,
  "@/lib/vistoria/servidor": `export async function sugeridosDoPedido() { globalThis.__VN.sugeridosChamado = true; return globalThis.__VN.sugeridos; }`,
  "@/lib/vistoria/actions": NOOP(["agendarVisita", "aceitarProposta", "avaliarConduta", "confirmarRecebido", "escolherAvaliador", "pedirAvaliacao", "recusarProposta", "registrarAusencia"]),
  "@/components/vistoria/form-acao": `export const FormAcao = ({ children }) => children;`,
  "@/components/vistoria/laudo-dono": `export const LaudoDono = () => null;`,
  "@/components/ui/campo-data": `export const CampoDataHoraFormulario = () => null;`,
  "@/components/dashboard/primitives": H + `export const Panel = ({ title, children }) => h("div", { "data-panel": title }, children);`,
  "@/components/ui/button": H + `export const Button = ({ children }) => h("button", null, children);`,
  "@/lib/fiscal/documento": `export const brl = (v) => "R$ " + Number(v).toFixed(2);`,
  "@/lib/flags": `export const PAGAMENTO_PARCEIROS_ATIVO = false; export const VISTORIA_ATIVA = false;`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "harness:" + spec, shortCircuit: true };
  if (spec.startsWith("@/")) {
    const base = pr(RAIZ, "src", spec.slice(2));
    for (const ext of ["", ".ts", ".tsx"]) if (existsSync(base + ext) && !/\/$/.test(base + ext) && (ext || /\.\w+$/.test(base))) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
  }
  // Os dublês (url "harness:...") importam "react": resolve a partir deste arquivo.
  if (ctx.parentURL?.startsWith("harness:")) return next(spec, { ...ctx, parentURL: import.meta.url });
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("harness:")) return { format: "module", source: STUBS[url.slice(8)], shortCircuit: true };
  if (url.endsWith(".tsx")) {
    const src = readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, ctx);
}
