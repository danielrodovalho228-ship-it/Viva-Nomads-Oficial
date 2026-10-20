import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Prompt 31a: o formulário de interesse (parceiros_interesse, 0104) saiu. Os interesses viraram pedidos de parceria
  pendentes (0190) e o "Seja parceiro" grava em parceiro_solicitacoes (servidor, conta com e-mail confirmado).
*/
const lei = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("migração 0104 continua no histórico; 0190 copia os interesses para pedidos pendentes (origem site)", () => {
  const mig = lei("supabase/migrations/0104_parceiros_interesse.sql");
  assert.match(mig, /with check \(aceite_contato and status = 'novo'\)/);
  const m190 = lei("supabase/migrations/0190_parceiros_ciclo.sql");
  assert.match(m190, /insert into public\.parceiro_solicitacoes \(interesse_id,[\s\S]*'pendente', 'site', i\.criado_em\s+from public\.parceiros_interesse i/);
  assert.match(m190, /not exists \(select 1 from public\.parceiro_solicitacoes s where s\.interesse_id = i\.id\)/);
});

test("página /parceiros: Seja parceiro, regras claras, sem dangerouslySetInnerHTML nem palavras proibidas", () => {
  const tela = lei("src/app/(public)/parceiros/page.tsx") + lei("src/components/parceiros/seja-parceiro-form.tsx");
  assert.doesNotMatch(tela, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(tela, /apartamentos?|comiss[ãa]o|corretagem|intermedia[çc][ãa]o|vistoria|aluguel/i);
  assert.match(tela, /<RegrasParceiros pagamentoAtivo=\{PAGAMENTO_PARCEIROS_ATIVO\}/);
  assert.match(tela, /<SejaParceiroForm /);
  assert.doesNotMatch(tela, /todo o Brasil/i);
});

test("pedido de parceria: armadilha, limite por IP e por conta, e-mail confirmado", () => {
  const acao = lei("src/lib/parceiros/solicitacao-actions.ts");
  assert.match(acao, /if \(String\(entrada\?\.armadilha \?\? ""\)\.trim\(\)\) return \{ ok: true/);
  assert.match(acao, /consumirLimite\(`parceria:ip:\$\{ip\}`, 5, HORA\)/);
  assert.match(acao, /consumirLimite\(`parceria:uid:\$\{s\.user\.id\}`, 5, HORA\)/);
  assert.match(acao, /email_confirmed_at/);
});
