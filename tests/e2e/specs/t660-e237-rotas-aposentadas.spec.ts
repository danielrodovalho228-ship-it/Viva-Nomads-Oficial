import { test, expect } from "@playwright/test";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T660 — E237 (#1525): as 4 rotas de API sem chamador saíram e o bucket central-anexos foi apagado (0255).
    1. /api/assinatura, /api/app/ponte, /api/app/ponte/entrar e /api/admin/agentes/anexos respondem 404 em GET e POST.
    2. O que ficou continua de pé: o webhook do Asaas e o login social do app (/api/app/login-social) não dão 404.
    3. No banco do laboratório (migrações aplicadas até a 0255), o bucket central-anexos não existe mais.
  Sem conta; o item 3 só no laboratório.
*/
const APOSENTADAS = ["/api/assinatura", "/api/app/ponte", "/api/app/ponte/entrar", "/api/admin/agentes/anexos"];
const FICAM = ["/api/webhooks/asaas", "/api/app/login-social"];

test.describe("T660 — E237: rotas sem chamador e bucket central-anexos aposentados", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (só chamadas HTTP e banco)");
  });

  test("as 4 rotas aposentadas dão 404 em GET e POST", async ({ request }) => {
    for (const rota of APOSENTADAS) {
      const get = await request.get(rota, { maxRedirects: 0 });
      expect(get.status(), `GET ${rota}`).toBe(404);
      const post = await request.post(rota, { data: {}, maxRedirects: 0 });
      expect(post.status(), `POST ${rota}`).toBe(404);
    }
  });

  test("o webhook do Asaas e o login social do app continuam respondendo", async ({ request }) => {
    for (const rota of FICAM) {
      const post = await request.post(rota, { data: {}, maxRedirects: 0 });
      expect(post.status(), `POST ${rota} (a rota tem de existir; corpo vazio pode ser recusado)`).not.toBe(404);
    }
  });

  test("o bucket central-anexos não existe mais no banco", async () => {
    test.skip(!NO_LABORATORIO, "só no laboratório (banco local com as migrações)");
    const { data: buckets, error } = await adm().storage.listBuckets();
    expect(error).toBeNull();
    const ids = (buckets ?? []).map((b) => b.id);
    expect(ids.length, "a listagem de buckets veio vazia: a checagem não provaria nada").toBeGreaterThan(0);
    expect(ids).not.toContain("central-anexos");
  });
});
