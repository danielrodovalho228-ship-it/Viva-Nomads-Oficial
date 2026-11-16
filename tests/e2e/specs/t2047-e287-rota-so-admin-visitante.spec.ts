import { test, expect } from "@playwright/test";

/*
  T2047 — E287 (Pista 3, cobertura do mapa das 142; ORDEM-DUET-073 pontos 2 e 3) @E287 @ao-vivo-seguro
  Regra: a rota de envio real às pioneiras (POST /api/admin/pioneiras-e287) é SÓ de admin e SÓ POST. Para o visitante:
    • UM POST sem sessão e sem corpo válido → 403 "Só admin." — a guarda rejeita ANTES de ler o corpo, sem nenhum efeito;
    • UM GET → 405 (o método não existe).
  Condições do Gerente: um só pedido de cada, sem varredura; contra produção, só a rejeição (a corrida é a do E951 ou a
  ronda do Gerente, nunca por iniciativa da Pista 3). A "ausência de estado criado" (nenhuma linha nova em
  automacoes_envios) é conferida no laboratório, no t2047-e287-rota-so-admin-lab (sem a etiqueta: usa a chave de serviço).
*/
test.use({ storageState: { cookies: [], origins: [] } });
const ROTA = "/api/admin/pioneiras-e287";

test.describe("T2047 — E287: a rota de envio rejeita o visitante @E287 @ao-vivo-seguro", () => {
  test("visitante: um POST → 403 Só admin, sem efeito; um GET → 405", async ({ request }) => {
    const post = await request.post(ROTA, { data: {}, maxRedirects: 0 });
    expect(post.status()).toBe(403);
    expect(await post.json()).toEqual({ erro: "Só admin." });
    const get = await request.get(ROTA, { maxRedirects: 0 });
    expect(get.status()).toBe(405);
  });
});
