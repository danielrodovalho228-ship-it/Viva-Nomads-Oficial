/*
  E1106 (ORDEM-DUET-478/481): a conferência manual da equipa vira ESTADO PRÓPRIO da fonte única da identidade
  (estadoIdentidade, E748) — `conferida_equipe`, texto "Conferida pela equipe da Viva". A fonte lê o registo da
  conferência (hoje profiles.is_verified) como insumo; as telas deixam de o ler directamente.
  Precedência: laudo válido → `confirmada`; sem ele, com conferência da equipa → `conferida_equipe`; sem nenhum dos
  dois → os estados de hoje, sem mudar. Na página do imóvel, um selo só, de uma fonte só: o dono conferido pela equipa
  mantém o selo (agora pela fonte); a precedência interina do E1105 (o "Dono verificado" lido de is_verified) sai.
  Fora do selo, o estado novo comporta-se como o `em_breve` de hoje (nada que não bloqueava passa a bloquear).
  Roda: node --test src/lib/identidade/e1106-conferencia-da-equipe.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comoEmBreve, estadoIdentidadeDe, TEXTO_CONFERIDA_EQUIPE, TEXTO_EM_BREVE } from "./estado.ts";
import { seloDoDono, textoDoSeloDeIdentidade } from "../anuncio/dono-verificado.ts";
import { estadoIdentidadeParaTrava } from "../anuncio/travas-publicacao.ts";

const AGORA = new Date("2026-10-19T12:00:00Z");
const laudo = (valid_until: string) => ({
  caf_result: { identity: true, document: true, liveness: true, light: "green" },
  traffic_light: "green",
  valid_until,
  created_at: "2026-10-18T15:00:00Z",
});
const VALIDO = laudo("2027-10-18T15:00:00Z");
const VENCIDO = laudo("2026-10-10T15:00:00Z");
const real = { id: "11111111-1111-4111-8111-111111111111", owner: { verified: true } } as never;

test("E1106: o estado novo nasce do registo da conferência da equipa, com o texto exacto", () => {
  const e = estadoIdentidadeDe(null, false, AGORA, true);
  assert.equal(e.estado, "conferida_equipe");
  assert.equal(e.texto, "Conferida pela equipe da Viva");
  assert.equal(TEXTO_CONFERIDA_EQUIPE, "Conferida pela equipe da Viva");
  assert.equal(e.acao, null);
});

test("E1106: precedência — laudo válido > conferência da equipa > os estados de hoje, intactos", () => {
  assert.equal(estadoIdentidadeDe(VALIDO, false, AGORA, true).estado, "confirmada", "o laudo válido vence a conferência");
  assert.equal(estadoIdentidadeDe(VENCIDO, false, AGORA, true).estado, "conferida_equipe", "laudo vencido + conferência: a conferência");
  assert.equal(estadoIdentidadeDe(null, true, AGORA, true).estado, "conferida_equipe", "conta de teste conferida: a conferência");
  // Sem conferência: exactamente como hoje.
  assert.equal(estadoIdentidadeDe(null, false, AGORA).estado, "em_breve");
  assert.equal(estadoIdentidadeDe(null, false, AGORA).texto, TEXTO_EM_BREVE);
  assert.equal(estadoIdentidadeDe(null, false, AGORA, false).estado, "em_breve");
  assert.equal(estadoIdentidadeDe(VENCIDO, false, AGORA).estado, "vencida");
  assert.equal(estadoIdentidadeDe(null, true, AGORA).estado, "simulavel");
  assert.equal(estadoIdentidadeDe(VALIDO, false, AGORA).estado, "confirmada");
});

test("E1106: fora do selo, o estado novo segue o caminho do em_breve — nada que não bloqueava passa a bloquear", () => {
  assert.equal(comoEmBreve("conferida_equipe"), true);
  assert.equal(comoEmBreve("em_breve"), true);
  assert.equal(comoEmBreve("confirmada"), false);
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "conferida_equipe" }, temCpf: false }), "em_breve");
  for (const f of ["src/components/account/conta-blocos.tsx", "src/components/anuncio/etapa-identidade.tsx", "src/app/(dashboard)/dashboard/imoveis/novo/etapa-onde-fica.tsx", "src/app/(dashboard)/dashboard/verificacao/page.tsx", "src/lib/anuncio/travas-publicacao.ts"]) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /\.estado === "em_breve"/, `${f}: o em_breve da fonte passa por comoEmBreve (que inclui a conferência da equipa)`);
    assert.match(s, /comoEmBreve\(/, f);
  }
});

test("E1106: o servidor lê o registo da conferência (is_verified) como insumo da fonte — nas duas leituras", () => {
  const srv = readFileSync("src/lib/identidade/estado-servidor.ts", "utf8");
  assert.match(srv, /select\("is_teste, is_verified"\)/);
  assert.match(srv, /select\("id, is_teste, is_verified"\)/);
  assert.match(srv, /perfil\?\.is_verified === true\)/);
  assert.match(srv, /conferida\.get\(id\) === true\)/);
});

test("E1106: na página do imóvel, um selo só pela fonte — o dono conferido pela equipa mantém o selo; nada lê is_verified", () => {
  const conferida = estadoIdentidadeDe(null, false, AGORA, true);
  assert.equal(textoDoSeloDeIdentidade(conferida), "Conferida pela equipe da Viva");
  assert.deepEqual(seloDoDono(real, textoDoSeloDeIdentidade(conferida)), { tipo: "identidade", texto: "Conferida pela equipe da Viva" }, "não perde o selo");
  const confirmada = estadoIdentidadeDe(VALIDO, false, AGORA, true);
  assert.deepEqual(seloDoDono(real, textoDoSeloDeIdentidade(confirmada)), { tipo: "identidade", texto: confirmada.texto });
  // is_verified sozinho (sem passar pela fonte) já não dá selo nenhum.
  assert.equal(seloDoDono(real, null), null);
  assert.equal(textoDoSeloDeIdentidade(estadoIdentidadeDe(null, false, AGORA)), null, "em_breve: sem selo");
  assert.equal(textoDoSeloDeIdentidade(estadoIdentidadeDe(VENCIDO, false, AGORA)), null, "vencida: sem selo");
  const cartao = readFileSync("src/components/property/owner-card.tsx", "utf8");
  assert.doesNotMatch(cartao, /SeloDonoVerificado|donoVerificado|\.verified\b|is_verified/, "a página do imóvel não lê is_verified");
  const regra = readFileSync("src/lib/anuncio/dono-verificado.ts", "utf8");
  assert.doesNotMatch(regra.slice(regra.indexOf("export function seloDoDono")), /verified/, "a regra do selo não lê is_verified");
  const perfil = readFileSync("src/lib/data/perfil-proprietario.ts", "utf8");
  assert.match(perfil, /identidadeConfirmada: textoDoSeloDeIdentidade\(await estadoIdentidade\(admin, donoId\)\.catch\(\(\) => null\)\)/);
});
