import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, fotosReais, gravarMensagem, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T662 — VARREDURA DA PÁGINA INTEIRA, BLOCO 63 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, elemento fixo sobre o conteúdo, estouro horizontal, texto cortado, grade desalinhada…), página toda
  rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges depois do bloco 62:
    · E241 (#1534): o Passo 4 (Detalhes) do cadastro com os contadores vazios (o número mínimo em cinza);
    · E243–E245 (#1535): Mensagens — a lista e a conversa aberta, com nome de imóvel e mensagem longos, dos dois lados;
    · E246–E249 (#1536): Contratos (subabas que rolam, sem o flutuante sobre o conteúdo no celular), o contrato com a
      conferência (anexo em português, "Início da estadia" uma vez), a estadia do morador e o Início do dono com rascunho.
  Sem clique no primário (assina, envia, anexa). Semeado aqui e apagado no fim. Só no laboratório.
  Prova a 390 px pedida pelo coordenador (29/10, E243/E244/E248 já no ar): rodada no lab-crítico sobre a main atual.
*/
type Conta = "DONO" | "MOR";
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
const ids: Record<string, string> = {};
const emails: Record<Conta, string> = {
  DONO: `dono.t662.${sufixo}@lab.vivanomads.test`,
  MOR: `mor.t662.${sufixo}@lab.vivanomads.test`,
};
const NOME_LONGO = `[Varredura] Studio Jardim Botânico com varanda gourmet e home office completo t662 ${sufixo}`;
const MSG_LONGA = "Olá! Tenho interesse no studio para quatro meses a partir do mês que vem, trabalho remoto, sou bem tranquilo e cuido do espaço como se fosse meu.";

const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Cadastro, Passo 4 com os contadores vazios (E241)", rota: () => `/dashboard/imoveis/novo?draft=${ids.vazio}&etapa=detalhes`, marca: "cadastro-quartos" },
  { conta: "DONO", papel: "proprietário", nome: "Mensagens, a lista com nome e mensagem longos (E243/E248)", rota: () => "/dashboard/mensagens", marca: "mensagens-conversa" },
  { conta: "DONO", papel: "proprietário", nome: "Mensagens, a conversa aberta (E244/E245)", rota: () => `/dashboard/mensagens?conversa=${ids.conversa}`, marca: "conversa-nome" },
  { conta: "MOR", papel: "morador", nome: "Mensagens, a conversa aberta (E244/E245)", rota: () => `/dashboard/mensagens?conversa=${ids.conversa}`, marca: "conversa-nome" },
  { conta: "DONO", papel: "proprietário", nome: "Contratos com as subabas que rolam (E246/E248)", rota: () => "/dashboard/contratos", marca: "subabas-dono" },
  { conta: "DONO", papel: "proprietário", nome: "Contrato com a conferência e o anexo em português (E247/E249)", rota: () => `/dashboard/contratos/${ids.contrato}`, marca: "conferencia-entrada-form" },
  { conta: "MOR", papel: "morador", nome: "Contrato (Minhas locações) vigente (E249)", rota: () => `/dashboard/locacoes/${ids.contrato}` },
  { conta: "DONO", papel: "proprietário", nome: "Início com o rascunho, sem o flutuante sobre a capa (E246)", rota: () => "/dashboard", marca: "inicio-dono-principal" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  // Desenho do E248 (#1536), não defeito: na fileira que rola na horizontal (subabas de Contratos, filtros de Mensagens),
  // o botão "›" sólido senta na borda, sobre o item que continua fora da tela; esse item aparece rolando a FILEIRA (a
  // t649 prova que, ao tocar, o último fica inteiro). O detector só conhece a rolagem da página, por isso acusa.
  { rota: /^\/dashboard\/(mensagens|contratos)(\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco63";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T662 — varredura da página inteira, bloco 63 (contadores do Passo 4, Mensagens, Contratos e Início do dono) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(180_000);
    ids.dono = await criarConta({ email: emails.DONO, nome: "Helena Maria de Albuquerque Varredura Sessenta e Três", role: "owner" }, senha);
    ids.mor = await criarConta({ email: emails.MOR, nome: "Bartolomeu Henrique dos Santos Nogueira Longo", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    await adm().from("profiles").update({ intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.mor);
    // Anúncio publicado (com fotos de verdade) para a conversa e o contrato; rascunho para o Início; rascunho com os
    // números do espaço vazios para o Passo 4 (como na t647).
    ids.im = await criarImovelPronto(ids.dono, NOME_LONGO, { ativo: true, preco: 3200 });
    await fotosReais(ids.im, ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `[Varredura] Rascunho com capa t662 ${sufixo}`, { semInternet: true });
    await fotosReais(ids.rascunho, ids.dono);
    ids.vazio = await criarImovelPronto(ids.dono, `[Varredura] Rascunho do Passo 4 t662 ${sufixo}`);
    const { error: eVazio } = await adm().from("properties").update({ bedrooms: null, bathrooms: null, area_m2: null, max_guests: null, parking_spots: null }).eq("id", ids.vazio);
    if (eVazio) throw eVazio;
    await criarLead(ids.dono, ids.mor, ids.im, true);
    ids.conversa = conversationId(ids.mor, ids.dono, ids.im);
    await gravarMensagem(ids.mor, ids.dono, ids.im, MSG_LONGA, ids.conversa);
    await gravarMensagem(ids.dono, ids.mor, ids.im, "Oi, Bartolomeu! O studio está livre a partir do dia 10. Quer marcar uma visita por vídeo?", ids.conversa);
    const t = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.im, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c!.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono);
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    if (ids.contrato) {
      await adm().from("contrato_eventos").delete().eq("contrato_id", ids.contrato);
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.conversa) await adm().from("messages").delete().eq("conversation_id", ids.conversa);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.mor].filter(Boolean));
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
        const page: Page = await entrar(browser, emails[t.conta], senha);
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
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id").replace(/conversa=[^&]+/, "conversa=:id");
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
