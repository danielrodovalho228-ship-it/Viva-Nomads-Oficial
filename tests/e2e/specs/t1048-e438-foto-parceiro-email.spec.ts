import { randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, pngDeTeste } from "../fixtures/laboratorio";

/**
 * T1048 — E438 (#2347, 02/11): a foto de destaque do parceiro nos e-mails sai pela rota do e-mail, /api/email/foto?pc=,
 * em JPEG, lida do bucket público "parceiros" — e SÓ no formato que o painel grava (<uuid>/avatar|banner-<16 hex>.webp).
 * Pela rota real, sem sessão:
 *   1. um arquivo do parceiro no formato do painel → 200, image/jpeg (bytes FF D8 FF);
 *   2. qualquer outro caminho (subida de pasta, outra extensão, nome livre, outro bucket) ou arquivo inexistente → 404;
 *   3. o ?p= da foto do imóvel segue com a regra antiga (um caminho fora do formato → 404).
 * Quais e-mails ganham o destaque fica com o e438-destaque.test.ts.
 */
const dono = randomUUID();
const caminho = `${dono}/avatar-${randomBytes(8).toString("hex")}.webp`;

test.describe("T1048 — E438: a foto do parceiro no e-mail pela rota própria, só no formato do painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const { error } = await adm().storage.from("parceiros").upload(caminho, pngDeTeste(5, 300, 300), { contentType: "image/webp", upsert: true });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().storage.from("parceiros").remove([caminho]);
  });

  test("1. arquivo do parceiro no formato do painel → JPEG", async ({ request }) => {
    const r = await request.get(`/api/email/foto?pc=${caminho}`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/jpeg");
    expect([...(await r.body()).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  test("2. fora do formato, de outro bucket ou inexistente → 404; 3. o ?p= segue com a regra antiga", async ({ request }) => {
    const casos = [
      `/api/email/foto?pc=../property-photos/${caminho}`,
      `/api/email/foto?pc=${dono}/avatar-${"a".repeat(16)}.png`,
      `/api/email/foto?pc=${dono}/qualquer.webp`,
      `/api/email/foto?pc=${encodeURIComponent(`${dono}/banner-${"b".repeat(16)}.webp`)}`,
      `/api/email/foto?p=${caminho.replace(".webp", ".exe")}`,
      `/api/email/foto?p=../parceiros/${caminho}`,
      "/api/email/foto",
    ];
    for (const url of casos) {
      const r = await request.get(url, { maxRedirects: 0 });
      expect(r.status(), url).toBe(404);
      expect(r.headers()["content-type"] ?? "", url).not.toContain("image/");
    }
  });
});
