// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T328 — L1-1 (D-V3): "Enviar documento" não trava em silêncio (390 px). E104: o documento mora no cartão "Antes de
 * publicar" da Revisão; o endereço, no Passo 3 — faltando o número, o toque leva ao Passo 3 com o foco no campo.
 *   1. rascunho retomado com o endereço já GRAVADO (CEP com máscara no rascunho, rua e número só na linha exata) →
 *      o toque abre o arquivo e o documento vai para conferência, sem redigitar nada;
 *   2. rascunho sem número → o toque diz "Falta: número", leva o foco ao campo e o marca; com o número, envia e o
 *      documento fica "Em revisão" (status em conferência no banco).
 */
const SAIDA = "tests/laboratorio/saida";

function docLab(): Buffer {
  return Buffer.concat([Buffer.from(`%PDF-1.4\n% documento ficticio do laboratorio VIVA-LAB-DOC:ok ${randomBytes(8).toString("hex")}\n`), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);
}

test.describe("T328 — enviar documento sem trava silenciosa (L1-1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t328.${sufixo}@lab.vivanomads.test`, nome: "Rita Rascunho", role: "owner" as const };
  const ids: Record<string, string> = {};

  async function rascunho(titulo: string, draft: Record<string, unknown>, exato?: string): Promise<string> {
    const { data, error } = await adm()
      .from("properties")
      .insert({ owner_id: ids.dono, title: titulo, city: "Uberlândia", state: "MG", address: "Centro", status: "draft", monthly_price: 0, exact_address: exato ?? null, draft_data: { title: titulo, city: "Uberlândia", uf: "MG", neighborhood: "Centro", step: 0, ...draft } })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  const statusDoDocumento = async (id: string) =>
    ((await adm().from("qualification_checklists").select("document_status").eq("property_id", id).order("created_at", { ascending: false }).limit(1)).data?.[0]?.document_status as string | undefined) ?? null;

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    // 1: o rascunho guardou só o CEP (com máscara); rua e número estão na linha exata gravada do imóvel.
    ids.salvo = await rascunho(`Endereço salvo t328 ${sufixo}`, { cep: "38400-100" }, "Rua do Laboratório, 102, apto 3");
    // 2: rua sem número.
    ids.semNumero = await rascunho(`Sem número t328 ${sufixo}`, { cep: "38400-100", street: "Rua do Laboratório", numero: "" });
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. rascunho retomado com endereço salvo: envia sem redigitar", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.salvo}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    const botao = p.getByTestId("documento-enviar");
    await expect(botao).toBeVisible({ timeout: 20_000 });
    await expect(botao).toBeEnabled();
    // Alvo de toque de pelo menos 44 px.
    expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Espera o endereço gravado chegar (a frase do que falta some) e toca: abre o arquivo, sem "Falta".
    await expect(p.getByTestId("documento-vinculo")).not.toContainText("Para enviar, o endereço precisa", { timeout: 20_000 });
    const [seletor] = await Promise.all([p.waitForEvent("filechooser"), botao.click()]);
    await expect(p.getByTestId("documento-falta")).toHaveCount(0);
    await seletor.setFiles({ name: "conta-de-luz.pdf", mimeType: "application/pdf", buffer: docLab() });
    await expect(p.getByTestId("documento-estado")).toHaveAttribute("data-estado", "revisao", { timeout: 30_000 });
    await expect.poll(() => statusDoDocumento(ids.salvo), { timeout: 20_000 }).toBe("pending");
    await p.screenshot({ path: `${SAIDA}/t328-endereco-salvo-390.png`, fullPage: true });
    await p.context().close();
  });

  test("2. sem número: 'Falta: número', foco e marca no campo; com o número, envia para conferência", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.semNumero}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    const botao = p.getByTestId("documento-enviar");
    await expect(botao).toBeEnabled({ timeout: 20_000 });
    let abriu = false;
    p.on("filechooser", () => (abriu = true));
    await botao.click();
    // E104: o número mora no Passo 3 — o toque leva até lá, com o foco e a marca no campo.
    await expect(p.getByTestId("passo-texto")).toHaveText("Passo 3 de 10", { timeout: 15_000 });
    const numero = p.getByTestId("cadastro-numero");
    await expect(numero).toBeFocused();
    await expect(numero).toHaveAttribute("aria-invalid", "true");
    await expect(p.getByText("Informe o número (ou s/n) para enviar o documento.")).toBeVisible();
    await expect(p.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório");
    // O campo fica na tela (acima de onde o teclado abre), não escondido.
    const caixa = (await numero.boundingBox())!;
    expect(caixa.y).toBeGreaterThanOrEqual(0);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(844 * 0.6);
    expect(abriu).toBe(false);
    await p.screenshot({ path: `${SAIDA}/t328-falta-numero-390.png`, fullPage: false });

    await numero.fill("102");
    await expect(numero).not.toHaveAttribute("aria-invalid", "true");
    // O rascunho grava sozinho; de volta à Revisão, o toque abre o arquivo.
    await expect
      .poll(async () => JSON.stringify((await adm().from("properties").select("draft_data").eq("id", ids.semNumero).single()).data?.draft_data ?? {}), { timeout: 30_000 })
      .toContain(`"numero":"102"`);
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.semNumero}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("documento-vinculo")).not.toContainText("Para enviar, o endereço precisa", { timeout: 20_000 });
    const [seletor] = await Promise.all([p.waitForEvent("filechooser"), p.getByTestId("documento-enviar").click()]);
    await seletor.setFiles({ name: "conta-de-luz.pdf", mimeType: "application/pdf", buffer: docLab() });
    await expect(p.getByTestId("documento-estado")).toHaveAttribute("data-estado", "revisao", { timeout: 30_000 });
    await expect.poll(() => statusDoDocumento(ids.semNumero), { timeout: 20_000 }).toBe("pending");
    await p.context().close();
  });
});
