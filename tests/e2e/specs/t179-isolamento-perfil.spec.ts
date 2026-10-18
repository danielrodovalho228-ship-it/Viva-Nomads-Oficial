import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, TELEFONE_LAB, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T179 — Isolamento do perfil (plano de QA, 17/10), a 390 e 1280 px:
  1. A (logado) não altera bio, idiomas nem cidade de B: nem pelo banco direto (RLS), nem chamando a action
     "Salvar perfil" com o pedido adulterado (id/owner_id de B no corpo) — a action só grava no próprio perfil;
  2. A não mexe em colunas que não são dele editar (nome, papel, CPF) nem no próprio perfil;
  3. a função do 0149 (perfil_publico_proprietario) só roda no servidor e NUNCA devolve e-mail, telefone ou documento.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const contaA = { email: `a.iso179.${sufixo}@lab.vivanomads.test`, nome: "Alice Isolada Sobrenomea", role: "tenant" as const };
const contaB = { email: `b.iso179.${sufixo}@lab.vivanomads.test`, nome: "Bruno Protegido Sobrenomeb", role: "owner" as const };
const ids: { a?: string; b?: string; imovel?: string } = {};
const PERFIL_B = { bio: "Cuido dos meus imóveis pessoalmente.", idiomas: ["Português"], cidade: "Uberlândia (MG)" };

const perfilB = async () => (await adm().from("profiles").select("bio, idiomas, cidade, full_name, role, cpf").eq("id", ids.b!).single()).data!;

test.describe("T179 — isolamento do perfil", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    ids.a = await criarConta(contaA, senha);
    ids.b = await criarConta(contaB, senha);
    ids.imovel = await criarImovelPronto(ids.b, `Studio Isolamento ${sufixo}`, { ativo: true });
    const { error } = await adm().from("profiles").update(PERFIL_B).eq("id", ids.b);
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.a, ids.b]);
  });

  test("banco direto: A não altera o perfil de B nem colunas fora de bio/idiomas/cidade", async () => {
    const logada = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    expect((await logada.auth.signInWithPassword({ email: contaA.email, password: senha })).error).toBeNull();
    const antes = await perfilB();

    for (const campos of [{ bio: "invadido" }, { idiomas: ["Alemão"] }, { cidade: "Outra" }, { full_name: "Hacker" }, { role: "admin" }]) {
      const r = await logada.from("profiles").update(campos).eq("id", ids.b!).select("id");
      expect(r.data ?? [], `update ${Object.keys(campos)[0]} de B`).toHaveLength(0);
    }
    // Upsert com o id de B também não passa.
    await logada.from("profiles").upsert({ id: ids.b, bio: "invadido por upsert" }, { onConflict: "id" });
    expect(await perfilB()).toEqual(antes);

    // No próprio perfil, A não troca papel nem CPF (só bio, idiomas e cidade).
    const papel = await logada.from("profiles").update({ role: "admin" }).eq("id", ids.a!).select("id");
    expect(papel.error, "papel não é editável pelo usuário").not.toBeNull();
    const { data: proprio } = await adm().from("profiles").select("role").eq("id", ids.a!).single();
    expect(proprio!.role).toBe("tenant");
    await logada.auth.signOut();
  });

  test("função 0149: só servidor, e nunca devolve e-mail, telefone ou documento", async () => {
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    expect((await anon.rpc("perfil_publico_proprietario", { p_dono: ids.b })).error, "anon não executa").not.toBeNull();
    const logada = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    await logada.auth.signInWithPassword({ email: contaA.email, password: senha });
    expect((await logada.rpc("perfil_publico_proprietario", { p_dono: ids.b })).error, "logado não executa").not.toBeNull();
    await logada.auth.signOut();

    const { data, error } = await adm().rpc("perfil_publico_proprietario", { p_dono: ids.b });
    expect(error).toBeNull();
    const linhas = data as Record<string, unknown>[];
    expect(linhas).toHaveLength(1);
    expect(Object.keys(linhas[0]).sort()).toEqual(
      ["avatar_url", "bio", "cidade", "conversas", "conversas_respondidas", "desde", "email_confirmado", "estadias_concluidas", "idiomas", "imoveis_ativos", "nome_curto", "resposta_media_min"].sort(),
    );
    const { data: b } = await adm().from("profiles").select("email, phone, cpf").eq("id", ids.b!).single();
    const tudo = JSON.stringify(linhas[0]);
    expect(tudo).not.toContain(b!.email);
    expect(tudo).not.toContain(String(b!.cpf));
    expect(tudo.replace(/\D/g, "")).not.toContain(TELEFONE_LAB.replace(/\D/g, ""));
    expect(linhas[0].nome_curto).toBe("Bruno S.");
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — action "Salvar perfil" adulterada com o id de B grava só no perfil de A`, async ({ browser }) => {
      const page = await entrar(browser, contaA.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      const antes = await perfilB();

      // Adultera o corpo da chamada da action: injeta id/user_id/owner_id de B e tenta mudar a bio "de B".
      let adulterada = false;
      await page.route("**/dashboard/conta**", async (route) => {
        const req = route.request();
        if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
        try {
          const corpo = JSON.parse(req.postData() ?? "");
          if (Array.isArray(corpo) && corpo[0] && typeof corpo[0] === "object" && "bio" in corpo[0]) {
            corpo[0] = { ...corpo[0], id: ids.b, user_id: ids.b, owner_id: ids.b, profile_id: ids.b };
            corpo.push(ids.b);
            adulterada = true;
            return route.continue({ postData: JSON.stringify(corpo) });
          }
        } catch {
          // corpo não-JSON (outra action): segue normal
        }
        return route.continue();
      });

      await page.goto(largura === 390 ? "/dashboard/conta/perfil" : "/dashboard/conta", { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("complete-perfil");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      const frase = `Frase de A ${largura} ${sufixo}`;
      await page.locator("#perfil-bio").fill(frase);
      await bloco.getByRole("button", { name: "Salvar perfil" }).click();
      await expect(bloco.getByRole("status")).toHaveText("Perfil salvo.", { timeout: 20_000 });
      expect(adulterada, "a chamada da action foi interceptada e adulterada").toBe(true);
      await page.screenshot({ path: `${SAIDA}/t179-perfil-${largura}.png`, fullPage: false });

      expect(await perfilB(), "perfil de B intacto").toEqual(antes);
      const { data: a } = await adm().from("profiles").select("bio").eq("id", ids.a!).single();
      expect(a!.bio).toBe(frase);

      // E o perfil público de B continua com a frase dele.
      await page.goto(`/proprietario/${ids.b}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pagina-proprietario")).toContainText(PERFIL_B.bio, { timeout: 20_000 });
      await expect(page.getByTestId("pagina-proprietario")).not.toContainText(frase);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
