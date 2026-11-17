import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2106 — E397 (grave; Pista 3; varredura "sem spec" das 142, lote E) @E397 — sem @ao-vivo-seguro: precisa de sessão e
  do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E397; unitário e397-pet-candidatura.test.ts): a candidatura só leva pet quando o anúncio ACEITA
  animais (pets_allowed === true); desmarcado ou não informado = não aceita. Vale para:
    - o MORADOR, na página do anúncio: num imóvel que não aceita, o aviso diz "Este imóvel não aceita animais. Seus pets
      não vão na candidatura." — nunca "Seus pets vão na candidatura";
    - o DONO, em Interessados: a candidatura para o imóvel que não aceita não mostra a ficha nem o nome do pet.
  Controlo: o mesmo morador, com o mesmo pet, num imóvel que ACEITA — o aviso "Seus pets vão…" e a ficha aparecem.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2106.${sufixo}@lab.vivanomads.test`, nome: "Dalva Donapet", role: "owner" as const };
const inq = { email: `inq.t2106.${sufixo}@lab.vivanomads.test`, nome: "Mauro Moradorpet", role: "tenant" as const };
const ids: Record<string, string> = {};
const PET = `Totó${sufixo.slice(-3)}`;
const SEM = `Studio sem animais ${sufixo}`;
const COM = `Studio que aceita animais ${sufixo}`;

test.describe("T2106 — E397: o pet do morador só vai na candidatura do imóvel que aceita animais @E397", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.sem = await criarImovelPronto(ids.dono, SEM, { ativo: true });
    ids.com = await criarImovelPronto(ids.dono, COM, { ativo: true });
    for (const [id, aceita] of [[ids.sem, false], [ids.com, true]] as const) {
      const { error } = await adm().from("properties").update({ pets_allowed: aceita }).eq("id", id);
      if (error) throw error;
    }
    const { error } = await adm()
      .from("pets_inquilino")
      .insert({ user_id: ids.inq, nome: PET, especie: "cao", porte: "M", idade_anos: 3, raca: "", castrado: true, vacinas_em_dia: true });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await adm().from("pets_inquilino").delete().eq("user_id", ids.inq ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("morador, 1280 px — imóvel sem animais: os pets NÃO vão; imóvel que aceita: vão", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });

    await p.goto(`/imoveis/${ids.sem}`, { waitUntil: "domcontentloaded" });
    const naoVai = p.getByTestId("pet-candidatura-nao-vai");
    await expect(naoVai, "o aviso de que os pets não vão").toBeVisible({ timeout: 30_000 });
    await expect(naoVai).toHaveText("Este imóvel não aceita animais. Seus pets não vão na candidatura.");
    await expect(p.getByTestId("pet-candidatura")).toHaveCount(0);
    await expect(p.getByText("Seus pets vão na candidatura")).toHaveCount(0);

    await p.goto(`/imoveis/${ids.com}`, { waitUntil: "domcontentloaded" });
    const vai = p.getByTestId("pet-candidatura");
    await expect(vai, "controlo: no imóvel que aceita, o pet vai").toBeVisible({ timeout: 30_000 });
    await expect(vai).toContainText("Seus pets vão na candidatura");
    await expect(vai).toContainText(PET);
    await expect(p.getByTestId("pet-candidatura-nao-vai")).toHaveCount(0);
    await p.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`dono, ${largura} px — Interessados: só a candidatura do imóvel que aceita mostra o pet`, async ({ browser }) => {
      // As candidaturas nascem depois do teste do morador (candidatura já enviada não mexe no aviso que ele viu).
      if (!ids.leadSem) ids.leadSem = await criarLead(ids.dono, ids.inq, ids.sem);
      if (!ids.leadCom) ids.leadCom = await criarLead(ids.dono, ids.inq, ids.com);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await expect(p.getByText(`interesse em ${SEM}`), "a candidatura do imóvel sem animais").toBeVisible({ timeout: 30_000 });
      await expect(p.getByText(`interesse em ${COM}`)).toBeVisible();

      // Uma ficha só: a do imóvel que aceita.
      const fichas = p.getByTestId("ficha-pet-candidatura");
      await expect(fichas, "uma ficha de pet só (a do imóvel que aceita)").toHaveCount(1);
      await expect(fichas).toContainText(PET);
      // O cartão da candidatura sem animais não tem a ficha nem o nome do pet.
      const cartaoSem = p.locator("li, article, section, div").filter({ has: p.getByText(`interesse em ${SEM}`, { exact: true }) }).filter({ has: p.getByTestId("candidato-nome") }).last();
      await expect(cartaoSem.getByTestId("ficha-pet-candidatura")).toHaveCount(0);
      await expect(cartaoSem).not.toContainText(PET);
      await p.context().close();
    });
  }
});
