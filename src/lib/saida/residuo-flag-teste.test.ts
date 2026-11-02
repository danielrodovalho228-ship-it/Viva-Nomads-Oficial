/*
  Varredura ampliada — a marca "conta de teste" lida sem conferir o erro (baixo), em três fluxos:
   - motivo de saída (registrarMotivoSaida): na falha, a saída de uma conta de teste contava como real e podia abrir
     uma Correção no painel de qualidade. Sair nunca é bloqueado (o motivo segue gravado), mas a Correção não abre;
   - denúncia de anúncio (denunciarAnuncio): a falha na leitura do anúncio virava "Anúncio não encontrado." e a do
     perfil gravava a denúncia como real; agora as duas dizem "tente de novo" (a pessoa reenvia), sem gravar;
   - evento de tráfego (/api/evento): a falha do perfil contava a sessão de teste como real; agora o evento é
     descartado (perder um evento custa menos que poluir a métrica).
  Roda: node --test src/lib/saida/residuo-flag-teste.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const acoes = ler("src/lib/saida/acoes.ts");
const trecho = (de: string) => acoes.slice(acoes.indexOf(de), acoes.indexOf("\n}\n", acoes.indexOf(de)));

test("motivo de saída: a falha da marca de teste não abre Correção (e a saída segue)", () => {
  const fn = trecho("export async function registrarMotivoSaida");
  assert.match(fn, /const \{ data: perfil, error: erroPerfil \} = await s\.admin\.from\("profiles"\)\.select\("is_teste"\)/);
  assert.match(fn, /else if \(motivo && !erroPerfil && perfil\?\.is_teste !== true\) await abrirCorrecoesDevidas/);
  assert.match(fn, /return \{ ok: true,/);
});

test("denúncia: anúncio ou perfil não lidos → 'tente de novo', antes de gravar", () => {
  const fn = trecho("export async function denunciarAnuncio");
  assert.match(fn, /const \{ data: im, error: erroIm \} = await s\.admin\.from\("properties"\)/);
  assert.ok(fn.indexOf("if (erroIm) return { ok: false, erro: MSG_DENUNCIA_SEM_LEITURA };") < fn.indexOf('"Anúncio não encontrado." };\n  if (im.owner_id'));
  assert.match(fn, /const \{ data: perfil, error: erroPerfil \} = await s\.admin\.from\("profiles"\)/);
  assert.ok(fn.indexOf("if (erroPerfil) return { ok: false, erro: MSG_DENUNCIA_SEM_LEITURA };") < fn.indexOf('.from("denuncias_anuncio").insert('));
});

test("evento de tráfego: perfil não lido → o evento é descartado", () => {
  const r = ler("src/app/api/evento/route.ts");
  assert.match(r, /const \{ data: perfil, error: erroPerfil \} = await admin\.from\("profiles"\)\.select\("is_teste"\)/);
  assert.match(r, /if \(erroPerfil\) return vazio\(\);/);
});
