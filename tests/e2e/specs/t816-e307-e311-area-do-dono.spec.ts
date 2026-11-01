import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T816 — #1775 (E307–E311, QA do Muse de 31/10), Pista C, bloco 130. A área do dono, pela tela de verdade, a 390 e a
  1280 px, com um proprietário NOVO (um anúncio publicado, sem interessado e sem proposta), apagado no fim:
   1. Orçamentos fala com o dono: vazio diz "Aqui aparecem as propostas que você enviar aos interessados. Publique seu
      anúncio para receber o primeiro." e a ação é "Ver meus anúncios" (→ /dashboard/imoveis);
   2. títulos sem a marca repetida: Ganhos e Análise da carteira terminam em "· Viva Nomads" uma vez só;
   3. mês em pt-BR: o título do mês da Agenda é "Novembro de 2026" (só a 1ª letra maiúscula), nunca "Novembro De 2026"
      (o `capitalize` antigo subia o "de").
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t816.${sufixo}@lab.vivanomads.test`, nome: "Nara Nova", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T816 — E307–E311: Orçamentos do dono novo, títulos sem marca repetida, mês em pt-BR (#1775)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    // A Agenda só desenha o calendário do mês com um imóvel; o anúncio não muda o Orçamentos vazio (sem interessado
    // e sem proposta, é o "dono novo" do E307).
    await criarImovelPronto(ids.dono, `Casa da agenda t816 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: Orçamentos do dono novo, títulos e mês da Agenda`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // 1. Orçamentos (E307).
      await p.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
      await expect(p.getByText("Aqui aparecem as propostas que você enviar aos interessados. Publique seu anúncio para receber o primeiro.")).toBeVisible({ timeout: 30_000 });
      const acao = p.getByTestId("orcamentos-vazio-acao");
      await expect(acao).toHaveText("Ver meus anúncios");
      await expect(acao).toHaveAttribute("href", "/dashboard/imoveis");

      // 2. Títulos sem a marca repetida.
      for (const [rota, nome] of [["/dashboard/ganhos", "Ganhos"], ["/dashboard/carteira", "Análise da carteira"]] as const) {
        await p.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(p).toHaveTitle(`${nome} · Viva Nomads`, { timeout: 20_000 });
        expect((await p.title()).split("Viva Nomads").length - 1, `${rota}: "Viva Nomads" uma vez no título`).toBe(1);
      }

      // 3. O mês da Agenda em pt-BR, só com a 1ª letra maiúscula (o texto visível, com o CSS aplicado).
      await p.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
      const mes = p.getByTestId("agenda-mes-titulo");
      await expect(mes).toBeVisible({ timeout: 30_000 });
      // O ::first-letter não aparece no innerText: confere o texto e o estilo (sem `capitalize`, com a 1ª letra maiúscula).
      const r = await mes.evaluate((el) => ({ texto: (el.textContent ?? "").trim(), transform: getComputedStyle(el).textTransform, primeira: getComputedStyle(el, "::first-letter").textTransform }));
      expect(r.texto, "mês e ano em pt-BR").toMatch(/^[a-zà-úA-ZÀ-Ú][a-zà-ú]+ de \d{4}$/);
      expect(r.transform, "sem capitalize (que subia o \"de\")").not.toBe("capitalize");
      expect(r.primeira === "uppercase" || /^[A-ZÀ-Ú]/.test(r.texto), "a 1ª letra sai maiúscula").toBe(true);
      await p.context().close();
    });
  }
});
