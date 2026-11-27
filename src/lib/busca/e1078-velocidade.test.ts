/*
  E1078 (ORDEM-DUET-382 opção (a), ORDEM-415/416): o filtro de internet da /buscar passa a ser de VELOCIDADE.
   - mesmas faixas (50/100/300, CHIPS_INTERNET) e mesmas chaves de URL (?internet=N, ?medida=1);
   - vale a velocidade MEDIDA quando há medição válida; sem medição, a INFORMADA pelo dono (marcada "não medida");
     medição válida abaixo do valor não volta pela porta do informado (a medição vale mais);
   - "Só com internet medida" continua o interruptor estrito (só medição válida);
   - quem não tem nem medida nem informada fica fora e entra na linha "Velocidade desconhecida: N imóveis".
  Roda: node --test src/lib/busca/e1078-velocidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHIPS_INTERNET,
  filtroInternetDaUrl,
  filtroInternetNaUrl,
  informadaNaoMedida,
  passaInternet,
  rotuloFiltroInternet,
  textoVelocidadeDesconhecida,
  velocidadeDesconhecida,
  velocidadeDoImovel,
} from "./filtro-internet.ts";
import { velocidadesDaBusca } from "./facetas.ts";

const AGORA = new Date("2026-11-22T12:00:00Z");
const VALIDO = "2027-01-01T00:00:00Z";
const VENCIDO = "2026-01-01T00:00:00Z";
// Os quatro anúncios da nota técnica: medido 120, informado 120, informado 40 e sem dado.
const MEDIDO_120 = { internetMedida: { downloadMbps: 120, validoAte: VALIDO } };
const INFORMADO_120 = { internetMbps: 120 };
const INFORMADO_40 = { internetMbps: 40 };
const SEM_DADO = {};
const MEDIDO_80_INFORMADO_500 = { internetMbps: 500, internetMedida: { downloadMbps: 80, validoAte: VALIDO } };
const VENCIDO_INFORMADO_200 = { internetMbps: 200, internetMedida: { downloadMbps: 20, validoAte: VENCIDO } };

test("E1078: faixas e chaves de URL não mudam", () => {
  assert.deepEqual([...CHIPS_INTERNET], [50, 100, 300]);
  const sp = new URLSearchParams();
  filtroInternetNaUrl(sp, { internetMin: 100, soInternetMedida: true });
  assert.equal(sp.toString(), "internet=100&medida=1");
  assert.deepEqual(filtroInternetDaUrl(sp), { internetMin: 100, soInternetMedida: true });
});

test("E1078: a velocidade do imóvel — a medida quando há medição válida; sem ela, a informada (não medida); senão, nada", () => {
  assert.deepEqual(velocidadeDoImovel(MEDIDO_120, AGORA), { mbps: 120, medida: true });
  assert.deepEqual(velocidadeDoImovel(INFORMADO_120, AGORA), { mbps: 120, medida: false });
  assert.deepEqual(velocidadeDoImovel(MEDIDO_80_INFORMADO_500, AGORA), { mbps: 80, medida: true }, "a medição vale mais que o informado");
  assert.deepEqual(velocidadeDoImovel(VENCIDO_INFORMADO_200, AGORA), { mbps: 200, medida: false }, "medição vencida: vale o informado");
  assert.equal(velocidadeDoImovel(SEM_DADO, AGORA), null);
});

test("E1078: 100+ Mbps — passa o medido 120 e o informado 120; saem o informado 40, o sem dado e o medido 80 (mesmo informado 500)", () => {
  const f = { internetMin: 100, soInternetMedida: false };
  assert.equal(passaInternet(MEDIDO_120, f, AGORA), true);
  assert.equal(passaInternet(INFORMADO_120, f, AGORA), true, "asserção alterada: sem medição, a informada passa");
  assert.equal(passaInternet(INFORMADO_40, f, AGORA), false);
  assert.equal(passaInternet(SEM_DADO, f, AGORA), false);
  assert.equal(passaInternet(MEDIDO_80_INFORMADO_500, f, AGORA), false, "medição abaixo não volta pelo informado");
  // O informado que passa não vai para a linha "não medida" (já está na lista, com o rótulo no cartão).
  assert.equal(informadaNaoMedida(INFORMADO_120, f, AGORA), false);
});

test("E1078: 'Só com internet medida' continua estrito — só medição válida; o informado vai para a linha 'não medida'", () => {
  const estrito = { internetMin: 100, soInternetMedida: true };
  assert.equal(passaInternet(MEDIDO_120, estrito, AGORA), true);
  assert.equal(passaInternet(INFORMADO_120, estrito, AGORA), false);
  assert.equal(informadaNaoMedida(INFORMADO_120, estrito, AGORA), true);
  assert.equal(passaInternet(INFORMADO_120, { internetMin: 0, soInternetMedida: true }, AGORA), false);
});

test("E1078: desligado não tira ninguém; os desconhecidos — sem medida e sem informada — entram na linha 'Velocidade desconhecida'", () => {
  const off = { internetMin: 0, soInternetMedida: false };
  for (const p of [MEDIDO_120, INFORMADO_120, INFORMADO_40, SEM_DADO]) assert.equal(passaInternet(p, off, AGORA), true);
  assert.equal(velocidadeDesconhecida(SEM_DADO, off, AGORA), false, "filtro desligado: não há linha");
  const f = { internetMin: 50, soInternetMedida: false };
  assert.equal(velocidadeDesconhecida(SEM_DADO, f, AGORA), true);
  assert.equal(velocidadeDesconhecida(INFORMADO_40, f, AGORA), false, "tem velocidade (abaixo): não é desconhecida");
  assert.equal(textoVelocidadeDesconhecida(1), "Velocidade desconhecida: 1 imóvel");
  assert.equal(textoVelocidadeDesconhecida(3), "Velocidade desconhecida: 3 imóveis");
});

test("E1078: rótulo do filtro e a base da seção (medida ou informada)", () => {
  assert.equal(rotuloFiltroInternet({ internetMin: 100, soInternetMedida: false }), "Velocidade 100+ Mbps");
  assert.equal(rotuloFiltroInternet({ internetMin: 100, soInternetMedida: true }), "Internet medida 100+ Mbps");
  assert.equal(rotuloFiltroInternet({ internetMin: 0, soInternetMedida: true }), "Internet medida");
  assert.deepEqual(velocidadesDaBusca([MEDIDO_120, INFORMADO_40, SEM_DADO], AGORA), [120, 40]);
});

test("E1078: a folha e a lista usam a velocidade (grupo 'Velocidade a partir de', linha dos desconhecidos)", () => {
  const folha = readFileSync("src/components/busca/painel-filtros-celular.tsx", "utf8");
  assert.match(folha, /<Grupo titulo="Velocidade a partir de" testId="painel-internet">/);
  const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  assert.match(busca, /velocidadesDaBusca\(baseVisivel\)/);
  assert.match(busca, /data-testid="velocidade-desconhecida"[^>]*>\s*\{textoVelocidadeDesconhecida\(desconhecidos\)\}/);
});
