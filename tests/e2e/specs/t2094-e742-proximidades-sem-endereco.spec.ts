import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2094 — E742 (Pista 3; varredura "sem spec" das 142, lote B) @E742 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E742): o editor do PRÓPRIO dono, num anúncio sem CEP e sem ponto gravado, pede "O que tem por perto" e
  recebe 200 { itens: [], fonte: "sem_endereco" } — não há endereço para buscar, não é erro. O 400 "CEP inválido" fica para
  entrada realmente inválida: anúncio de OUTRA pessoa e CEP errado no corpo. O unitário e742-sem-endereco.test.ts fixa a
  rota por leitura; esta spec chama a rota com a sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2094.${sufixo}@lab.vivanomads.test`, nome: "Duda Endereco", role: "owner" as const };
const outro = { email: `outro.t2094.${sufixo}@lab.vivanomads.test`, nome: "Otavio Alheio", role: "owner" as const };
const ids: Record<string, string> = {};

/** POST /api/proximidades de dentro da página (a sessão e a origem são as da tela). */
const pedir = (p: Page, corpo: Record<string, unknown>) =>
  p.evaluate(async (c) => {
    const r = await fetch("/api/proximidades", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, corpo);

test.describe("T2094 — E742: anúncio do dono sem endereço → 200 sem_endereco; entrada inválida → 400 @E742", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    for (const id of [ids.dono, ids.outro]) await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", id);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio sem endereço ${sufixo}`, { ativo: false });
    // Sem CEP (nem no rascunho, nem o das proximidades) e sem ponto. Os quatro campos de ponto vão a null: o gatilho da 0066
    // (properties_coordenada_publica) trata um lat/lng NOVO — mesmo 0,0 — como o ponto real e grava um aproximado perto dele.
    const { error } = await adm()
      .from("properties")
      .update({ status: "draft", draft_data: {}, cep_proximidades: null, lat: null, lng: null, lat_exata: null, lng_exata: null })
      .eq("id", ids.imovel);
    if (error) throw error;
    const { data: lido, error: e2 } = await adm().from("properties").select("cep_proximidades, lat, lng, lat_exata, lng_exata").eq("id", ids.imovel).single();
    if (e2) throw e2;
    expect(lido, "o anúncio do teste ficou mesmo sem CEP e sem ponto").toEqual({ cep_proximidades: null, lat: null, lng: null, lat_exata: null, lng_exata: null });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.outro]);
  });

  test("o dono: 200 com lista vazia e fonte sem_endereco (nada de 400)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const r = await pedir(p, { propertyId: ids.imovel });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ itens: [], fonte: "sem_endereco" });
    // CEP errado no corpo continua 400.
    const errado = await pedir(p, { cep: "123" });
    expect(errado.status).toBe(400);
    await p.context().close();
  });

  test("outra pessoa pedindo pelo mesmo anúncio: 400 CEP inválido (o sem_endereco é só do dono)", async ({ browser }) => {
    const p = await entrar(browser, outro.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const r = await pedir(p, { propertyId: ids.imovel });
    expect(r.status).toBe(400);
    expect(r.json?.fonte).not.toBe("sem_endereco");
    await p.context().close();
  });
});
