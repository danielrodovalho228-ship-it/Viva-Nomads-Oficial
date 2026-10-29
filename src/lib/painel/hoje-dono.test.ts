/*
  E190 (parte 2) — "Hoje" no Início do dono: quem entra e quem sai hoje, da mesma fonte da Agenda.
  Roda: node --test src/lib/painel/hoje-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartoesDeHoje } from "./hoje-dono.ts";
import type { ItemAgenda } from "../agenda.ts";

const HOJE = "2026-10-29";
const item = (extra: Partial<ItemAgenda> & Pick<ItemAgenda, "id" | "tipo" | "quando">): ItemAgenda => ({
  propertyId: "p1",
  imovel: "Studio Centro",
  pessoa: { nome: "Ana", fotoUrl: "https://x/ana.webp" },
  href: "/x",
  ...extra,
});

test("só entradas e saídas de HOJE; visitas, bloqueios e outros dias ficam de fora", () => {
  const c = cartoesDeHoje(
    [
      item({ id: "entrada-c1", tipo: "entrada", quando: HOJE }),
      item({ id: "saida-c2", tipo: "saida", quando: HOJE, propertyId: "p2", imovel: "Loft Praça" }),
      item({ id: "entrada-c3", tipo: "entrada", quando: "2026-10-30" }),
      item({ id: "saida-c4", tipo: "saida", quando: "2026-10-28" }),
      item({ id: "v1", tipo: "visita", quando: `${HOJE}T13:00:00.000Z` }),
      item({ id: "bloqueio-b1", tipo: "bloqueio", quando: HOJE, ate: HOJE }),
    ],
    HOJE
  );
  assert.deepEqual(
    c.map((x) => [x.tipo, x.contratoId, x.rotulo]),
    [
      ["entrada", "c1", "Entra hoje"],
      ["saida", "c2", "Sai hoje"],
    ]
  );
});

test("o cartão leva à estadia do contrato e traz foto e nome do morador", () => {
  const [c] = cartoesDeHoje([item({ id: "entrada-abc", tipo: "entrada", quando: HOJE })], HOJE);
  assert.equal(c.href, "/dashboard/estadia/abc");
  assert.equal(c.nome, "Ana");
  assert.equal(c.fotoUrl, "https://x/ana.webp");
  assert.equal(c.imovel, "Studio Centro");
});

test("sem nome (antes do aceite), 'Morador' e sem foto — o avatar cai nas iniciais", () => {
  const [c] = cartoesDeHoje([item({ id: "saida-x", tipo: "saida", quando: HOJE, pessoa: null })], HOJE);
  assert.equal(c.nome, "Morador");
  assert.equal(c.fotoUrl, null);
});

test("horário do imóvel: 'a partir das' na entrada, 'até as' na saída; sem horário válido, null", () => {
  const horarios = { p1: { entrada: "14:00", saida: "11:00" }, p2: { entrada: "", saida: "meio-dia" } };
  const c = cartoesDeHoje(
    [
      item({ id: "entrada-a", tipo: "entrada", quando: HOJE }),
      item({ id: "saida-b", tipo: "saida", quando: HOJE }),
      item({ id: "entrada-c", tipo: "entrada", quando: HOJE, propertyId: "p2", imovel: "Z" }),
      item({ id: "saida-d", tipo: "saida", quando: HOJE, propertyId: "p2", imovel: "Z" }),
      item({ id: "entrada-e", tipo: "entrada", quando: HOJE, propertyId: "p9", imovel: "ZZ" }),
    ],
    HOJE,
    horarios
  );
  assert.deepEqual(
    c.map((x) => x.horario),
    ["a partir das 14:00", null, null, "até as 11:00", null]
  );
});

test("ordem: primeiro quem entra, depois quem sai; dentro de cada um, pelo imóvel", () => {
  const c = cartoesDeHoje(
    [
      item({ id: "saida-1", tipo: "saida", quando: HOJE, imovel: "Beta" }),
      item({ id: "entrada-2", tipo: "entrada", quando: HOJE, imovel: "Zeta" }),
      item({ id: "saida-3", tipo: "saida", quando: HOJE, imovel: "Alfa" }),
      item({ id: "entrada-4", tipo: "entrada", quando: HOJE, imovel: "Ágata" }),
    ],
    HOJE
  );
  assert.deepEqual(
    c.map((x) => x.id),
    ["entrada-4", "entrada-2", "saida-3", "saida-1"]
  );
});

test("nada hoje → lista vazia, e o Início só mostra a seção quando há cartão", () => {
  assert.deepEqual(cartoesDeHoje([], HOJE), []);
  assert.deepEqual(cartoesDeHoje([item({ id: "entrada-z", tipo: "entrada", quando: "2026-11-01" })], HOJE), []);
  const tela = readFileSync(new URL("../../components/painel/inicio-dono.tsx", import.meta.url), "utf8");
  assert.match(tela, /hoje\.length > 0 && <HojeNoInicio/);
});

test("vocabulário: 'Entra hoje' / 'Sai hoje', nunca check-in/check-out", () => {
  const fontes = [
    readFileSync(new URL("./hoje-dono.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../../components/painel/inicio-dono.tsx", import.meta.url), "utf8"),
  ];
  const c = cartoesDeHoje([item({ id: "entrada-a", tipo: "entrada", quando: HOJE }), item({ id: "saida-b", tipo: "saida", quando: HOJE })], HOJE, { p1: { entrada: "14:00", saida: "11:00" } });
  for (const x of c) assert.doesNotMatch(`${x.rotulo} ${x.horario}`, /check-?in|check-?out|hóspede|reserva/i);
  // Nos textos visíveis (entre aspas) dos dois arquivos, nada de check-in/check-out.
  for (const f of fontes) assert.doesNotMatch(f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").match(/"[^"]*"|`[^`]*`/g)?.join(" ") ?? "", /check-?in|check-?out/i);
});
