/*
  E477 (resíduo do #2845): a conta observadora da QA (qa_admin) só lê dado real. O #2845 guardou Atendimento e as emissões de
  documentos, mas listou estas ações como ainda sem guarda. Cada uma grava (ou manda aviso) e precisa recusar o observador ANTES
  da primeira escrita. (sugerirResposta e resumoDoChamado ficam de fora de propósito: o resumo roda sozinho ao abrir o chamado e
  recusar quebraria a leitura da conta observadora.)
  Roda: node --test src/lib/data/e477-residuo-observador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ALVOS: [string, string[]][] = [
  ["src/lib/data/agentes-actions.ts", ["postarRetornosDoMoacir", "deixarOrdem", "responderAceiteOrdem"]],
  ["src/lib/data/ofensas-admin-actions.ts", ["marcarOfensaRevisada"]],
  ["src/lib/data/ajuda-publicacao-actions.ts", ["mudarStatusAjudaPublicacao"]],
  ["src/lib/vistoria/actions.ts", ["adminSalvarPreco", "adminDecidirCredenciamento"]],
  ["src/lib/data/manutencao-actions.ts", ["reclassificarOrdem"]],
];
const ESCRITA = /\.(insert|update|upsert|delete)\(|notify\(|\.rpc\(/;

function corpo(src: string, fn: string): string {
  const i = src.search(new RegExp(`export async function ${fn}\\b`));
  assert.ok(i >= 0, `${fn} existe`);
  const fim = src.indexOf("\n}\n", i);
  return src.slice(i, fim);
}

for (const [arquivo, fns] of ALVOS) {
  for (const fn of fns) {
    test(`${fn}: recusa a conta observadora antes da primeira escrita`, () => {
      const src = ler(arquivo);
      assert.match(src, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/);
      const c = corpo(src, fn);
      const g = c.indexOf("recusaObservador(");
      assert.ok(g >= 0, "tem a guarda");
      const e = c.search(ESCRITA);
      assert.ok(e < 0 || g < e, "a guarda vem antes da primeira escrita");
    });
  }
}

test("reclassificarOrdem só pergunta pelo observador quando quem age é o admin (dono e morador seguem como antes)", () => {
  const c = corpo(ler("src/lib/data/manutencao-actions.ts"), "reclassificarOrdem");
  assert.match(c, /if \(souAdmin\) \{[\s\S]*?recusaObservador\(s\.uid\)/);
});

test("ficam de fora, por escrito, as duas ações de IA que rodam ao abrir o chamado", () => {
  const a = ler("src/lib/data/atendimento-actions.ts");
  assert.doesNotMatch(corpo(a, "resumoDoChamado"), /recusaObservador/);
});
