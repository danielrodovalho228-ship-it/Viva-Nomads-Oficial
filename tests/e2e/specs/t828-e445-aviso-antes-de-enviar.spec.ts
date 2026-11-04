import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T828 — E445 item 2 (Relay 57, aprovado pelo Daniel): texto com contato/link → o aviso e a PRÉVIA MASCARADA aparecem
  ANTES do envio; "Editar" volta ao campo sem gravar nada; "Enviar mesmo assim" grava a versão mascarada (o servidor
  continua mascarando — o contato nunca é liberado). Texto sem contato segue direto. 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t828.${sufixo}@lab.vivanomads.test`, nome: "Dora Avisoenvio", role: "owner" as const };
const inq = { email: `inq.t828.${sufixo}@lab.vivanomads.test`, nome: "Iara Avisoenvio", role: "tenant" as const };
const ids: Record<string, string> = {};
const MASK = "[contato protegido]";

async function gravadasDoInq(): Promise<string[]> {
  const { data } = await adm().from("messages").select("body").eq("sender_id", ids.inq).eq("property_id", ids.imovel).order("created_at");
  return (data ?? []).map((m) => m.body as string);
}

async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const conversa = page.getByRole("button", { name: /Studio do aviso/ }).first();
  await expect(conversa).toBeVisible({ timeout: 30_000 });
  await conversa.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}

test.describe("T828 — E445 item 2: aviso antes de enviar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do aviso ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Olá! Pode perguntar por aqui.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`${w}: Editar não grava; Enviar mesmo assim grava mascarado; texto limpo vai direto`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(p);
      const campo = p.getByTestId("mensagem-campo");
      const antes = (await gravadasDoInq()).length;

      // 1. Contato no texto: aviso + prévia mascarada, nada gravado.
      const comContato = `Me chama no (34) 99876-5432 ou dora.${w}@exemplo.com ${sufixo}`;
      await campo.fill(comContato);
      await p.getByRole("button", { name: "Enviar", exact: true }).click();
      const aviso = p.getByTestId("aviso-antes-de-enviar");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText("telefones e e-mails são protegidos");
      await expect(p.getByTestId("aviso-previa")).toContainText(MASK);
      await expect(p.getByTestId("aviso-previa")).not.toContainText("99876");
      // E483: o "(" do DDD sai junto com o número — a prévia não mostra parêntese aberto sem fechar.
      await expect(p.getByTestId("aviso-previa")).toContainText(`Me chama no ${MASK} ou`);
      await expect(p.getByTestId("aviso-previa")).not.toContainText(`(${MASK}`);
      // Um só botão preenchido na tela: os dois do aviso são de contorno.
      for (const nome of ["Editar", "Enviar mesmo assim"]) {
        const fundo = await p.getByRole("button", { name: nome }).evaluate((b) => getComputedStyle(b).backgroundColor);
        expect(fundo, nome).toBe("rgb(255, 255, 255)");
      }
      const box = await aviso.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(w);
      expect(await p.evaluate((largura) => document.documentElement.scrollWidth - largura, w)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `tests/laboratorio/saida/t828-aviso-${w}.png` });

      // Enter de novo NÃO confirma (só o botão envia).
      await campo.press("Enter");
      await p.waitForTimeout(1_500);
      expect((await gravadasDoInq()).length).toBe(antes);

      // 2. Editar: fecha o aviso, foco no campo, texto mantido, nada gravado.
      await p.getByRole("button", { name: "Editar" }).click();
      await expect(aviso).toHaveCount(0);
      await expect(campo).toBeFocused();
      await expect(campo).toHaveValue(comContato);
      expect((await gravadasDoInq()).length).toBe(antes);

      // 3. Enviar mesmo assim: grava a versão mascarada; o contato não chega ao banco.
      await p.getByRole("button", { name: "Enviar", exact: true }).click();
      await p.getByRole("button", { name: "Enviar mesmo assim" }).click();
      await expect(aviso).toHaveCount(0);
      await expect(campo).toHaveValue("");
      await expect.poll(async () => (await gravadasDoInq()).length, { timeout: 20_000 }).toBe(antes + 1);
      const gravada = (await gravadasDoInq()).at(-1)!;
      expect(gravada).toContain(MASK);
      expect(gravada).not.toMatch(/99876|@exemplo/);

      // 4. Texto sem contato: vai direto, sem aviso.
      await campo.fill(`Posso visitar sábado? ${w} ${sufixo}`);
      await p.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect(aviso).toHaveCount(0);
      await expect.poll(async () => (await gravadasDoInq()).length, { timeout: 20_000 }).toBe(antes + 2);
      await p.context().close();
    });
  }
});
