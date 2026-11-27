import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1753 — E1144 @E1144 (ORDEM-DUET-643, classe B). Quando a proposta de avaliação vencia sem o aceite, o DONO recebia o
  modelo genérico ("Novidade na escolha do avaliador": respondeu, recusou ou não respondeu…), que não diz o que
  aconteceu nem o que ele faz a seguir (provado ao vivo duas vezes na perna 8). Passa a receber o e-mail próprio da
  expiração, com o texto aprovado e o botão "Escolher avaliador" para a página do imóvel. O e-mail do avaliador (E1142)
  fica. Sem expiração, nenhum dos dois sai.
  Só contas de teste; cidade própria do spec, com UM avaliador e dois pedidos do mesmo dono:
   • VENCIDA: a proposta foi enviada há 75 horas (a rotina expira-a);
   • VIVA: a proposta foi enviada há 10 horas (a rotina não lhe toca).
  A rotina corre num 2º servidor do mesmo build (porta 3153, CRON_SECRET só dele; padrão do t2131 e das t1750–t1752)
  e, por correr sobre o banco inteiro, esta spec pega a vez da rotina.
   1. Antes do tique não há nenhum dos dois e-mails. Depois do tique: UM e-mail da expiração ao dono (o texto aprovado,
      o imóvel vencido, o botão e o destino), UM ao avaliador, nenhum genérico ao dono, nada sobre o pedido vivo — e a
      2ª rodada não repete nada.
   2. O destino do botão: o dono abre o endereço do aviso e está na página do imóvel, com "Escolher avaliador" aberto.
      Print a 390 e a 1280 px.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Pratinha";
