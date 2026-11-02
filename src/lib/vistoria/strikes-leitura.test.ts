/*
  Leitura dos strikes que falha (deixado da rodada 17). Antes: strikesDoDono engolia o erro → lista vazia → o 2º/3º
  strike do dono era gravado como 1º e a escada (republicar só com laudo / tudo fora da busca) não pesava.
  Desenho (VISTORIA_ATIVA desligada em produção; o laudo é gravado antes do strike):
   - strikesDoDono e aplicarEscada lançam na falha (nunca "degrau 0" por engano);
   - emitirLaudo lê os strikes ANTES de registrar o laudo: falhou → nada gravado, "tente de novo";
   - ressalva vencida: lê antes de marcar; falhou → fica para amanhã; strike não gravado → a marca volta;
   - depois do strike gravado, nada faz quem chama achar que falhou (sem strike em dobro);
   - a escada que falha na leitura tenta de novo uma vez e não derruba a emissão/contestação (sem reaplicação diária
     para todos: o strike vale 12 meses e ela tiraria da busca quem já foi liberado por laudo aprovado);
   - o painel do dono mostra o aviso da falha em vez de esconder a escada.
  Roda: node --test src/lib/vistoria/strikes-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const srv = ler("src/lib/vistoria/laudo-servidor.ts");
const trecho = (de: string, ate: string) => srv.slice(srv.indexOf(de), srv.indexOf(ate, srv.indexOf(de)));

test("strikesDoDono e aplicarEscada lançam na falha da leitura", () => {
  const fn = trecho("export async function strikesDoDono", "/** Dados do");
  assert.match(fn, /const \{ data, error \} = await admin\.from\("proprietario_strikes"\)/);
  assert.match(fn, /if \(error\) throw new Error\(MSG_STRIKES_SEM_LEITURA\);/);
  const esc = trecho("export async function aplicarEscada", "async function aplicarEscadaComRetentativa");
  assert.match(esc, /if \(e1 \|\| e2\) throw new Error\(MSG_STRIKES_SEM_LEITURA\);/);
});

test("emitirLaudo lê os strikes antes de registrar o laudo; falhou → nada gravado", () => {
  const fn = trecho("export async function emitirLaudo", "async function laudoDoPedido");
  const leitura = fn.indexOf("strikesAntes = await strikesDoDono(admin, p.owner_id)");
  assert.ok(leitura > 0);
  assert.ok(leitura < fn.indexOf("registrarDocumento("), "a leitura vem antes do registro do laudo");
  assert.match(fn, /catch \{\s*return \{ ok: false, erro: MSG_STRIKES_SEM_LEITURA \};/);
  assert.match(fn, /registrarStrike\(admin, strikesAntes, p\.owner_id/);
  // registrarStrike não lê de novo: usa os strikes lidos antes.
  const reg = trecho("async function registrarStrike", "// ── Emissão");
  assert.doesNotMatch(reg, /strikesDoDono\(/);
  assert.match(reg, /if \(error\) throw new Error\("Não foi possível gravar o strike\."\);/);
  assert.match(reg, /try \{[\s\S]*aplicarEscadaComRetentativa[\s\S]*\} catch/);
});

test("ressalva vencida: lê antes de marcar; strike não gravado → a marca volta para amanhã", () => {
  const fn = trecho("export async function rotinaLaudos", "// 3.");
  assert.ok(fn.indexOf("strikesDoDono(admin, l.owner_id).catch(() => null)") < fn.indexOf("ressalva_vencida_em: quando"));
  assert.match(fn, /if \(!strikesAntes\) continue;/);
  assert.match(fn, /if \(!gravou\) \{[\s\S]*update\(\{ ressalva_vencida_em: null \}\)/);
});

test("escada: tenta de novo uma vez; ninguém além do invólucro chama aplicarEscada direto; sem reaplicação diária", () => {
  const inv = trecho("async function aplicarEscadaComRetentativa", "/**\n * Grava o strike");
  assert.equal(inv.match(/await aplicarEscada\(admin, ownerId, agora\)/g)?.length, 2);
  assert.equal(srv.match(/await aplicarEscada\(/g)?.length, 2);
  assert.doesNotMatch(trecho("// 4. Strikes apagados", "// 5."), /aplicarEscada/);
});

test("painel do dono: falha da leitura mostra aviso, nunca 'sem strike'", () => {
  const t = ler("src/components/vistoria/laudo-dono.tsx");
  assert.match(t, /strikesDoDono\(admin, ownerId\)\.catch\(\(\) => null\)/);
  assert.match(t, /data-testid="laudo-degrau-falhou"/);
  assert.match(t, /&& degrau === 0 && !strikesFalhou\) return null;/);
});
