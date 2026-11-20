import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2127 — E660 @E660: a ficha "o que tem dentro" congela no contrato na 1ª assinatura, uma vez só.
  Regra decidida (E660; unitários e660-ficha-guardas.test.ts e ficha-dentro.test.ts): na 1ª assinatura (de qualquer
  lado), a ficha do anúncio é copiada para contratos.ficha_dentro_congelada. A outra parte assina a MESMA ficha, mesmo
  que o dono edite o anúncio depois, e é ela que se confere na entrada.
  Contrato aguardando as duas assinaturas, anúncio com a ficha do laboratório (1 quarto, cama de casal, ar, enxoval
  e cozinha equipada):
    1. antes de qualquer assinatura, nada congelado;
    2. o inquilino assina pela tela → a ficha congela, igual à do anúncio nesse momento;
    3. o dono muda a ficha do anúncio (sem enxoval, 2 camas de solteiro, sem ar) e assina pela tela → o contrato
       segue com a ficha congelada na 1ª assinatura, e a data do congelamento não muda.
  Assinatura com o código de 6 dígitos da caixa de testes. 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2127.${sufixo}@lab.vivanomads.test`, nome: "Fabio Ficha", role: "owner" as const };
const inq = { email: `inq.t2127.${sufixo}@lab.vivanomads.test`, nome: "Iris Inquilina", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const FICHA_EDITADA = {
  versao: 1,
  quartos: [{ nome: "Quarto 1", camas: [{ tipo: "solteiro", qtd: 2 }], solteirosJuntam: false, arCondicionado: false }],
  enxoval: false,
  cozinhaEquipada: true,
  utensilios: null,
};

type Congelada = { ficha: { enxoval: boolean; quartos: { camas: { tipo: string; qtd: number }[]; arCondicionado: boolean }[] }; congeladaEm: string } | null;

async function congelada(): Promise<Congelada> {
  const { data, error } = await adm().from("contratos").select("ficha_dentro_congelada").eq("id", ids.contrato!).single();
  if (error) throw error;
  return (data?.ficha_dentro_congelada ?? null) as Congelada;
}

async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm()
      .from("emails_teste")
      .select("corpo")
      .eq("usuario_id", usuarioId)
      .eq("evento", "contract_signature_code")
      .gte("criado_em", depoisDe)
      .order("criado_em", { ascending: false })
      .limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}

async function assinarPelaTela(browser: Browser, quem: { email: string; id: string }, rota: string) {
  const page = await entrar(browser, quem.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
  const antes = new Date(Date.now() - 2_000).toISOString();
  await page.getByTestId("assinar-pedir-codigo").click();
  await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("assinar-aceite").check();
  await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(quem.id, antes));
  await page.getByTestId("assinar-enviar").click();
  await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
  await page.context().close();
}

test.describe("T2127 — E660: a ficha do que tem dentro congela na 1ª assinatura e não muda depois @E660", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    const { error: eTeste } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eTeste) throw eTeste;
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T2127 ${sufixo}`, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(10), fim: dia(69), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eb) throw eb;
    const { error: ec } = await adm().from("contratos_checkin").insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria.", plantao: "34999990000" });
    if (ec) throw ec;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1ª assinatura congela a ficha do anúncio; a edição depois e a 2ª assinatura não mexem nela", async ({ browser }) => {
    // 1. nada congelado antes de assinar
    expect(await congelada(), "antes de qualquer assinatura").toBeNull();

    // 2. o inquilino assina primeiro: a ficha congela igual à do anúncio
    await assinarPelaTela(browser, { email: inq.email, id: ids.inq! }, `/dashboard/locacoes/${ids.contrato}`);
    await expect.poll(async () => (await congelada()) !== null, { timeout: 15_000, message: "a ficha congelou na 1ª assinatura" }).toBe(true);
    const primeira = (await congelada())!;
    expect(primeira.ficha.enxoval).toBe(true);
    expect(primeira.ficha.quartos).toHaveLength(1);
    expect(primeira.ficha.quartos[0].camas).toEqual([{ tipo: "casal", qtd: 1 }]);
    expect(primeira.ficha.quartos[0].arCondicionado).toBe(true);
    expect(Number.isNaN(Date.parse(primeira.congeladaEm)), "data do congelamento").toBe(false);

    // 3. o dono muda a ficha do anúncio e assina: o contrato fica com a ficha da 1ª assinatura
    const { error: eFicha } = await adm().from("properties").update({ ficha_dentro: FICHA_EDITADA }).eq("id", ids.imovel!);
    if (eFicha) throw eFicha;
    await assinarPelaTela(browser, { email: dono.email, id: ids.dono! }, `/dashboard/contratos/${ids.contrato}`);
    const { data: assinado } = await adm().from("contratos").select("assinado_proprietario_em, assinado_inquilino_em").eq("id", ids.contrato!).single();
    expect(assinado?.assinado_inquilino_em, "o inquilino assinou").not.toBeNull();
    expect(assinado?.assinado_proprietario_em, "o dono assinou").not.toBeNull();
    const depois = await congelada();
    expect(depois, "a ficha congelada não muda com a edição do anúncio nem com a 2ª assinatura").toEqual(primeira);
  });
});
