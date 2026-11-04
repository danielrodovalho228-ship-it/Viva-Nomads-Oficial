/*
  E445 item 5 (tela): anexar foto ou PDF no chat e abrir o anexo na conversa, usando o backend do #2387.
  - A conversa carrega os anexos das mensagens (RLS: só as partes) e cada mensagem com anexo mostra "Abrir foto"/"Abrir PDF",
    que abre a URL assinada de 10 minutos.
  - O botão "Anexar" aceita só JPG, PNG, WebP e PDF, recusa acima de 10 MB antes de enviar e mostra o erro do servidor.
  - Com a tela chamando as duas rotas, elas saem da lista de exceções da varredura de rotas sem chamador.
  Roda: node --test src/lib/messages/e445-anexos-tela.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACEITA_ANEXO, rotuloDoAnexo, tipoDaMensagemAnexo, urlDoAnexo, erroAntesDeEnviar } from "./anexos-tela.ts";
import { ANEXO_MAX_BYTES } from "./anexos.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("puro: tipos aceitos, rótulo, URL do anexo e validação antes de enviar", () => {
  assert.equal(ACEITA_ANEXO, "image/jpeg,image/png,image/webp,application/pdf");
  assert.equal(tipoDaMensagemAnexo("application/pdf"), "pdf");
  assert.equal(tipoDaMensagemAnexo("image/webp"), "foto");
  assert.equal(rotuloDoAnexo("pdf"), "Abrir PDF");
  assert.equal(rotuloDoAnexo("foto"), "Abrir foto");
  assert.equal(urlDoAnexo("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), "/api/mensagens/anexo/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assert.equal(erroAntesDeEnviar({ size: 1000, type: "image/png" }), null);
  assert.match(erroAntesDeEnviar({ size: ANEXO_MAX_BYTES + 1, type: "image/png" }) ?? "", /10 MB/);
  assert.match(erroAntesDeEnviar({ size: 1000, type: "image/svg+xml" }) ?? "", /foto.*PDF/i);
  assert.match(erroAntesDeEnviar({ size: 0, type: "application/pdf" }) ?? "", /vazio/i);
});

test("dados: a conversa lê os anexos pelo cliente do usuário e liga cada um à mensagem", () => {
  const m = ler("src/lib/data/messages.ts");
  assert.match(m, /anexo\?: \{ id: string; tipo: "foto" \| "pdf" \}/);
  assert.match(m, /supabase\.from\("mensagens_anexos"\)\.select\("id, message_id, mime"\)\.in\("message_id", /);
  assert.match(m, /\{ id: a\.id, tipo: tipoDaMensagemAnexo\(a\.mime\) \}/);
});

test("tela: botão Anexar, envio pela rota, link do anexo e erro visível", () => {
  const c = ler("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(c, /accept=\{ACEITA_ANEXO\}/);
  assert.match(c, /data-testid="mensagem-anexar"/);
  assert.match(c, /fetch\("\/api\/mensagens\/anexo", \{ method: "POST", body: dados \}\)/);
  assert.match(c, /erroAntesDeEnviar\(arquivo\)/);
  assert.match(c, /href=\{urlDoAnexo\(m\.anexo\.id\)\}/);
  assert.match(c, /data-testid="mensagem-anexo"/);
  assert.match(c, /data-testid="erro-anexo"/);
});

test("varredura: as duas rotas do anexo saem das exceções (agora a tela as chama)", () => {
  const v = ler("src/lib/rotas-sem-chamador.test.ts");
  assert.doesNotMatch(v, /"\/api\/mensagens\/anexo/);
});
