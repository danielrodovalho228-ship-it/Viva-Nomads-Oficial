import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T623 — VARREDURA DA PÁGINA INTEIRA, BLOCO 57 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400.
  O E193 (#1496, "um só estilo de controle") trocou caixas e listas por pílulas e cartões também FORA das dez etapas
  que os blocos 53 e 55 varreram: o editor do anúncio (campos de chácara, privacidade, chegada e pedido, medir a
  internet), o padrão mínimo de conforto, o nível do imóvel (ruído) e os campos que só aparecem para chácara/sítio. O
  bloco 57 varre essas telas: o anúncio publicado do DONO17 da massa (editar, conforto, nível) e uma chácara semeada
  como na t400 (as etapas Detalhes e Comodidades do cadastro e o editor). Sem clique no primário (todos gravam).
  O dono da chácara é criado e apagado aqui. Só no laboratório.
*/
type Conta = "CHACARA" | "DONO17";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
}

const TELAS: Tela[] = [
  { conta: "DONO17", papel: "proprietário", nome: "Editor do anúncio publicado (E193)", rota: (m) => `/dashboard/imoveis/${m.imovel17}/editar`, clicar: false },
  { conta: "DONO17", papel: "proprietário", nome: "Padrão mínimo de conforto (E193)", rota: (m) => `/dashboard/imoveis/${m.imovel17}/conforto`, clicar: false },
  { conta: "DONO17", papel: "proprietário", nome: "Nível do imóvel, ruído e internet (E193)", rota: (m) => `/dashboard/imoveis/${m.imovel17}/nivel`, clicar: false },
  { conta: "CHACARA", papel: "proprietário", nome: "Chácara no cadastro, etapa Detalhes (campos de chácara, E193)", rota: () => `/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=detalhes`, clicar: false },
  { conta: "CHACARA", papel: "proprietário", nome: "Chácara no cadastro, etapa Comodidades (E193)", rota: () => `/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=comodidades`, clicar: false },
  { conta: "CHACARA", papel: "proprietário", nome: "Editor da chácara (E193)", rota: () => `/dashboard/imoveis/${ids.chacara}/editar`, clicar: false },
];

/**
 * Achados já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco57";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";
const sufixo = novoSufixo();
const senha = novaSenha();
const dono = { email: `chacara.t623.${sufixo}@lab.vivanomads.test`, nome: "Rui Sítio", role: "owner" as const };
const TITULO = `[Varredura] Chácara Ipê t623 ${sufixo}`;
const ids: Record<string, string> = {};

async function abrir(browser: Parameters<typeof abrirComoConta>[0], conta: Conta, tam: (typeof TAMANHOS)[number]): Promise<Page> {
  if (conta === "CHACARA") {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: tam.width, height: tam.height });
    return page;
  }
  return (await abrirComoConta(browser, conta, tam.nome)).page;
}

test.describe("T623 — varredura da página inteira, bloco 57 (editor, conforto, nível e chácara depois do E193) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: a chácara semeada vale para as três telas dela; sem o modo serial, uma falha não pula as outras.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"] }).eq("id", ids.dono);
    ids.chacara = await criarImovelPronto(ids.dono, TITULO, { ativo: false });
    // Chácara com os campos próprios, como na t400 (E102-B).
    const fotos = Array.from({ length: 8 }, (_, i) => {
      const caminho = `${ids.dono}/${ids.chacara}-${i}.png`;
      return { id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false };
    });
    const { error } = await adm()
      .from("properties")
      .update({
        property_type: "chacara",
        detalhes_anuncio: { chacara: { acesso: "terra", internet: "radio", pontoMarcado: true } },
        draft_data: {
          title: TITULO,
          description: "Casa de chácara mobiliada, com home office, cozinha completa e varanda. Pronta para morar por temporada.",
          propertyType: "chacara",
          chacara: { acesso: "terra", internet: "radio", ponto: { lat: -18.95, lng: -48.4 } },
          amenityKeys: { internet_fibra: true },
          tipoEntrada: "porteiro",
          bedrooms: "2",
          bathrooms: "1",
          areaM2: "120",
          maxGuests: "4",
          minPeriod: "30",
          maxPeriod: "180",
          monthlyPrice: "4200",
          street: "Estrada do Ipê",
          numero: "100",
          neighborhood: "Zona Rural",
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
      .eq("id", ids.chacara);
    if (error) throw error;
  });
  test.afterAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    await apagarContas([ids.dono].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "CHACARA" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        const rota = t.rota(MASSA!);
        const page = await abrir(browser, t.conta, tam);
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
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
          let clique: string[] = [];
          if (t.clicar !== false) {
            await test.step(`clique @${tam.nome}`, async () => {
              const primario = page.locator('main [data-cta="primary"]:visible').first();
              if ((await primario.count()) === 0) {
                console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|sem primário visível no main (nada a clicar)`);
                return;
              }
              await primario.scrollIntoViewIfNeeded().catch(() => {});
              const nome = ((await primario.innerText().catch(() => "")) || (await primario.getAttribute("aria-label")) || "primário").trim().slice(0, 60);
              const href = await primario.evaluate((el) => (el instanceof HTMLAnchorElement ? el.href : null)).catch(() => null);
              if (href) {
                // Primário que é link: a resposta é a navegação (ou a troca da tela sem navegar).
                const antes = page.url();
                const textoAntes = await page.locator("main").first().innerText().catch(() => "");
                await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                const navegou = await page
                  .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                  .then(() => true)
                  .catch(() => false);
                const mudou = navegou || (await page.locator("main").first().innerText().catch(() => textoAntes)) !== textoAntes;
                clique = mudou ? [] : [`clique em "${nome}" (link) sem navegação nem mudança na tela em 3 s`];
              } else {
                clique = await cliqueResponde(page, primario, nome);
              }
              for (const a of clique) console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|${a}`);
              for (const a of clique) {
                const c = conhecido(rotulo, a);
                if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome}: ${a}` });
              }
              const novos = clique.filter((a) => !conhecido(rotulo, a));
              expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — clique: ${CLIQUE}`).toEqual([]);
            });
          }
          relatorio[tam.nome] = { ...achados, clique };
        } finally {
          await page.context().close();
        }
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
