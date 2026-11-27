/*
  E544 — "Avaliar o morador" só dentro da janela permitida (contrato encerrado, até 14 dias depois do fim — a mesma
  regra do servidor, migração 0089). Antes disso, o cartão mostra o estado pendente com o prazo e NÃO oferece o botão
  (estadias futuras/agendadas e em andamento).
  Roda: node --test src/lib/e544-avaliacao-janela.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podeAvaliarLocacao } from "./contrato-assinar.ts";
import { partesDaAvaliacao, prazoAvaliacao, TEXTO_AVALIACAO_FECHADA } from "./avaliacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const agora = new Date("2026-11-05T12:00:00Z");

test("a janela: estadia futura ou ativa não avalia; encerrado há até 14 dias avalia; depois de 14 dias, não", () => {
  assert.equal(podeAvaliarLocacao("ativo", null, agora), false); // início em 10/11 ou 10/12: ainda nem começou
  assert.equal(podeAvaliarLocacao("aguardando_assinatura", null, agora), false);
  assert.equal(podeAvaliarLocacao("concluido", "2026-11-01T00:00:00Z", agora), true);
  assert.equal(podeAvaliarLocacao("concluido", "2026-10-01T00:00:00Z", agora), false);
});

test("o pendente com o prazo: o fim previsto do contrato dá o 'até dd/mm/aaaa'", () => {
  const prazo = prazoAvaliacao("2027-02-28");
  assert.equal(prazo, "14/03/2027");
  assert.equal(partesDaAvaliacao(false, prazo).linhas[0].estado, "Pendente, até 14/03/2027");
  assert.match(TEXTO_AVALIACAO_FECHADA, /14 dias/);
});

test("a tela: o formulário fechado não mostra o botão; o cartão do dono passa a janela e o fim", () => {
  const form = ler("components/avaliacao-form.tsx");
  const fechada = form.slice(form.indexOf("if (fechada) {"), form.indexOf("if (!aberto) {"));
  assert.match(fechada, /TEXTO_AVALIACAO_FECHADA/);
  assert.doesNotMatch(fechada, /abrirLabel|setAberto/);
  const cartao = ler("app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(cartao, /fechada=\{!demo && !contrato\.podeAvaliar\}/);
  assert.match(cartao, /encerradoEm=\{contrato\.fimParaAvaliacao\}/);
  const dados = ler("lib/data/contratos-actions.ts");
  const meus = dados.slice(dados.indexOf("export async function getMeusContratos"));
  assert.match(meus, /podeAvaliar: podeAvaliarLocacao\(String\(c\.status \?\? "ativo"\), \(c\.encerrado_em as string \| null\) \?\? null\)/);
  assert.match(meus, /fimParaAvaliacao: \(c\.encerrado_em as string \| null\) \?\? blocos\[blocos\.length - 1\]\?\.fim \?\? null/);
});
