import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1783 — E1180 @E1180 (ORDENS-DUET 824 e 835; endurecimento).
  O avaliador declara no credenciamento em quantos dias entrega o laudo. A aplicação só deixa de 1 a 5; a base ainda
  aceitava de 1 a 30 (a regra antiga). A migração 0364 troca a regra da coluna para 1 a 5.
  Esta trava escreve DIRETO na base do laboratório, sem passar pela aplicação: é o caminho que a aplicação não vigia.
   1. Acima do teto (6 e 30 dias) e abaixo do mínimo (0): a base recusa, pela regra da coluna, e nada fica gravado.
   2. Dentro do teto (1 e 5 dias) e vazio: a base aceita.
  O caminho pela aplicação ("Meus termos": 6 recusado, 5 gravado) é da t1772, caso 4.
  Massa própria, só conta de teste; cidade própria (Araporã); o credenciamento fica "solicitado", fora de qualquer rotina.
  Sem tela: o defeito é de regra da base. Laboratório; não é prova ao vivo no site.
*/
const CIDADE = "Araporã";
const REGRA = "avaliadores_credenciamento_prazo_entrega_dias_check";
const senha = novaSenha();
const sufixo = novoSufixo();
const avaliador = { email: `av.t1783.${sufixo}@lab.vivanomads.test`, nome: "Tito Prazo", role: "tenant" as const };
const ids: Record<string, string> = {};

/** Escreve o prazo direto na base e devolve o erro (ou null) da gravação. */
async function gravarDireto(dias: number | null): Promise<{ code?: string; message: string } | null> {
  const { error } = await adm().from("avaliadores_credenciamento").update({ prazo_entrega_dias: dias }).eq("id", ids.cred);
  return error ? { code: error.code, message: error.message } : null;
}
async function gravado(): Promise<number | null> {
  const { data, error } = await adm().from("avaliadores_credenciamento").select("prazo_entrega_dias").eq("id", ids.cred).single();
  if (error) throw error;
  return (data as { prazo_entrega_dias: number | null }).prazo_entrega_dias;
}

test.describe("T1783 — E1180: a base só aceita prazo de entrega do laudo de 1 a 5 dias @E1180", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.avaliador = await criarConta(avaliador, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.avaliador);
    if (t.error) throw t.error;
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1783-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "solicitado", experiencia_link: "https://portfolio.lab.vivanomads.test/t1783", conduta_versao: "2026-10-23" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    expect(await gravado(), "o credenciamento nasce sem prazo declarado").toBeNull();
  });

  test.afterAll(async () => {
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.avaliador) await adm().from("emails_teste").delete().eq("usuario_id", ids.avaliador);
    await apagarContas([ids.avaliador].filter(Boolean));
  });

  test("1. acima do teto (6 e 30 dias) e abaixo do mínimo (0): a base recusa pela regra da coluna, e nada fica gravado", async () => {
    for (const dias of [6, 30, 0]) {
      const erro = await gravarDireto(dias);
      expect(erro, `${dias} dias: a base recusa a gravação`).not.toBeNull();
      expect(erro?.code, `${dias} dias: recusa por violação de regra`).toBe("23514");
      expect(erro?.message, `${dias} dias: a regra que recusa é a da coluna`).toContain(REGRA);
      expect(await gravado(), `${dias} dias: nada fica gravado`).toBeNull();
    }
  });

  test("2. dentro do teto (1 e 5 dias) e vazio: a base aceita", async () => {
    for (const dias of [1, 5]) {
      expect(await gravarDireto(dias), `${dias} dia(s): a base aceita`).toBeNull();
      expect(await gravado(), `${dias} dia(s): fica gravado`).toBe(dias);
    }
    expect(await gravarDireto(null), "vazio: a base aceita").toBeNull();
    expect(await gravado(), "vazio: fica sem prazo declarado").toBeNull();
  });
});
