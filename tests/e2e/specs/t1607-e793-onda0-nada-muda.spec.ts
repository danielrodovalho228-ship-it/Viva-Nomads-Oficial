import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1607 — E793 Onda 0 (peças e chave, nada visível): com a chave PAINEL_SESSAO_SERVIDOR desligada (padrão e rollback),
  o HTML inicial do painel continua com o esqueleto do guarda (auth-guard-carregando), e a tela abre com o conteúdo
  depois da conferência do cliente, como hoje. Com a chave em "piloto" (Onda 1), quem prova as 5 rotas é o t1608.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const email = `onda0.t1607.${sufixo}@lab.vivanomads.test`;
let id: string | undefined;

test.describe("T1607 — E793 Onda 0: nada muda no painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  // Asserção alterada pela Onda 1 (E793, PR 2): com a chave em "piloto", /dashboard e o Perfil passam a sair desenhados
  // do servidor (provado no t1608). Este spec segue provando o caso da chave desligada (o padrão e o rollback).
  test.skip(process.env.PAINEL_SESSAO_SERVIDOR === "piloto", "com a chave piloto, quem prova é o t1608");
  test.beforeAll(async () => {
    id = await criarConta({ email, nome: "Olga Onda Zero", role: "tenant" }, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const rota of ["/dashboard", "/dashboard/conta/perfil"]) {
    test(`${rota}: o HTML do servidor segue com auth-guard-carregando e a tela abre depois`, async ({ page }) => {
      await entrarNaPagina(page, email, senha);
      const resposta = await page.request.get(rota);
      expect(resposta.status()).toBe(200);
      const html = await resposta.text();
      expect(html).toContain('data-testid="auth-guard-carregando"');
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("auth-guard-carregando")).toHaveCount(0, { timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(rota.replace(/\//g, "\\/")));
    });
  }
});
