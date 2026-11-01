import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";

/**
 * T939 — #2036 (auditoria de erros e estados vazios, achado 44): em carregarEstadia, uma leitura secundária que falha
 * (conferência, ocupantes, nota, aditivos, encerramento, recibos, perfil) agora LANÇA — a tela mostra "Tentar de novo"
 * (dashboard/error.tsx) em vez de sumir com o pedido de encerramento ou os ocupantes.
 * O lado que a tela real consegue provar: com TODAS essas leituras preenchidas, a guarda nova não dispara à toa.
 * Pela tela, 390 e 1280, dono e morador:
 *   • a página da estadia abre (nada de painel-erro) e mostra o que vem das leituras secundárias: o ocupante (contrato_ocupantes),
 *     o pedido de encerramento (contrato_encerramento_pedidos), a nota privada de cada um (contrato_notas, só para o autor)
 *     e o nome do morador (profiles);
 *   • as subpáginas que usam carregarEstadia (ocupantes, mensagens, encerrar) abrem sem painel-erro, sem rolagem lateral.
 * A falha da leitura em si fica com o teste de unidade do #2036 (estadia-falha.test.ts): as leituras são do servidor, com
 * a chave de serviço, e os dados não conseguem quebrá-las (conferencias tem unique (contrato_id, tipo), notas tem
 * chave (contrato_id, autor_id), o encerramento lê com limit(1)).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t939.${sufixo}@lab.vivanomads.test`, nome: "Elsa Estadia", role: "owner" as const };
const morador = { email: `mor.t939.${sufixo}@lab.vivanomads.test`, nome: "Ênio Estadia", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; contrato?: string } = {};
const OCUPANTE = `Olga Ocupante ${sufixo}`;
const NOTA = { dono: `Nota do dono t939 ${sufixo}`, morador: `Nota do morador t939 ${sufixo}` };
const LARGURAS = [390, 1280] as const;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T939 — #2036 achado 44: estadia com as leituras secundárias cheias abre sem falso erro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio estadia ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.morador,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 2,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono);
    const ins = await Promise.all([
      adm().from("contrato_ocupantes").insert({ contrato_id: ids.contrato, nome: OCUPANTE, documento: "123.456.789-09", parentesco_ou_relacao: "Irmã", criado_por: ids.morador }),
      adm().from("contrato_notas").insert([
        { contrato_id: ids.contrato, autor_id: ids.dono, texto: NOTA.dono },
        { contrato_id: ids.contrato, autor_id: ids.morador, texto: NOTA.morador },
      ]),
      adm().from("contrato_encerramento_pedidos").insert({ contrato_id: ids.contrato, pedido_por: ids.morador, papel: "inquilino", motivo: "acordo_entre_partes" }),
    ]);
    for (const r of ins) if (r.error) throw r.error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.contrato) {
      for (const t of ["contrato_encerramento_pedidos", "contrato_notas", "contrato_ocupantes", "pagamentos_bloco", "contrato_eventos", "contrato_blocos"])
        await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const quem of ["dono", "morador"] as const) {
    test(`${quem}: página da estadia e subpáginas, a 390 e 1280`, async ({ browser }) => {
      test.setTimeout(180_000);
      const conta = quem === "dono" ? dono : morador;
      const page = await entrar(browser, conta.email, senha);
      for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("pagina-estadia")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("painel-erro")).toHaveCount(0);
        // Cada leitura secundária aparece na tela.
        await expect(page.getByTestId("estadia-ocupantes")).toContainText(OCUPANTE);
        await expect(page.getByTestId("estadia-encerramento")).toBeVisible();
        await expect(page.getByTestId("estadia-moradores")).toContainText(morador.nome);
        const nota = page.getByTestId("nota-texto");
        await expect(nota).toHaveValue(quem === "dono" ? NOTA.dono : NOTA.morador);
        await expect(nota).not.toHaveValue(quem === "dono" ? NOTA.morador : NOTA.dono);
        await semRolagemLateral(page);

        for (const sub of ["ocupantes", "mensagens", "encerrar"]) {
          const r = await page.goto(`/dashboard/estadia/${ids.contrato}/${sub}`, { waitUntil: "domcontentloaded" });
          expect(r?.status() ?? 0, `/${sub} responde`).toBeLessThan(500);
          await expect(page.locator("main, body").first()).toBeVisible();
          await page.waitForLoadState("load");
          await expect(page.getByTestId("painel-erro"), `/${sub} sem painel-erro a ${largura}`).toHaveCount(0);
          await semRolagemLateral(page);
        }
      }
      await page.context().close();
    });
  }
});
