/*
  E445 item 5 (backend) — anexos de foto e PDF no chat: bucket PRIVADO, até 10 MB, tipo real pelos primeiros bytes.
  O arquivo entra e sai só pelo servidor; quem vê é só quem está na conversa (remetente e destinatário), por URL
  assinada de 10 minutos. A mensagem do anexo passa pela MESMA RLS do chat (quem não pode escrever, não anexa).
  Roda: node --test src/lib/messages/e445-anexos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANEXO_MAX_BYTES, BUCKET_ANEXOS, caminhoAnexo, corpoDoAnexo, tipoDoAnexo, erroDoAnexo } from "./anexos.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const b = (...n: number[]) => new Uint8Array([...n, ...new Array(16).fill(0)]);

test("limite de 10 MB e bucket próprio", () => {
  assert.equal(ANEXO_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(BUCKET_ANEXOS, "mensagens-anexos");
});

test("tipo real pelos primeiros bytes: PDF, JPG, PNG e WebP; o resto é recusado", () => {
  assert.equal(tipoDoAnexo(b(0x25, 0x50, 0x44, 0x46)), "application/pdf");
  assert.equal(tipoDoAnexo(b(0xff, 0xd8, 0xff)), "image/jpeg");
  assert.equal(tipoDoAnexo(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(tipoDoAnexo(b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)), "image/webp");
  assert.equal(tipoDoAnexo(b(0x4d, 0x5a)), null, "executável");
  assert.equal(tipoDoAnexo(new TextEncoder().encode("<svg onload=alert(1)>")), null, "SVG");
});

test("validação: vazio, grande demais e tipo inválido têm mensagem própria; o válido passa", () => {
  assert.match(erroDoAnexo(0, "application/pdf") ?? "", /vazio/i);
  assert.match(erroDoAnexo(ANEXO_MAX_BYTES + 1, "image/jpeg") ?? "", /10 MB/);
  assert.match(erroDoAnexo(1000, null) ?? "", /foto.*PDF/i);
  assert.equal(erroDoAnexo(ANEXO_MAX_BYTES, "image/png"), null);
});

test("caminho fica na pasta da conversa, com id novo e extensão do tipo real; corpo da mensagem diz o que foi", () => {
  const conv = "11111111-2222-3333-4444-555555555555";
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  assert.equal(caminhoAnexo(conv, id, "application/pdf"), `${conv}/${id}.pdf`);
  assert.equal(caminhoAnexo(conv, id, "image/webp"), `${conv}/${id}.webp`);
  assert.match(corpoDoAnexo("application/pdf"), /PDF/);
  assert.match(corpoDoAnexo("image/jpeg"), /foto/);
  assert.doesNotMatch(corpoDoAnexo("application/pdf") + corpoDoAnexo("image/png"), /\p{Extended_Pictographic}/u, "sem emoji");
});

test("migração 0288: bucket privado de 10 MB, tabela com RLS só das partes e sem escrita pelo navegador", () => {
  const m = ler("../../../supabase/migrations/0288_mensagens_anexos.sql");
  assert.match(m, /'mensagens-anexos', 'mensagens-anexos', false, 10485760/);
  assert.match(m, /create table if not exists public\.mensagens_anexos/);
  assert.match(m, /references public\.messages \(id\) on delete cascade/);
  assert.match(m, /enable row level security/);
  assert.match(m, /auth\.uid\(\) = sender_id or auth\.uid\(\) = receiver_id/);
  assert.match(m, /revoke all on public\.mensagens_anexos from anon, authenticated/);
  assert.doesNotMatch(m, /on storage\.objects/, "nenhuma política de storage para o navegador");
  const a = ler("../../../supabase/producao/aplicar-0288.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /^commit;/m);
  assert.match(a, /'0288_mensagens_anexos'/);
  assert.match(a, /where not exists/);
  assert.match(ler("../../../supabase/producao/rollback/0288_rollback.sql"), /drop table if exists public\.mensagens_anexos/);
});

test("rota de envio: autenticada, limite de envios, tipo real, mensagem pela RLS do usuário e desfaz se falhar", () => {
  const r = ler("../../app/api/mensagens/anexo/route.ts");
  assert.match(r, /auth\.getUser\(\)/);
  assert.match(r, /consumirLimite\(`msg-anexo:\$\{user\.id\}`/);
  assert.match(r, /tipoDoAnexo\(bytes\)/);
  assert.match(r, /erroDoAnexo\(/);
  // A mensagem é gravada com o cliente DO USUÁRIO (a RLS de messages decide quem pode falar com quem).
  assert.match(r, /await supabase\s*\.from\("messages"\)\s*\.insert\(/);
  assert.match(r, /conversationId\(user\.id, receiverId, propertyId\)/);
  assert.match(r, /\.storage\.from\(BUCKET_ANEXOS\)\.upload\(/);
  // Falha no arquivo ou no registro: apaga a mensagem e o arquivo (nada órfão).
  assert.match(r, /from\("messages"\)\.delete\(\)\.eq\("id", msgId\)/);
  assert.match(r, /\.remove\(\[caminho\]\)/);
});

test("rota de leitura: só as partes (RLS), URL assinada de 10 minutos, nada público", () => {
  const r = ler("../../app/api/mensagens/anexo/[id]/route.ts");
  assert.match(r, /auth\.getUser\(\)/);
  assert.match(r, /await supabase\.from\("mensagens_anexos"\)/);
  assert.match(r, /createSignedUrl\(anexo\.caminho, 600\)/);
  assert.doesNotMatch(r, /getPublicUrl/);
});
