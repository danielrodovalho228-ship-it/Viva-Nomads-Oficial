import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1416 — E287 (#3235, na main): a rota de envio real às duas pioneiras (POST /api/admin/pioneiras-e287) é SÓ de admin e
  SÓ POST. Caminhos negativos, sem enviar nada (o envio em si tem teste unitário com dependências injetadas,
  src/lib/notifications/pioneiras-e287-real.test.ts):
    1. visitante (sem sessão): POST → 404 "Não encontrado." (a API do admin não revela que existe, ordem 12a8086d);
    2. conta comum (inquilino): POST → 404 e nada gravado em automacoes_envios;
    3. GET (e outros métodos) não existem → 405.
  Nenhuma chamada com sessão de admin e nenhum corpo com pessoa válida: esta spec nunca chega perto de um envio.
*/
const senha = novaSenha();
const inq = { email: `inq.t1416.${novoSufixo()}@lab.vivanomads.test`, nome: "Ivo Comum", role: "tenant" as const };
const ids: { inq?: string } = {};
const ROTA = "/api/admin/pioneiras-e287";

test.describe("T1416 — E287: rota de envio só de admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.inq]);
  });

  test("visitante: POST é recusado e GET não existe", async ({ request }) => {
    const r = await request.post(ROTA, { data: { pessoa: "maria-de-fatima" } });
    expect(r.status()).toBe(404);
    expect(await r.json()).toEqual({ erro: "Não encontrado." });
    expect((await request.get(ROTA)).status()).toBe(405);
  });

  test("conta comum: POST é recusado com 404", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    const r = await p.request.post(ROTA, { data: { pessoa: "lya-raquel" } });
    expect(r.status()).toBe(404);
    expect(await r.json()).toEqual({ erro: "Não encontrado." });
    await p.context().close();
  });
});
