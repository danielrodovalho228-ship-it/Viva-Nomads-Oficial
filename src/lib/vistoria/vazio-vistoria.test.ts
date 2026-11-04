/*
  Estados vazios / falha de leitura na avaliação (prompt 62):
  1. pedirAvaliacao: falha ao ler os contratos ativos, a última avaliação ou o is_teste NÃO vira "imóvel vago",
     "primeira avaliação" ou "conta real". Antes, a visita a um imóvel OCUPADO era agendada sem a concordância do
     morador. Agora não abre o pedido e pede para tentar de novo.
  2. liberar: falha ao ler se ainda há OUTRO bloqueio aberto (ex.: segurança grave) não devolve o anúncio à busca.
     A conferência vem ANTES de qualquer escrita: com falha, nada muda e quem chama vê o erro.
  Roda: node --test src/lib/vistoria/vazio-vistoria.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("pedido de avaliação: contratos, última avaliação e is_teste com erro conferido antes de gravar o pedido", () => {
  const a = ler("./actions.ts");
  // O insert do pedido do DONO (o do laboratório, mais acima, é outro).
  const i = a.indexOf("owner_id: s.userId,\n      cidade:");
  assert.ok(i > 0);
  const antes = a.slice(0, i);
  assert.match(antes, /\{ data: contratos, error: erroContratos \}/);
  assert.match(antes, /\{ data: dono, error: erroDono \}/);
  assert.match(antes, /\{ data: ultimo, error: erroUltimo \}/);
  assert.match(antes, /if \(erroContratos \|\| erroDono \|\| erroUltimo\) return \{ ok: false, erro: MSG_VISTORIA_SEM_LEITURA \}/);
});

test("liberar: confere os OUTROS bloqueios abertos antes de escrever; com erro, lança e nada muda", () => {
  const l = ler("./laudo-servidor.ts");
  const ini = l.indexOf("export async function liberar(");
  const corpo = l.slice(ini, l.indexOf("\n}\n", ini));
  const leitura = corpo.indexOf("{ data: outros, error: erroOutros }");
  assert.ok(leitura > 0, "lê os outros bloqueios");
  assert.match(corpo, /\.not\("motivo", "in", `\(\$\{motivos\.join\(","\)\}\)`\)/);
  assert.match(corpo, /if \(erroOutros\) throw new Error\(/);
  assert.ok(leitura < corpo.indexOf(".update("), "a conferência vem antes de qualquer escrita");
  assert.match(corpo, /if \(pausou && !outros\?\.length\)/);
});
