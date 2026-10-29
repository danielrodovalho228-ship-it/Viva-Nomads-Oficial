import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T651 — VARREDURA DA PÁGINA INTEIRA, BLOCO 61 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, estouro horizontal, texto cortado, grade desalinhada…), página toda
  rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges novos:
    · E222-B (#1506), renovar = aditivo: a página do contrato com "Renovar a estadia" (dono e morador), o contrato no teto
      de 180 dias (a frase no lugar do botão), o aditivo como renovação (?renovar=1, com a prévia) e no teto, e a Carteira;
    · E180 (#1507), o anúncio novo sempre pela Qualificação com o aviso "anúncio em andamento" (dono com rascunho);
    · parceria em /admin/parceiros: o E223 (#1505) mostrava os interesses; o E227-B (#1513) deixou uma fila só
      (parceiro_solicitacoes), então a tela varrida é a aba Pendentes com um pedido de teste de nome longo.
  Sem clique no primário: aqui ele propõe aditivo, começa rascunho ou muda a situação do interesse (efeito fora da tela).
  Semeado como na t631/t630 e apagado no fim. Só no laboratório.
*/
type Conta = "DONO" | "ANA" | "BETO" | "RASCUNHO" | "ADMIN";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio). */
  marca?: string;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const emails: Partial<Record<Conta, string>> = {};
const ids: Record<string, string> = {};
const contratos: string[] = [];
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const NOME_INTERESSE = `Maximiliano Bartolomeu de Albuquerque Fotografias Panorâmicas t651 ${sufixo}`;
const EMAIL_PEDIDO = `pedido.t651.${sufixo}@lab.vivanomads.test`;

async function conta(quem: Conta, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem.toLowerCase()}.t651.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem]!, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true, intencao: [role === "owner" ? "anunciar" : "morar"] }).eq("id", id);
  return id;
}

/** Contrato ativo, assinado pelas duas partes, com os blocos dados (meses), o último terminando em `fimEm` dias (t631). */
async function contrato(letra: string, inquilino: string, mesesPorBloco: number[], fimEm: number) {
  const imovel = await criarImovelPronto(ids.dono, `[Varredura] Studio Renovação ${letra} com nome comprido t651 ${sufixo}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(ids.dono, inquilino, imovel, true);
  const agora = new Date().toISOString();
  const total = mesesPorBloco.reduce((s, m) => s + m, 0);
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: total * 30, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256 * total, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id);
  let inicio = new Date(Date.parse(emDias(fimEm)) - (total * 30 - 1) * 86_400_000).toISOString().slice(0, 10);
  for (const [i, meses] of mesesPorBloco.entries()) {
    const fim = new Date(Date.parse(inicio) + (meses * 30 - 1) * 86_400_000).toISOString().slice(0, 10);
    const { error: e } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: i + 1, inicio, fim, meses, valor: 3200 * meses, caucao: i === 0 ? 3200 : 0, status: i === 0 ? "ativo" : "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (e) throw e;
    inicio = new Date(Date.parse(fim) + 86_400_000).toISOString().slice(0, 10);
  }
  return c.id as string;
}

const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Contrato com espaço: 'Renovar a estadia' (E222-B)", rota: () => `/dashboard/contratos/${ids.A}`, marca: "contrato-renovar" },
  { conta: "DONO", papel: "proprietário", nome: "Contrato no teto de 180 dias: a frase no lugar do botão (E222-B)", rota: () => `/dashboard/contratos/${ids.B}`, marca: "contrato-renovacao-maximo" },
  { conta: "DONO", papel: "proprietário", nome: "Carteira com a renovação (E222-B)", rota: () => "/dashboard/carteira" },
  { conta: "ANA", papel: "morador", nome: "Contrato (Minhas locações) com 'Renovar a estadia' (E222-B)", rota: () => `/dashboard/locacoes/${ids.A}`, marca: "contrato-renovar" },
  { conta: "ANA", papel: "morador", nome: "Aditivo como renovação, com a prévia (E222-B)", rota: () => `/dashboard/estadia/${ids.A}/alteracao?renovar=1`, marca: "renovacao-previa" },
  { conta: "BETO", papel: "morador", nome: "Renovação no teto: só a frase, sem formulário (E222-B)", rota: () => `/dashboard/estadia/${ids.B}/alteracao?renovar=1`, marca: "renovacao-no-maximo" },
  { conta: "RASCUNHO", papel: "proprietário", nome: "Anúncio novo pela Qualificação com o aviso do anúncio em andamento (E180)", rota: () => "/dashboard/imoveis/novo", marca: "rascunho-aviso" },
  { conta: "ADMIN", papel: "admin", nome: "Parceiros, aba Pendentes com o pedido de nome longo (E227-B)", rota: () => "/admin/parceiros?aba=pendentes", marca: "ficha-parceria" },
];

/** Achados já registrados como defeito de produto (L-*): ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco61";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T651 — varredura da página inteira, bloco 61 (renovar = aditivo, anúncio novo pela Qualificação, interesses de parceria) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // Um worker só: as contas e os contratos semeados valem para as oito telas; sem o modo serial, uma falha não pula as outras.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(180_000);
    ids.dono = await conta("DONO", "Dora Renovação Varredura", "owner");
    ids.ana = await conta("ANA", "Ana Aparecida dos Santos Nogueira Renovação", "tenant");
    ids.beto = await conta("BETO", "Bartolomeu Henrique de Albuquerque Teto", "tenant");
    ids.rascunho = await conta("RASCUNHO", "Rui Rascunho Varredura", "owner");
    ids.A = await contrato("A", ids.ana, [2], 20); // 2 meses, termina em 20 dias: renova
    ids.B = await contrato("B", ids.beto, [3, 3], 40); // 180 dias: no teto
    // O dono com um rascunho no servidor: "Novo anúncio" abre na Qualificação com o aviso (E180).
    ids.imRascunho = await criarImovelPronto(ids.rascunho, `[Varredura] Rascunho em andamento t651 ${sufixo}`);
    const { error } = await adm().from("parceiro_solicitacoes").insert({
      email: EMAIL_PEDIDO,
      nome: NOME_INTERESSE,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      categorias: ["fotografia"],
      cidades: ["São José dos Campos"],
      status: "pendente",
      origem: "site",
    });
    if (error) throw error;
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    if (contratos.length) {
      await adm().from("contrato_aditivos").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    await adm().from("parceiro_solicitacoes").delete().eq("email", EMAIL_PEDIDO);
    await adm().from("leads").delete().in("owner_id", [ids.dono].filter(Boolean));
    await apagarContas([ids.dono, ids.ana, ids.beto, ids.rascunho].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const rota = t.rota();
        const page: Page =
          t.conta === "ADMIN"
            ? await (await browser.newContext({ storageState: authFile("admin") })).newPage()
            : await entrar(browser, emails[t.conta]!, senha);
        await page.setViewportSize({ width: tam.width, height: tam.height });
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          if (t.marca) {
            await expect.soft(page.getByTestId(t.marca).filter({ visible: true }).first(), `${t.nome} @${tam.nome}: a tela do merge aparece (${t.marca})`).toBeVisible({ timeout: 20_000 });
          }
          if (t.conta === "ADMIN") {
            await expect.soft(page.locator(`[data-testid="ficha-parceria"][data-email="${EMAIL_PEDIDO}"]`), `${t.nome} @${tam.nome}: o pedido de teste na fila`).toBeVisible({ timeout: 20_000 });
          }
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rotulo}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(rotulo, a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(rotulo, a, classe));
              expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = achados;
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
