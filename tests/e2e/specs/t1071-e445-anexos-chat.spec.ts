import { test, expect, type Browser } from "@playwright/test";
import { adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, NO_LABORATORIO, novaSenha, novoSufixo, pdf, pngDeTeste } from "../fixtures/laboratorio";

/**
 * T1071 — E445 item 5 (#2387, backend dos anexos do chat, 04/11): foto ou PDF no chat pelas rotas reais, com a sessão
 * real de cada conta (a RLS e o bucket privado da 0288 só existem de verdade no laboratório):
 *   1. sem sessão: enviar e abrir → 401;
 *   2. a moradora (pedido aceito) envia um PDF ao dono → 200 com o anexo; a mensagem diz "Anexo: PDF enviado" (sem o
 *      nome do arquivo) e o registro guarda o tipo real, o tamanho e o destinatário da linha gravada;
 *   3. um texto com nome .pdf → 415 pelo tipo real (primeiros bytes) e nenhuma mensagem nova;
 *   4. uma foto PNG → "Anexo: foto enviada", mime image/png;
 *   5. o dono abre o anexo → 302 para URL assinada (Cache-Control private, no-store) que devolve o mesmo arquivo;
 *   6. uma terceira conta, fora da conversa → 404 (a RLS "anexos das partes" não acha a linha).
 * As regras puras (tipoDoAnexo, erroDoAnexo, caminhoAnexo) ficam com o e445-anexos.test.ts.
 */
const sufixo = novoSufixo();
const senha = novaSenha();
const dono = { email: `dono.t1071.${sufixo}@lab.vivanomads.test`, nome: "Artur Anexo Dias", role: "owner" as const };
const inq = { email: `inq.t1071.${sufixo}@lab.vivanomads.test`, nome: "Clara Clipe Moura", role: "tenant" as const };
const fora = { email: `fora.t1071.${sufixo}@lab.vivanomads.test`, nome: "Rui Rodeado Paz", role: "tenant" as const };
const ids: Record<string, string> = {};
const ARQ_PDF = pdf();
let anexoPdf = "";

const abrir = (browser: Browser, email: string) => entrar(browser, email, senha);
const envio = (file: { name: string; mimeType: string; buffer: Buffer }) => ({
  multipart: { receiverId: ids.dono, propertyId: ids.imovel, file },
});
const contarMsgs = async () =>
  (await adm().from("messages").select("id", { count: "exact", head: true }).eq("sender_id", ids.inq)).count ?? 0;

test.describe("T1071 — E445: anexos de foto e PDF no chat pelas rotas reais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.fora = await criarConta(fora, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do anexo t1071 ${sufixo}`, { ativo: true, preco: 3100 });
    await criarLead(ids.dono, ids.inq, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    const { data } = await adm().from("mensagens_anexos").select("caminho").eq("sender_id", ids.inq);
    const caminhos = (data ?? []).map((r) => r.caminho as string);
    if (caminhos.length) await adm().storage.from("mensagens-anexos").remove(caminhos);
    await adm().from("messages").delete().eq("sender_id", ids.inq);
    await apagarContas([ids.dono, ids.inq, ids.fora]);
  });

  test("1. sem sessão: enviar e abrir → 401", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const r = await anon.post("/api/mensagens/anexo", { multipart: { receiverId: ids.dono, file: { name: "a.pdf", mimeType: "application/pdf", buffer: ARQ_PDF } } });
    expect(r.status()).toBe(401);
    const g = await anon.get(`/api/mensagens/anexo/${crypto.randomUUID()}`, { maxRedirects: 0 });
    expect(g.status()).toBe(401);
    await anon.dispose();
  });

  test("2–4. a moradora envia PDF e foto; o texto disfarçado de PDF é recusado pelo tipo real", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    const r = await p.request.post("/api/mensagens/anexo", envio({ name: "Contrato Clara 62999991234.pdf", mimeType: "application/pdf", buffer: ARQ_PDF }));
    expect(r.status(), await r.text()).toBe(200);
    const j = (await r.json()) as { ok: boolean; anexoId: string; messageId: string; mime: string };
    expect(j.ok).toBe(true);
    expect(j.mime).toBe("application/pdf");
    anexoPdf = j.anexoId;
    const { data: msg } = await adm().from("messages").select("body, receiver_id, property_id").eq("id", j.messageId).single();
    expect(msg?.body).toBe("Anexo: PDF enviado");
    expect(msg?.receiver_id).toBe(ids.dono);
    expect(msg?.property_id).toBe(ids.imovel);
    const { data: reg } = await adm().from("mensagens_anexos").select("*").eq("id", anexoPdf).single();
    expect(reg?.mime).toBe("application/pdf");
    expect(reg?.tamanho).toBe(ARQ_PDF.length);
    expect(reg?.receiver_id).toBe(ids.dono);
    expect(JSON.stringify(reg), "o nome original do arquivo não é guardado").not.toContain("62999991234");

    const antes = await contarMsgs();
    const falso = await p.request.post("/api/mensagens/anexo", envio({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("só texto, não é PDF") }));
    expect(falso.status()).toBe(415);
    expect(await contarMsgs(), "a recusa não grava mensagem").toBe(antes);

    const foto = await p.request.post("/api/mensagens/anexo", envio({ name: "sala.png", mimeType: "image/png", buffer: pngDeTeste(7, 64, 48) }));
    expect(foto.status(), await foto.text()).toBe(200);
    const jf = (await foto.json()) as { messageId: string; mime: string };
    expect(jf.mime).toBe("image/png");
    const { data: mf } = await adm().from("messages").select("body").eq("id", jf.messageId).single();
    expect(mf?.body).toBe("Anexo: foto enviada");
    await p.context().close();
  });

  test("5. o dono abre o anexo: 302 para URL assinada, sem cache, com o mesmo arquivo", async ({ browser }) => {
    expect(anexoPdf).not.toBe("");
    const p = await abrir(browser, dono.email);
    const r = await p.request.get(`/api/mensagens/anexo/${anexoPdf}`, { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    expect(r.headers()["cache-control"]).toContain("no-store");
    const destino = r.headers()["location"] ?? "";
    expect(destino).toContain("/storage/v1/object/sign/mensagens-anexos/");
    const arq = await p.request.get(destino);
    expect(arq.status()).toBe(200);
    expect((await arq.body()).equals(ARQ_PDF)).toBe(true);
    await p.context().close();
  });

  test("6. uma conta fora da conversa não acha o anexo (404)", async ({ browser }) => {
    const p = await abrir(browser, fora.email);
    const r = await p.request.get(`/api/mensagens/anexo/${anexoPdf}`, { maxRedirects: 0 });
    expect(r.status()).toBe(404);
    await p.context().close();
  });
});
