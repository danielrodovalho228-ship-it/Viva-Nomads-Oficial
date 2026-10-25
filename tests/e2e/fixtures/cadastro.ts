import { expect, type Page } from "@playwright/test";

/*
  Assistente de cadastro em 10 passos (mockups cadastro-imovel-01..10): o H1 de cada passo (`passo-titulo`), na ordem de
  src/lib/anuncio/etapas-ids.ts. Copiado de TELAS_ASSISTENTE (src/lib/anuncio/assistente-telas.ts) de propósito: se o
  texto da tela mudar sem querer, o teste avisa.
*/
export const TITULO_PASSO = {
  tipo: "Qual é o tipo do seu imóvel?",
  fotos: "Adicione as fotos do imóvel",
  endereco: "Onde fica o imóvel?",
  detalhes: "Detalhes do imóvel",
  comodidades: "O que o imóvel oferece?",
  regras: "Regras da casa",
  descricao: "Título e descrição do anúncio",
  preco: "Quanto custa por mês?",
  disponibilidade: "Disponibilidade",
  revisao: "Revise e publique",
} as const;
export type PassoCadastro = keyof typeof TITULO_PASSO;

/** Posição (1 a 10) de cada passo, para conferir "Passo X de 10". */
export const NUMERO_PASSO: Record<PassoCadastro, number> = Object.fromEntries(Object.keys(TITULO_PASSO).map((k, i) => [k, i + 1])) as Record<PassoCadastro, number>;

const ORDEM_PASSOS = Object.keys(TITULO_PASSO) as PassoCadastro[];

/** Foto de teste que o passo Fotos aceita (a mesma que os specs já usavam). */
export const FOTO_TESTE = "public/images/imoveis/ube/ube-001-sala.webp";

/** E133: o Passo 2 só segue com o mínimo de 8 fotos — 8 fotos de imóvel diferentes (a conferência não sinaliza). */
export const FOTOS_TESTE_MINIMO = ["sala", "cozinha", "banheiro", "quarto-1", "quarto-2", "varanda", "fachada", "home-office"].map(
  (c) => `public/images/imoveis/ube/ube-001-${c}.webp`,
);

/** Sobe as 8 fotos de teste no Passo 2 e espera a contagem (o "Continuar" só habilita com elas). */
export async function subirFotosMinimas(page: Page, timeout = 60_000) {
  await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS_TESTE_MINIMO);
  await expect(page.getByText(/^8\/40 fotos/)).toBeVisible({ timeout });
  await expect(page.getByTestId("cadastro-continuar")).toBeEnabled({ timeout });
}

/** Espera o assistente mostrar o passo: o H1 do passo e o "Passo X de 10" do topo. */
export async function noPasso(page: Page, passo: PassoCadastro, timeout = 20_000) {
  await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO[passo], { timeout });
  await expect(page.getByTestId("passo-texto")).toHaveText(`Passo ${NUMERO_PASSO[passo]} de 10`);
}

/**
 * Do passo `de` até o passo `ate` pelo "Continuar", conferindo cada passo do caminho. Nos 6 passos eram 2 cliques das
 * Comodidades à revisão; nos 10 são 5 (Regras, Descrição, Preço, Disponibilidade, Revisão), e o "Continuar" valida a
 * cada passo (título na Descrição; valor e garantia no Preço).
 */
export async function continuarAte(page: Page, de: PassoCadastro, ate: PassoCadastro) {
  for (const passo of ORDEM_PASSOS.slice(ORDEM_PASSOS.indexOf(de) + 1, ORDEM_PASSOS.indexOf(ate) + 1)) {
    await page.getByTestId("cadastro-continuar").click();
    await noPasso(page, passo);
  }
}

/**
 * Anúncio NOVO, do passo Tipo até o Endereço pelo "Continuar": Tipo (sem trava) → Fotos (E133: exige as 8 fotos do
 * mínimo) → Endereço. Nos 6 passos o endereço era o 1º passo; agora vem depois das fotos.
 */
