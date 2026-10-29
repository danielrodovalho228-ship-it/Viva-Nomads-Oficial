import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

// Portão de #1483 (E217) e #1484 (E190 parte 2) (Pista C, 29/10): roda no lab-crítico deste PR.
/*
  T540 — E167, guarda permanente da Pista C, no desenho aprovado (menus-simples, Daniel 24/10; MENUS-5 #1392): ABAS no
  topo para os dois papéis e barra de baixo no celular, de uma fonte única por papel; o morador não tem barra lateral.
  Conta única que também é PROPRIETÁRIA (um anúncio ativo) e mora num imóvel de outro dono (contrato vigente), com o
  papel MORADOR ativo (profiles.preferred_mode = tenant, papel_ativo = morador):
   1. 1280 e 390: o Início do morador sem blocos de proprietário (sem "Como proprietário", sem o Início do dono);
   2. as abas do morador (topo a 1280, barra de baixo a 390) são exatamente os 5 nomes do desenho — Início · Buscar ·
      Pedidos · Mensagens · Estadia —, sem nenhum item de dono, e sem barra lateral.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `dupla.t540.${sufixo}@lab.vivanomads.test`, nome: "Duda Dupla", role: "owner" as const };
const outro = { email: `dono.t540.${sufixo}@lab.vivanomads.test`, nome: "Otto Outro", role: "owner" as const };
const ids: Record<string, string> = {};
const MORADOR_5 = ["Início", "Buscar", "Pedidos", "Mensagens", "Estadia"];
const DE_DONO = ["Anúncios", "Interessados", "Contratos", "Ganhos", "Agenda", "Ferramentas", "Meus imóveis"];

const barraDeBaixo = (p: Page) => p.getByRole("navigation", { name: "Navegação principal" });
const rotulosDaBarra = async (p: Page) => (await barraDeBaixo(p).locator("a").allInnerTexts()).map((t) => t.trim());

test.describe("T540 — E167: o papel morador sem blocos nem abas de dono (modelo de abas)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    ids.outro = await criarConta(outro, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.conta, ids.outro]);
    ids.meuImovel = await criarImovelPronto(ids.conta, `Studio do dono-morador t540 ${sufixo}`, { ativo: true });
    ids.ondeMoro = await criarImovelPronto(ids.outro, `Studio onde mora t540 ${sufixo}`, { ativo: true });
    const lead = await criarLead(ids.outro, ids.conta, ids.ondeMoro, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.ondeMoro, tenant_id: ids.conta, lead_id: lead, owner_plan: "pro", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.outro, 3200);
    const { error: e2 } = await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.conta);
    if (e2) throw e2;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.conta, ids.outro]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: Início do morador sem blocos de proprietário e as 5 abas do desenho, sem itens de dono`, async ({ browser }) => {
      const page = await entrar(browser, conta.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      let abas: string[];
      if (w === 1280) {
        // As abas do morador provam que o papel ativo é o de morador (senão o teste não diz nada sobre o E167).
        const topo = page.getByTestId("abas-morador");
        await expect(topo).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("abas-dono")).toHaveCount(0);
        await expect(page.getByTestId("barra-lateral")).toHaveCount(0);
        await expect(topo.locator("a")).toHaveText(MORADOR_5, { timeout: 30_000 });
        abas = (await topo.locator("a").allInnerTexts()).map((t) => t.trim());
      } else {
        await expect.poll(() => rotulosDaBarra(page), { timeout: 30_000 }).toEqual(MORADOR_5);
        abas = await rotulosDaBarra(page);
      }
      console.log(`t540 ${w}: abas do morador ${JSON.stringify(abas)}`);
      expect(abas.filter((a) => DE_DONO.includes(a)), "itens de dono nas abas do morador").toEqual([]);

      await expect(page.getByTestId("inicio-morador").or(page.getByTestId("inicio-so-morador")).first()).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: `tests/laboratorio/saida/t540-inicio-morador-${w}.png`, fullPage: true });
      await expect(page.getByTestId("inicio-proprietario"), "seção 'Como proprietário' no Início do morador").toHaveCount(0);
      await expect(page.getByTestId("inicio-dono")).toHaveCount(0);
      await expect(page.getByText("Como proprietário")).toHaveCount(0);
      await page.context().close();
    });
  }
});
