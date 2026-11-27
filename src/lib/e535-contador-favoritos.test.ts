/*
  E535 (família E497/E456/E181) — o contador "Favoritos" do painel oscilava entre cargas (0 numas, 1 noutras), enquanto
  a página de Favoritos mostrava sempre 1. Causa: o cartão escrevia o número ANTES de os dados chegarem — a lista da
  conta (mesclarGuardadosDoConvidado, assíncrona no login/aparelho novo) e os imóveis de /api/properties (sem cache na
  1ª carga). Até lá, `favoritos.length` = 0 e o cartão dizia "0"; a página de Favoritos esperava (esqueleto).
  Correção: um sinal único "pronto" (imóveis carregados, sessão conferida e, logado, a lista da conta já chegou nesta
  aba). Antes disso o cartão mostra "—" (a convenção dos contadores sem leitura) e o "Salve seus favoritos" não aparece.
  Roda: node --test src/lib/e535-contador-favoritos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { favoritosProntos } from "./favoritos-prontos.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("favoritosProntos: só com imóveis carregados, sessão conferida e, logado, a lista da conta já sincronizada", () => {
  const base = { loading: false, authChecked: true, userId: "u1", sincronizado: "u1" };
  assert.equal(favoritosProntos(base), true);
  assert.equal(favoritosProntos({ ...base, loading: true }), false, "imóveis ainda carregando");
  assert.equal(favoritosProntos({ ...base, authChecked: false }), false, "sessão ainda não conferida");
  assert.equal(favoritosProntos({ ...base, sincronizado: null }), false, "lista da conta ainda não chegou");
  assert.equal(favoritosProntos({ ...base, sincronizado: "outra" }), false, "lista de outra conta");
  assert.equal(favoritosProntos({ ...base, userId: null, sincronizado: null }), true, "convidado: a lista do aparelho basta");
});

test("o cartão do painel não escreve número antes de pronto; o 'Salve seus favoritos' espera o mesmo sinal", () => {
  const home = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.match(home, /const \{ favoritos, pronto: favoritosProntos \} = useFavoritos\(\);/);
  assert.match(home, /label="Favoritos" value=\{demo \? "3" : valorContador\(favoritosProntos \? favoritos\.length : null\)\}/);
  assert.match(home, /\{\(demo \? false : favoritosProntos && favoritos\.length === 0\) && \(/);
});

test("o store marca a conta sincronizada (não persiste) e o carregamento da conta sempre marca, mesmo se falhar", () => {
  const store = ler("lib/favorites-store.ts");
  assert.match(store, /sincronizado: string \| null;/);
  assert.match(store, /partialize: \(s\) => \(\{ owner: s\.owner, ids: s\.ids, pendente: s\.pendente \}\)/);
  assert.match(store, /concluirMescla: \(userId, ids\) =>[\s\S]*?sincronizado: userId/);
  const mesclar = ler("lib/convidado/mesclar.ts");
  assert.match(mesclar, /useFavoritesStore\.getState\(\)\.marcarSincronizado\(userId\)/);
  const hook = ler("lib/use-favoritos.ts");
  assert.match(hook, /pronto: favoritosProntos\(\{ loading, authChecked, userId, sincronizado \}\)/);
});