export async function doTipoAoEndereco(page: Page) {
  await noPasso(page, "tipo");
  await page.getByTestId("cadastro-continuar").click();
  await noPasso(page, "fotos");
  await subirFotosMinimas(page);
  await page.getByTestId("cadastro-continuar").click();
  await noPasso(page, "endereco");
}

/**
 * Abre o passo Endereço de um anúncio NOVO direto pela URL (?etapa=endereco), como os specs faziam com o 1º passo dos
 * 6 passos. Conta que já tem rascunho no servidor ganha o aviso "Você tem um anúncio em andamento" e a etapa da URL
 * não vale: aí "Começar outro" e o caminho pelo "Continuar" (Tipo → Fotos → Endereço).
 */
export async function abrirNoEndereco(page: Page, timeout = 20_000) {
  await page.goto("/dashboard/imoveis/novo?etapa=endereco", { waitUntil: "domcontentloaded" });
  const endereco = page.getByTestId("passo-titulo").filter({ hasText: TITULO_PASSO.endereco });
  const aviso = page.getByTestId("rascunho-aviso");
  await expect(endereco.or(aviso)).toBeVisible({ timeout });
  if (await aviso.isVisible()) {
    await aviso.getByRole("button", { name: "Começar outro" }).click();
    await doTipoAoEndereco(page);
  } else {
    await noPasso(page, "endereco");
  }
}

/**
 * E104: quem opera, identidade e documento do imóvel moram no cartão "Antes de publicar" da Revisão (o Passo 3 é só
 * endereço). Com o rascunho já gravado (?draft= na URL), reabre o mesmo rascunho no Passo 10 e espera o cartão.
 */
export async function irParaAntesDePublicar(page: Page, timeout = 30_000) {
  await expect(page).toHaveURL(/draft=/, { timeout });
  const url = new URL(page.url());
  url.searchParams.set("etapa", "revisao");
  await page.goto(url.pathname + url.search, { waitUntil: "domcontentloaded" });
  await noPasso(page, "revisao", timeout);
  await expect(page.getByTestId("antes-de-publicar")).toBeVisible({ timeout });
  return page.getByTestId("antes-de-publicar");
}

/** Volta passo a passo pelo "Voltar" do rodapé (sem recarregar: o que a tela guardou na memória continua). */
export async function voltarAte(page: Page, ate: PassoCadastro) {
  for (let i = 0; i < ORDEM_PASSOS.length; i++) {
    if ((await page.getByTestId("passo-titulo").textContent()) === TITULO_PASSO[ate]) break;
    await page.getByTestId("cadastro-voltar").click();
    await page.waitForTimeout(150);
  }
  await noPasso(page, ate);
}

/**
 * Abre um cadastro NOVO como o dono abre ("Anunciar" → /dashboard/imoveis/novo): com rascunho anterior, "Começar outro";
 * na Qualificação (E132-A, antes do Passo 1), "Responder depois". Termina no Passo 1 (Tipo).
 */
export async function abrirCadastroNovo(page: Page, waitUntil: "domcontentloaded" | "networkidle" = "domcontentloaded") {
  await page.goto("/dashboard/imoveis/novo", { waitUntil });
  const titulo = page.getByTestId("passo-titulo");
  const comecarOutro = page.getByRole("button", { name: "Começar outro" });
  const qualificacao = page.getByTestId("qualificacao");
  await titulo.or(comecarOutro).or(qualificacao).first().waitFor({ state: "visible", timeout: 30_000 });
  if (await comecarOutro.isVisible()) await comecarOutro.click();
  await titulo.or(qualificacao).first().waitFor({ state: "visible", timeout: 30_000 });
  if (await qualificacao.isVisible()) await page.getByTestId("qualificacao-depois").click();
  await noPasso(page, "tipo", 30_000);
}
