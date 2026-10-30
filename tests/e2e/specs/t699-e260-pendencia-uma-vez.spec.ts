import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo, aceitarTermoIaSePreciso } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, emDiasBR, isoParaBR } from "../fixtures/rascunho-cadastro";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../../src/config/conforto-minimo";

/*
  T699 — E260 (#1596), o que a t700 não grava nem lê de volta. Pista C, 30/10. Um rascunho completo por largura (tudo
  pronto, menos o padrão mínimo de conforto e as datas), da mesma conta; 1280 primeiro, depois 390.
   1. Passo 9 → 10: janela de 24 dias com mínimo de 30 → "Continuar" recusa (o aviso só junto das datas); a data final
      corrigida para 38 dias tira o aviso na hora e o "Continuar" leva ao Passo 10, onde a linha Disponibilidade está
      feita com "Disponível a partir de dd/mm/aaaa." e o motivo do "Publicar anúncio" conta UMA pendência, no singular
      ("Falta 1 item da lista de conferência", + "e o aceite do termo da IA" enquanto o dono nunca aceitou). As datas
      ficam no rascunho do banco (draft_data).
   2. Ida e volta: o Passo 9 reaberto em outra sessão lê as datas do banco (sem aviso). Pela lista, "Resolver" de
      Comodidades → "Confirmo todos" grava os 12 itens (conforto_declaracoes); o Passo 10 reaberto lê do banco: lista sem
      pendência e o motivo muda — 1280: "Falta: aceite do termo da IA" (tocar desce até o aceite); 390: nenhum motivo,
      porque o aceite dado ao publicar em 1280 ficou gravado (termo_ia_aceites) e a caixa vira "Você já aceitou…".
      Publicar grava o anúncio ativo com as datas do Passo 9 (available_from / available_until).
   3. A página pública do anúncio publicado mostra "Disponível a partir de dd/mm/aaaa" (a data do Passo 9).
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [1280, 390] as const;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t699.${sufixo}@lab.vivanomads.test`, nome: "Uma Pendencia", role: "owner" as const };
const ids: { dono?: string; imovel: Record<number, string> } = { imovel: {} };
const titulo = (w: number) => `Studio Pendência ${w} ${sufixo}`;
const DE = emDiasBR(2);
const ATE_CURTA = emDiasBR(26);
const ATE = emDiasBR(40);

const naTela = (p: Page, testid: string) =>
  p.getByTestId(testid).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });

async function confirmadosNoBanco(id: string): Promise<number> {
  const { data } = await adm().from("conforto_declaracoes").select("chave, confirmado, versao_lista").eq("property_id", id);
  return (data ?? []).filter((d) => d.confirmado && d.versao_lista === VERSAO_CONFORTO).length;
}

async function datasDoRascunho(id: string) {
  const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
  const d = (data?.draft_data ?? {}) as Record<string, unknown>;
  return { de: d.availableFrom ?? null, ate: d.availableUntil ?? null };
}

/** Rascunho completo (o mesmo estado da t653/t309): tudo pronto, menos o padrão mínimo e as datas do Passo 9. */
async function rascunhoCompleto(donoId: string, t: string): Promise<string> {
  const id = await criarImovelPronto(donoId, t, { semConforto: true });
  const fotos = Array.from({ length: 8 }, (_, i) => {
    const caminho = `${donoId}/${id}-${i}.png`;
    return { id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false };
  });
  const { error } = await adm()
    .from("properties")
    .update({
      draft_data: {
        title: t,
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
        step: 8,
        ordemEtapas: 5,
        etapaMax: 9,
      },
    })
    .eq("id", id);
  if (error) throw error;
  const { error: eQual } = await adm()
    .from("qualification_checklists")
    .update({ document_path: `${donoId}/${id}-documento.png`, formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
    .eq("property_id", id);
  if (eQual) throw eQual;
  return id;
}

test.describe("T699 — E260: cada pendência dita uma vez, gravada e lida de volta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of LARGURAS) ids.imovel[w] = await rascunhoCompleto(ids.dono, titulo(w));
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of LARGURAS) {
    // Em 1280 o dono nunca aceitou o termo; em 390 o aceite veio gravado da publicação em 1280.
    const comAceite = w === 1280;
    const SUFIXO_ACEITE = comAceite ? " e o aceite do termo da IA" : "";

    test(`1. ${w} px — Passo 9 corrigido → Passo 10: Disponibilidade feita com a data, motivo no singular; datas no rascunho`, async ({ browser }) => {
      const id = ids.imovel[w];
      const p = await abrirPasso(browser, { email: dono.email, senha }, id, "disponibilidade", w);
      await p.getByTestId("disponivel-de").fill(isoParaBR(DE));
      await p.getByTestId("disponivel-ate").fill(isoParaBR(ATE_CURTA));
      const aviso = p.getByTestId("janela-curta");
      await expect(aviso).toContainText("menos que a duração mínima de 30 dias", { timeout: 15_000 });
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "disponibilidade");
      await expect(aviso).toHaveCount(1);
      await expect(p.getByTestId("passo-erros")).toHaveCount(0);

      // Corrigida a data final, o aviso some na hora (sem resumo esquecido no topo) e o Continuar passa.
      await p.getByTestId("disponivel-ate").fill(isoParaBR(ATE));
      await expect(aviso).toHaveCount(0, { timeout: 10_000 });
      await expect(p.getByTestId("passo-erros")).toHaveCount(0);
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "revisao", 30_000);

      const lista = p.getByTestId("lista-conferencia");
      await expect(lista.getByTestId("conferencia-disponibilidade")).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
      await expect(lista.getByTestId("conferencia-nota-disponibilidade")).toHaveText(`Disponível a partir de ${isoParaBR(DE)}.`);
      await expect(lista.getByTestId("conferencia-comodidades")).toHaveAttribute("data-ok", "0");
      await expect(p.getByTestId("etapa-revisar").locator('[data-itens~="conforto"]')).toHaveCount(1);
      await expect(lista).toHaveAttribute("data-faltam", "1");
      await expect(p.getByTestId("conferencia-revisao")).toHaveCount(0);
      if (!comAceite) await expect(p.getByTestId("aceite-ia-ja-aceito")).toBeVisible({ timeout: 20_000 });
      const motivo = p.getByTestId("publicar-motivo");
      await expect(motivo).toHaveText(`Falta 1 item da lista de conferência${SUFIXO_ACEITE}`, { timeout: 20_000 });
      await expect(p.getByTestId("publicar-anuncio")).toBeDisabled();
      await motivo.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${SAIDA}/t699-1-passo10-singular-${w}.png` });

      // As datas do Passo 9 foram para o rascunho do banco.
      await expect.poll(() => datasDoRascunho(id), { timeout: 30_000 }).toEqual({ de: DE, ate: ATE });
      await p.context().close();
    });

    test(`2. ${w} px — o Passo 9 lê as datas do banco; resolver pela lista grava o padrão mínimo; o motivo muda; publica com as datas`, async ({ browser }) => {
      const id = ids.imovel[w];
      const p = await abrirPasso(browser, { email: dono.email, senha }, id, "disponibilidade", w);
      await expect(p.getByTestId("disponivel-de")).toHaveValue(isoParaBR(DE), { timeout: 20_000 });
      await expect(p.getByTestId("disponivel-ate")).toHaveValue(isoParaBR(ATE));
      await expect(p.getByTestId("janela-curta")).toHaveCount(0);
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "revisao", 30_000);

      // "Resolver" da linha pendente leva ao padrão mínimo; "Confirmo todos" grava sozinho.
      await p.getByTestId("conferencia-resolver-comodidades").click();
      await expect(p.getByTestId("conforto-checklist")).toBeVisible({ timeout: 20_000 });
      const todos = p.getByTestId("conforto-marcar-todos");
      await expect(todos).toBeEnabled({ timeout: 20_000 });
      await todos.click();
      await expect(p.getByTestId("conforto-salvamento")).toHaveAttribute("data-estado", "salvo", { timeout: 20_000 });
      await expect.poll(() => confirmadosNoBanco(id), { timeout: 20_000 }).toBe(CHAVES_CONFORTO.length);

      // O Passo 10 reaberto (lido do banco): a lista sem pendência; o motivo só diz o que fica fora dela.
      await p.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "revisao", 30_000);
      const lista = p.getByTestId("lista-conferencia");
      await expect(lista.getByTestId("conferencia-comodidades")).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
      await expect(lista).toHaveAttribute("data-faltam", "0");
      await expect(lista.getByTestId("conferencia-nota-disponibilidade")).toHaveText(`Disponível a partir de ${isoParaBR(DE)}.`);
      const motivo = p.getByTestId("publicar-motivo");
      const publicar = p.getByTestId("publicar-anuncio");
      if (comAceite) {
        await expect(motivo).toHaveText("Falta: aceite do termo da IA", { timeout: 20_000 });
        // Sem nada na lista, tocar no motivo leva ao aceite (fora da lista).
        await p.evaluate(() => window.scrollTo(0, 0));
        await motivo.click();
        await expect.poll(() => naTela(p, "aceite-ia"), { message: `@${w}: o motivo desce até o aceite`, timeout: 5_000 }).toBe(true);
        await p.waitForTimeout(600);
        await p.screenshot({ path: `${SAIDA}/t699-2-motivo-aceite-${w}.png` });
        await aceitarTermoIaSePreciso(p);
      } else {
        await expect(p.getByTestId("aceite-ia-ja-aceito")).toBeVisible({ timeout: 20_000 });
        await expect(p.getByTestId("aceite-ia")).toHaveCount(0);
      }
      await expect(publicar).toBeEnabled({ timeout: 20_000 });
      await expect(motivo, "nada mais falta: sem motivo").toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t699-2-pronto-${w}.png` });
      await publicar.click();
      await p.waitForURL((u) => !u.pathname.endsWith("/imoveis/novo"), { timeout: 30_000 });
      await expect
        .poll(async () => {
          const { data } = await adm().from("properties").select("status, available_from, available_until").eq("id", id).single();
          return data ? { status: data.status, de: String(data.available_from ?? "").slice(0, 10), ate: String(data.available_until ?? "").slice(0, 10) } : null;
        }, { timeout: 30_000 })
        .toEqual({ status: "active", de: DE, ate: ATE });
      expect(await confirmadosNoBanco(id)).toBe(CHAVES_CONFORTO.length);
      if (comAceite) {
        // O aceite ficou gravado por dono: é o que tira o "e o aceite do termo da IA" do motivo em 390.
        await expect
          .poll(async () => (await adm().from("termo_ia_aceites").select("user_id", { count: "exact", head: true }).eq("user_id", ids.dono!)).count ?? 0, { timeout: 20_000 })
          .toBeGreaterThan(0);
      }
      await p.context().close();
    });

    test(`3. ${w} px — o anúncio publicado mostra a data do Passo 9`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.imovel[w]}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { level: 1, name: titulo(w) })).toBeVisible({ timeout: 30_000 });
      const data = p.getByText(`Disponível a partir de ${isoParaBR(DE)}`);
      await expect(data.first()).toBeAttached({ timeout: 20_000 });
      await data.first().scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: `${SAIDA}/t699-3-anuncio-${w}.png` });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
