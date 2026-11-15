import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T2047 — E287 (Pista 3, cobertura do mapa das 142; ORDEM-DUET-073 pontos 2 e 3) @E287 @ao-vivo-seguro
  Regra: a rota de envio real às pioneiras (POST /api/admin/pioneiras-e287) é SÓ de admin e SÓ POST. Para o visitante:
    • UM POST sem sessão e sem corpo válido → 403 "Só admin." — a guarda rejeita ANTES de ler o corpo, sem nenhum efeito;
    • UM GET → 405 (o método não existe).
  Condições do Gerente: um só pedido de cada, sem varredura; a asserção cobre a rejeição e a ausência de estado criado
  (no laboratório, nenhuma linha nova em automacoes_envios; contra produção, só a rejeição — a corrida é a do E951 ou a
  ronda do Gerente, nunca por iniciativa da Pista 3).
*/
test.use({ storageState: { cookies: [], origins: [] } });
const ROTA = "/api/admin/pioneiras-e287";
const envios = async () => (NO_LABORATORIO ? ((await adm().from("automacoes_envios").select("chave", { count: "exact", head: true })).count ?? 0) : null);

test.describe("T2047 — E287: a rota de envio rejeita o visitante @E287 @ao-vivo-seguro", () => {
  test("visitante: um POST → 403 'Só admin.' sem efeito; um GET → 405", async ({ request }) => {
    const antes = await envios();
    const post = await request.post(ROTA, { data: {}, maxRedirects: 0 });
    expect(post.status()).toBe(403);
    expect(await post.json()).toEqual({ erro: "Só admin." });
    const get = await request.get(ROTA, { maxRedirects: 0 });
    expect(get.status()).toBe(405);
    if (antes !== null) expect(await envios(), "nenhum envio reservado").toBe(antes);
  });
});
