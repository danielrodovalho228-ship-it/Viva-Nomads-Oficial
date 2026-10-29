import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T612 — E219 (L-72 do laboratório): a seção "Hoje" do Início do proprietário não estoura a largura no celular. Nome
  de imóvel e de morador longos, sem espaço para quebrar: a 360 e 390 px cada cartão cabe na tela, com foto (ou
  iniciais), nome, imóvel e horário à vista; a 1280 px o desenho continua em 2 colunas, do mesmo jeito.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t612.${sufixo}@lab.vivanomads.test`, nome: "Odete Larga", role: "owner" as const };
const entra = { email: `entra.t612.${sufixo}@lab.vivanomads.test`, nome: "Maximiliana-Constantina Albuquerque", role: "tenant" as const };
const sai = { email: `sai.t612.${sufixo}@lab.vivanomads.test`, nome: "Bartolomeu-Fernandes Vasconcelos", role: "tenant" as const };
const ids: Record<string, string> = {};
const LONGO = `Apartamento-Mobiliado-Residencial-Jardim-Botanico-Torre-Norte-Cobertura-${sufixo}`;
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

/** Quanto cada cartão passa da tela (px) e se o essencial está à vista dentro dele. */
const medir = (p: Page) =>
  p.getByTestId("inicio-dono-hoje-cartao").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const dentro = (sel: string) => {
        const f = el.querySelector(sel);
        if (!f) return false;
        const q = f.getBoundingClientRect();
        return q.width > 0 && q.left >= r.left - 1 && q.right <= r.right + 1;
      };
      return {
        passa: Math.round(Math.max(0, r.right - document.documentElement.clientWidth, -r.left)),
        foto: dentro("[data-testid=inicio-dono-hoje-cartao] > :first-child"),
        nome: dentro("[data-testid=inicio-dono-hoje-nome]"),
        imovel: dentro("[data-testid=inicio-dono-hoje-imovel]"),
        rotulo: dentro("[data-testid=inicio-dono-hoje-rotulo]"),
      };
    }),
  );

test.describe("T612 — E219: 'Hoje' sem estouro no celular", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.entra = await criarConta(entra, senha);
    ids.sai = await criarConta(sai, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.entra, ids.sai]);
    ids.imA = await criarImovelPronto(ids.dono, `${LONGO}-A`, { ativo: true });
    ids.imB = await criarImovelPronto(ids.dono, `${LONGO}-B`, { ativo: true });
    const { error } = await adm().from("properties").update({ checkin_after: "14:00", checkout_before: "11:00" }).in("id", [ids.imA, ids.imB]);
    if (error) throw error;
    await criarLead(ids.dono, ids.entra, ids.imA, true);
    await criarLead(ids.dono, ids.sai, ids.imB, true);
    ids.cEntra = await contrato(ids.imA, ids.entra, dia(0), dia(59));
    ids.cSai = await contrato(ids.imB, ids.sai, dia(-59), dia(0));
  });
  test.afterAll(async () => {
    const cids = [ids.cEntra, ids.cSai].filter(Boolean);
    if (cids.length) {
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.entra, ids.sai]);
  });

  for (const largura of [360, 390, 1280] as const) {
    test(`${largura} px — cartões dentro da tela, com foto, nome, imóvel e horário`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 1280 ? 900 : 800 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const secao = page.getByTestId("inicio-dono-hoje");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      await expect(secao.getByTestId("inicio-dono-hoje-cartao")).toHaveCount(2);
      await expect(secao).toContainText("a partir das 14:00");
      await expect(secao).toContainText("até as 11:00");

      const m = await medir(page);
      console.log(`t612 ${largura}`, JSON.stringify(m));
      for (const c of m) expect(c, JSON.stringify(c)).toEqual({ passa: 0, foto: true, nome: true, imovel: true, rotulo: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      if (largura === 1280) {
        // Desktop: as 2 colunas lado a lado continuam.
        const tops = await secao.getByTestId("inicio-dono-hoje-cartao").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
        expect(tops[0]).toBe(tops[1]);
      }
      await secao.screenshot({ path: `${SAIDA}/t612-hoje-${largura}.png` });
      await page.screenshot({ path: `${SAIDA}/t612-inicio-${largura}.png` });
      await page.context().close();
    });
  }
});
