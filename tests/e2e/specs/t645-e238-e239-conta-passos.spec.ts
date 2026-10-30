import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T645 — conformidade com os mockups (29/10).
   E238: no celular, a Conta diz "Conta" UMA vez (o título da tela; o grupo logo abaixo não repete o nome).
   E239: no Início do dono, os "Próximos passos" com os ícones do mockup painel-proprietario — feito: ✓ num círculo
         verde cheio; o passo da vez: prancheta; os seguintes: cadeado (nada de círculo contornado).
  A 390 e 1280 px.
  Reconferência a 390/360 px pedida pelo coordenador (30/10, E195/E238/E219/E229): rodada no lab-crítico sobre a main atual.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t645.${sufixo}@lab.vivanomads.test`, nome: "Rita Passos", role: "owner" as const };
const ids: string[] = [];

test.describe("T645 — E238 (Conta uma vez) e E239 (ícones dos próximos passos)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    const a = await criarConta(dono, senha);
    ids.push(a);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", a);
    // Rascunho que ainda não publica: passos feitos e pendentes no bloco "Continue seu anúncio".
    await criarImovelPronto(a, `Studio passos t645 ${sufixo}`, { semInternet: true, semConforto: true });
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("E238 — 390 px: 'Conta' aparece uma vez no topo da lista", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    const menu = p.getByTestId("conta-menu");
    await expect(menu.getByTestId("conta-h1")).toHaveText("Conta", { timeout: 30_000 });
    const vezes = await menu.evaluate((m) =>
      Array.from(m.querySelectorAll("h1, h2, h3, p, span")).filter((e) => (e as HTMLElement).offsetParent && (e as HTMLElement).innerText.trim() === "Conta").length,
    );
    expect(vezes, "'Conta' visível sozinho").toBe(1);
    // O grupo continua com o nome para o leitor de tela (e para as specs).
    await expect(p.locator('[data-testid="conta-grupo"][data-grupo="Conta"]')).toHaveAttribute("aria-label", "Conta");
    await p.screenshot({ path: `${SAIDA}/t645-conta-390.png` });
    await p.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`E239 — ${largura} px: ícones dos próximos passos como no mockup`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const passos = p.getByTestId("inicio-dono-passos");
      await expect(passos).toBeVisible({ timeout: 30_000 });
      const estados = await passos.locator("li").evaluateAll((lis) =>
        lis.map((li) => {
          const ic = li.querySelector("[data-passo-icone]") as HTMLElement | null;
          return { estado: ic?.dataset.passoIcone ?? null, fundo: ic ? getComputedStyle(ic).backgroundColor : "", texto: (li as HTMLElement).innerText.includes("Concluído") ? "feito" : "pendente" };
        }),
      );
      console.log(`t645|${largura}|${JSON.stringify(estados)}`);
      expect(estados.length).toBeGreaterThan(1);
      // Feito → círculo verde cheio; o primeiro pendente → prancheta; os demais pendentes → cadeado.
      const primeiroPendente = estados.findIndex((e) => e.texto === "pendente");
      estados.forEach((e, i) => {
        if (e.texto === "feito") {
          expect(e.estado).toBe("feito");
          expect(e.fundo).not.toBe("rgba(0, 0, 0, 0)");
        } else expect(e.estado).toBe(i === primeiroPendente ? "agora" : "depois");
      });
      await p.getByTestId("inicio-dono-principal").screenshot({ path: `${SAIDA}/t645-passos-${largura}.png` });
      await p.context().close();
    });
  }
});
