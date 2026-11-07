/**
 * E427 (reprova de 06/11 contra o #2897): quem tem o aceite continuava vendo "Daniel P." no cabeçalho. Causa provável (não
 * reproduzível sem sessão real): o servidor devolvia null para QUALQUER erro (sessão ainda não pronta, leitura que não
 * respondeu) e a tela ficava abreviada para sempre. Agora o servidor distingue "sem aceite" de FALHA, o hook tenta de novo
 * só na falha e refaz o pedido quando a sessão do navegador muda. Anônimo e sem aceite seguem abreviados, sem repetir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("servidor: sem sessão, outro usuário e sem aceite = null SEM falha; erro/sem cliente = falha", () => {
  const fn = ler("src/lib/data/perfil-proprietario.ts");
  const corpo = fn.slice(fn.indexOf("export async function nomeCompletoDoAceite"), fn.indexOf("export interface AvaliacaoRecebida"));
  assert.match(corpo, /if \(!user \|\| user\.id === donoId\) return \{ nome: null, falhou: false \};/);
  assert.match(corpo, /if \(!aceite\) return \{ nome: null, falhou: false \};/);
  assert.match(corpo, /if \(!supabase \|\| !admin\) return \{ nome: null, falhou: true \};/);
  assert.match(corpo, /catch \{\s*return \{ nome: null, falhou: true \};/);
  assert.match(fn, /nomeCompletoParaQuemTemAceite\(donoId: string\): Promise<string \| null> \{\s*return \(await nomeCompletoDoAceite\(donoId\)\)\.nome;/);
});

test("hook: tenta de novo só na falha (2 vezes), não em 'sem aceite'; refaz quando a sessão muda e ainda não achou", () => {
  const h = ler("src/components/property/use-nome-depois-do-aceite.ts");
  assert.match(h, /ESPERAS_NOVA_TENTATIVA = \[1500, 4000\] as const/);
  assert.match(h, /else if \(r\.falhou && tentativa < ESPERAS_NOVA_TENTATIVA\.length\)/);
  assert.match(h, /if \(!achou && \(evento === "SIGNED_IN" \|\| evento === "TOKEN_REFRESHED"\)\) buscar\(0\);/);
  assert.match(h, /clearTimeout\(timer\)/);
  assert.match(h, /unsubscribe\(\)/);
});

test("o HTML público segue sem o nome completo (como no #2863): a página é estática e não lê a sessão", () => {
  const page = ler("src/app/(public)/imoveis/[id]/page.tsx");
  assert.match(page, /export const revalidate = 60;/);
  assert.doesNotMatch(page, /nomeCompletoDoAceite|nomeCompletoParaQuemTemAceite|nomeDoDonoDepoisDoAceite/);
  const f = ler("src/components/property/faixa-proprietario.tsx");
  assert.match(f, /const nome = exemplo\?\.nome \?\? nomeAceite \?\? real!\.nome;/);
});
