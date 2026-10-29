import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, aceitarTermoIaSePreciso } from "../fixtures/laboratorio";
import { abrirSecoesPasso10 } from "../fixtures/cadastro";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T665 — BLOCO 65 (Pista C, 29/10): o Passo 10 do E251 (#1544, duas colunas). A t653 (Pista A) prova o desenho; aqui
  entra o que ela não cobre:
   1–2. (1280 e 390) o acordeão abre E fecha no toque; o motivo do "Publicar anúncio" travado leva ao que falta —
        "Falta: aceite do termo da IA" desce até o aceite; "Falta: declarações do imóvel…" REABRE a seção das
        declarações (fechada antes) e desce até ela. É a promessa do cabeçalho da t653 ("tocar no motivo abre o que
        falta"), que nenhum teste tocava.
   3. Varredura da página inteira (protocolo do bloco 21, t385): seis classes, carregamento real de cada imagem, 390 e
      1280 px — o Passo 10 travado e, a 390, com a prévia aberta.
  Sem publicar. Cada teste com o seu rascunho (o rascunho se salva sozinho). Só no laboratório.
*/
const SAIDA = "tests/laboratorio/saida/varredura-bloco65";
const FOTOS_LOCAIS = ["sala", "quarto", "cozinha", "banheiro", "fachada", "sala", "quarto", "cozinha"];
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t665.${sufixo}@lab.vivanomads.test`, nome: "Rui Bloco Sessenta e Cinco", role: "owner" as const };
const ids: { dono?: string; rascunho: Record<string, string> } = { rascunho: {} };

/** O mesmo rascunho pronto para a Revisão da t653 (só falta o aceite do termo da IA). */
async function rascunhoNaRevisao(nome: string): Promise<string> {
  const id = await criarImovelPronto(ids.dono!, `Studio no Centro ${nome} ${sufixo}`);
  const fotos = FOTOS_LOCAIS.map((n, i) => ({ id: `lab-${i}`, url: `/images/imoveis/placeholder-imovel-${n}.webp`, name: "", path: `${ids.dono}/${id}-${i}.webp`, demo: false }));
  const { error } = await adm()
    .from("properties")
    .update({
      draft_data: {
        title: `Studio no Centro ${nome} ${sufixo}`,
        description: "Studio mobiliado no Centro, com home office, internet rápida e cozinha completa. Pronto para morar.",
        propertyType: "studio",
        tipoEntrada: "porteiro",
        internetMbps: "300",
        bedrooms: "1",
        bathrooms: "1",
        areaM2: "40",
        maxGuests: "2",
        minPeriod: "30",
        maxPeriod: "180",
        monthlyPrice: "3200",
        street: "Rua Santos Dumont",
        numero: "100",
        neighborhood: "Centro",
        city: "Uberlândia",
        uf: "MG",
        cep: "38400-060",
        garantias: { caucao: true },
        privacidade: { semCamerasInterior: true, camerasExternas: false, tipoAcesso: "chave", senhaTrocadaEstadia: false },
        ownershipType: "own",
        subleaseAuthorized: false,
        photos: fotos,
        iaAnalisadas: fotos.map((f) => f.url),
        step: 9,
        ordemEtapas: 5,
        etapaMax: 9,
      },
    })
    .eq("id", id);
  if (error) throw error;
  const { error: eQual } = await adm()
    .from("qualification_checklists")
    .update({ document_path: `${ids.dono}/${id}-documento.png`, formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
    .eq("property_id", id);
  if (eQual) throw eQual;
  return id;
}

async function abrir(browser: Browser, largura: number, imovel: string): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: largura, height: largura === 1280 ? 900 : 844 });
  await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}

/** O elemento está (pelo menos em parte) dentro da janela visível. */
const naTela = (p: Page, testid: string) =>
  p.getByTestId(testid).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });

test.describe("T665 — bloco 65: Passo 10 em duas colunas (E251) — acordeão, motivo que leva ao que falta e varredura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(180_000);
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const nome of ["m1280", "m390", "v1280", "v390"]) ids.rascunho[nome] = await rascunhoNaRevisao(nome);
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (as larguras saem dentro do teste)");
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — o acordeão abre e fecha; o motivo leva ao aceite e reabre as declarações`, async ({ browser }) => {
      const p = await abrir(browser, largura, ids.rascunho[`m${largura}`]);
      // Acordeão: tudo fechado; abre e fecha no toque.
      for (const s of ["operacao", "identidade", "documento", "declaracoes"]) await expect(p.getByTestId(`antes-secao-${s}`)).toHaveAttribute("data-aberta", "0");
      const decl = p.getByTestId("antes-secao-declaracoes");
      await p.getByTestId("antes-secao-declaracoes-abrir").click();
      await expect(decl).toHaveAttribute("data-aberta", "1");
      await expect(p.getByTestId("antes-conteudo-declaracoes")).toBeVisible();
      await p.getByTestId("antes-secao-declaracoes-abrir").click();
      await expect(decl).toHaveAttribute("data-aberta", "0");
      await expect(p.getByTestId("antes-conteudo-declaracoes")).toBeHidden();

      // Motivo 1: falta o aceite → tocar desce até o aceite.
      const motivo = p.getByTestId("publicar-motivo");
      await expect(motivo).toHaveText("Falta: aceite do termo da IA");
      await p.evaluate(() => window.scrollTo(0, 0));
      await motivo.click();
      await expect.poll(() => naTela(p, "aceite-ia"), { message: `@${largura}: o aceite aparece depois do toque no motivo`, timeout: 5_000 }).toBe(true);

      // Motivo 2: com o aceite e a convenção "Não", falta a declaração → com a seção FECHADA, tocar no motivo a reabre.
      await aceitarTermoIaSePreciso(p);
      await abrirSecoesPasso10(p, ["declaracoes"]);
      await p.getByTestId("convencao-no").click();
      await expect(motivo).toHaveText(/^Falta: declarações do imóvel/);
      await p.getByTestId("antes-secao-declaracoes-abrir").click();
      await expect(decl).toHaveAttribute("data-aberta", "0");
      await p.evaluate(() => window.scrollTo(0, 0));
      await motivo.click();
      await expect(decl, `@${largura}: o motivo reabre as declarações`).toHaveAttribute("data-aberta", "1", { timeout: 5_000 });
      await expect(p.getByTestId("antes-conteudo-declaracoes")).toBeVisible();
      await expect.poll(() => naTela(p, "antes-secao-declaracoes"), { message: `@${largura}: e desce até elas`, timeout: 5_000 }).toBe(true);
      await p.screenshot({ path: `tests/laboratorio/saida/t665-motivo-declaracoes-${largura}.png` });
      await p.context().close();
    });
  }

  test("varredura: o Passo 10 travado (390 e 1280) e, a 390, com a prévia aberta — as seis classes, rolando a página inteira", async ({ browser }) => {
    mkdirSync(SAIDA, { recursive: true });
    const relatorio: Record<string, Record<string, string[]>> = {};
    const estados: { nome: string; largura: number; previa?: boolean }[] = [
      ...TAMANHOS.map((t) => ({ nome: `travado-${t.nome}`, largura: t.width })),
      { nome: "previa-aberta-390", largura: 390, previa: true },
    ];
    for (const e of estados) {
      const p = await abrir(browser, e.largura, ids.rascunho[e.largura === 1280 ? "v1280" : "v390"]);
      try {
        const respostas = escutarImagens(p);
        await p.reload({ waitUntil: "domcontentloaded" });
        await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
        if (e.previa) {
          await p.getByTestId("previa-recolhida").click();
          await expect(p.getByTestId("revisao-cartao")).toBeVisible();
        }
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const achados = await varrerPagina(p, respostas);
        for (const classe of Object.keys(CLASSES) as Classe[]) {
          await test.step(`${classe} — ${e.nome}`, async () => {
            for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${e.nome}|proprietário|/dashboard/imoveis/novo?etapa=revisao|${a}`);
            expect.soft(achados[classe], `Passo 10 ${e.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
          });
        }
        await p.screenshot({ path: `${SAIDA}/passo10-${e.nome}.png`, fullPage: true }).catch(() => {});
        relatorio[e.nome] = achados;
      } finally {
        await p.context().close();
      }
    }
    writeFileSync(`${SAIDA}/passo10.json`, JSON.stringify(relatorio, null, 2));
  });
});
