/*
  E793 Onda 0 — guardas estáticos. Roda: node --test src/lib/auth/e793-onda0-guardas.test.ts
  (a) H1: nenhum setUser / useAuthStore.setState / setActiveMode fora de useEffect ou de handler nos componentes da casca e do guarda
      (o store do zustand é compartilhado entre requisições no servidor: escrever nele durante o render vaza sessão);
  (b) a sessão do servidor importa "server-only";
  (c) o layout do painel não redireciona a partir da sessão (A2) — nem ele, nem o que ele importa para ler a sessão.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ESCRITAS = /\b(?:setUser|setActiveMode|setPapel|useAuthStore\.setState)\(/g;

/** Para cada escrita no store, sobe pelos blocos que a envolvem até achar um useEffect/handler (ok) ou um componente (erro). */
function escritasNoRender(fonte: string): string[] {
  const erros: string[] = [];
  for (const m of fonte.matchAll(ESCRITAS)) {
    let profundidade = 0;
    let ok = false;
    for (let i = m.index! - 1; i >= 0; i--) {
      const c = fonte[i];
      if (c === "}") profundidade++;
      else if (c === "{") {
        if (profundidade > 0) {
          profundidade--;
          continue;
        }
        const antes = fonte.slice(Math.max(0, i - 160), i);
        const ultimaLinha = antes.slice(antes.lastIndexOf("\n") + 1);
        if (/useEffect\(\s*(?:async\s*)?\(\)\s*=>\s*$/.test(antes) || /useEffect\(/.test(ultimaLinha)) { ok = true; break; }
        // Componente (função com inicial maiúscula): a escrita está no render.
        if (/function [A-Z]\w*\([^)]*\)[^{]*$/.test(ultimaLinha) || /const [A-Z]\w* = \([^)]*\)\s*=>\s*$/.test(ultimaLinha)) break;
        // Handler/função interna (inicial minúscula), callback de promessa ou de evento: fora do render.
        if (/(?:function [a-z]\w*\s*\(|const [a-z]\w*\s*=\s*(?:async\s*)?\(|\.then\(|\.catch\(|setTimeout\(|on[A-Z]\w*=\{|=>\s*$)/.test(ultimaLinha)) { ok = true; break; }
      }
    }
    if (!ok) erros.push(fonte.slice(Math.max(0, m.index! - 60), m.index! + 40).replace(/\s+/g, " "));
  }
  return erros;
}

const CASCA_E_GUARDA = [
  "src/components/layout/auth-guard.tsx",
  "src/components/layout/dashboard-shell.tsx",
  "src/components/layout/mode-initializer.tsx",
  "src/components/papel/sincronizar-papel.tsx",
  "src/components/auth/sessao-servidor-contexto.tsx",
];

test("(a) nenhuma escrita no store durante o render na casca e no guarda", () => {
  for (const f of CASCA_E_GUARDA) assert.deepEqual(escritasNoRender(readFileSync(f, "utf8")), [], f);
});

test("(a) o detector pega uma escrita no render (controle)", () => {
  const ruim = `export function Casca({ u }) {\n  useAuthStore.getState().setUser(u);\n  return null;\n}`;
  assert.equal(escritasNoRender(ruim).length, 1);
  const bom = `export function Casca({ u }) {\n  useEffect(() => {\n    useAuthStore.getState().setUser(u);\n  }, [u]);\n  return null;\n}`;
  assert.equal(escritasNoRender(bom).length, 0);
});

test("(b) a sessão do servidor é server-only e usa getClaims (A3)", () => {
  const s = readFileSync("src/lib/auth/sessao-servidor.ts", "utf8");
  assert.match(s, /^import "server-only";/m);
  assert.match(s, /auth\.getClaims\(\)/);
  assert.doesNotMatch(s, /useAuthStore/);
});

test("(c) o layout do painel nunca redireciona a partir da sessão (A2) e usa o limite da casca", () => {
  const layout = readFileSync("src/app/(dashboard)/layout.tsx", "utf8");
  const sessao = readFileSync("src/lib/auth/sessao-servidor.ts", "utf8");
  for (const [nome, fonte] of [["layout", layout], ["sessao-servidor", sessao]] as const) {
    assert.doesNotMatch(fonte, /\bredirect\(|from "next\/navigation"/, nome);
  }
  assert.match(layout, /comLimite\(usuarioDaSessaoServidor\(\), LIMITE_CASCA_MS\)\.catch\(\(\) => null\)/);
  // Chave off → nem lê a sessão: a árvore é a de hoje.
  assert.match(layout, /onda === "off" \? Promise\.resolve\(null\)/);
  assert.match(layout, /if \(!usuarioServidor\) return painel;/);
});
