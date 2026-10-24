/*
  CAMPOS-1 — regras da casa estruturadas: migração, formulário e exibição.
  Roda: node --test src/lib/anuncio/regras-casa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fumoParaSmokingAllowed, horaFalada, linhasRegrasCasa, normalizarRegrasCasa } from "./regras-casa.ts";
import { itensRegrasCasa, linhasBomSaber } from "./resumos-imovel.ts";
import type { Property } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const imovel = (o: Partial<Property>) => ({ description: "", ...o }) as Property;
const COMPLETA = { silencio: { inicio: "22:00", fim: "08:00" }, fumo: "area_externa", festas: "proibido", visitas: { permitidas: true, ate: "22:00", pernoite: false } };

test("normalizar: aceita o formato, descarta o torto, nada definido = null", () => {
  assert.deepEqual(normalizarRegrasCasa(COMPLETA), COMPLETA);
  assert.equal(normalizarRegrasCasa(null), null);
  assert.equal(normalizarRegrasCasa([]), null);
  assert.equal(normalizarRegrasCasa({}), null);
  assert.equal(normalizarRegrasCasa({ fumo: "às vezes", festas: 1 }), null, "valor fora da lista cai");
  assert.equal(normalizarRegrasCasa({ silencio: { inicio: "22:00" } }), null, "silêncio precisa das duas pontas");
  assert.equal(normalizarRegrasCasa({ silencio: { inicio: "25:00", fim: "08:00" } }), null, "hora inválida");
  assert.equal(normalizarRegrasCasa({ silencio: { inicio: "22:00", fim: "22:00" } }), null, "início = fim não é horário");
  assert.deepEqual(normalizarRegrasCasa({ visitas: { permitidas: false, ate: "22:00", pernoite: true } }), { visitas: { permitidas: false } }, "sem visita, sem horário nem pernoite");
  assert.deepEqual(normalizarRegrasCasa({ visitas: { permitidas: true, ate: "x" } }), { visitas: { permitidas: true } });
});

test("exibição em palavras simples, uma linha por regra definida", () => {
  assert.equal(horaFalada("22:00"), "22h");
  assert.equal(horaFalada("08:00"), "8h");
  assert.equal(horaFalada("22:30"), "22h30");
  assert.deepEqual(linhasRegrasCasa(normalizarRegrasCasa(COMPLETA)).map((l) => l.texto), [
    "Silêncio das 22h às 8h",
    "Não fuma dentro de casa · só na área externa",
    "Festas não são permitidas",
    "Visitas até às 22h · não podem pernoitar",
  ]);
  assert.deepEqual(linhasRegrasCasa({ fumo: "proibido" }).map((l) => l.texto), ["Não é permitido fumar no imóvel"]);
  assert.deepEqual(linhasRegrasCasa({ visitas: { permitidas: false } }).map((l) => l.texto), ["Visitas não são permitidas"]);
  assert.deepEqual(linhasRegrasCasa({ visitas: { permitidas: true, pernoite: true } }).map((l) => l.texto), ["Visitas são permitidas · podem pernoitar"]);
  assert.deepEqual(linhasRegrasCasa(undefined), []);
});

test("folha Regras da casa: fatos de sempre + regras definidas; nada de 'não informado'", () => {
  const antigo = imovel({ maxGuests: 3, petsAllowed: false });
  assert.deepEqual(itensRegrasCasa(antigo).map((i) => i.texto), ["Até 3 pessoas", "Sem pets"], "o print do Daniel continua igual sem regra nova");
  const novo = imovel({ maxGuests: 3, petsAllowed: false, regrasCasa: normalizarRegrasCasa(COMPLETA)! });
  const regras = linhasBomSaber(novo)[1];
  assert.deepEqual(regras.itens!.map((i) => i.chave), ["pessoas", "pets", "silencio", "fumo", "festas", "visitas"]);
  assert.equal(regras.resumo, "Até 3 pessoas · sem pets", "o resumo continua com os 2 primeiros fatos");
  assert.doesNotMatch(regras.detalhe.join(" "), /não informad|não definid/i);
  const soFestas = linhasBomSaber(imovel({ regrasCasa: { festas: "permitido" } }))[1];
  assert.deepEqual(soFestas.detalhe, ["Festas e eventos são permitidos"]);
});

test("fumo estruturado acerta o smoking_allowed antigo; sem fumo, não mexe", () => {
  assert.equal(fumoParaSmokingAllowed({ fumo: "permitido" }), true);
  assert.equal(fumoParaSmokingAllowed({ fumo: "area_externa" }), false);
  assert.equal(fumoParaSmokingAllowed({ fumo: "proibido" }), false);
  assert.equal(fumoParaSmokingAllowed({ festas: "proibido" }), undefined);
  assert.equal(fumoParaSmokingAllowed(null), undefined);
});

test("migração 0233: coluna jsonb objeto, leitura pública, aplicar idempotente e rollback", () => {
  const mig = ler("supabase/migrations/0233_regras_casa.sql");
  assert.match(mig, /add column if not exists regras_casa jsonb/);
  assert.match(mig, /jsonb_typeof\(regras_casa\) = 'object'/);
  assert.match(mig, /grant select \(regras_casa\) on public\.properties to anon, authenticated/);
  const apl = ler("supabase/producao/aplicar-0233.sql");
  assert.match(apl, /^-- [\s\S]*?\nbegin;/);
  assert.match(apl, /commit;\s*$/);
  assert.match(apl, /'20261023000233', '0233_regras_casa'/);
  assert.match(apl, /where not exists/);
  const rb = ler("supabase/producao/rollback/0233_rollback.sql");
  assert.match(rb, /drop column if exists regras_casa/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261023000233'/);
});

test("formulário e servidor: editor tem o grupo, servidor valida, página lê à parte", () => {
  const editor = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(editor, /<RegrasCasaCampos value=\{regrasCasa\}/);
  // E56 + tela 06: cada regra tem o seu toggle; só as ligadas vão.
  assert.match(editor, /regrasCasa: payloadDeRegrasCasa\(regrasCasa\)/);
  const campos = ler("src/components/anuncio/regras-casa-campos.tsx");
  for (const id of ["regras-casa-silencio-inicio", "regras-casa-silencio-fim", "regras-casa-${nome}", "regras-casa-visitas-ate"]) assert.ok(campos.includes(id), id);
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /normalizarRegrasCasa\(input\.regrasCasa\)/);
  assert.match(acoes, /\.update\(\{ regras_casa: regras/);
  const dados = ler("src/lib/data/properties.ts");
  assert.match(dados, /select\("regras_casa"\)/);
  const folha = ler("src/components/property/bom-saber.tsx");
  assert.match(folha, /ICONES_REGRA\[it\.chave\]/);
});
