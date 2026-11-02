import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { CHAVE_SERVICO, NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/**
 * T1047 — E441 (#2348, Relay 51, 02/11): a foto do morador no e-mail ao dono sai pela rota própria /api/email/avatar,
 * assinada pelo par (dono, morador), que confere a relação ACEITA a cada abertura — nunca a URL do bucket privado.
 * Pela rota real, sem sessão (como o leitor de e-mail abre):
 *   1. sem parâmetros, ids inválidos, o mesmo id dos dois lados, assinatura errada e a assinatura do par invertido → 404;
 *   2. assinatura certa SEM relação aceita (candidatura nova) → 404; com a candidatura aceita → 200, JPEG, cache privado;
 *      morador sem foto, mesmo com a candidatura aceita → 404;
 *   3. a relação deixa de valer (a candidatura volta a "new") → 404 de novo, com a mesma URL.
 * O bloco do morador no e-mail (iniciais antes do aceite, nome pela regra E427, texto sem URL de imagem) fica com o
 * e441-morador.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1047.${sufixo}@lab.vivanomads.test`, nome: "Dora Avatar Souza", role: "owner" as const };
const morador = { email: `morador.t1047.${sufixo}@lab.vivanomads.test`, nome: "Mauro Avatar Lima", role: "tenant" as const };
const semFoto = { email: `semfoto.t1047.${sufixo}@lab.vivanomads.test`, nome: "Sara Semfoto Lima", role: "tenant" as const };
const ids: Record<string, string> = {};

/** A mesma assinatura do servidor (assinarAvatarEmail): HMAC-SHA256 de "dono:morador", 32 hex. */
const assinar = (d: string, m: string) => createHmac("sha256", `avatar-email:${CHAVE_SERVICO ?? "viva-nomads"}`).update(`${d}:${m}`).digest("hex").slice(0, 32);
const rota = (d: string, m: string, s = assinar(d, m)) => `/api/email/avatar?d=${d}&m=${m}&s=${s}`;

test.describe("T1047 — E441: a foto do morador no e-mail do dono só com assinatura e relação aceita", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.semFoto = await criarConta(semFoto, senha);
    const caminho = `${ids.morador}/t1047.png`;
    const up = await adm().storage.from("avatars").upload(caminho, pngDeTeste(3, 200, 200), { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    const { error } = await adm().from("profiles").update({ avatar_url: caminho }).eq("id", ids.morador);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, `Studio avatar t1047 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel);
    ids.leadSemFoto = await criarLead(ids.dono, ids.semFoto, ids.imovel, true);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().storage.from("avatars").remove([`${ids.morador}/t1047.png`]);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.morador, ids.semFoto]);
  });

  test("1. sem parâmetros, ids inválidos, mesmo id, assinatura errada ou do par invertido → 404", async ({ request }) => {
    const casos = [
      "/api/email/avatar",
      `/api/email/avatar?d=nao-e-uuid&m=${ids.morador}&s=${assinar("nao-e-uuid", ids.morador)}`,
      rota(ids.dono, ids.dono),
      rota(ids.dono, ids.morador, "0".repeat(32)),
      rota(ids.dono, ids.morador, assinar(ids.morador, ids.dono)),
    ];
    for (const url of casos) {
      const r = await request.get(url, { maxRedirects: 0 });
      expect(r.status(), url).toBe(404);
      expect(r.headers()["content-type"] ?? "", url).not.toContain("image/");
    }
  });

  test("2. assinatura certa: sem aceite → 404; candidatura aceita → JPEG com cache privado; sem foto → 404", async ({ request }) => {
    const antes = await request.get(rota(ids.dono, ids.morador));
    expect(antes.status(), "sem relação aceita a foto não sai").toBe(404);

    const { error } = await adm().from("leads").update({ status: "accepted" }).eq("id", ids.lead);
    expect(error).toBeNull();
    const ok = await request.get(rota(ids.dono, ids.morador));
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toBe("image/jpeg");
    expect(ok.headers()["cache-control"] ?? "").toContain("private");
    expect(ok.headers()["x-content-type-options"]).toBe("nosniff");
    const corpo = await ok.body();
    expect([...corpo.subarray(0, 3)], "assinatura de arquivo JPEG").toEqual([0xff, 0xd8, 0xff]);

    const vazio = await request.get(rota(ids.dono, ids.semFoto));
    expect(vazio.status(), "morador sem foto: 404 (o e-mail usa as iniciais)").toBe(404);
  });

  test("3. a relação deixa de valer → a mesma URL volta a dar 404", async ({ request }) => {
    const { error } = await adm().from("leads").update({ status: "new" }).eq("id", ids.lead);
    expect(error).toBeNull();
    const r = await request.get(rota(ids.dono, ids.morador));
    expect(r.status()).toBe(404);
  });
});
