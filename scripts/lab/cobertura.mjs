/*
  Mapa de cobertura do laboratório (ordem 2567f1af, parte A).
  Varre src/app (páginas e rotas de API) e os arquivos "use server" (Server Actions) e monta a lista de tudo
  o que o site expõe, com a persona que deve acessar e o spec E2E que menciona o caminho (null = lacuna).
  - node scripts/lab/cobertura.mjs --gravar   regrava tests/e2e/cobertura.json (preserva persona/spec editados à mão)
  - o teste scripts/lab/cobertura.test.mjs FALHA se surgir (ou sumir) página/rota/action sem entrada no mapa.
*/
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();
const MAPA = join(RAIZ, "tests/e2e/cobertura.json");

function arquivos(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else acc.push(p);
  }
  return acc;
}
const rel = (p) => relative(RAIZ, p).split("\\").join("/");

/** Caminho público de uma página/rota: remove grupos "(x)" e o arquivo final. */
export function caminhoDe(arquivo, nome) {
  const seg = rel(arquivo).replace(/^src\/app\//, "").replace(new RegExp(`/?${nome}\\.tsx?$`), "").split("/").filter((s) => s && !/^\(.*\)$/.test(s));
  return "/" + seg.join("/");
}

export function personaDe(caminho, tipo) {
  if (caminho.startsWith("/admin") || caminho.startsWith("/dev") || tipo === "action-admin") return ["admin"];
  if (caminho.startsWith("/socios") || caminho.startsWith("/acesso-socios")) return ["sócio"];
  if (caminho.startsWith("/dashboard")) return ["inquilino", "proprietário", "parceiro"];
  if (caminho.startsWith("/qualificar")) return ["inquilino"];
  return ["público"];
}

export function descobrir() {
  const todos = arquivos(join(RAIZ, "src"));
  const itens = [];
  for (const f of todos) {
    const base = f.split("/").pop();
    if (f.includes("/src/app/") && base === "page.tsx") itens.push({ tipo: "pagina", id: caminhoDe(f, "page"), arquivo: rel(f) });
    if (f.includes("/src/app/") && base === "route.ts") itens.push({ tipo: "api", id: "/api" + caminhoDe(f, "route").replace(/^\/api/, ""), arquivo: rel(f) });
  }
  for (const f of todos) {
    if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
    const src = readFileSync(f, "utf8");
    if (!/^\s*["']use server["'];?\s*$/m.test(src.split("\n").slice(0, 8).join("\n"))) continue;
    for (const m of src.matchAll(/^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async)/gm)) {
      itens.push({ tipo: "action", id: `${rel(f)}#${m[1] ?? m[2]}`, arquivo: rel(f) });
    }
  }
  return itens.sort((a, b) => (a.tipo + a.id).localeCompare(b.tipo + b.id));
}

function specs() {
  return arquivos(join(RAIZ, "tests/e2e/specs")).filter((f) => f.endsWith(".spec.ts")).map((f) => ({ nome: f.split("/").pop(), texto: readFileSync(f, "utf8") }));
}

export function specDe(item, lista) {
  const chave = item.tipo === "action" ? item.id.split("#")[1] : item.id.replace(/\/\[[^\]]+\]/g, "");
  if (chave === "/" || chave.length < 2) return lista.find((s) => /goto\((["'`])\/\1/.test(s.texto))?.nome ?? null;
  const achado = lista.filter((s) => s.texto.includes(chave));
  return achado.length ? achado.map((s) => s.nome).sort().slice(0, 3).join(", ") : null;
}

export function montar(anterior = []) {
  const antes = new Map(anterior.map((e) => [`${e.tipo}|${e.id}`, e]));
  const lista = specs();
  return descobrir().map((i) => {
    const velho = antes.get(`${i.tipo}|${i.id}`);
    return {
      tipo: i.tipo,
      id: i.id,
      arquivo: i.arquivo,
      personas: velho?.personas ?? personaDe(i.id, i.tipo),
      spec: velho?.spec !== undefined && velho.spec !== null ? velho.spec : specDe(i, lista),
    };
  });
}

export function percentual(mapa) {
  const por = {};
  for (const e of mapa) {
    const p = (por[e.tipo] ??= { total: 0, cobertos: 0 });
    p.total++;
    if (e.spec) p.cobertos++;
  }
  const total = mapa.length, cobertos = mapa.filter((e) => e.spec).length;
  return { total, cobertos, percentual: total ? Math.round((cobertos / total) * 1000) / 10 : 0, por_tipo: por };
}

export function lerMapa() {
  return existsSync(MAPA) ? JSON.parse(readFileSync(MAPA, "utf8")) : { itens: [] };
}

if (process.argv[1]?.endsWith("cobertura.mjs")) {
  const itens = montar(lerMapa().itens);
  const saida = { gerado_por: "scripts/lab/cobertura.mjs", resumo: percentual(itens), itens };
  if (process.argv.includes("--gravar")) writeFileSync(MAPA, JSON.stringify(saida, null, 2) + "\n");
  console.log(JSON.stringify(saida.resumo));
}
