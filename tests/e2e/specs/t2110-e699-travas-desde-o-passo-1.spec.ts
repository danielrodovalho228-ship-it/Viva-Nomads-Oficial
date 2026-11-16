import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T2110 — E699 (Pista 3; varredura "sem spec" das 142, lote G) @E699 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E699; unitário travas-publicacao.test.ts): as travas da publicação — confirmação de identidade e
  documento do imóvel — aparecem desde o PASSO 1 do cadastro, não só no Passo 10. Cada trava diz o estado e, quando
  falta, traz o caminho de resolução:
    - identidade não confirmada, com CPF na conta → "falta", leva a /dashboard/verificacao;
    - sem CPF na conta → "falta", leva a /dashboard/conta/dados#documento;
    - documento nunca enviado → "falta"; documento enviado e na fila → "em análise" (não é falta).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const comCpf = { email: `cpf.t2110.${sufixo}@lab.vivanomads.test`, nome: "Iris Identidade", role: "owner" as const };
const semCpf = { email: `semcpf.t2110.${sufixo}@lab.vivanomads.test`, nome: "Sergio Semcpf", role: "owner" as const };
const ids: Record<string, string> = {};

async function rascunho(dono: string, titulo: string): Promise<string> {
  const { data, error } = await adm()
    .from("properties")
    .insert({
      owner_id: dono, title: titulo, description: "Rascunho do laboratório para conferir as travas da publicação no Passo 1.",
      property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40, max_guests: 2,
      min_period_days: 30, max_period_days: 180, monthly_price: 3000, status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function abrirPasso1(p: Page, id: string) {
  await p.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=tipo`, { waitUntil: "domcontentloaded" });
  await noPasso(p, "tipo", 30_000);
  const cartao = p.getByTestId("travas-publicacao");
  await expect(cartao, "o cartão das travas no Passo 1").toBeVisible({ timeout: 30_000 });
  // O estado da identidade carrega do servidor: espera sair de "carregando".
  await expect(p.getByTestId("trava-identidade")).not.toHaveAttribute("data-estado", "carregando", { timeout: 20_000 });
  return cartao;
}

test.describe("T2110 — E699: as travas da publicação aparecem desde o Passo 1, com o caminho de resolução @E699", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.comCpf = await criarConta(comCpf, senha, true);
    ids.semCpf = await criarConta(semCpf, senha, false);
    for (const id of [ids.comCpf, ids.semCpf]) await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", id);
    ids.semDoc = await rascunho(ids.comCpf, `Rascunho sem documento T2110 ${sufixo}`);
    ids.docNaFila = await rascunho(ids.comCpf, `Rascunho com documento na fila T2110 ${sufixo}`);
    const { error } = await adm().from("qualification_checklists").insert({
      owner_id: ids.comCpf, property_id: ids.docNaFila, document_path: `${ids.comCpf}/${randomBytes(6).toString("hex")}.png`, document_status: "pending",
      document_hash_sha256: randomBytes(32).toString("hex"), document_uploaded_at: new Date().toISOString(), formulario: { versao: 1, elig: { titularDocumento: comCpf.nome } },
    });
    if (error) throw error;
    ids.semCpfRascunho = await rascunho(ids.semCpf, `Rascunho da conta sem CPF T2110 ${sufixo}`);
  });

  test.afterAll(async () => {
    await adm().from("qualification_checklists").delete().in("property_id", [ids.semDoc ?? "", ids.docNaFila ?? "", ids.semCpfRascunho ?? ""]);
    await adm().from("properties").delete().in("id", [ids.semDoc ?? "", ids.docNaFila ?? "", ids.semCpfRascunho ?? ""]);
    await apagarContas([ids.comCpf, ids.semCpf]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — conta com CPF: identidade e documento faltam no Passo 1; documento na fila fica em análise`, async ({ browser }) => {
      const p = await entrar(browser, comCpf.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await abrirPasso1(p, ids.semDoc);
      await expect(p.getByTestId("trava-identidade")).toHaveAttribute("data-estado", "falta");
      await expect(p.getByTestId("trava-identidade")).toContainText("Confirmação de identidade");
      await expect(p.getByTestId("trava-identidade-resolver"), "com CPF: o caminho é a verificação").toHaveAttribute("href", "/dashboard/verificacao");
      await expect(p.getByTestId("trava-documento")).toHaveAttribute("data-estado", "falta");
      await expect(p.getByTestId("trava-documento")).toContainText("Documento do imóvel");

      await abrirPasso1(p, ids.docNaFila);
      await expect(p.getByTestId("trava-documento"), "documento enviado e na fila não é falta").toHaveAttribute("data-estado", "em_analise");
      await p.context().close();
    });

    test(`${largura} px — conta sem CPF: a trava de identidade leva aos dados da conta`, async ({ browser }) => {
      const p = await entrar(browser, semCpf.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrirPasso1(p, ids.semCpfRascunho);
      await expect(p.getByTestId("trava-identidade")).toHaveAttribute("data-estado", "falta");
      await expect(p.getByTestId("trava-identidade-resolver"), "sem CPF: o caminho é o CPF na Conta").toHaveAttribute("href", "/dashboard/conta/dados#documento");
      await p.context().close();
    });
  }
});
