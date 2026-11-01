/*
  Auditoria de erros e estados vazios — achado nº 9: Agenda, Recibos e Avaliações mostravam o estado vazio ("nada na
  agenda", "nenhum recibo", "nenhuma avaliação") quando a leitura do banco falhava. Agora as telas pedem com `exigir`: a
  falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo". O resumo de hoje na home, o bloco
  de recibos do celular e a exportação seguem sem `exigir`.
  Roda: node --test src/lib/data/lista-agenda-recibos-avaliacoes-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("agenda, recibos e avaliações lançam na falha do banco quando a tela pede com exigir", () => {
  const ag = ler("src/lib/data/agenda-servidor.ts");
  assert.match(ag, /export async function carregarAgendaDoDono\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(ag, /if \(erroProps && opcoes\.exigir\) throw new Error\(MSG_AGENDA_NAO_CARREGOU\);/);
  assert.match(ag, /if \(\(e1 \|\| e2 \|\| e3\) && opcoes\.exigir\) throw new Error\(MSG_AGENDA_NAO_CARREGOU\);/);
  const rec = ler("src/lib/data/recibos.ts");
  assert.match(rec, /export async function recibosDaPessoa\(papel: PapelRecibos, opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(rec, /if \(error && opcoes\.exigir\) throw new Error\(MSG_RECIBOS_NAO_CARREGARAM\);/);
  const av = ler("src/lib/data/avaliacoes-recebidas.ts");
  assert.match(av, /export async function avaliacoesRecebidas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(av, /if \(error && opcoes\.exigir\) throw new Error\(MSG_AVALIACOES_NAO_CARREGARAM\);/);
});

test("as telas pedem com exigir; home, bloco do celular e exportação não", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/agenda/page.tsx"), /await carregarAgendaDoDono\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/recibos/page.tsx"), /await recibosDaPessoa\("dono", \{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/avaliacoes/page.tsx"), /await avaliacoesRecebidas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/conta/avaliacoes/page.tsx"), /await avaliacoesRecebidas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/page.tsx"), /carregarAgendaDoDono\(\)\.catch\(\(\) => null\)/);
  for (const f of ["src/components/recibos/blocos-recibos.tsx", "src/app/api/recibos/[relatorio]/route.ts"]) assert.doesNotMatch(ler(f), /exigir: true/, f);
});
