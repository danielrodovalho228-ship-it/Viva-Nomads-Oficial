import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T695 — E264-B: e-mails proativos pela fila, de verdade (o disparo diário /api/cron/resumo-pedidos), na caixa de teste:
    A. Ana: 2 imóveis novos para o pedido → UM e-mail com 2 cartões ("2 imóveis combinam com o seu pedido");
    B. Beto: 5 imóveis para a busca salva → UM e-mail com 3 cartões e "Ver os 5 imóveis";
    C. Caio: o pedido de moradia que expira em 4 dias → cartão do pedido e o assunto com os dias de verdade;
    D. sem repetição: a mesma (pessoa, evento, imóvel) não entra duas vezes na fila;
    E. teto: rodar de novo no mesmo dia não manda outro e-mail (o novo pendente espera);
    F. descadastro de um clique (POST do provedor, sem login): desliga só "Sugestões e novidades".
  O laboratório não tem CRON_SECRET: como a t592, o teste sobe um 2º servidor do MESMO build (porta 3126) com um
  segredo só dele. No silêncio (22h–7h de Brasília) nada sai, de propósito: o teste pula nesse horário.
*/
const PORTA = 3126;
const SEGREDO = `lab-t695-${Math.random().toString(36).slice(2)}`;
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const imoveis: string[] = [];
let servidor: ChildProcess | null = null;
const horaBRT = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
const emSilencio = () => horaBRT() >= 22 || horaBRT() < 7;
const chave = (u: string, ev: string, ref: string) => `proativo:${ev}:${u}:${ref}`;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t695.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

async function fila(usuarioId: string, evento: string, refId: string, extra: Record<string, unknown> = {}) {
  return adm().from("emails_proativos").insert({ usuario_id: usuarioId, evento, ref_id: refId, chave: chave(usuarioId, evento, refId), extra });
}

