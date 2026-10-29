import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Portão/catraca dos merges da noite (#1483–#1489) (Pista C, 29/10): roda no lab-crítico deste PR (o completo não chega aqui).
/*
  T610 — E190 (parte 2): "Hoje" no Início do proprietário. Quem entra e quem sai HOJE nos imóveis do dono, cada um num
  cartão com foto (ou iniciais) + nome do morador, o imóvel e o horário; o cartão leva à estadia. Sem nada hoje, a seção
  não aparece. Mesma fonte da Agenda. 1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t610.${sufixo}@lab.vivanomads.test`, nome: "Otília Hoje", role: "owner" as const };
const vazio = { email: `vazio.t610.${sufixo}@lab.vivanomads.test`, nome: "Vera Semnada", role: "owner" as const };
const entra = { email: `entra.t610.${sufixo}@lab.vivanomads.test`, nome: "Iara Chegada", role: "tenant" as const };
const sai = { email: `sai.t610.${sufixo}@lab.vivanomads.test`, nome: "Bruno Partida", role: "tenant" as const };
const ids: Record<string, string> = {};
/** Dia em Brasília (UTC−3), deslocado em `d` dias — o mesmo "hoje" da tela. */
const dia = (d: number) => new Date(Date.now() - 3 * 3_600_000 + d * 86_400_000).toISOString().slice(0, 10);
const t = new Date().toISOString();

async function contrato(imovel: string, tenant: string, inicio: string, fim: string): Promise<string> {
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel,
      tenant_id: tenant,
      owner_plan: "essential",
      faixa: "media_estadia",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.12,
      comissao_valor: 768,
      qtd_ocupantes: 1,
      garantia: "caucao",
      status: "ativo",
      assinado_proprietario_em: t,
      assinado_inquilino_em: t,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eB } = await adm().from("contrato_blocos").insert({ contrato_id: c!.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eB) throw eB;
  return c!.id as string;
}

test.describe("T610 — E190 parte 2: 'Hoje' no Início do proprietário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.vazio = await criarConta(vazio, senha);
    ids.entra = await criarConta(entra, senha);
    ids.sai = await criarConta(sai, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.vazio, ids.entra, ids.sai]);
    ids.imA = await criarImovelPronto(ids.dono, `Studio Aurora t610 ${sufixo}`, { ativo: true });
    ids.imB = await criarImovelPronto(ids.dono, `Loft Bela t610 ${sufixo}`, { ativo: true });
    ids.imVazio = await criarImovelPronto(ids.vazio, `Studio Calmo t610 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ checkin_after: "14:00", checkout_before: "11:00" }).in("id", [ids.imA, ids.imB]);
    if (error) throw error;
    // O nome do morador aparece depois do aceite (a mesma regra da Agenda).
    await criarLead(ids.dono, ids.entra, ids.imA, true);
    await criarLead(ids.dono, ids.sai, ids.imB, true);
    ids.cEntra = await contrato(ids.imA, ids.entra, dia(0), dia(59));
    ids.cSai = await contrato(ids.imB, ids.sai, dia(-59), dia(0));
    // O dono "vazio" tem contrato, mas nada HOJE: a seção não aparece.
    ids.cFuturo = await contrato(ids.imVazio, ids.entra, dia(70), dia(129));
  });
  test.afterAll(async () => {
    const cids = [ids.cEntra, ids.cSai, ids.cFuturo].filter(Boolean);
    if (cids.length) {
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await adm().from("leads").delete().in("owner_id", [ids.dono, ids.vazio].filter(Boolean));
    await apagarContas([ids.dono, ids.vazio, ids.entra, ids.sai]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — quem entra e quem sai hoje, com nome, imóvel, horário e link da estadia`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const secao = page.getByTestId("inicio-dono-hoje");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      const cartoes = secao.getByTestId("inicio-dono-hoje-cartao");
      await expect(cartoes).toHaveCount(2);

      const e = cartoes.nth(0);
      await expect(e).toHaveAttribute("data-tipo", "entrada");
      await expect(e).toContainText("Entra hoje · a partir das 14:00");
      await expect(e.getByTestId("inicio-dono-hoje-nome")).toHaveText("Iara");
      await expect(e).toContainText(`Studio Aurora t610 ${sufixo}`);
      await expect(e).toHaveAttribute("href", `/dashboard/estadia/${ids.cEntra}`);

      const s = cartoes.nth(1);
      await expect(s).toHaveAttribute("data-tipo", "saida");
      await expect(s).toContainText("Sai hoje · até as 11:00");
      await expect(s.getByTestId("inicio-dono-hoje-nome")).toHaveText("Bruno");
      await expect(s).toContainText(`Loft Bela t610 ${sufixo}`);
      await expect(s).toHaveAttribute("href", `/dashboard/estadia/${ids.cSai}`);

      await expect(secao).not.toContainText(/check-?in|check-?out/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await secao.screenshot({ path: `${SAIDA}/t610-hoje-${largura}.png` });
      await page.screenshot({ path: `${SAIDA}/t610-inicio-${largura}.png`, fullPage: true });

      await e.click();
      await page.waitForURL(new RegExp(`/dashboard/estadia/${ids.cEntra}`), { timeout: 30_000 });
      await expect(page.locator("main").first()).toBeVisible();
      await page.context().close();
    });
  }

  test("1280 px — sem nada hoje, a seção não aparece (nada de caixa vazia)", async ({ browser }) => {
    const page = await entrar(browser, vazio.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("inicio-dono")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("inicio-dono-hoje")).toHaveCount(0);
    await page.context().close();
  });
});
