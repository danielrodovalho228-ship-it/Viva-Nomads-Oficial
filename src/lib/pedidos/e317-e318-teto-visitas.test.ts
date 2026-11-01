/*
  E317 (opção b do Muse, 01/11): a tolerância de 10% do casamento fica, e o morador é avisado — "R$ 200 acima do seu
  teto" na resposta acima do teto e a tolerância declarada no formulário. A faixa "quase" (10–20%) não vira resposta.
  E318: a visita cancelada diz quando foi pedida ("Pedida em …"), para diferenciar pedidos parecidos.
  Roda: node --test src/lib/pedidos/e317-e318-teto-visitas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_TOLERANCIA_TETO, TOLERANCIA_TETO_PCT, textoAcimaDoTeto, valorAcimaDoTeto } from "./campos.ts";
import { avaliarImovel, type ImovelDaCidade, type RascunhoPedido } from "./contador.ts";
import { totalMesDaLinha } from "../precos.ts";
import { textoPedidaEm } from "../visitas-video.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

// O caso real do QA (inquilino1, 31/10): "[TESTE QA] Apto mobiliado 2 quartos", valor mensal R$ 3.200, condomínio 0,
// consumo fixo R$ 200 → R$ 3.400/mês; teto do pedido R$ 3.200.
const anuncioReal = { monthly_price: 3200, condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 200 };

test("E317: total por mês da resposta (o mesmo do banco) × teto → R$ 200 acima", () => {
  const total = totalMesDaLinha(anuncioReal);
  assert.equal(total, 3400, "valor mensal + condomínio + consumo fixo");
  assert.equal(valorAcimaDoTeto(total, 3200), 200);
  assert.equal(textoAcimaDoTeto(total, 3200), "R$ 200 acima do seu teto");
});

test("E317: dentro do teto, sem teto ou com valor inválido não há aviso", () => {
  assert.equal(textoAcimaDoTeto(3200, 3200), null, "igual ao teto não é acima");
  assert.equal(textoAcimaDoTeto(3000, 3200), null);
  assert.equal(textoAcimaDoTeto(3400, 0), null, "pedido sem teto");
  assert.equal(textoAcimaDoTeto(Number.NaN, 3200), null);
  assert.equal(valorAcimaDoTeto(3200.4, 3200), 0, "centavos não viram aviso");
  assert.equal(textoAcimaDoTeto(4520, 4100), "R$ 420 acima do seu teto");
  assert.equal(textoAcimaDoTeto(13600, 12000), "R$ 1.600 acima do seu teto", "milhar com ponto");
});

test("E317: a tolerância de 10% segue no casamento — dentro dela combina (com aviso); acima dela, não", () => {
  const pedido: RascunhoPedido = { dataInicio: "2026-12-15", prazoMeses: 2, ocupantes: 1, orcamento: 3200, pets: false, criancas: false };
  const imovel = (total: number): ImovelDaCidade => ({
    total, minDias: 30, maxDias: 180, maxHospedes: 2, aceitaPets: false, aceitaCriancas: false, faixasAceitas: [],
    disponivelDesde: null, disponivelAte: null, ocupadoNoPeriodo: false,
  });
  // R$ 3.400 = 6,25% acima: combina e leva o aviso.
  assert.equal(avaliarImovel(pedido, imovel(3400)).ok.orcamento, true);
  assert.ok(textoAcimaDoTeto(3400, 3200));
  // R$ 3.520 = exatamente 10%: ainda combina. R$ 3.600 (12,5%, faixa "quase"): não vira resposta.
  assert.equal(avaliarImovel(pedido, imovel(3520)).ok.orcamento, true);
  assert.equal(avaliarImovel(pedido, imovel(3600)).ok.orcamento, false);
  assert.equal(TOLERANCIA_TETO_PCT, 10);
  // A regra oficial do banco não mudou: compatível até 1,10; "quase" entre 1,10 e 1,20.
  const sql = ler("supabase/migrations/0184_pedido_moradia_completo.sql");
  assert.match(sql, /\(im\.total <= ped\.orcamento_mensal \* 1\.10\) as r4/);
  assert.match(sql, /\(par\.total > par\.orc \* 1\.10 and par\.total <= par\.orc \* 1\.20\) as q4/);
});

test("E317: o formulário declara a tolerância; a resposta mostra o aviso com o total por mês e o teto do pedido", () => {
  assert.equal(TEXTO_TOLERANCIA_TETO, "Você também recebe imóveis até 10% acima desse valor, marcados como acima do teto.");
  const form = ler("src/app/(public)/pedidos/novo/page.tsx");
  assert.match(form, /data-testid="pedido-tolerancia-teto"/);
  assert.match(form, /\{TEXTO_TOLERANCIA_TETO\}/);
  const tela = ler("src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx");
  assert.match(tela, /textoAcimaDoTeto\(totalMesDaLinha\(r\.properties\), p\.orcamento_mensal\)/);
  assert.match(tela, /data-testid="resposta-acima-teto"/);
});

test("E318: só a visita cancelada diz quando foi pedida, no horário de Brasília", () => {
  // O caso real: dois pedidos do inquilino1 para sex. 30/10 às 17:00, pedidos às 13:25 e às 14:08 (Brasília).
  assert.equal(textoPedidaEm({ status: "cancelado", criadoEm: "2026-10-30T16:25:55Z" }), "Pedida em sex., 30/10 às 13:25 (horário de Brasília)");
  assert.equal(textoPedidaEm({ status: "cancelado", criadoEm: "2026-10-30T17:08:31Z" }), "Pedida em sex., 30/10 às 14:08 (horário de Brasília)");
  assert.equal(textoPedidaEm({ status: "confirmado", criadoEm: "2026-10-30T16:25:55Z" }), null);
  assert.equal(textoPedidaEm({ status: "pedido", criadoEm: "2026-10-30T16:25:55Z" }), null);
  assert.equal(textoPedidaEm({ status: "cancelado", criadoEm: null }), null);
  assert.equal(textoPedidaEm({ status: "cancelado" }), null);
});

test("E318: o cartão usa o status da tela e a data que a consulta já traz (criado_em)", () => {
  const cartao = ler("src/components/visitas/cartao-visita.tsx");
  assert.match(cartao, /criadoEm\?: string \| null;/);
  assert.match(cartao, /textoPedidaEm\(\{ status, criadoEm: v\.criadoEm \}\)/);
  assert.match(cartao, /data-testid="visita-pedida-em"/);
  assert.match(ler("src/lib/data/visitas-video-actions.ts"), /criadoEm: r\.criado_em,/);
});
