import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T25 — Tela do chamado: "Resumo e ações" sozinho ao abrir + sugestão já na
 * caixa Responder, com o caso do VN-000101 (proprietário perguntando sobre
 * Caução e seguros). No laboratório não há IA: resumo por regras e sugestão só
 * com textos oficiais (marcada como simulada).
 */
const noLaboratorio = process.env.INTEGRACOES_SIMULADAS === "on";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PERGUNTA = "Sou proprietário e quero entender como funciona o Caução. Vocês oferecem seguro para o imóvel?";

test.describe("T25 — Resumo e ações + sugestão pronta", () => {
  test.skip(!noLaboratorio || !URL || !SERVICE, "Só no laboratório (banco local + service role).");
  const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

  test("caso VN-000101: cartão com quem é, ações (seguros → Thiago) e prazo; sugestão honesta enviada com 1 clique", async ({ browser }) => {
    // Proprietário logado abre pelo "Falar com uma pessoa" do chat da /ajuda (como o VN-000101).
    const dono = await browser.newContext({ storageState: authFile("proprietario") });
    const p = await dono.newPage();
    await p.goto("/ajuda", { waitUntil: "networkidle" });
    const bloco = p.getByTestId("viva-chat-bloco");
    await bloco.getByRole("button", { name: /Falar com uma pessoa/i }).click();
    await bloco.getByLabel("Pedido para a equipe").fill(`${PERGUNTA} (${Date.now()})`);
    await bloco.getByRole("button", { name: "Abrir chamado" }).click();
    const ok = p.getByTestId("chamado-aberto-chat");
    await expect(ok).toBeVisible({ timeout: 20_000 });
    const numero = (await ok.innerText()).match(/VN-\d+/)![0];
    await dono.close();
    const { data: c } = await adm().from("chamados").select("id").eq("numero_publico", numero).single();

    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto(`/admin/atendimento/${c!.id}`, { waitUntil: "networkidle" });

    const card = page.getByTestId("resumo-acoes");
    await expect(card.getByTestId("resumo-texto")).toContainText("Caução", { timeout: 20_000 });
    await expect(card.getByTestId("resumo-quem")).toContainText("Proprietário cadastrado");
    await expect(card.getByTestId("resumo-acoes-lista")).toContainText("Responder sobre seguros");
    await expect(card.getByTestId("resumo-acoes-lista")).toContainText("Thiago");
    await expect(card).toContainText("Prazo");

    // Sugestão já na caixa: honesta sobre seguros e com o pré-lançamento.
    const caixa = page.locator("textarea").last();
    await expect(caixa).toHaveValue(/ainda NÃO oferece seguro/);
    await expect(caixa).toHaveValue(/conversando com seguradoras/);
    await expect(caixa).toHaveValue(/2027/);

    // O resumo ficou guardado: reabrir não gera outro.
    const contar = async () => ((await adm().from("chamado_mensagens").select("id").eq("chamado_id", c!.id).like("corpo", "[resumo-e-acoes]%")).data ?? []).length;
    expect(await contar()).toBe(1);
    await page.reload({ waitUntil: "networkidle" });
    await expect(card.getByTestId("resumo-texto")).toBeVisible();
    expect(await contar()).toBe(1);
    // "Atualizar resumo" refaz.
    await card.getByRole("button", { name: "Atualizar resumo" }).click();
    await expect.poll(contar).toBe(2);

    // "Gerar outra" cria uma nova sugestão (guardada como nota).
    const notas = async () => ((await adm().from("chamado_mensagens").select("id").eq("chamado_id", c!.id).eq("interno", true).like("corpo", "%Resposta sugerida:%")).data ?? []).length;
    const antes = await notas();
    await page.getByTestId("gerar-outra").click();
    await expect.poll(notas).toBe(antes + 1);

    // Enviar como está → resposta da equipe; histórico registra que foi a sugestão da Viva.
    await page.getByTestId("enviar-sugestao").click();
    await expect(page.locator("body")).toContainText("enviou a sugestão da Viva como está", { timeout: 15_000 });
    const { data: ms } = await adm().from("chamado_mensagens").select("autor, interno, corpo").eq("chamado_id", c!.id).eq("autor", "admin").eq("interno", false);
    expect(ms?.[0]?.corpo).toMatch(/ainda NÃO oferece seguro/);
    await ctx.close();
  });
});
