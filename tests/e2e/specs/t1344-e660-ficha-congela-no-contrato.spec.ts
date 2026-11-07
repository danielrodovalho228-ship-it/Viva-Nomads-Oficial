import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1344 — E660 (draft #3085): a ficha "o que tem dentro" do anúncio congela no contrato na 1ª assinatura, uma vez só.
  O anúncio nasce com ficha completa (quarto com cama de casal e ar, enxoval e cozinha). A inquilina assina pela tela
  (código da caixa de testes): contratos.ficha_dentro_congelada passa a ter a ficha e a data de congelamento. O dono muda
  o anúncio depois (sem enxoval) e assina pela tela: a ficha congelada NÃO muda — é a que se confere na entrada.
  Spec preparada sobre a branch do draft; só roda verde com a migração 0316 e o E660 presentes.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1344.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Ficha", role: "owner" as const };
const inq = { email: `inq.t1344.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino Ficha", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const FICHA = { versao: 1, quartos: [{ nome: "Quarto 1", camas: [{ tipo: "casal", qtd: 1 }], solteirosJuntam: null, arCondicionado: true }], enxoval: true, cozinhaEquipada: true, utensilios: null };

async function codigoDaCaixa(usuarioId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}
const congelada = async () => (await adm().from("contratos").select("ficha_dentro_congelada").eq("id", ids.contrato!).single()).data?.ficha_dentro_congelada as { ficha?: typeof FICHA; congeladaEm?: string } | null;

test.describe("T1344 — E660: a ficha do anúncio congela no contrato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio ficha ${sufixo}`, { ativo: true, preco: 3200 });
    const { error: ef } = await adm().from("properties").update({ ficha_dentro: FICHA }).eq("id", ids.imovel);
    if (ef) throw ef;
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: emDias(10), fim: emDias(69), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eb) throw eb;
    const { error: ec } = await adm().from("contratos_checkin").insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (ec) throw ec;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. a inquilina assina e a ficha do anúncio congela no contrato", async ({ browser }) => {
    expect(await congelada()).toBeNull();
    const page = await entrar(browser, inq.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("assinar-pedir-codigo").click();
    await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(ids.inq!));
    await page.getByTestId("assinar-enviar").click();
    await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
    const c = await congelada();
    expect(c?.congeladaEm, "data do congelamento").toBeTruthy();
    expect(c?.ficha?.quartos?.[0]?.camas?.[0]).toMatchObject({ tipo: "casal", qtd: 1 });
    expect(c?.ficha?.quartos?.[0]?.arCondicionado).toBe(true);
    expect(c?.ficha?.enxoval).toBe(true);
    expect(c?.ficha?.cozinhaEquipada).toBe(true);
    await page.context().close();
  });

  test("2. o dono muda o anúncio depois e assina: a ficha congelada não muda", async ({ browser }) => {
    const antes = await congelada();
    const { error } = await adm().from("properties").update({ ficha_dentro: { ...FICHA, enxoval: false, cozinhaEquipada: false } }).eq("id", ids.imovel!);
    expect(error).toBeNull();
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("assinar-pedir-codigo").click();
    await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(ids.dono!));
    await page.getByTestId("assinar-enviar").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}/confirmada$`), { timeout: 45_000 });
    const depois = await congelada();
    expect(depois).toEqual(antes);
    expect(depois?.ficha?.enxoval).toBe(true);
    await page.context().close();
  });
});