async function rodar() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/resumo-pedidos`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  expect(r.status).toBe(200);
}

async function caixa(usuarioId: string): Promise<{ evento: string; assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("evento, assunto, corpo").eq("usuario_id", usuarioId).order("criado_em");
  return (data ?? []) as { evento: string; assunto: string; corpo: string }[];
}

test.describe("T695 — E264-B: proativos com cartão, agrupados, sem repetição, com teto e descadastro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
  test.skip(emSilencio(), "Silêncio das 22h às 7h (Brasília): nenhum proativo sai, de propósito.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await conta("dono", "Dora Proativo", "owner");
    for (const k of ["ana", "beto", "caio"]) ids[k] = await conta(k, `${k[0].toUpperCase()}${k.slice(1)} Proativo`, "tenant");
    for (let i = 1; i <= 5; i++) imoveis.push(await criarImovelPronto(ids.dono, `Apto proativo ${i} t695 ${sufixo}`, { ativo: true }));
    // A: dois imóveis novos para o pedido da Ana.
    for (const im of imoveis.slice(0, 2)) expect((await fila(ids.ana, "pedido_imovel_novo", im)).error).toBeNull();
    // B: cinco imóveis para a busca salva do Beto.
    const { data: busca, error: eb } = await adm().from("buscas_salvas").insert({ usuario_id: ids.beto, parametros: "local=Uberl%C3%A2ndia", resumo: "Uberlândia", alerta_ativo: true }).select("id").single();
    expect(eb).toBeNull();
    for (const im of imoveis) expect((await fila(ids.beto, "saved_search_match", im, { busca_id: busca!.id })).error).toBeNull();
    // C: o pedido do Caio expira em 4 dias. O gatilho trg_pedido_expira calcula expira_em = maior entre criado_em + 30 dias
    // e o fim do dia de entrada: publicado há 26,5 dias com entrada em 2 dias → expira em ~3,5 dias (o e-mail diz 4).
    const { data: ped, error: ep } = await adm()
      .from("pedidos_moradia")
      .insert({ inquilino_id: ids.caio, cidade: "Uberlândia", uf: "MG", data_inicio: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10), prazo_meses: 3, orcamento_mensal: 3200, qtd_ocupantes: 2, motivo: "trabalho_remoto", pets: true, compativeis_ao_publicar: 0, criado_em: new Date(Date.now() - 26.5 * 86_400_000).toISOString() })
      .select("id, expira_em")
      .single();
    expect(ep).toBeNull();
    const faltam = (new Date(ped!.expira_em as string).getTime() - Date.now()) / 86_400_000;
    expect(faltam).toBeGreaterThan(3.2);
    expect(faltam).toBeLessThan(3.8);
    ids.pedidoCaio = ped!.id;
    expect((await fila(ids.caio, "pedido_expirando", ids.pedidoCaio)).error).toBeNull();

    const log = createWriteStream(`${SAIDA}/t695-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/resumo-pedidos`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const todos = [ids.dono, ids.ana, ids.beto, ids.caio].filter(Boolean);
    await adm().from("emails_proativos").delete().in("usuario_id", todos);
    await adm().from("emails_teste").delete().in("usuario_id", todos);
    if (ids.pedidoCaio) await adm().from("pedidos_moradia").delete().eq("id", ids.pedidoCaio);
    await adm().from("buscas_salvas").delete().eq("usuario_id", ids.beto ?? "");
    await apagarContas(todos);
  });

  test("D: a mesma (pessoa, evento, imóvel) não entra duas vezes na fila (o caso de 23/10)", async () => {
    const r = await fila(ids.ana, "pedido_imovel_novo", imoveis[0]);
    expect(r.error?.code).toBe("23505");
  });

  test("A–C: um e-mail por pessoa, com cartões, agrupado e com o descadastro", async () => {
    await rodar();
    await expect.poll(async () => (await caixa(ids.ana)).length, { timeout: 30_000 }).toBe(1);
    const [a] = await caixa(ids.ana);
    expect(a.evento).toBe("pedido_imovel_novo");
    expect(a.assunto).toBe("2 imóveis combinam com o seu pedido · Viva Nomads");
    for (const t of [`Apto proativo 1 t695 ${sufixo}`, `Apto proativo 2 t695 ${sufixo}`, "Total por mês (com contas)", "Ver o imóvel", "Não quero mais este tipo de e-mail"]) expect(a.corpo).toContain(t);
    expect(a.corpo).not.toContain("Ver os ");

    await expect.poll(async () => (await caixa(ids.beto)).length, { timeout: 30_000 }).toBe(1);
    const [b] = await caixa(ids.beto);
    expect(b.evento).toBe("saved_search_match");
    expect(b.assunto).toBe("5 imóveis combinam com a sua busca · Viva Nomads");
    expect(b.corpo).toContain("Ver os 5 imóveis");
    expect((b.corpo.match(/Ver o imóvel:/g) ?? []).length).toBe(3);

    await expect.poll(async () => (await caixa(ids.caio)).length, { timeout: 30_000 }).toBe(1);
    const [c] = await caixa(ids.caio);
    expect(c.evento).toBe("pedido_expirando");
    expect(c.assunto).toBe("Seu pedido de moradia expira em 4 dias · Viva Nomads");
    for (const t of ["Pedido de moradia", "Cidade: Uberlândia - MG", "Orçamento: até R$ 3.200 por mês", "Pessoas: 2", "Pets: Sim", "Renovar o pedido"]) expect(c.corpo).toContain(t);

    // Nenhum cartão leva endereço exato nem dado do proprietário (o corpo é a mensagem; o rodapé é o padrão).
    for (const m of [a, b, c]) expect(m.corpo.split("— Viva Nomads")[0]).not.toMatch(/Dora Proativo|dono\.t695|@lab\.vivanomads\.test|\bRua\b/);
  });

  test("E: teto — rodar de novo no mesmo dia não manda outro e-mail; o novo pendente espera", async () => {
    expect((await fila(ids.ana, "pedido_imovel_novo", imoveis[2])).error).toBeNull();
    await rodar();
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await caixa(ids.ana)).toHaveLength(1);
    const { data } = await adm().from("emails_proativos").select("enviado_em, descartado_em").eq("chave", chave(ids.ana, "pedido_imovel_novo", imoveis[2])).single();
    expect(data?.enviado_em).toBeNull();
    expect(data?.descartado_em).toBeNull();
  });

  test("F: descadastro de um clique (sem login) desliga só 'Sugestões e novidades' e limpa a fila", async () => {
    const t = createHmac("sha256", SEGREDO).update(`descadastro:sugestoes:${ids.ana}`).digest("base64url");
    const ruim = await fetch(`http://localhost:${PORTA}/api/avisos/desligar?u=${ids.ana}&t=errado`, { method: "POST" });
    expect(ruim.status).toBe(400);
    const r = await fetch(`http://localhost:${PORTA}/api/avisos/desligar?u=${ids.ana}&t=${encodeURIComponent(t)}`, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect(r.status).toBe(200);
    const { data: p } = await adm().from("profiles").select("notif_categorias_desligadas").eq("id", ids.ana).single();
    expect(p?.notif_categorias_desligadas).toEqual(["sugestoes"]);
    const { data: f } = await adm().from("emails_proativos").select("motivo_descarte").eq("chave", chave(ids.ana, "pedido_imovel_novo", imoveis[2])).single();
    expect(f?.motivo_descarte).toBe("descadastro");
  });
});
