import { test, expect, type Browser, type Page } from "@playwright/test";
import { textoDasPaginas } from "../../../src/lib/fiscal/pdf-texto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T260 — Documentos (Prompt 56), no laboratório:
 * pacote de provas baixado pela parte = PRV novo a cada geração, com número, emissão e "Confira em …/conferir com o
 * código …" no PDF → /conferir com esse código mostra o documento válido, sem valor e sem nome → o PDF baixado confere
 * no navegador e o PDF alterado não → número sozinho não confere nada → o contrato (legado) tem Registro nº →
 * documento de conta de teste responde "documento de teste". 390 e 1280 px, sem rolagem lateral.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t260.${sufixo}@lab.vivanomads.test`, nome: "Dalva Registro", role: "owner" as const };
const morador = { email: `mor.t260.${sufixo}@lab.vivanomads.test`, nome: "Moacir Registro", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string } = {};

const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function abrir(browser: Browser, email: string | null, largura = 1280): Promise<Page> {
  const page = email ? await entrar(browser, email, senha) : await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
/** Baixa o pacote como parte e devolve os bytes, o número PRV e o código impressos no rodapé. */
async function baixarPacote(page: Page): Promise<{ bytes: Uint8Array; numero: string; codigo: string; texto: string }> {
  const resp = await page.request.get(`/api/contrato/${ids.contrato}/provas`);
  expect(resp.status()).toBe(200);
  const bytes = new Uint8Array(await resp.body());
  const texto = (await textoDasPaginas(bytes)).join("\n").replace(/\s+/g, " ");
  const numero = /PRV-\d{4}-\d{6}/.exec(texto)?.[0] ?? "";
  const codigo = /conferir com o código ([0-9a-f]{32})/.exec(texto)?.[1] ?? "";
  return { bytes, numero, codigo, texto };
}

test.describe("T260 — Documentos: registro único e /conferir (Prompt 56)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do registro ${sufixo}`, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 640,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(10), fim: dia(69), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eb) throw eb;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("pacote de provas: PRV novo a cada geração, com número e código no PDF; o contrato legado ganha Registro nº", async ({ browser }) => {
    const m = await abrir(browser, morador.email);
    const a = await baixarPacote(m);
    expect(a.numero).toMatch(/^PRV-\d{4}-\d{6}$/);
    expect(a.codigo).toMatch(/^[0-9a-f]{32}$/);
    expect(a.texto).toContain(`Confira em `);
    expect(a.texto).toMatch(/Emitido em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} \(horário de Brasília\)/);
    expect(a.texto).toMatch(/VN-CT-[0-9A-F]{8} · Registro nº \d{6}/);
    const b = await baixarPacote(m);
    expect(b.numero, "um número por geração").not.toBe(a.numero);
    expect(b.codigo).not.toBe(a.codigo);
    const { data: reg } = await adm().from("documentos_registro").select("prefixo, numero, hash_sha256, status").in("codigo_verificacao", [a.codigo, b.codigo]);
    expect(reg).toHaveLength(2);
    for (const r of reg!) expect(r).toMatchObject({ prefixo: "PRV", status: "valido" });
    const { data: ct } = await adm().from("documentos_registro").select("prefixo, numero, registro_seq").eq("ref_tabela", "contratos").eq("ref_id", ids.contrato!);
    // O PRV também aponta para o contrato (ref = contrato); o legado é um VN-CT só.
    expect(ct!.filter((r) => r.prefixo === "VN-CT"), "o contrato legado tem um único registro").toHaveLength(1);
    expect(ct!.filter((r) => r.prefixo === "PRV").map((r) => r.numero)).toEqual(expect.arrayContaining([a.numero, b.numero]));
    await m.context().close();
  });

  test("/conferir: o código mostra o documento válido sem valor nem nome; o PDF certo confere e o alterado não (390 e 1280)", async ({ browser }) => {
    const m = await abrir(browser, morador.email);
    const doc = await baixarPacote(m);
    await m.context().close();
    for (const largura of [390, 1280]) {
      const p = await abrir(browser, null, largura);
      await p.goto(`/conferir/${doc.codigo}`, { waitUntil: "networkidle" });
      await expect(p.getByTestId("conferir-ok")).toBeVisible();
      await expect(p.getByTestId("conferir-numero")).toHaveText(doc.numero);
      await expect(p.getByTestId("conferir-documento")).toHaveText("Pacote de provas");
      await expect(p.getByTestId("conferir-emitido-em")).toContainText("horário de Brasília");
      const corpo = await p.locator("main").innerText();
      expect(corpo).not.toMatch(/R\$|Dalva|Moacir|D\. R\.|M\. R\./);
      await p.getByTestId("conferir-arquivo").setInputFiles({ name: "pacote.pdf", mimeType: "application/pdf", buffer: Buffer.from(doc.bytes) });
      await expect(p.getByTestId("conferir-hash-ok")).toBeVisible();
      const alterado = Buffer.from(doc.bytes);
      alterado[alterado.length - 20] ^= 0xff;
      await p.getByTestId("conferir-arquivo").setInputFiles({ name: "alterado.pdf", mimeType: "application/pdf", buffer: alterado });
      await expect(p.getByTestId("conferir-hash-falhou")).toBeVisible();
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t260-conferir-${largura}.png`, fullPage: true });
      await p.context().close();
    }
  });

  test("número sozinho não confere nada; código desconhecido não responde", async ({ browser }) => {
    const p = await abrir(browser, null, 390);
    await p.goto(`/conferir?codigo=PRV-2026-000001`, { waitUntil: "networkidle" });
    await expect(p.getByTestId("conferir-codigo-invalido")).toBeVisible();
    await p.goto(`/conferir/${"0".repeat(31)}1`, { waitUntil: "networkidle" });
    await expect(p.getByTestId("conferir-nao")).toBeVisible();
    await p.context().close();
  });

  test("pacote gerado com a conta de teste: /conferir avisa que é documento de teste", async ({ browser }) => {
    // O registro guarda "is_teste" na EMISSÃO (alguma parte é conta de teste).
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.morador!);
    const m = await abrir(browser, morador.email);
    const doc = await baixarPacote(m);
    await m.context().close();
    const p = await abrir(browser, null, 1280);
    await p.goto(`/conferir/${doc.codigo}`, { waitUntil: "networkidle" });
    await expect(p.getByTestId("conferir-teste")).toBeVisible();
    await p.context().close();
  });
});
