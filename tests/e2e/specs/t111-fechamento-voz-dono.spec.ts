import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T111 — Fechamento do proprietário não fala com o inquilino (ordem 2bf88730, achado Moacir #596 / F42).
 * Dono logado abre o Fechamento a 390 e 1280 px: nenhuma frase em 2ª pessoa do inquilino, sem "aluguel × meses",
 * e sem rolagem lateral.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.voz.${sufixo}@lab.vivanomads.test`, nome: "Dora Voz", role: "owner" as const };
const inq = { email: `inq.voz.${sufixo}@lab.vivanomads.test`, nome: "Ivo Voz", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

const FRASES_DO_INQUILINO = [
  "Como você quer pagar?",
  "Por quanto tempo você quer ficar?",
  "Para começar você paga só",
  "Quanto você paga",
  "Volta para você?",
  "Se você quebrar algo",
  "sempre com seu aceite",
  "você responde pelos danos",
  "A comissão é cobrada",
  "aluguel × meses",
];

test.describe("T111 — Fechamento com voz do proprietário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.imovel = await criarImovelPronto(ids.dono, `Voz do dono ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("contratos").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280]) {
    test(`a ${largura} px nenhuma frase fala com o inquilino em 2ª pessoa`, async ({ browser }) => {
      test.setTimeout(120_000);
      const pagina = await entrar(browser, dono.email, senha);
      await pagina.setViewportSize({ width: largura, height: 900 });
      await pagina.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
      await expect(pagina.getByTestId("inicio-estadia")).toBeVisible({ timeout: 15_000 });
      const texto = await pagina.locator("body").innerText();
      for (const frase of FRASES_DO_INQUILINO) expect(texto, `ainda tem: ${frase}`).not.toContain(frase);
      expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await pagina.context().close();
    });
  }
});
