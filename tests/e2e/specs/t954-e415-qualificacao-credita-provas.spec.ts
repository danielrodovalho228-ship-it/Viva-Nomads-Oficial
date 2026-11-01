import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T954 — E415 (#2063): a prova feita na hora não creditava o item na Qualificação — o resultado calculava o nível e a
  lista "Para subir a Conforto" só pelas respostas, e um item já fotografado na hora seguia como "falta". Agora, com o
  rascunho salvo (botão "Qualificação" do rascunho: ?draft=…&qualificacao=1), o resultado usa o mesmo motor do Passo 5
  com as provas do imóvel. Pela tela real, 1280 e 390:
    • rascunho COM a prova de "2 travesseiros por pessoa" (foto na hora, origem câmera): o resultado lista o item em
      "Já provado com foto na hora" e ele NÃO aparece em "Para subir a …";
    • rascunho SEM prova (as mesmas respostas): nenhum "Já provado" e o item segue na lista do que falta.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t954.${sufixo}@lab.vivanomads.test`, nome: "Quel Qualifica", role: "owner" as const };
const ids: Record<string, string> = {};
const ITEM = { chave: "sono_dois_travesseiros", rotulo: "2 travesseiros por pessoa" };

async function responderTudo(p: Page) {
  const tela = async (n: number) => expect(p.getByTestId("qualificacao-progresso")).toHaveText(`Qualificação · ${n} de 5`, { timeout: 30_000 });
  await tela(1);
  await p.getByTestId("qualificacao-opcao-cama-sim").click();
  await p.getByTestId("qualificacao-opcao-apoio-sim").click();
  await p.getByTestId("qualificacao-opcao-ventilacao-ar").click();
  await p.getByTestId("qualificacao-continuar").click();
  await tela(2);
  await p.getByTestId("qualificacao-opcao-cozinha-completa").click();
  await p.getByTestId("qualificacao-opcao-roupa-todos").click();
  await p.getByTestId("qualificacao-continuar").click();
  await tela(3);
  await p.getByTestId("qualificacao-opcao-agua-sim").click();
  await p.getByTestId("qualificacao-opcao-lavanderia-imovel").click();
  await p.getByTestId("qualificacao-continuar").click();
  await tela(4);
  for (const t of ["luz", "fechadura", "limpa", "mobilia"]) await p.getByTestId(`qualificacao-opcao-${t}-sim`).click();
  await p.getByTestId("qualificacao-continuar").click();
  await tela(5);
  await p.getByTestId("qualificacao-mbps").fill("300");
  await p.getByTestId("qualificacao-continuar").click();
  await expect(p.getByTestId("qualificacao-resultado")).toBeVisible({ timeout: 30_000 });
}

test.describe("T954 — E415: o resultado da Qualificação credita a prova feita na hora", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [1280, 390]) {
      ids[`com${w}`] = await prepararRascunho(ids.dono, `Studio Provado ${w} ${sufixo}`);
      ids[`sem${w}`] = await prepararRascunho(ids.dono, `Studio Sem Prova ${w} ${sufixo}`);
      const { error } = await adm().from("nivel_itens").insert({
        property_id: ids[`com${w}`],
        chave: ITEM.chave,
        declarado: true,
        foto_path: `${ids.dono}/${randomUUID()}.webp`,
        foto_status: "pendente",
        foto_origem: "camera",
        foto_capturada_em: new Date(Date.now() - 60_000).toISOString(), // prova de câmera: com a hora da captura (nivel_itens_camera_sem_prazo)
        declarado_por: ids.dono,
        declarado_em: new Date().toISOString(),
      });
      if (error) throw error;
    }
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("nivel_itens").delete().in("property_id", Object.values(ids).filter((v) => v !== ids.dono));
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`${w} px — com a prova o item sai do "falta" e vai a "Já provado"; sem a prova, segue no "falta"`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      await p.goto(`/dashboard/imoveis/novo?draft=${ids[`com${w}`]}&qualificacao=1`, { waitUntil: "domcontentloaded" });
      await responderTudo(p);
      const provados = p.getByTestId("qualificacao-provados");
      await expect(provados).toBeVisible({ timeout: 30_000 });
      await expect(provados).toContainText("Já provado com foto na hora");
      await expect(provados).toContainText(ITEM.rotulo);
      const paraSubir = p.getByTestId("qualificacao-para-subir");
      if (await paraSubir.count()) await expect(paraSubir).not.toContainText(ITEM.rotulo);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await p.goto(`/dashboard/imoveis/novo?draft=${ids[`sem${w}`]}&qualificacao=1`, { waitUntil: "domcontentloaded" });
      await responderTudo(p);
      await expect(p.getByTestId("qualificacao-nivel")).toBeVisible();
      await p.waitForTimeout(1_500); // as provas do rascunho chegam depois do resultado
      await expect(p.getByTestId("qualificacao-provados")).toHaveCount(0);
      await expect(p.getByTestId("qualificacao-para-subir")).toContainText(ITEM.rotulo);
      await p.context().close();
    });
  }
});
