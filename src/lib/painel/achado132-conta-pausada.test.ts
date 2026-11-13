/*
  Resíduo da varredura de páginas — achado 132 (baixo): o Início do painel lia se a conta está pausada sem conferir
  o erro. Na falha, a faixa "Sua conta está pausada · Reativar minha conta" sumia e o dono achava que a conta estava
  ativa (anúncios fora da busca sem saber). Agora a falha entra no aviso do topo ("Não foi possível ler agora: o estado
  da sua conta…"), como as outras leituras do Início (achado nº 24), e nunca "conta ativa" por engano.
  Roda: node --test src/lib/painel/achado132-conta-pausada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoInicioSemLeitura } from "./sem-leitura.ts";

const pg = readFileSync(new URL("../../app/(dashboard)/dashboard/inicio-dados.tsx", import.meta.url), "utf8");

test("o aviso do topo nomeia o estado da conta quando ele não foi lido", () => {
  assert.match(avisoInicioSemLeitura(["conta"])!, /^Não foi possível ler agora: o estado da sua conta \(pausada ou ativa\)\./);
  assert.match(avisoInicioSemLeitura(["propostas", "conta"])!, /ler agora: propostas e o estado da sua conta/);
});

test("Início: a leitura da conta pausada lança na falha e entra em semLeitura", () => {
  const fn = pg.slice(pg.indexOf("async function contaPausadaEm"), pg.indexOf("/**", pg.indexOf("async function contaPausadaEm")));
  assert.match(fn, /const \{ data, error \} = await supabase\.from\("profiles"\)\.select\("pausada_em"\)/);
  assert.match(fn, /if \(error\) throw new Error\(/);
  assert.match(pg, /ou\("conta", contaPausadaEm\(\), null\)/);
  // O aviso do topo é calculado depois das duas leituras (a da conta vem na 2ª rodada).
  assert.ok(pg.indexOf('ou("conta"') < pg.indexOf("avisoInicioSemLeitura(semLeitura)"));
});
