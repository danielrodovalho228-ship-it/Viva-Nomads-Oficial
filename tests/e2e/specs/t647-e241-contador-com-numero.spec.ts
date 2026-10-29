import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T647 — E241 (conformidade do cadastro, item 8): no Passo 4 (Detalhes), com o campo vazio, o miolo de cada contador
  (Quartos, Banheiros, Área, Pessoas, Vagas) mostra um número — o mínimo, em cinza — como no mockup cadastro-imovel-04,
  e nunca fica em branco. O campo segue vazio para a validação (o número é só o que aparece). A 390 e 1280 px.
  Rodadas fora do lab completo (teto L-5): no lab-crítico do PR que toca a spec; 29/10, junto com o bloco 63 (t662).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t647.${sufixo}@lab.vivanomads.test`, nome: "Iara Contador", role: "owner" as const };
const ids: Record<string, string> = {};
const CONTADORES = ["cadastro-quartos", "cadastro-banheiros", "cadastro-area", "cadastro-capacidade", "cadastro-vagas"] as const;

test.describe("T647 — E241: contadores do Passo 4 sempre com número", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.r = await criarImovelPronto(ids.dono, `Rascunho t647 ${sufixo}`);
    // Os números do espaço ainda não preenchidos (como num rascunho que acabou de passar do Endereço).
    const { error } = await adm().from("properties").update({ bedrooms: null, bathrooms: null, area_m2: null, max_guests: null, parking_spots: null }).eq("id", ids.r);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — campo vazio mostra o número, em cinza`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.r}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("cartao-numeros")).toBeVisible({ timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const lidos = await p.evaluate((tids) =>
        tids.map((t) => {
          const i = document.querySelector(`[data-testid="${t}"]`) as HTMLInputElement | null;
          return { t, valor: i?.value ?? null, mostra: i ? i.value || i.placeholder : null };
        }),
      [...CONTADORES]);
      console.log(`t647|${largura}|${JSON.stringify(lidos)}`);
      for (const l of lidos) expect(l.mostra ?? "", `${l.t}: o miolo mostra um número`).toMatch(/^\d+$/);
      // Pelo menos um continua vazio de verdade (o número é só o que aparece; a validação vê o vazio).
      expect(lidos.some((l) => l.valor === "")).toBe(true);
      await p.getByTestId("cartao-numeros").screenshot({ path: `${SAIDA}/t647-contadores-${largura}.png` });
      await p.context().close();
    });
  }
});
