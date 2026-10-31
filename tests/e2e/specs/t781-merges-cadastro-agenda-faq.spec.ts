import { test, expect, type Locator } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, continuarFicaEm, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T781 — merges de 31/10 (tarde), Pista C, bloco 105. Pelas telas de verdade, a 1280 e a 390 px, com um proprietário
  novo (rascunhos e um anúncio publicado, apagados no fim):
   A. #1716 — Passo 6 (Regras da casa): silêncio, festas, visitas e "Outras regras" no próprio passo, sem repetir o
      "Fumar" (o passo já tem o cartão "Permite fumar"); o texto de "Outras regras" fica guardado ao continuar;
   B. #1717 — Passo 5, "Pronto para trabalhar": todo cartão tem o seu ícone;
   C. #1718 — Passo 10: o motivo do "Publicar anúncio" travado aparece inteiro (quebra a linha, não corta com "…");
   D. #1708 — Editar anúncio: as comodidades no cartão do cadastro (grade, ícone por comodidade, marcar/desmarcar);
   E. #1713 — Agenda: o dia vazio diz o que a Agenda mostra e, com o filtro de um imóvel, que o vazio é só dele;
   F. #1711 — FAQPage da cidade, do polo e do bairro com nome em português e inLanguage pt-BR (visitante, sem conta).
  Já guardados pelo próprio merge: #1715 (t189, t212, t37, t97), #1714 (t192) e #1710 (t314). Fora daqui o #1712 (tela
  de erro do admin): só aparece com uma exceção no servidor de uma página do admin, e o laboratório não tem como
  provocar uma sem mexer em produção; fica coberto pelo teste de unidade do merge (erro-admin.test.ts).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t781.${sufixo}@lab.vivanomads.test`, nome: "Rita Regras", role: "owner" as const };
const LARGURAS = [1280, 390] as const;
const ids: { dono?: string; publicado?: string; tituloPublicado?: string; rascunho: Record<string, string> } = { rascunho: {} };

/** Hoje (Brasília) + n dias, no formato da chave do dia na Agenda (AAAA-MM-DD). */
const diaBR = (n: number) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [a, m, d] = p.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Cada cartão tem um <svg> (o ícone) antes do rótulo. */
async function todosComIcone(cartoes: Locator, rotulo: string) {
  const n = await cartoes.count();
  expect(n, `${rotulo}: há cartões`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(cartoes.nth(i).locator(":scope > svg").first(), `${rotulo}: cartão ${i + 1} com ícone`).toBeVisible();
}

test.describe("T781 — merges de 31/10: regras no Passo 6, ícones, motivo inteiro, Editar, Agenda vazia e FAQ em português", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    for (const l of LARGURAS) {
      ids.rascunho[`r${l}`] = await prepararRascunho(ids.dono, `Studio t781 ${l} ${sufixo}`);
      ids.rascunho[`v${l}`] = await prepararRascunho(ids.dono, `Studio t781 revisão ${l} ${sufixo}`);
      // Sem o documento do imóvel (o laboratório cria um aprovado): o Publicar fica travado e o motivo aparece.
      await adm().from("qualification_checklists").delete().eq("property_id", ids.rascunho[`v${l}`]);
    }
    ids.tituloPublicado = `Casa da agenda t781 ${sufixo}`;
    ids.publicado = await criarImovelPronto(ids.dono, ids.tituloPublicado, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`A. ${largura} px: Passo 6 com silêncio, festas, visitas e "Outras regras", sem repetir o fumo; o texto fica guardado (#1716)`, async ({ browser }) => {
      const id = ids.rascunho[`r${largura}`];
      const p = await abrirPasso(browser, { email: dono.email, senha }, id, "regras", largura);
      const regras = p.getByTestId("cadastro-regras-casa");
      await expect(regras).toBeVisible({ timeout: 30_000 });
      for (const chave of ["silencio", "festas", "visitas"]) await expect(regras.getByTestId(`bloco-${chave}`)).toBeVisible();
      await expect(regras.getByTestId("bloco-fumo")).toHaveCount(0);
      const outras = `Tirar os sapatos na sala (t781 ${largura})`;
      await regras.getByTestId("regras-casa-outras").fill(outras);
      await expect(regras.getByTestId("regras-casa-outras-contador")).toContainText(`${outras.length} de`);
      await continuarFicaEm(p, "descricao");
      await expect
        .poll(
          async () => {
            const { data } = await adm().from("properties").select("regras_casa, draft_data").eq("id", id).single();
            const r = (data?.regras_casa ?? null) as { outras?: string } | null;
            const d = ((data?.draft_data ?? {}) as { regrasCasa?: { outras?: string } }).regrasCasa;
            return r?.outras ?? d?.outras ?? null;
          },
          { timeout: 20_000, message: "o texto de Outras regras ficou guardado" },
        )
        .toBe(outras);
      await p.context().close();
    });

    test(`B. ${largura} px: Passo 5 — todo cartão do "Pronto para trabalhar" tem o seu ícone (#1717)`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho[`r${largura}`], "comodidades", largura);
      await expect(p.getByTestId("trabalho-essenciais")).toBeVisible({ timeout: 30_000 });
      await todosComIcone(p.locator('[data-cartao-assistente][data-testid^="trabalho-"]'), "Pronto para trabalhar");
      await p.context().close();
    });

    test(`C. ${largura} px: Passo 10 — o motivo do Publicar travado aparece inteiro, sem corte (#1718)`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho[`v${largura}`], "revisao", largura);
      const motivo = p.getByTestId("publicar-motivo");
      await expect(motivo).toBeVisible({ timeout: 30_000 });
      await expect(motivo).toHaveText(/^Faltam? \d+ ite(m|ns) antes de publicar( e o aceite do termo da IA)?$/);
      const caixa = await motivo.evaluate((el) => {
        const s = getComputedStyle(el);
        return { sobra: el.scrollWidth - el.clientWidth, reticencias: s.textOverflow === "ellipsis" && s.whiteSpace === "nowrap" };
      });
      expect(caixa.reticencias, "o motivo não é cortado com reticências").toBe(false);
      expect(caixa.sobra, "o texto cabe na caixa").toBeLessThanOrEqual(1);
      await p.context().close();
    });

    test(`D. ${largura} px: Editar anúncio — comodidades no cartão do cadastro, com ícone, e marcar/desmarcar (#1708)`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/${ids.publicado}/editar`, { waitUntil: "domcontentloaded" });
      const grade = p.getByTestId("editar-comodidades-grade").first();
      await expect(grade).toBeVisible({ timeout: 30_000 });
      const cartoes = p.getByTestId("editar-comodidades-grade").locator("[data-comodidade]");
      await todosComIcone(cartoes, "Editar anúncio");
      const primeiro = cartoes.first();
      const antes = await primeiro.getAttribute("aria-pressed");
      await primeiro.click();
      await expect(primeiro).toHaveAttribute("aria-pressed", antes === "true" ? "false" : "true");
      await p.context().close();
    });

    test(`E. ${largura} px: Agenda — dia vazio diz o que ela mostra; com filtro, que o vazio é só do imóvel (#1713)`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
      // Um dia do mês que está na tela, sem nada marcado (conta nova).
      const hoje = diaBR(0);
      await p.getByTestId(`agenda-dia-${hoje}`).click({ timeout: 30_000 });
      const vazio = p.getByTestId("agenda-dia-vazio");
      await expect(vazio).toHaveText("Nenhuma visita, entrada, saída ou data bloqueada neste dia.");
      await p.getByTestId("agenda-filtro-imovel").selectOption(ids.publicado!);
      await expect(vazio).toHaveText(`Nenhuma visita, entrada, saída ou data bloqueada neste dia em ${ids.tituloPublicado}. Escolha "Todos os imóveis" para ver os outros.`);
      await expect(p.getByText("Nada marcado neste dia.")).toHaveCount(0);
      await p.context().close();
    });
  }

  test("F. FAQPage da cidade, do polo e do bairro em português (#1711)", async ({ request }) => {
    const casos = [
      { rota: "/cidades/uberlandia", nome: /^Perguntas frequentes · Uberlândia$/ },
      { rota: "/cidades/uberlandia/hc-ufu-umuarama", nome: /^Perguntas frequentes · .*HC-UFU/ },
      { rota: "/cidades/uberlandia/martins", nome: /^Perguntas frequentes · Martins, Uberlândia$/ },
    ];
    for (const c of casos) {
      const html = await (await request.get(c.rota)).text();
      const blocos = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      const faqs = blocos
        .flatMap((b) => {
          try {
            const j = JSON.parse(b) as unknown;
            return Array.isArray(j) ? j : [j];
          } catch {
            return [];
          }
        })
        .filter((j): j is { "@type": string; name?: string; inLanguage?: string } => !!j && typeof j === "object" && (j as { "@type"?: string })["@type"] === "FAQPage");
      expect(faqs.length, `${c.rota}: um FAQPage`).toBeGreaterThan(0);
      for (const f of faqs) {
        expect(f.name ?? "", `${c.rota}: nome do FAQPage`).toMatch(c.nome);
        expect(f.inLanguage, `${c.rota}: inLanguage`).toBe("pt-BR");
      }
      expect(html, `${c.rota}: sem o rótulo padrão em inglês`).not.toContain("Frequently Asked Questions");
    }
  });
});
