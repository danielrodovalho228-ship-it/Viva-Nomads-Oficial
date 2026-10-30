import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T670 — E190, regressão permanente da troca de modo pelo menu do avatar (QA ao vivo do coordenador aprovou em 30/10).
  Conta que é dono (anúncio no ar) E morador (estadia vigente no imóvel de outro dono), a 1280 e 390 px:
   1. O menu do avatar tem exatamente: Minha conta · Modo <outro papel> · Ajuda · Sair.
   2. UM clique em "Modo morador" troca: a barra vira a do morador, com "Estadia" visível e nada do dono.
   3. UM clique em "Modo proprietário" volta: a barra é exatamente Início · Anúncios · Interessados · Contratos · Mensagens.
   4. O papel nunca muda sozinho ao navegar: Mensagens, Conta, Notificações, de volta ao Início e um recarregar — o modo
      escolhido continua (nos dois sentidos).
  A t562 cobre só morador → proprietário saindo de Favoritos; aqui os dois sentidos, o menu e as barras exatas.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dupla = { email: `dupla.t670.${sufixo}@lab.vivanomads.test`, nome: "Dora Dois Papéis", role: "owner" as const };
const outro = { email: `outro.t670.${sufixo}@lab.vivanomads.test`, nome: "Otávio Anfitrião", role: "owner" as const };
const ids: Record<string, string> = {};

const BARRA_DONO = ["Início", "Anúncios", "Interessados", "Contratos", "Mensagens"];
const COMUNS = ["/dashboard/mensagens", "/dashboard/conta", "/dashboard/notificacoes", "/dashboard"];

type Papel = "proprietario" | "morador";
const px = (papel: Papel) => (papel === "proprietario" ? "dono" : "morador");

/** O papel que a casca está mostrando: no computador, o topo do papel; no celular, a barra de baixo. */
async function papelNaTela(p: Page, largura: number): Promise<string | null> {
  const sel = largura >= 1024 ? 'header[data-testid^="topo-"][data-papel]' : "nav[data-papel]";
  return p.locator(sel).filter({ visible: true }).first().getAttribute("data-papel", { timeout: 20_000 }).catch(() => null);
}

/** Rótulos da barra de navegação do papel (sem contadores de não lidas). */
async function rotulosDaBarra(p: Page, largura: number, papel: Papel): Promise<string[]> {
  const barra = largura >= 1024 ? p.getByTestId(`abas-${px(papel)}`) : p.locator(`nav[data-papel="${papel}"]`).filter({ visible: true }).first();
  await expect(barra).toBeVisible({ timeout: 20_000 });
  return barra.locator("a").evaluateAll((as) =>
    as
      .filter((a) => (a as HTMLElement).offsetParent !== null)
      .map((a) => ((a as HTMLElement).innerText || a.getAttribute("aria-label") || "").split("\n")[0].replace(/\s*\d+\+?$/, "").trim())
      .filter(Boolean),
  );
}

/** Abre o menu do avatar do papel atual e devolve os rótulos dos itens. */
async function abrirMenu(p: Page, largura: number, papel: Papel): Promise<string[]> {
  const id = largura >= 1024 ? `conta-${px(papel)}` : `conta-${px(papel)}-celular`;
  const botao = largura >= 1024 ? p.getByTestId(id) : p.getByTestId("topo-celular").getByTestId(id);
  await expect(botao).toBeVisible({ timeout: 20_000 });
  await botao.click();
  const menu = p.getByTestId(`menu-${id}`);
  await expect(menu).toBeVisible();
  return menu.getByRole("menuitem").allInnerTexts().then((t) => t.map((s) => s.trim()));
}

async function trocarPara(p: Page, largura: number, de: Papel, para: Papel) {
  const id = largura >= 1024 ? `conta-${px(de)}` : `conta-${px(de)}-celular`;
  await p.getByTestId(`${id}-${para === "morador" ? "modo-morador" : "modo-proprietario"}`).click();
  await expect.poll(() => papelNaTela(p, largura), { message: `@${largura}: um clique troca para ${para}`, timeout: 30_000 }).toBe(para);
  // E fica: a guarda de rota não desfaz a troca.
  await p.waitForTimeout(2_000);
  expect(await papelNaTela(p, largura), `@${largura}: continua ${para} depois da troca`).toBe(para);
}

async function navegarSemMudarPapel(p: Page, largura: number, papel: Papel) {
  for (const rota of COMUNS) {
    await p.goto(rota, { waitUntil: "domcontentloaded" });
    await p.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    expect(await papelNaTela(p, largura), `@${largura}: em ${rota} o papel continua ${papel}`).toBe(papel);
  }
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  expect(await papelNaTela(p, largura), `@${largura}: depois de recarregar o papel continua ${papel}`).toBe(papel);
}

test.describe("T670 — E190: troca de modo em um clique, barras certas e papel estável", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dupla = await criarConta(dupla, senha);
    ids.outro = await criarConta(outro, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dupla, ids.outro]);
    // Dono: um anúncio no ar (habilita "Modo proprietário" no menu do morador).
    await criarImovelPronto(ids.dupla, `Studio da Dora t670 ${sufixo}`, { ativo: true });
    // Morador: estadia vigente no imóvel do outro dono (a aba "Estadia" aparece com contrato).
    const imovel = await criarImovelPronto(ids.outro, `Apartamento do Otávio t670 ${sufixo}`, { ativo: true });
    const t = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: imovel, tenant_id: ids.dupla, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c!.id as string;
    await tornarContratoVigente(ids.contrato, ids.outro);
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dupla, ids.outro]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (as larguras saem dentro do teste)");
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — proprietário → morador → proprietário, um clique cada, barras certas e papel estável`, async ({ browser }) => {
      await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dupla);
      const p = await entrar(browser, dupla.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect.poll(() => papelNaTela(p, largura), { timeout: 30_000 }).toBe("proprietario");

      // Barra do dono, exata.
      expect(await rotulosDaBarra(p, largura, "proprietario"), `@${largura}: barra do proprietário`).toEqual(BARRA_DONO);
      // Menu do avatar do dono.
      expect(await abrirMenu(p, largura, "proprietario"), `@${largura}: menu do avatar (dono)`).toEqual(["Minha conta", "Modo morador", "Ajuda", "Sair"]);
      await p.screenshot({ path: `${SAIDA}/t670-menu-dono-${largura}.png` });

      // Um clique → morador, com "Estadia" e nada do dono.
      await trocarPara(p, largura, "proprietario", "morador");
      const barraMorador = await rotulosDaBarra(p, largura, "morador");
      console.log(`t670|${largura}|barra-morador|${JSON.stringify(barraMorador)}`);
      expect(barraMorador, `@${largura}: barra do morador com Estadia`).toContain("Estadia");
      for (const r of ["Anúncios", "Interessados"]) expect(barraMorador, `@${largura}: nada do dono na barra do morador`).not.toContain(r);
      await navegarSemMudarPapel(p, largura, "morador");

      // Menu do morador e um clique → proprietário.
      expect(await abrirMenu(p, largura, "morador"), `@${largura}: menu do avatar (morador)`).toEqual(["Minha conta", "Modo proprietário", "Ajuda", "Sair"]);
      await trocarPara(p, largura, "morador", "proprietario");
      expect(await rotulosDaBarra(p, largura, "proprietario"), `@${largura}: barra do proprietário depois de voltar`).toEqual(BARRA_DONO);
      await navegarSemMudarPapel(p, largura, "proprietario");
      await p.screenshot({ path: `${SAIDA}/t670-volta-dono-${largura}.png` });
      await p.context().close();
    });
  }
});
