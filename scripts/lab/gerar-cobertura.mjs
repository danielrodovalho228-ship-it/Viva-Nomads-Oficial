// Gera o rascunho de tests/e2e/cobertura.json (mapa de cobertura do laboratório).
// Uso: node scripts/lab/gerar-cobertura.mjs  — preserva persona/specs já curados no JSON.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.cwd();
const SAIDA = join(RAIZ, "tests/e2e/cobertura.json");

function varrer(dir, filtro, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, filtro, acc);
    else if (filtro(p)) acc.push(p);
  }
  return acc;
}
const posix = (p) => p.split(sep).join("/");

export function listarPaginas() {
  return varrer(join(RAIZ, "src/app"), (p) => p.endsWith(`${sep}page.tsx`))
    .map((p) => "/" + posix(relative(join(RAIZ, "src/app"), p)).replace(/\/?page\.tsx$/, ""))
    .map((r) => r.replace(/\/\([^)]+\)/g, "").replace(/^\/$/, "/") || "/")
    .sort();
}
export function listarRotas() {
  return varrer(join(RAIZ, "src/app"), (p) => p.endsWith(`${sep}route.ts`))
    .map((p) => "/" + posix(relative(join(RAIZ, "src/app"), p)).replace(/\/?route\.ts$/, ""))
    .map((r) => r.replace(/\/\([^)]+\)/g, ""))
    .sort();
}
export function listarActions() {
  const out = [];
  for (const p of varrer(join(RAIZ, "src"), (p) => /\.tsx?$/.test(p) && !/\.test\./.test(p))) {
    const txt = readFileSync(p, "utf8");
    // diretiva de verdade: primeira instrução do arquivo (ignora comentários)
    const semComentario = txt.replace(/^(\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*))*/g, "").trimStart();
    if (!/^["']use server["']/.test(semComentario)) continue;
    const arq = posix(relative(RAIZ, p));
    for (const m of txt.matchAll(/^export\s+async\s+function\s+(\w+)/gm)) out.push(`${arq}#${m[1]}`);
    for (const m of txt.matchAll(/^export\s+const\s+(\w+)\s*=\s*async/gm)) out.push(`${arq}#${m[1]}`);
  }
  return out.sort();
}

function personaPagina(r) {
  if (r.startsWith("/admin")) return ["admin"];
  if (r.startsWith("/dashboard/imoveis") || r.startsWith("/dashboard/leads") || r.startsWith("/dashboard/locacoes") || r.startsWith("/dashboard/assinatura") || r.startsWith("/dashboard/roi") || r.startsWith("/dashboard/viabilidade")) return ["proprietario"];
  if (r.startsWith("/dashboard/favoritos") || r.startsWith("/dashboard/buscas") || r.startsWith("/dashboard/candidaturas") || r.startsWith("/dashboard/comparar") || r.startsWith("/dashboard/fechamento") || r.startsWith("/dashboard/garantias")) return ["inquilino"];
  if (r.startsWith("/dashboard") || r.startsWith("/qualificar") || r.startsWith("/pedidos") && r !== "/pedidos/novo") return ["inquilino", "proprietario", "admin"];
  if (["/acesso-socios", "/decisao", "/modelodenegocio", "/roi", "/simulacao", "/socios", "/tributario"].includes(r)) return ["socio"];
  if (r.startsWith("/dev")) return ["socio"];
  return ["publico"];
}
function personaRota(r) {
  if (r.startsWith("/api/admin") || r.startsWith("/api/test-")) return ["admin"];
  if (r.startsWith("/api/cron") || r.startsWith("/api/webhooks")) return ["sistema"];
  if (["/api/health", "/api/evento", "/api/parceiros-interesse", "/api/empresas", "/api/well-known/android", "/api/well-known/apple", "/llms.txt", "/llms-full.txt", "/api/auth/email-existe", "/api/atendimento/email", "/api/atendimento/avaliar", "/api/viva/chat"].includes(r) || r.startsWith("/api/calendario") || r.startsWith("/api/app/") || r.startsWith("/auth/") || r.startsWith("/api/places")) return ["publico"];
  return ["inquilino", "proprietario", "admin"];
}
function personaAction(a) {
  if (/admin|agentes/.test(a)) return ["admin"];
  if (/acesso-socios/.test(a)) return ["socio"];
  if (/fotografos/.test(a)) return ["proprietario", "parceiro"];
  if (/contratos|reservas|leads|planos|blocks|imoveis|documentos-actions/.test(a)) return ["proprietario", "inquilino"];
  return ["inquilino", "proprietario"];
}

const specs = readdirSync(join(RAIZ, "tests/e2e/specs")).filter((f) => f.endsWith(".spec.ts"));
const textoSpecs = Object.fromEntries(specs.map((f) => [f, readFileSync(join(RAIZ, "tests/e2e/specs", f), "utf8")]));
function specsQueCobrem(chave) {
  const lit = chave.replace(/\[[^\]]+\]/g, "").replace(/\/$/, "") || "/";
  if (lit === "/") return [];
  const nome = chave.includes("#") ? chave.split("#")[1] : lit;
  return specs.filter((f) => textoSpecs[f].includes(nome)).map((f) => f.replace(".spec.ts", ""));
}

const antigo = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, "utf8")) : { paginas: {}, rotas: {}, actions: {} };
function montar(chaves, personas, grupo) {
  const o = {};
  for (const c of chaves) {
    const ant = antigo[grupo]?.[c];
    o[c] = ant ?? { personas: personas(c), specs: specsQueCobrem(c) };
  }
  return o;
}
const mapa = {
  _doc: "Mapa de cobertura do laboratório. Toda página (src/app/**/page.tsx), rota (route.ts) e Server Action ('use server') precisa de uma entrada; o teste src/lib/lab/cobertura.test.ts falha se surgir uma sem entrada. 'specs' vazio = ainda sem spec (lacuna conhecida, contada no % de cobertura). Atualize rodando: node scripts/lab/gerar-cobertura.mjs",
  paginas: montar(listarPaginas(), personaPagina, "paginas"),
  rotas: montar(listarRotas(), personaRota, "rotas"),
  actions: montar(listarActions(), personaAction, "actions"),
};
if (process.argv[1]?.endsWith("gerar-cobertura.mjs")) {
  writeFileSync(SAIDA, JSON.stringify(mapa, null, 2) + "\n");
  const conta = (g) => { const v = Object.values(g); return `${v.filter((e) => e.specs.length).length}/${v.length}`; };
  console.log("páginas", conta(mapa.paginas), "rotas", conta(mapa.rotas), "actions", conta(mapa.actions));
}

/** Chaves reais sem entrada no mapa (faltando) e entradas do mapa sem item real (sobrando). */
export function diferencas(reais, mapaGrupo) {
  const set = new Set(reais);
  return {
    faltando: reais.filter((c) => !(c in mapaGrupo)),
    sobrando: Object.keys(mapaGrupo).filter((c) => !set.has(c)),
  };
}
/** % de itens com ao menos um spec. */
export function percentual(mapa) {
  const todos = [...Object.values(mapa.paginas), ...Object.values(mapa.rotas), ...Object.values(mapa.actions)];
  return Math.round((todos.filter((e) => e.specs.length > 0).length / todos.length) * 1000) / 10;
}
