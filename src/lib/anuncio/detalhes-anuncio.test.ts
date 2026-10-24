/*
  CAMPOS-2 — detalhes opcionais do anúncio (incluído no preço, áreas do condomínio, andar/elevador, janela de
  entrada/saída, vaga), cada grupo no padrão E56, e a Convivência do CAMPOS-1 no mesmo padrão.
  Roda: node --test src/lib/anuncio/detalhes-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { grupoPreenchido, linhasDetalhes, normalizarDetalhes } from "./detalhes-anuncio.ts";
import { desligarGrupo, estadosDetalhes, formDeDetalhes, grupoTemDados, payloadDeDetalhes } from "./detalhes-form.ts";
import { itensRegrasCasa } from "./resumos-imovel.ts";
import type { Property } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const COMPLETO = {
  incluidoNoPreco: ["internet", "agua"],
  areasCondominio: ["piscina", "academia"],
  andar: { andar: 3, elevador: true },
  janela: { entradaDe: "14:00", entradaAte: "20:00", saidaAte: "11:00" },
  vaga: { coberta: true, tipo: "fixa", observacao: "cabe carro médio" },
};

test("normalizar: aceita o formato, ordena pela lista, descarta o torto; nada definido = null", () => {
  const n = normalizarDetalhes(COMPLETO)!;
  assert.deepEqual(n.incluidoNoPreco, ["agua", "internet"], "na ordem da lista");
  assert.deepEqual(n.andar, { andar: 3, elevador: true });
  assert.equal(normalizarDetalhes({}), null);
  assert.equal(normalizarDetalhes([]), null);
  assert.equal(normalizarDetalhes({ incluidoNoPreco: ["ouro"], andar: { andar: -1 }, vaga: {} }), null);
  assert.equal(normalizarDetalhes({ andar: { andar: "0" } })?.andar?.andar, 0, "térreo vale");
  assert.equal(normalizarDetalhes({ andar: { andar: 3.5 } }), null);
  assert.deepEqual(normalizarDetalhes({ janela: { entradaDe: "20:00", entradaAte: "14:00" } })?.janela, { entradaDe: "20:00" }, "janela invertida: fica o início");
  assert.equal(normalizarDetalhes({ vaga: { observacao: "x".repeat(300) } })?.vaga?.observacao?.length, 120);
});

test("exibição: uma linha por grupo definido, em palavras simples", () => {
  assert.deepEqual(linhasDetalhes(COMPLETO as never).map((l) => l.texto), [
    "Água e internet",
    "Piscina e academia",
    "3º andar · com elevador",
    "Entrada das 14h às 20h · saída até às 11h",
    "Vaga coberta e fixa · cabe carro médio",
  ]);
  assert.equal(linhasDetalhes({ andar: { andar: 0, elevador: false } })[0].texto, "Térreo · sem elevador");
  assert.equal(linhasDetalhes({ janela: { saidaAte: "10:30" } })[0].texto, "Saída até às 10h30");
  assert.deepEqual(linhasDetalhes(null), []);
});

test("janela ligada substitui os horários antigos na folha Regras da casa", () => {
  const base = { description: "", checkinAfter: "15:00", checkoutBefore: "11:00" } as Property;
  assert.deepEqual(itensRegrasCasa(base).map((i) => i.chave), ["entrada", "saida"]);
  const comJanela = { ...base, detalhesAnuncio: { janela: { entradaDe: "14:00", entradaAte: "20:00" } } } as Property;
  assert.deepEqual(itensRegrasCasa(comJanela).map((i) => i.texto), ["Entrada das 14h às 20h"]);
});

test("E56 no formulário: sem salvo nasce tudo fechado; grupo salvo nasce aberto; desligado não vai ao servidor", () => {
  const vazio = formDeDetalhes(null);
  assert.deepEqual(Object.values(vazio.ligados), [false, false, false, false, false]);
  const salvo = formDeDetalhes({ andar: { andar: 3, elevador: true } });
  assert.equal(salvo.ligados.andar, true);
  assert.equal(salvo.ligados.vaga, false);
  assert.equal(salvo.andar, "3");
  // Preencheu a vaga mas deixou o grupo desligado: não vai.
  const f = { ...salvo, vagaTipo: "fixa" as const };
  assert.deepEqual(normalizarDetalhes(payloadDeDetalhes(f)), { andar: { andar: 3, elevador: true } });
  // Desligar confirmado limpa o grupo e o tira do envio.
  assert.equal(grupoTemDados(salvo, "andar"), true);
  const off = desligarGrupo(salvo, "andar");
  assert.equal(off.ligados.andar, false);
  assert.equal(off.andar, "");
  assert.equal(normalizarDetalhes(payloadDeDetalhes(off)), null);
});

test("medidor: estados dos 5 blocos (ligado e preenchido; ligado vazio falta; desligado não se aplica)", () => {
  const f = formDeDetalhes({ andar: { andar: 2 } });
  const ligadoVazio = { ...f, ligados: { ...f.ligados, vaga: true } };
  const e = estadosDetalhes(ligadoVazio);
  assert.deepEqual(e.find((x) => x.chave === "andar"), { chave: "andar", ligado: true, preenchido: true });
  assert.deepEqual(e.find((x) => x.chave === "vaga"), { chave: "vaga", ligado: true, preenchido: false });
  assert.deepEqual(e.find((x) => x.chave === "janela"), { chave: "janela", ligado: false, preenchido: false });
  assert.equal(grupoPreenchido({ andar: { andar: 2 } }, "andar"), true);
});

test("migração 0235: coluna jsonb objeto, leitura pública, aplicar idempotente e rollback", () => {
  const mig = ler("supabase/migrations/0235_detalhes_anuncio.sql");
  assert.match(mig, /add column if not exists detalhes_anuncio jsonb/);
  assert.match(mig, /jsonb_typeof\(detalhes_anuncio\) = 'object'/);
  assert.match(mig, /grant select \(detalhes_anuncio\) on public\.properties to anon, authenticated/);
  const apl = ler("supabase/producao/aplicar-0235.sql");
  assert.match(apl, /\nbegin;/);
  assert.match(apl, /commit;\s*$/);
  assert.match(apl, /'20261024000235', '0235_detalhes_anuncio'/);
  assert.match(apl, /where not exists/);
  const rb = ler("supabase/producao/rollback/0235_rollback.sql");
  assert.match(rb, /drop column if exists detalhes_anuncio/);
  assert.match(rb, /where version = '20261024000235'/);
});

test("editor e servidor: 5 grupos + Convivência no BlocoOpcional, medidor no topo, servidor valida e página lê", () => {
  const ed = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(ed, /<BlocoOpcional\s+id="convivencia"/);
  assert.match(ed, /nasceLigado\(!!property\.regrasCasa\)/);
  assert.match(ed, /regrasCasa: convivenciaLigada \? payloadDeRegrasCasa\(regrasCasa\) : \{\}/);
  assert.match(ed, /<DetalhesAnuncioCampos value=\{detalhes\}/);
  assert.match(ed, /data-testid="completude-opcionais"/);
  const campos = ler("src/components/anuncio/detalhes-anuncio-campos.tsx");
  assert.match(campos, /<BlocoOpcional/);
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /detalhes_anuncio: normalizarDetalhes\(input\.detalhesAnuncio\)/);
  assert.match(ler("src/lib/data/properties.ts"), /select\("detalhes_anuncio"\)/);
});
