/*
  E202 — e-mails de proposta e contrato com os dados da negociação (imóvel, valores, datas, desfecho, próximo passo).
  Roda: node --test src/lib/notifications/dados-negociacao.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aberturaAssinatura,
  aberturaContratoPronto,
  aberturaProposta,
  dataHoraBR,
  imovelPorExtenso,
  linhasContrato,
  linhasProposta,
  proximoPassoAssinatura,
  proximoPassoProposta,
} from "./dados-negociacao.ts";
import { catalogoEmails } from "./catalogo-emails.ts";

const IM = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
const visivel = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

test("imóvel por extenso: título + bairro, cidade; sem bairro/cidade, só o título", () => {
  assert.equal(imovelPorExtenso(IM), "Apto Santa Mônica · Santa Mônica, Uberlândia");
  assert.equal(imovelPorExtenso({ titulo: "Studio", cidade: "Uberlândia" }), "Studio · Uberlândia");
  assert.equal(imovelPorExtenso({ titulo: "  " }), "Imóvel");
});

test("proposta nova: imóvel, período com entrada/saída e meses, valor mensal, total com a conta aberta, prazo e número", () => {
  const l = linhasProposta({ numero: "ORC-2026-0001", imovel: IM, entrada: "2026-11-01", saida: "2027-02-28", meses: 4, valorMensal: 2700, contaTotal: "4 × R$ 2.700 + preparação R$ 450 = R$ 11.250", responderAte: "2026-10-30T18:00:00Z" });
  assert.deepEqual(
    l.map((x) => [x.rotulo, x.valor]),
    [
      ["Imóvel", "Apto Santa Mônica · Santa Mônica, Uberlândia"],
      ["Período", "01/11/2026 a 28/02/2027 (4 meses)"],
      ["Valor mensal", "R$ 2.700"],
      ["Total do contrato", "4 × R$ 2.700 + preparação R$ 450 = R$ 11.250"],
      ["Responder até", "30/10/2026 às 15:00"],
      ["Proposta", "ORC-2026-0001"],
    ],
  );
  // Respondida: sem prazo de resposta.
  assert.ok(!linhasProposta({ numero: "X", imovel: IM, entrada: "2026-11-01", saida: "2026-11-30", meses: 1, valorMensal: 1, contaTotal: "R$ 1", responderAte: null }).some((x) => x.rotulo === "Responder até"));
  assert.equal(dataHoraBR("lixo"), "");
});

test("proposta respondida: o DESFECHO está no corpo, com o próximo passo de cada um", () => {
  assert.match(aberturaProposta("aceita", { nome: "Ana", imovel: IM }), /^Olá Ana, a proposta para Apto Santa Mônica foi aceita\.$/);
  assert.match(aberturaProposta("recusada", { imovel: IM, motivo: "Datas não servem" }), /foi recusada\. Motivo: Datas não servem\./);
  assert.match(aberturaProposta("contraproposta", { imovel: IM, novoValorMensal: 2500 }), /contraproposta para Apto Santa Mônica: o valor mensal agora é R\$ 2\.500/);
  assert.match(proximoPassoProposta("aceita", "owner"), /gere o contrato no Fechamento/);
  assert.match(proximoPassoProposta("aceita", "tenant"), /recebe um e-mail para assinar/);
  assert.match(proximoPassoProposta("recusada", "tenant"), /buscar outros imóveis/);
  assert.match(proximoPassoProposta("recusada", "owner"), /nova proposta/);
  assert.match(proximoPassoProposta("contraproposta", "owner"), /aceite, faça uma contraproposta ou recuse/);
});

test("contrato pronto e assinaturas: imóvel, período início–fim, mensal e total, e o próximo passo (Caução e 1º pagamento)", () => {
  const l = linhasContrato({ imovel: IM, inicio: "2026-11-01", fim: "2027-02-28", meses: 4, valorMensal: 2700 });
  assert.deepEqual(l.map((x) => x.rotulo), ["Imóvel", "Período", "Valor mensal", "Total do contrato"]);
  assert.equal(l[3].valor, "4 × R$ 2.700 = R$ 10.800");
  assert.match(aberturaContratoPronto({ imovel: IM }), /contrato de Apto Santa Mônica está pronto para você assinar/);
  assert.match(aberturaAssinatura({ imovel: IM, asDuas: false, quemAssinou: "tenant" }), /o morador assinou o contrato de Apto Santa Mônica\. Falta a sua assinatura\./);
  assert.match(aberturaAssinatura({ imovel: IM, asDuas: true, quemAssinou: "owner" }), /assinado pelas duas partes/);
  assert.match(proximoPassoAssinatura(true, "tenant"), /Caução e o 1º pagamento direto ao proprietário[\s\S]*página da sua estadia/);
  assert.match(proximoPassoAssinatura(true, "owner"), /registre o recebimento no contrato, em Contratos/);
  assert.match(proximoPassoAssinatura(false, "owner"), /assine pela plataforma/);
});

test("catálogo: os e-mails de proposta e contrato saem com imóvel, valores e próximo passo (nada de 'Há uma atualização')", () => {
  const por = new Map(catalogoEmails("https://vivanomads.com.br").map((e) => [e.chave, visivel(e.html)]));
  for (const k of ["proposta:recebida", "proposta:contraproposta", "proposta:aceita", "proposta:recusada", "contrato:pronto", "contrato:falta-voce", "contrato:assinado"]) {
    const t = por.get(k) ?? "";
    assert.match(t, /Apto Santa Mônica · Santa Mônica, Uberlândia/, k);
    assert.match(t, /R\$ 2\.700/, k);
    assert.match(t, /Próximo passo:/, k);
    assert.doesNotMatch(t, /Há uma atualização no seu contrato/, k);
  }
  assert.match(por.get("proposta:recebida")!, /Responder até 30\/10\/2026/);
  assert.match(por.get("proposta:recusada")!, /foi recusada\. Motivo/);
});

test("GUARDA: os chamadores passam os dados (proposta: 4 desfechos; contrato pronto; assinaturas)", () => {
  const prop = ler("src/lib/data/propostas-actions.ts");
  for (const d of ["nova", "contraproposta", "aceita", "recusada"]) assert.match(prop, new RegExp(`desfecho: "${d}"`), d);
  assert.match(prop, /select\("title, address, city"\)/);
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /aberturaContratoPronto\(\{ nome, imovel: imovelEmail \}\)/);
  assert.match(acoes, /linhasContrato\(\{ imovel: imovelEmail, inicio: periodo\.inicio, fim: periodo\.fim/);
  const ass = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.match(ass, /properties\(title, address, city, owner_id/);
  assert.match(ass, /\.\.\.corpo\(outroId\)/);
  assert.match(ass, /proximoPassoAssinatura\(outraJaAssinou, papelDe\(para\)\)/);
});

test("E210: o período traz as datas reais; sem datas, nunca 'Período: a ' vazio", async () => {
  const { textoPeriodo, linhasContrato } = await import("./dados-negociacao.ts");
  assert.equal(textoPeriodo("2026-11-01", "2026-12-30", 2), "01/11/2026 a 30/12/2026 (2 meses)");
  assert.equal(textoPeriodo(null, null, 2), "2 meses");
  assert.equal(textoPeriodo("", "2026-12-30", 2), "2 meses");
  const l = linhasContrato({ imovel: { titulo: "Apto", bairro: null, cidade: null }, inicio: "", fim: "", meses: 2, valorMensal: 3200 });
  const periodo = l.find((x) => x.rotulo === "Período")!.valor;
  assert.doesNotMatch(periodo, /^ ?a |(^|\s)a $/);
  assert.equal(periodo, "2 meses");
});
