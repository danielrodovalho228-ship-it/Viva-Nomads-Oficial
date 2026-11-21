import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1565 — E219 (a parte da Pista C: só a PROVA de laboratório; a tela é da Pista A): os cartões "Hoje" do Início do proprietário não
  estouram a largura no celular em nenhuma variação — 4 cartões (2 entram, 2 saem), com e sem horário de check-in/check-out, nome de imóvel
  e de morador sem ponto de quebra, a 320, 360 e 390 px; e a 1280 px o desenho segue em colunas. Complementa a t612 (2 cartões, 360/390/1280).
  Cada cartão: dentro da tela, com foto (ou iniciais), nome, imóvel e rótulo à vista; a página não rola para o lado. Só no laboratório.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1565.${sufixo}@lab.vivanomads.test`, nome: "Odete Larga", role: "owner" as const };
const entra = { email: `entra.t1565.${sufixo}@lab.vivanomads.test`, nome: "Maximiliana-Constantina-Albuquerque-de-Vasconcelos", role: "tenant" as const };
const sai = { email: `sai.t1565.${sufixo}@lab.vivanomads.test`, nome: "Bartolomeu-Fernandes-Vasconcelos-Albuquerque", role: "tenant" as const };
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

test.describe("T1565 — E219: 'Hoje' com 4 cartões, com e sem horário, sem estouro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  const contratos: string[] = [];

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.entra = await criarConta(entra, senha);
    ids.sai = await criarConta(sai, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.entra, ids.sai]);
    // A, B: com horário. C, D: sem horário (o cartão não inventa um).
    for (const [k, comHorario] of [["A", true], ["B", true], ["C", false], ["D", false]] as const) {
      ids[`im${k}`] = await criarImovelPronto(ids.dono, `${LONGO}-${k}`, { ativo: true });
      if (comHorario) {
        const { error } = await adm().from("properties").update({ checkin_after: "14:00", checkout_before: "11:00" }).eq("id", ids[`im${k}`]);
        if (error) throw error;
      }
    }
    for (const [k, quem, ini, fim] of [["A", "entra", dia(0), dia(59)], ["C", "entra", dia(0), dia(59)], ["B", "sai", dia(-59), dia(0)], ["D", "sai", dia(-59), dia(0)]] as const) {
      await criarLead(ids.dono, ids[quem], ids[`im${k}`], true);
      contratos.push(await contrato(ids[`im${k}`], ids[quem], ini, fim));
    }
  });
  test.afterAll(async () => {
    if (contratos.length) {
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.entra, ids.sai]);
  });

  for (const largura of [320, 360, 390, 1280] as const) {
    test(`${largura} px — 4 cartões dentro da tela; horário só onde existe; sem rolagem lateral`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 1280 ? 900 : 800 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const secao = page.getByTestId("inicio-dono-hoje");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      await expect(secao.getByTestId("inicio-dono-hoje-cartao")).toHaveCount(4);
      await expect(secao).toContainText("a partir das 14:00");
      await expect(secao).toContainText("até as 11:00");
      // sem horário cadastrado: nenhum cartão inventa um (só 2 horários no total)
      expect((await secao.innerText()).match(/a partir das|até as/g)?.length ?? 0).toBe(2);

      const m = await medir(page);
      console.log(`t1565 ${largura}`, JSON.stringify(m));
      for (const c of m) expect(c, JSON.stringify(c)).toEqual({ passa: 0, foto: true, nome: true, imovel: true, rotulo: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "rolagem lateral da página").toBeLessThanOrEqual(0);
      await secao.screenshot({ path: `${SAIDA}/t1565-hoje-${largura}.png` });
      await page.context().close();
    });
  }
});
