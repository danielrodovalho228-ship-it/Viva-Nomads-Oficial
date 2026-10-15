import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { hojeBR } from "../../../src/lib/utils";
import { addDiasISO } from "../../../src/lib/contrato-blocos";

/**
 * T89 — Fechamento: "Data de início da estadia" (ordem 02d4c903 / c4530769, F37).
 * Campo obrigatório na etapa 1, sem data passada, e a data aparece no resumo; a 390 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.ini.${sufixo}@lab.vivanomads.test`, nome: "Dora Início", role: "owner" as const };
const inq = { email: `inq.ini.${sufixo}@lab.vivanomads.test`, nome: "Ivo Início", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T89 — data de início no Fechamento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.imovel = await criarImovelPronto(ids.dono, `Início da estadia ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("contratos").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o campo nasce com hoje, não aceita data passada e aceita data futura", async ({ browser }) => {
    test.setTimeout(120_000);
    const hoje = hojeBR();
    const futura = addDiasISO(hoje, 20);
    const pagina = await entrar(browser, dono.email, senha);
    await pagina.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    const campo = pagina.getByTestId("inicio-estadia");
    await expect(campo).toBeVisible({ timeout: 15_000 });
    await expect(campo).toHaveValue(hoje);
    await expect(campo).toHaveAttribute("min", hoje);

    await campo.fill(addDiasISO(hoje, -3));
    await expect(pagina.getByTestId("inicio-estadia-erro")).toContainText(/passado/i);
    await expect(pagina.getByRole("button", { name: /continuar/i })).toBeDisabled();

    await campo.fill(futura);
    await expect(pagina.getByTestId("inicio-estadia-erro")).toHaveCount(0);
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pagina.context().close();
  });
});
