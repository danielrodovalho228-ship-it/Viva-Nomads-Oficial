import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2144 — E343 @E343: o e-mail "proposta vencendo" diz o VALOR do que o dono (ou o morador) decide.
  Regra decidida (E343; unitário src/lib/automacoes/e343-proposta-valor.test.ts): o corpo diz o valor mensal e o total do
  contrato ("de R$ X por mês (total do contrato R$ Y)"), e o quadro de dados traz "Valor mensal" e "Total do contrato",
  com a mesma conta da tela (precoDaProposta). Sem valores lidos, nada de "R$ 0".
  A prova: uma proposta aberta de R$ 3.200/mês por 2 meses, que vence daqui a 6 h. O cron de automações corre num 2.º
  servidor do mesmo build (porta 3136, padrão do t597/t2130), com CRON_SECRET só dele e AUTOMACOES_ATIVO=1. A leitura é
  na caixa de testes (emails_teste) da moradora, de quem é a vez (a última versão é do dono).
*/
const PORTA = 3136;
const SEGREDO = `lab-t2144-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `Apto do valor ${sufixo}`;
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2144.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

test.describe("T2144 — E343: o e-mail da proposta vencendo diz o valor mensal e o total @E343", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await conta("dono", "Rafael Dono", "owner");
    ids.inq = await conta("inq", "Sofia Moradora", "tenant");
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ title: TITULO, address: "Santa Mônica", city: "Uberlândia" }).eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data, error } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "enviada", versao_atual: 1, validade_dias: 3, valida_ate: new Date(Date.now() + 6 * 3_600_000).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.proposta = data.id as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({ proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 2, data_entrada: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), total_mensal: 3200, total_contrato: 6400, mensagem: "Proposta de teste do E343." });
    if (ev) throw ev;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const pessoas = [ids.dono, ids.inq].filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("proposta de R$ 3.200 por 2 meses que vence em 6 h: o corpo diz o valor mensal e o total do contrato", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA_LOG}/t2144-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    expect(r.status, await r.clone().text()).toBe(200);

    const caixa = async () => {
      const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.inq).eq("evento", "proposta_vencendo");
      return (data ?? []).map((d) => String(d.corpo ?? ""));
    };
    await expect.poll(async () => (await caixa()).length, { timeout: 30_000, message: "o e-mail da proposta vencendo chegou à moradora (a vez é dela)" }).toBe(1);
    const [corpo] = await caixa();
    expect(corpo, "o corpo diz o valor mensal e o total do contrato").toMatch(/de R\$ 3\.200 por mês \(total do contrato R\$ [\d.]+\)/);
    expect(corpo, "nada de R$ 0").not.toMatch(/R\$ 0(?![\d.,])/);

  });
});
