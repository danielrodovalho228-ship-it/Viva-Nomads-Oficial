import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T711 — E264-B (#1595): o CORPO dos 5 e-mails proativos, o que a t695 não confere. Disparo de verdade (a fila
  emails_proativos + /api/cron/resumo-pedidos num 2º servidor do MESMO build, porta 3171, com um CRON_SECRET só dele,
  como a t695); leitura na caixa de teste (emails_teste: o texto do e-mail) e no LAB_OUTBOX (o HTML sem tags, com o
  destino de cada link entre parênteses — é dali que sai o link do descadastro, que a caixa de teste esconde).
    A. pedido_imovel_novo (Ana, 1 imóvel): "Olá Ana", o cartão do imóvel (título — bairro, cidade; total do mês; "Ver o
       imóvel" com o link do anúncio) e a linha "Não quero mais este tipo de e-mail".
    B. saved_search_match (Beto, 2 imóveis): UM e-mail com os 2 cartões; o teto vale ENTRE tipos — o pedido_imovel_novo
       que o Beto também tem na fila espera (sai no próximo envio).
    C. pedido_compativel (Olga, dona, 1 pedido): cartão do pedido (cidade, entrada, orçamento, pessoas, pets), "Combina
       com “<imóvel dela>”" e "Responder ao pedido" com o pedido e o imóvel; nunca o nome de quem pediu.
    D. pedido_resumo (Paula, dona, 4 pedidos): UM e-mail, 3 cartões e "Ver os 4 pedidos".
    E. pedido_expirando (Caio): "Olá Caio", os dias que faltam no assunto, o cartão e "Renovar o pedido".
    F. descadastro de um clique pelo link DO E-MAIL: o link é o assinado (HMAC do segredo), o GET do one-click leva à
       página, a confirmação desliga "Sugestões e novidades" e o próximo proativo da Ana é descartado ("desligado"),
       mesmo com o teto livre.
    G. sem repetição no 2º disparo (o imóvel já enviado não volta, mesmo com o teto do dia livre) e teto semanal (3 em
       7 dias: o 4º espera e sai quando o mais antigo sai da janela). O "ontem" é simulado recuando enviado_em.
  No silêncio (22h–7h de Brasília) nada sai, de propósito: o teste pula nesse horário.
*/
const PORTA = 3171;
const BASE = `http://localhost:${PORTA}`;
const SEGREDO = `lab-t711-${Math.random().toString(36).slice(2)}`;
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
const imoveis: string[] = [];
const pedidos: string[] = [];
let servidor: ChildProcess | null = null;
const titulo = (i: number) => `Apto proativo ${i} t711 ${sufixo}`;
const tituloDona = (quem: string) => `Studio da ${quem} t711 ${sufixo}`;
const horaBRT = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
const emSilencio = () => horaBRT() >= 22 || horaBRT() < 7;
const chave = (u: string, ev: string, ref: string) => `proativo:${ev}:${u}:${ref}`;
const diaISO = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
/** O corpo sem o rodapé padrão (o rodapé traz o nome da marca e links fixos). */
const semRodape = (corpo: string) => corpo.split("— Viva Nomads")[0];
const contar = (s: string, trecho: string) => s.split(trecho).length - 1;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t711.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

async function fila(usuarioId: string, evento: string, refId: string, extra: Record<string, unknown> = {}) {
  return adm().from("emails_proativos").insert({ usuario_id: usuarioId, evento, ref_id: refId, chave: chave(usuarioId, evento, refId), extra });
}

/** Pedido de moradia ativo em Uberlândia (o cálculo de compatíveis já "feito": o disparo diário não o recalcula). */
async function pedido(inquilino: string, entradaEmDias: number, criadoHaDias = 0): Promise<{ id: string; entrada: string; expira_em: string }> {
  const entrada = diaISO(entradaEmDias);
  const { data, error } = await adm()
    .from("pedidos_moradia")
    .insert({ inquilino_id: inquilino, cidade: "Uberlândia", uf: "MG", data_inicio: entrada, prazo_meses: 3, orcamento_mensal: 3200, qtd_ocupantes: 2, motivo: "trabalho_remoto", pets: false, compativeis_ao_publicar: 0, ...(criadoHaDias ? { criado_em: new Date(Date.now() - criadoHaDias * 86_400_000).toISOString() } : {}) })
    .select("id, expira_em")
    .single();
  if (error) throw error;
  pedidos.push(data.id as string);
  return { id: data.id as string, entrada, expira_em: data.expira_em as string };
}

/** Libera o "um envio por vez" (60 s) da pessoa: os disparos do teste vêm em sequência. */
async function liberarDespacho(usuarioId: string) {
  await adm().from("limites_uso").delete().eq("chave", `proativo-envio:${usuarioId}`);
}

/** Simula o tempo: a linha já enviada passa a ter saído há `dias` dias (o teto lê enviado_em). */
async function enviadoHa(usuarioId: string, evento: string, refId: string, dias: number) {
  const { error } = await adm().from("emails_proativos").update({ enviado_em: new Date(Date.now() - dias * 86_400_000).toISOString() }).eq("chave", chave(usuarioId, evento, refId)).not("enviado_em", "is", null);
  expect(error).toBeNull();
}

async function rodar() {
  const r = await fetch(`${BASE}/api/cron/resumo-pedidos`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  expect(r.status).toBe(200);
}

async function caixa(usuarioId: string): Promise<{ evento: string; assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("evento, assunto, corpo").eq("usuario_id", usuarioId).order("criado_em");
  return (data ?? []) as { evento: string; assunto: string; corpo: string }[];
}

async function noOutbox(email: string): Promise<{ assunto: string; corpo: string }[]> {
  return (await lerSaida()).filter((l) => l.servico === "email" && l.para === email).map((l) => ({ assunto: String(l.assunto ?? ""), corpo: String(l.corpo ?? "") }));
}

async function linha(usuarioId: string, evento: string, refId: string) {
  const { data } = await adm().from("emails_proativos").select("enviado_em, descartado_em, motivo_descarte").eq("chave", chave(usuarioId, evento, refId)).single();
  return data as { enviado_em: string | null; descartado_em: string | null; motivo_descarte: string | null };
}

test.describe("T711 — E264-B: o corpo dos 5 proativos (pessoa, imóvel, fato), descadastro pelo link do e-mail e teto semanal", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
  test.skip(emSilencio(), "Silêncio das 22h às 7h (Brasília): nenhum proativo sai, de propósito.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await conta("dono", "Dora Proativa", "owner");
    ids.olga = await conta("olga", "Olga Proativa", "owner");
    ids.paula = await conta("paula", "Paula Proativa", "owner");
    for (const [k, nome] of [["ana", "Ana Proativa"], ["beto", "Beto Proativo"], ["caio", "Caio Proativo"], ["eva", "Eva Proativa"]] as const) ids[k] = await conta(k, nome, "tenant");
    for (let i = 1; i <= 6; i++) imoveis.push(await criarImovelPronto(ids.dono, titulo(i), { ativo: true }));
    ids.imovelOlga = await criarImovelPronto(ids.olga, tituloDona("Olga"), { ativo: true });
    ids.imovelPaula = await criarImovelPronto(ids.paula, tituloDona("Paula"), { ativo: true });
    // Quatro pedidos do Caio que combinam com os imóveis da Olga e da Paula (Uberlândia, 2 pessoas, R$ 3.200, 3 meses).
    for (let i = 0; i < 4; i++) await pedido(ids.caio, 10 + i);
    // O pedido que expira em ~3,5 dias (o gatilho: criado há 26,5 dias, entrada em 2 dias → 30 dias da criação).
    const exp = await pedido(ids.caio, 2, 26.5);
    ids.pedidoExpira = exp.id;
    ids.entradaExpira = exp.entrada;
    const { data: busca, error } = await adm().from("buscas_salvas").insert({ usuario_id: ids.beto, parametros: "local=Uberl%C3%A2ndia", resumo: "Uberlândia", alerta_ativo: true }).select("id").single();
    expect(error).toBeNull();
    ids.busca = busca!.id as string;

    const log = createWriteStream(`${SAIDA}/t711-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`${BASE}/api/cron/resumo-pedidos`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const todos = ["dono", "olga", "paula", "ana", "beto", "caio", "eva"].map((k) => ids[k]).filter(Boolean);
    await adm().from("emails_proativos").delete().in("usuario_id", todos);
    await adm().from("emails_teste").delete().in("usuario_id", todos);
    for (const u of todos) await liberarDespacho(u);
    if (pedidos.length) await adm().from("pedidos_moradia").delete().in("id", pedidos);
    if (ids.beto) await adm().from("buscas_salvas").delete().eq("usuario_id", ids.beto);
    await apagarContas(todos);
  });

  test("A–E: cada um dos 5 proativos nomeia a pessoa, o imóvel ou o pedido, e traz o cartão; agrupado e com teto entre tipos", async () => {
    // Fila na ordem em que os avisos teriam nascido (o lote é o do pendente mais antigo de cada pessoa).
    expect((await fila(ids.ana, "pedido_imovel_novo", imoveis[0])).error).toBeNull();
    for (const im of imoveis.slice(0, 2)) expect((await fila(ids.beto, "saved_search_match", im, { busca_id: ids.busca })).error).toBeNull();
    expect((await fila(ids.beto, "pedido_imovel_novo", imoveis[2])).error).toBeNull();
    expect((await fila(ids.olga, "pedido_compativel", pedidos[0], { imovel_id: ids.imovelOlga })).error).toBeNull();
    for (const p of pedidos.slice(0, 4)) expect((await fila(ids.paula, "pedido_compativel", p, { imovel_id: ids.imovelPaula })).error).toBeNull();
    expect((await fila(ids.caio, "pedido_expirando", ids.pedidoExpira)).error).toBeNull();
    await rodar();

    // A — Ana: um imóvel novo para o pedido.
    await expect.poll(async () => (await caixa(ids.ana)).length, { timeout: 30_000 }).toBe(1);
    const [a] = await caixa(ids.ana);
    expect(a.evento).toBe("pedido_imovel_novo");
    expect(a.assunto).toBe("Surgiu um imóvel que combina com o seu pedido · Viva Nomads");
    expect(a.corpo).toContain("Olá Ana, um imóvel publicado agora combina com o seu pedido de moradia.");
    expect(a.corpo).toContain(`• ${titulo(1)} — Centro, Uberlândia - MG`);
    expect(a.corpo).toMatch(/Total por mês \(com contas\): R\$ [\d.]+/);
    expect(a.corpo).toContain(`Ver o imóvel: `);
    expect(a.corpo).toContain(`/imoveis/${imoveis[0]}`);
    // A caixa de teste esconde o link assinado; a linha do descadastro está lá.
    expect(a.corpo).toContain("Não quero mais este tipo de e-mail: [link com token removido]");
    expect(a.corpo).not.toContain("Ver os ");
    // No HTML que saiu: o botão do cartão leva ao anúncio e o descadastro é um link de verdade.
    await expect.poll(async () => (await noOutbox(emails.ana)).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
    const htmlA = (await noOutbox(emails.ana)).at(-1)!.corpo;
    expect(htmlA).toMatch(new RegExp(`Ver o imóvel \\(https?://[^)\\s]+/imoveis/${imoveis[0]}\\)`));
    expect(htmlA).toMatch(/Não quero mais este tipo de e-mail \(https?:\/\/[^)\s]+\/avisos\/desligar\?u=/);

    // B — Beto: 2 imóveis da busca num e-mail só; o pedido_imovel_novo dele espera (teto por pessoa, entre tipos).
    await expect.poll(async () => (await caixa(ids.beto)).length, { timeout: 30_000 }).toBe(1);
    const [b] = await caixa(ids.beto);
    expect(b.evento).toBe("saved_search_match");
    expect(b.assunto).toBe("2 imóveis combinam com a sua busca · Viva Nomads");
    expect(b.corpo).toContain("Olá Beto, 2 imóveis novos combinam com a sua busca salva.");
    for (const i of [1, 2]) expect(b.corpo).toContain(`• ${titulo(i)} — Centro, Uberlândia - MG`);
    expect(contar(b.corpo, "Ver o imóvel:")).toBe(2);
    expect(b.corpo).not.toContain(titulo(3));
    expect(b.corpo).not.toContain("Ver os ");
    expect(await linha(ids.beto, "pedido_imovel_novo", imoveis[2])).toMatchObject({ enviado_em: null, descartado_em: null });

    // C — Olga (dona): um pedido compatível com o imóvel dela.
    await expect.poll(async () => (await caixa(ids.olga)).length, { timeout: 30_000 }).toBe(1);
    const [c] = await caixa(ids.olga);
    expect(c.evento).toBe("pedido_compativel");
    expect(c.assunto).toBe("Um pedido de moradia combina com o seu imóvel · Viva Nomads");
    expect(c.corpo).toContain("Olá Olga, um pedido de moradia combina com um dos seus imóveis.");
    expect(c.corpo).toContain(`• Pedido de moradia (Combina com “${tituloDona("Olga")}”)`);
    for (const t of ["Cidade: Uberlândia - MG", `Entrada: ${dataBR(diaISO(10))} · 3 meses`, "Orçamento: até R$ 3.200 por mês", "Pessoas: 2", "Pets: Não", "Responder ao pedido: "]) expect(c.corpo).toContain(t);
    expect(c.corpo).toContain(`/dashboard/pedidos-cidade?pedido=${pedidos[0]}&imovel=${ids.imovelOlga}`);

    // D — Paula (dona): 4 pedidos → o resumo, 3 cartões e "Ver os 4 pedidos".
    await expect.poll(async () => (await caixa(ids.paula)).length, { timeout: 30_000 }).toBe(1);
    const [d] = await caixa(ids.paula);
    expect(d.evento).toBe("pedido_resumo");
    expect(d.assunto).toBe("4 pedidos de moradia combinam com os seus imóveis · Viva Nomads");
    expect(d.corpo).toContain("Olá Paula, 4 pedidos de moradia combinam com os seus imóveis.");
    expect(contar(d.corpo, `Combina com “${tituloDona("Paula")}”`)).toBe(3);
    expect(contar(d.corpo, "Responder ao pedido:")).toBe(3);
    expect(d.corpo).toMatch(/Ver os 4 pedidos: https?:\/\/\S+\/dashboard\/pedidos-cidade/);
    // Os 4 saíram neste e-mail (os que não viraram cartão estão no "ver os 4"): nada fica na fila da Paula.
    for (const p of pedidos.slice(0, 4)) expect((await linha(ids.paula, "pedido_compativel", p)).enviado_em).not.toBeNull();

    // E — Caio: o pedido que expira.
    await expect.poll(async () => (await caixa(ids.caio)).length, { timeout: 30_000 }).toBe(1);
    const [e] = await caixa(ids.caio);
    expect(e.evento).toBe("pedido_expirando");
    expect(e.assunto).toBe("Seu pedido de moradia expira em 4 dias · Viva Nomads");
    expect(e.corpo).toContain("Olá Caio, o seu pedido de moradia está perto de expirar.");
    for (const t of ["• Pedido de moradia", "Cidade: Uberlândia - MG", `Entrada: ${dataBR(ids.entradaExpira)} · 3 meses`, "Renovar o pedido: "]) expect(e.corpo).toContain(t);
    expect(e.corpo).toMatch(/Renovar o pedido: https?:\/\/\S+\/dashboard\/pedidos/);

    // Privacidade dos cartões: nem o proprietário (para quem procura) nem quem pediu (para a dona) aparecem pelo nome.
    for (const m of [a, b]) expect(semRodape(m.corpo)).not.toMatch(/Dora|dono\.t711|Rua\b/);
    for (const m of [c, d]) expect(semRodape(m.corpo)).not.toMatch(/Caio|caio\.t711/);
    // Todo proativo tem a saída "Não quero mais este tipo de e-mail".
    for (const m of [a, b, c, d, e]) expect(m.corpo).toContain("Não quero mais este tipo de e-mail");
  });

  test("F: o link do e-mail descadastra de verdade (GET → página → confirmar) e o próximo proativo é descartado", async ({ browser }) => {
    const html = (await noOutbox(emails.ana)).at(-1)?.corpo ?? "";
    const achado = /Não quero mais este tipo de e-mail \((https?:\/\/[^)\s]+\/avisos\/desligar\?[^)\s]+)\)/.exec(html);
    expect(achado, "o link do descadastro no HTML do e-mail").toBeTruthy();
    const link = new URL(achado![1].replace(/&amp;/g, "&"));
    // O link é o assinado com o segredo do servidor (o mesmo do one-click do List-Unsubscribe).
    expect(link.searchParams.get("u")).toBe(ids.ana);
    expect(link.searchParams.get("t")).toBe(createHmac("sha256", SEGREDO).update(`descadastro:sugestoes:${ids.ana}`).digest("base64url"));
    // O site do e-mail é o do laboratório (sem CRON_SECRET): o mesmo caminho vai ao 2º servidor, que tem o segredo.
    const caminho = `${link.pathname}${link.search}`;

    // O GET do endereço do one-click (alguém abriu o link do cabeçalho) leva à página com confirmação.
    const get = await fetch(`${BASE}/api/avisos/desligar${link.search}`, { redirect: "manual" });
    expect(get.status).toBe(303);
    expect(get.headers.get("location") ?? "").toContain(`/avisos/desligar?u=${ids.ana}&t=`);
    // Só abrir não desliga nada.
    expect((await adm().from("profiles").select("notif_categorias_desligadas").eq("id", ids.ana).single()).data?.notif_categorias_desligadas ?? []).not.toContain("sugestoes");

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    // Link adulterado: não desliga e explica.
    await page.goto(`${BASE}/avisos/desligar?u=${ids.ana}&t=adulterado`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Este link não é válido.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("sugestoes-desligar")).toHaveCount(0);
    await page.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("sugestoes-desligar").click();
    await expect(page.getByTestId("sugestoes-desligadas")).toBeVisible({ timeout: 20_000 });
    await ctx.close();
    const { data: p } = await adm().from("profiles").select("notif_categorias_desligadas, notif_email").eq("id", ids.ana).single();
    expect(p?.notif_categorias_desligadas).toEqual(["sugestoes"]);
    expect(p?.notif_email).not.toBe(false);

    // Depois: um imóvel novo para o pedido da Ana, com o teto livre (o 1º e-mail "saiu há 2 dias") → descartado, nada sai.
    await enviadoHa(ids.ana, "pedido_imovel_novo", imoveis[0], 2);
    expect((await fila(ids.ana, "pedido_imovel_novo", imoveis[1])).error).toBeNull();
    await liberarDespacho(ids.ana);
    await rodar();
    await expect.poll(async () => (await linha(ids.ana, "pedido_imovel_novo", imoveis[1])).motivo_descarte, { timeout: 30_000 }).toBe("desligado");
    expect((await linha(ids.ana, "pedido_imovel_novo", imoveis[1])).enviado_em).toBeNull();
    expect(await caixa(ids.ana)).toHaveLength(1);
  });

  test("G: sem repetição no 2º disparo e teto semanal (3 em 7 dias; o 4º espera a janela)", async () => {
    const ev = "pedido_imovel_novo";
    const enviar = async (n: number) => {
      await liberarDespacho(ids.eva);
      await rodar();
      await expect.poll(async () => (await caixa(ids.eva)).length, { timeout: 30_000 }).toBe(n);
      return (await caixa(ids.eva)).at(-1)!;
    };

    // 1º e-mail: o imóvel 1, com o nome dela.
    expect((await fila(ids.eva, ev, imoveis[0])).error).toBeNull();
    const m1 = await enviar(1);
    expect(m1.corpo).toContain("Olá Eva, um imóvel publicado agora combina com o seu pedido de moradia.");
    expect(m1.corpo).toContain(`• ${titulo(1)} — Centro, Uberlândia - MG`);

    // Sem repetição: no dia seguinte (teto do dia livre) o disparo roda de novo e o imóvel 1 não volta; enfileirar o
    // mesmo (pessoa, evento, imóvel) é recusado pela chave única.
    await enviadoHa(ids.eva, ev, imoveis[0], 1);
    await liberarDespacho(ids.eva);
    await rodar();
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await caixa(ids.eva)).toHaveLength(1);
    expect((await fila(ids.eva, ev, imoveis[0])).error?.code).toBe("23505");
    const { count } = await adm().from("emails_proativos").select("id", { count: "exact", head: true }).eq("chave", chave(ids.eva, ev, imoveis[0]));
    expect(count).toBe(1);

    // 2º e 3º e-mails em dias diferentes (o anterior "saiu" antes): cada um só com o imóvel novo.
    await enviadoHa(ids.eva, ev, imoveis[0], 3);
    expect((await fila(ids.eva, ev, imoveis[1])).error).toBeNull();
    const m2 = await enviar(2);
    expect(m2.corpo).toContain(`• ${titulo(2)} — Centro, Uberlândia - MG`);
    expect(m2.corpo).not.toContain(titulo(1));
    await enviadoHa(ids.eva, ev, imoveis[1], 2);
    expect((await fila(ids.eva, ev, imoveis[2])).error).toBeNull();
    const m3 = await enviar(3);
    expect(m3.corpo).toContain(`• ${titulo(3)} — Centro, Uberlândia - MG`);
    await enviadoHa(ids.eva, ev, imoveis[2], 1);

    // Teto semanal: 3 e-mails nos últimos 7 dias (nenhum hoje) → o 4º não sai e fica na fila.
    expect((await fila(ids.eva, ev, imoveis[3])).error).toBeNull();
    await liberarDespacho(ids.eva);
    await rodar();
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await caixa(ids.eva)).toHaveLength(3);
    expect(await linha(ids.eva, ev, imoveis[3])).toMatchObject({ enviado_em: null, descartado_em: null });

    // O mais antigo sai da janela de 7 dias → o pendente sai, sozinho.
    await enviadoHa(ids.eva, ev, imoveis[0], 8.5);
    const m4 = await enviar(4);
    expect(m4.corpo).toContain(`• ${titulo(4)} — Centro, Uberlândia - MG`);
    for (const i of [1, 2, 3]) expect(m4.corpo).not.toContain(titulo(i));
  });
});