const PORTA = 3153;
const SEGREDO = `lab-t1753-${Math.random().toString(36).slice(2)}`;
const HORA = 3_600_000;
const EVENTO_DONO = "vistoria_proposta_expirada_dono";
const EVENTO_AVALIADOR = "vistoria_proposta_expirada";
const EVENTO_GENERICO = "vistoria_designado_dono";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1753.${sufixo}@lab.vivanomads.test`, nome: "Dora Prazo", role: "owner" as const };
const avaliador = { email: `aval.t1753.${sufixo}@lab.vivanomads.test`, nome: "Valdo Único", role: "tenant" as const };
const TITULO_VENCIDA = `Casa vencida t1753 ${sufixo}`;
const TITULO_VIVA = `Casa viva t1753 ${sufixo}`;
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, proposta_em").eq("id", pedido).single()).data!;
type Email = { assunto: string; corpo: string };
const emails = async (usuario: string, evento: string) => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuario).eq("evento", evento)).data ?? []) as Email[];
const avisos = async (usuario: string, evento: string, pedido: string) =>
  ((await adm().from("avisos").select("url").eq("usuario_id", usuario).eq("evento", evento).eq("ref_id", pedido)).data ?? []) as { url: string }[];

/** O pedido com o avaliador escolhido e a proposta dele (R$ 380,00 · laudo em 5 dias) enviada há `horas` horas. */
async function pedidoComProposta(imovel: string, horas: number): Promise<string> {
  const proposta = new Date(Date.now() - horas * HORA).toISOString();
  const escolha = new Date(Date.now() - (horas + 2) * HORA).toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
  if (d.error) throw d.error;
  return data.id as string;
}

test.describe("T1753 — E1144: o dono recebe o e-mail próprio quando a proposta de avaliação expira @E1144", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1753");
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
      const p = await adm().from("vistoria_piloto").insert({ user_id: ids[k], nota: "T1753 (laboratório)" });
      if (p.error) throw p.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1753-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1753", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    ids.imovelVencida = await criarImovelPronto(ids.dono, TITULO_VENCIDA, { ativo: true });
    ids.imovelViva = await criarImovelPronto(ids.dono, TITULO_VIVA, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelVencida, ids.imovelViva]);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    ids.pedidoVencida = await pedidoComProposta(ids.imovelVencida, 75);
    ids.pedidoViva = await pedidoComProposta(ids.imovelViva, 10);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const imoveis = [ids.imovelVencida, ids.imovelViva].filter(Boolean);
    const pedidos = [ids.pedidoVencida, ids.pedidoViva].filter(Boolean);
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    if (pedidos.length) {
      await adm().from("avisos").delete().in("ref_id", pedidos);
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
    }
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. a expiração dispara o e-mail próprio ao dono e mantém o do avaliador; sem expiração, nenhum dos dois sai", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    // Antes do tique: nada expirou, nenhum dos dois e-mails existe.
    expect(await emails(ids.dono, EVENTO_DONO), "antes do tique: nenhum e-mail da expiração ao dono").toHaveLength(0);
    expect(await emails(ids.avaliador, EVENTO_AVALIADOR), "antes do tique: nenhum e-mail da expiração ao avaliador").toHaveLength(0);

    const log = createWriteStream(`${SAIDA}/t1753-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const rodar = async () => {
      const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
      const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; expiradas?: number };
      expect(r.status, JSON.stringify(corpo)).toBe(200);
      return corpo;
    };
    expect((await rodar()).expiradas ?? 0, "a rotina expirou pelo menos a proposta vencida").toBeGreaterThanOrEqual(1);
    // A 2ª rodada não repete nada.
    await rodar();

    // A proposta vencida voltou ao dono; a viva continua com o avaliador e a proposta.
    expect((await linha(ids.pedidoVencida)).status).toBe("pedido");
    const viva = await linha(ids.pedidoViva);
    expect(viva.status, "a proposta de 10 horas não expira").toBe("designado");
    expect(viva.proposta_em).not.toBeNull();

    // O e-mail do DONO: um só, com o texto aprovado, o imóvel vencido, o botão e o destino.
    await expect.poll(async () => (await emails(ids.dono, EVENTO_DONO)).length, { timeout: 30_000, message: "um e-mail da expiração ao dono, mesmo com 2 rodadas" }).toBe(1);
    const email = (await emails(ids.dono, EVENTO_DONO))[0];
    // O assunto nomeia o imóvel; a régua dos assuntos encurta o título comprido e o envio junta "· Viva Nomads".
    expect(email.assunto).toMatch(/^A proposta de avaliação expirou: Casa vencida/);
    expect(email.assunto.length, `"${email.assunto}" cabe em 70 caracteres`).toBeLessThanOrEqual(70);
    expect(email.assunto).not.toMatch(/vistoria_|VIS-\d|VN-[0-9A-F]{6}|\b[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(email.corpo).toContain(`Olá Dora, o prazo de 72 horas para aceitar a proposta de avaliação de ${TITULO_VENCIDA} terminou, e ela expirou. O pedido voltou para você escolher de novo.`);
    expect(email.corpo).toContain("Escolher avaliador");
    expect(email.corpo).toContain(`/dashboard/imoveis/${ids.imovelVencida}/nivel`);
    expect(email.corpo, "o texto genérico não entra").not.toMatch(/respondeu, recusou ou não respondeu/);
    expect(email.corpo, "nada sobre o pedido que não expirou").not.toContain(TITULO_VIVA);

    // O aviso no sino leva ao mesmo destino; o genérico não é gravado para este pedido.
    const avisoDono = await avisos(ids.dono, EVENTO_DONO, ids.pedidoVencida);
    expect(avisoDono).toHaveLength(1);
    expect(avisoDono[0].url).toBe(`/dashboard/imoveis/${ids.imovelVencida}/nivel#avaliacao`);
    expect(await avisos(ids.dono, EVENTO_GENERICO, ids.pedidoVencida), "o modelo genérico já não sai na expiração").toHaveLength(0);
    expect(await emails(ids.dono, EVENTO_GENERICO), "nenhum e-mail genérico ao dono").toHaveLength(0);

    // O e-mail do AVALIADOR (E1142) fica: um só, do imóvel vencido.
    await expect.poll(async () => (await emails(ids.avaliador, EVENTO_AVALIADOR)).length, { timeout: 30_000, message: "um e-mail da expiração ao avaliador" }).toBe(1);
    const doAvaliador = (await emails(ids.avaliador, EVENTO_AVALIADOR))[0];
    expect(doAvaliador.corpo).toContain(`o proprietário não aceitou a sua proposta de avaliação de ${TITULO_VENCIDA} no prazo de 72 horas, e ela expirou.`);
    expect(doAvaliador.corpo).not.toContain(TITULO_VIVA);

    // Sem expiração, nenhum dos dois sai: o pedido vivo não tem aviso de nenhum dos dois eventos.
    expect(await avisos(ids.dono, EVENTO_DONO, ids.pedidoViva)).toHaveLength(0);
    expect(await avisos(ids.avaliador, EVENTO_AVALIADOR, ids.pedidoViva)).toHaveLength(0);
  });

  test("2. o destino do botão: a página do imóvel, com 'Escolher avaliador' aberto", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Depende do caso 1 (a rotina).");
    const [aviso] = await avisos(ids.dono, EVENTO_DONO, ids.pedidoVencida);
    expect(aviso, "o caso 1 deixou o aviso da expiração").toBeTruthy();
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(aviso.url, { waitUntil: "domcontentloaded" });
      await expect(d).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.imovelVencida}/nivel`));
      const escolha = d.getByTestId("avaliacao-escolha");
      await expect(escolha, `a ${w} px: a escolha está aberta`).toBeVisible({ timeout: 30_000 });
      await expect(escolha.getByTestId("avaliacao-sugerido").first().getByRole("button", { name: `Escolher ${avaliador.nome}` })).toBeVisible();
      await expect(d.getByTestId("avaliacao-proposta"), "a proposta vencida saiu da tela").toHaveCount(0);
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await d.screenshot({ path: `${SAIDA}/t1753-2-escolher-avaliador-${w}.png`, fullPage: true });
    }
    await d.context().close();
  });
});
