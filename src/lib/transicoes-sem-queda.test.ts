/*
  Auditoria de erros e estados vazios — varredura depois dos achados nº 2 e nº 3: nenhuma tela chama uma ação do
  servidor dentro de uma transição (useTransition) sem tratamento. Sem conexão a ação REJEITA; sem try/semQuedaDeRede,
  o erro sobe ao limite de erro e a tela inteira cai ("Não conseguimos abrir esta tela"). Guarda para o repo todo:
  uma tela nova com o mesmo defeito quebra este teste.
  Roda: node --test src/lib/transicoes-sem-queda.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MSG_ACAO_FALHOU, MSG_SEM_CONEXAO, semQuedaDeRede } from "./erro-de-rede.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;

function arquivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p, ext) : ext.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

/** Módulos "use server" (as ações) e os nomes que exportam. */
const modulosDeAcao = new Set(
  arquivos(join(RAIZ, "src/lib"), /\.ts$/)
    .filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")))
    .map((f) => f.slice(join(RAIZ, "src/").length).replace(/\.ts$/, "")),
);

/** O corpo de cada `nome(async () => { … })`, contando chaves. */
function corpos(src: string, nome: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${nome}\\(async \\(\\) => \\{`, "g");
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let d = 1;
    let j = m.index + m[0].length;
    while (d && j < src.length) {
      if (src[j] === "{") d++;
      else if (src[j] === "}") d--;
      j++;
    }
    out.push(src.slice(m.index + m[0].length, j));
  }
  return out;
}

test("semQuedaDeRede: sem conexão a ação não rejeita — devolve { ok: false } com a frase em português", async () => {
  const caiu = await semQuedaDeRede(Promise.reject(new TypeError("Failed to fetch")));
  assert.deepEqual(caiu, { ok: false, erro: MSG_SEM_CONEXAO, error: MSG_SEM_CONEXAO });
  const safari = await semQuedaDeRede(Promise.reject(new TypeError("Load failed")), "Não foi possível salvar agora.");
  assert.equal(safari.ok, false);
  assert.equal((safari as { erro: string }).erro, MSG_SEM_CONEXAO);
  // Outro erro técnico: a frase padrão da tela (nunca o texto cru).
  const tecnico = await semQuedaDeRede(Promise.reject(new SyntaxError("Unexpected token")));
  assert.equal((tecnico as { erro: string }).erro, MSG_ACAO_FALHOU);
  // A resposta da ação passa como veio (sucesso e recusa do servidor).
  assert.deepEqual(await semQuedaDeRede(Promise.resolve({ ok: true as const, valor: 1 })), { ok: true, valor: 1 });
  assert.deepEqual(await semQuedaDeRede(Promise.resolve({ ok: false as const, erro: "Sem permissão." })), { ok: false, erro: "Sem permissão." });
});

test("nenhuma tela chama ação do servidor dentro de transição sem tratamento (o repo todo)", () => {
  const sem: string[] = [];
  for (const f of arquivos(join(RAIZ, "src"), /\.tsx$/)) {
    const src = readFileSync(f, "utf8");
    if (!/^\s*["']use client["']/.test(src)) continue;
    const acoes = new Set<string>();
    for (const m of src.matchAll(/import \{([^}]*)\} from "@\/(lib\/[^"]+)"/g)) {
      if (!modulosDeAcao.has(m[2])) continue;
      for (const n of m[1].split(",")) {
        const nome = n.trim().split(/\s+as\s+/).pop() ?? "";
        if (nome && !nome.startsWith("type ")) acoes.add(nome);
      }
    }
    if (!acoes.size) continue;
    const nomes = new Set(["startTransition", ...[...src.matchAll(/const \[\s*\w+\s*,\s*(\w+)\s*\]\s*=\s*useTransition\(/g)].map((m) => m[1])]);
    for (const n of nomes) {
      for (const corpo of corpos(src, n)) {
        if (/\btry\b|\.catch\(|\.then\([^)]*,/.test(corpo)) continue;
        for (const a of acoes) {
          // A chamada só pode aparecer embrulhada: semQuedaDeRede(acao(…)).
          const cruas = [...corpo.matchAll(new RegExp(`await ${a}\\(`, "g"))].length;
          if (cruas) sem.push(`${f.slice(RAIZ.length)} → ${a}`);
        }
      }
    }
  }
  assert.deepEqual(sem, [], "ação do servidor em transição sem try nem semQuedaDeRede");
});
