/* Roda: node --test src/lib/notifications/e394-imovel-nos-emails.test.ts
  E394 (família E325): todo modelo transacional que cita o imóvel o identifica por TÍTULO + CÓDIGO (VN-…). Visita e confirmação já
  eram cobertas pelo E325; aqui, candidatura, proposta, estadia, pedido de parceiro, automações e demais, pelos formatadores
  centrais, e a ligação do id nos chamadores. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { imovelPorExtenso } from "./dados-negociacao.ts";
import { imovelDoPedido } from "../parceiros/email-pedido.ts";
import { imovelPorExtenso as imovelDaEstadia } from "../estadia/emails-chegada.ts";
import { linhasCandidatura } from "./dados-candidatura.ts";
import { codigoDoImovel } from "../imovel-pagina.ts";

const ID = "3f9a2c11-aaaa-bbbb-cccc-000000000001";
const COD = codigoDoImovel(ID);
const imovel = { id: ID, titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };

test("E394: os quatro formatadores centrais dizem título · lugar · código", () => {
  const esperado = `Apto Santa Mônica · Santa Mônica, Uberlândia · código ${COD}`;
  assert.equal(imovelPorExtenso(imovel), esperado);
  assert.equal(imovelDoPedido(imovel), esperado);
  assert.equal(imovelDaEstadia(imovel), esperado);
});

test("E394: sem id, nada muda (o e-mail sai como antes, sem código inventado)", () => {
  const sem = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
  assert.equal(imovelPorExtenso(sem), "Apto Santa Mônica · Santa Mônica, Uberlândia");
  assert.equal(imovelDoPedido(sem), "Apto Santa Mônica · Santa Mônica, Uberlândia");
  assert.equal(imovelDoPedido(null), "");
});

test("E394: o quadro da candidatura traz o imóvel com o código", () => {
  const l = linhasCandidatura({ imovel, interessado: "Ana", entrada: "2026-12-01", saida: "2027-01-15", valorMensal: 3000, totalMensal: 3400 });
  assert.equal(l[0].rotulo, "Imóvel");
  assert.ok(l[0].valor.includes(`código ${COD}`), l[0].valor);
});

test("E394: os chamadores passam o id do imóvel (candidatura, proposta, contrato pronto, pedidos, crons, internet, vistoria, prova)", () => {
  const ler = (p: string) => readFileSync(p, "utf8");
  const casos: [string, RegExp][] = [
    ["src/lib/data/candidatura-email.ts", /const imovel = \{ id: lead\.property_id as string,/],
    ["src/lib/data/propostas-actions.ts", /const imovel = \{ id: p\.property_id,/],
    ["src/lib/data/actions.ts", /const imovelEmail = \{ id: lead\.property_id as string,/],
    ["src/lib/data/pedidos-actions.ts", /corpoPedidoAceito\(\{ imovel: \{ id: imovelId,/],
    ["src/app/api/cron/automacoes/route.ts", /\{ id: c\.property_id as string, titulo: prop\.title/],
    ["src/app/api/cron/checkin-lembretes/route.ts", /\{ id: c\.property_id as string, titulo: prop\?\.title/],
    ["src/lib/parceiros/pedido-servidor.ts", /\{ id: d\.property_id, titulo: d\.properties\.title/],
    ["src/lib/internet-medida-servidor.ts", /imovel: \{ id: imovelId, titulo: pp\.title/],
    ["src/lib/vistoria/servidor.ts", /\{ id: propertyId, titulo: i\.title/],
    ["src/lib/data/prova-actions.ts", /\{ id: propertyId, titulo: im\.title/],
  ];
  for (const [arq, re] of casos) assert.match(ler(arq), re, arq);
});
