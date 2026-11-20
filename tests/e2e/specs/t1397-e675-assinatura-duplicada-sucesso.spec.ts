import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1397 — E675 (#3171): quem já assinou e envia de novo (segunda aba com o formulário velho, toque duplo) recebe SUCESSO,
  não "Você já assinou" como erro. A inquilina abre o contrato em duas abas, assina na primeira e reenvia na segunda: a
  segunda mostra a confirmação (sem o erro), nada é gravado de novo (a data da assinatura não muda). 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1397.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inq = { email: `inq.t1397.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function codigoDaCaixa(usuarioId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}

test.describe("T1397 — E675: reenvio de quem já assinou vira sucesso", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const { error: eTeste } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eTeste) throw eTeste;
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1397 ${sufixo}`, { ativo: true, preco: 3200 });
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

  test("segunda aba com o formulário velho: reenviar mostra sucesso, sem 'Você já assinou'", async ({ browser }) => {
    const a = await entrar(browser, inq.email, senha);
    const b = await a.context().newPage();
    for (const p of [a, b]) {
      await p.setViewportSize({ width: 1280, height: 900 });
      await p.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
    }
    await a.getByTestId("assinar-pedir-codigo").click();
    await expect(a.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
    const codigo = await codigoDaCaixa(ids.inq!);
    await a.getByTestId("assinar-aceite").check();
    await a.getByTestId("assinar-codigo").fill(codigo);
    await a.getByTestId("assinar-enviar").click();
    await expect(a.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
    const antes = (await adm().from("contratos").select("assinado_inquilino_em").eq("id", ids.contrato!).single()).data?.assinado_inquilino_em;
    expect(antes).not.toBeNull();

    // A segunda aba ainda tem o formulário: reenvia com o mesmo código.
    await expect(b.getByTestId("form-assinar")).toBeVisible();
    await b.getByTestId("assinar-aceite").check();
    await b.getByTestId("assinar-codigo").fill(codigo);
    await b.getByTestId("assinar-enviar").click();
    await expect(b.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
    await expect(b.getByText(/Você já assinou/)).toHaveCount(0);
    const depois = (await adm().from("contratos").select("assinado_inquilino_em").eq("id", ids.contrato!).single()).data?.assinado_inquilino_em;
    expect(depois, "nada gravado de novo").toBe(antes);
    expect(await b.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    // 390 px: a tela do contrato assinado não estoura.
    await b.setViewportSize({ width: 390, height: 844 });
    await b.reload({ waitUntil: "domcontentloaded" });
    await expect(b.getByTestId("contrato-aviso-assinatura")).toBeVisible({ timeout: 20_000 });
    expect(await b.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await a.context().close();
  });
});
