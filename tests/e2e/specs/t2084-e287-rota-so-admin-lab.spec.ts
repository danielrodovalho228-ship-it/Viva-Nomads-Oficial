import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T2084 (laboratório; antes t2047-lab) — E287 @E287 (sem @ao-vivo-seguro: lê o banco pela chave de serviço). Complementa o t2047 de
  visitante: o POST rejeitado do visitante NÃO deixa estado — nenhuma linha nova em automacoes_envios.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const ROTA = "/api/admin/pioneiras-e287";
const envios = async () => (await adm().from("automacoes_envios").select("chave", { count: "exact", head: true })).count ?? 0;

test.describe("T2084 (lab) — E287: o POST rejeitado não reserva envio @E287", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test("visitante: um POST → 403 e nenhuma linha nova em automacoes_envios", async ({ request }) => {
    const antes = await envios();
    const post = await request.post(ROTA, { data: { pessoa: "maria-de-fatima" }, maxRedirects: 0 });
    expect(post.status()).toBe(403);
    expect(await envios(), "nenhum envio reservado").toBe(antes);
  });
});
