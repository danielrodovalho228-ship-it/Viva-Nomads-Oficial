/*
  E482 — o aviso de mensagem nova no sino dizia só "Você tem uma nova mensagem": sem quem escreveu, sem o imóvel e sem
  a prévia. O desenho do E444 prevê título, texto e destino úteis. Correção:
    • título: "Nova mensagem de Ana · Casa no Centro" (primeiro nome de quem escreveu — o mesmo do e-mail — e o imóvel);
    • texto: a prévia da mensagem (140 caracteres, sem controle/HTML, com o filtro de contato), numa coluna própria
      (avisos.texto, migração 0298) — o título continua sem texto do usuário;
    • destino: a própria conversa (E541, já valia).
  Roda: node --test src/lib/notifications/e482-aviso-mensagem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoDeMensagem, textoDoAviso } from "./avisos.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("título com quem escreveu; prévia limpa e curta no texto", () => {
  assert.deepEqual(avisoDeMensagem({ remetente: "Ana", previa: "Oi! A casa ainda está disponível em dezembro?" }), {
    titulo: "Nova mensagem de Ana",
    texto: "Oi! A casa ainda está disponível em dezembro?",
  });
  assert.deepEqual(avisoDeMensagem({ remetente: "  ", previa: "" }), { titulo: "Você tem uma nova mensagem", texto: null });
  const longa = "a".repeat(300);
  assert.equal(avisoDeMensagem({ remetente: "Ana", previa: longa }).texto, `${"a".repeat(139)}…`);
  assert.equal(textoDoAviso("linha 1\n<b>linha 2</b>"), "linha 1 b linha 2 /b");
  assert.equal(textoDoAviso(null), null);
});

test("o notify monta o aviso de mensagem com remetente e prévia; o gravarAviso põe o imóvel e grava o texto", () => {
  const notify = ler("lib/notifications/index.ts");
  assert.match(notify, /params\.event === "new_message" \? avisoDeMensagem\(\{ remetente: params\.remetenteNome, previa: params\.previaAviso \}\) : null/);
  assert.match(notify, /titulo: params\.tituloAviso \?\? mensagem\?\.titulo, texto: mensagem\?\.texto/);
  const gravar = ler("lib/notifications/avisos-servidor.ts");
  assert.match(gravar, /if \(p\.imovelId && UUID_RE\.test\(p\.imovelId\)\) \{/);
  assert.match(gravar, /const texto = p\.texto \? textoDoAviso\(guardContactInfo\(p\.texto\)\.text\) : null;/);
  assert.match(gravar, /update\(\{ criado_em: new Date\(\)\.toISOString\(\), titulo, url, texto \}\)/);
});

test("as duas mensagens novas (conversa e programada) mandam a prévia e o imóvel", () => {
  const actions = ler("lib/data/actions.ts");
  assert.match(actions, /previaAviso: safeBody,/);
  const programadas = ler("lib/respostas/servidor.ts");
  assert.match(programadas, /remetenteNome: nome, previaAviso: p\.texto, imovelId: c\.property_id/);
});

test("o sino e a lista de avisos mostram o texto embaixo do título", () => {
  assert.match(ler("lib/data/avisos-actions.ts"), /ler\("id, evento, prioridade, titulo, texto, url, ref_id, criado_em, lido_em, resolvido_em"\)/);
  for (const p of ["components/painel/sino-avisos.tsx", "components/account/lista-avisos.tsx"]) assert.match(ler(p), /data-testid="aviso-texto"/, p);
});

test("migração 0298: coluna texto curta, só o servidor grava, aplicar idempotente e rollback", () => {
  const m = ler("../supabase/migrations/0298_avisos_texto_e482.sql");
  assert.match(m, /alter table public\.avisos add column if not exists texto text/);
  assert.match(m, /char_length\(texto\) <= 200/);
  const a = ler("../supabase/producao/aplicar-0298.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /^commit;/m);
  assert.match(a, /'0298_avisos_texto_e482'/);
  assert.match(ler("../supabase/producao/rollback/0298_rollback.sql"), /drop column if exists texto/);
});
