import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2146 — E345 @E345: o pedido de avaliação não se contradiz no mesmo e-mail.
  Regra decidida (E345; unitário src/lib/automacoes/e345-frase-avaliacao.test.ts): o corpo e o bloco de detalhes dizem a
  MESMA frase (FRASE_AVALIACAO): "Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários." Antes, o
  bloco dizia só "ajuda os próximos moradores".
  A prova: contrato assinado pelas duas partes, com o único bloco a terminar ONTEM (Brasília), o que pede a avaliação
  hoje. O cron de automações corre num 2.º servidor do mesmo build (porta 3138, padrão do t597/t2130), com CRON_SECRET só
  dele e AUTOMACOES_ATIVO=1. A leitura é na caixa de testes (emails_teste) das duas partes: em cada e-mail, toda menção a
  "ajuda os próximos moradores" é a frase inteira, e ela aparece no corpo e no bloco (duas vezes).
*/
const PORTA = 3138;
const SEGREDO = `lab-t2146-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const FRASE = "Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários.";
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `Apto da avaliação ${sufixo}`;
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2146.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

const ocorrencias = (texto: string, trecho: string) => texto.split(trecho).length - 1;

test.describe("T2146 — E345: o pedido de avaliação diz uma frase só, no corpo e no bloco @E345", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await conta("dono", "Telma Dona", "owner");
    ids.inq = await conta("inq", "Vitor Morador", "tenant");
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ address: "Santa Mônica", city: "Uberlândia" }).eq("id", ids.imovel);
    const lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const fim = somar(hojeBRT(), -1);
    const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: somar(fim, -59), fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora }).select("id").single();
    if (e1) throw e1;
    ids.bloco = b1.id as string;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.contrato) {
      await adm().from("contrato_eventos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    const pessoas = [ids.dono, ids.inq].filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("estadia terminada ontem: o pedido de avaliação às duas partes diz a frase inteira no corpo e no bloco", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA_LOG}/t2146-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    expect(r.status, await r.clone().text()).toBe(200);

    for (const [quem, nome] of [[ids.inq, "o morador"], [ids.dono, "a dona"]] as const) {
      const caixa = async () => {
        const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", quem).eq("evento", "avaliacao_pedido");
        return (data ?? []).map((d) => String(d.corpo ?? ""));
      };
      await expect.poll(async () => (await caixa()).length, { timeout: 30_000, message: `o pedido de avaliação chegou a ${nome}` }).toBe(1);
      const [corpo] = await caixa();
      expect(ocorrencias(corpo, FRASE), `a frase inteira no corpo e no bloco (${nome})`).toBe(2);
      expect(ocorrencias(corpo, "ajuda os próximos moradores"), `nenhuma versão encurtada da frase (${nome})`).toBe(ocorrencias(corpo, FRASE));
    }
  });
});
