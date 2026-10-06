/*
  Copiloto da equipe: rascunho só com consultas (nunca ação), fontes visíveis,
  "Quem é a pessoa" registrado no histórico e "Devolver para a Viva" só P3/P4.
  Roda: node --test tests/atendimento/copiloto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SYSTEM_COPILOTO, sugerirRespostaMotor, transcricaoParaRascunho } from "../../src/lib/atendimento/copiloto.ts";
import { mascararEmail, podeDevolverParaViva, ehContaNova } from "../../src/lib/atendimento/copiloto-regras.ts";
import { FERRAMENTAS_LEITURA } from "../../src/lib/atendimento/viva-prompt.ts";
import type { ChamarModelo, Ferramentas, RespostaModelo } from "../../src/lib/atendimento/viva-motor.ts";

/** Modelo falso: devolve as respostas em ordem e guarda o que recebeu. */
function roteiro(respostas: RespostaModelo[]) {
  const pedidos: Parameters<ChamarModelo>[0][] = [];
  const modelo: ChamarModelo = async (req) => {
    pedidos.push(req);
    return respostas[pedidos.length - 1];
  };
  return { modelo, pedidos };
}
const texto = (t: string): RespostaModelo => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });
const usa = (name: string, input: unknown = {}): RespostaModelo => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: `t-${name}`, name, input }] });

test("rascunho consulta a prontidão e devolve o texto com a fonte (nada é enviado)", async () => {
  const { modelo, pedidos } = roteiro([usa("ver_status_anuncio", { imovel_id: null }), texto("Conferimos o seu anúncio: está pronto para publicar.")]);
  const ferramentas: Ferramentas = {
    ver_status_anuncio: async () => ({ conteudo: JSON.stringify([{ imovel: "TESTE", pode_publicar: true, falta_para_publicar: [] }]) }),
  };
  const s = await sugerirRespostaMotor("Pessoa: meu anúncio não publica", modelo, ferramentas);
  assert.equal(s.ok, true);
  assert.equal(s.texto, "Conferimos o seu anúncio: está pronto para publicar.");
  assert.equal(s.fontes.length, 1);
  assert.equal(s.fontes[0].ferramenta, "ver_status_anuncio");
  assert.match(s.fontes[0].resumo, /pode_publicar":true/);
  assert.equal(s.aviso, null);
  // O modelo só recebe ferramentas de CONSULTA.
  assert.deepEqual(pedidos[0].tools.map((t) => t.name).sort(), [...FERRAMENTAS_LEITURA].sort());
  assert.match(pedidos[0].system, /MODO RASCUNHO PARA A EQUIPE/);
});

test("rascunho NUNCA executa ação, mesmo se o modelo tentar", async () => {
  let abriu = false;
  const { modelo } = roteiro([usa("abrir_ordem_manutencao", { descricao: "x", urgencia: "baixa", categoria: "outros", contrato_id: null }), texto("Vamos verificar.")]);
  const s = await sugerirRespostaMotor("Pessoa: a torneira pinga", modelo, {
    abrir_ordem_manutencao: async () => {
      abriu = true;
      return { conteudo: "aberta" };
    },
  });
  assert.equal(abriu, false);
  assert.equal(s.fontes.length, 0);
  assert.equal(s.texto, "Vamos verificar.");
});

test("se a regra aponta algo, o rascunho vem com aviso para a equipe conferir", async () => {
  const { modelo } = roteiro([texto("Resolvemos em até 7 horas.")]);
  const s = await sugerirRespostaMotor("Pessoa: oi", modelo, {});
  assert.equal(s.ok, true);
  assert.match(s.aviso ?? "", /^Confira antes de enviar/);
});

test("falha do modelo vira erro claro, sem texto", async () => {
  const s = await sugerirRespostaMotor("Pessoa: oi", async () => {
    throw new Error("rede");
  }, {});
  assert.equal(s.ok, false);
  assert.equal(s.texto, "");
});

test("a transcrição do rascunho não leva notas internas", () => {
  const t = transcricaoParaRascunho("ctx", [
    { autor: "usuario", corpo: "oi" },
    { autor: "ia", corpo: "segredo interno", interno: true },
    { autor: "admin", corpo: "olá" },
  ]);
  assert.match(t, /Pessoa: oi/);
  assert.match(t, /Equipe: olá/);
  assert.doesNotMatch(t, /segredo interno/);
});

test("Devolver para a Viva: só P3/P4; P1/P2 nunca voltam para a IA", () => {
  assert.equal(podeDevolverParaViva("p1", "aberto").ok, false);
  assert.equal(podeDevolverParaViva("p2", "aberto").ok, false);
  assert.equal(podeDevolverParaViva("p3", "aberto").ok, true);
  assert.equal(podeDevolverParaViva("p4", "em_andamento").ok, true);
  assert.equal(podeDevolverParaViva("p3", "aguardando_aprovacao").ok, false);
  assert.equal(podeDevolverParaViva("p4", "encerrado").ok, false);
});

test("LGPD: e-mail sempre mascarado; conta nova = menos de 30 dias", () => {
  assert.equal(mascararEmail("proprietario1@vivanomads.com.br"), "p•••@vivanomads.com.br");
  assert.equal(mascararEmail(null), null);
  const agora = new Date("2026-10-06T12:00:00Z");
  assert.equal(ehContaNova("2026-10-02T00:00:00Z", agora), true);
  assert.equal(ehContaNova("2026-08-01T00:00:00Z", agora), false);
});

test("a Viva continua se apresentando como assistente virtual (regra fixa); o modo rascunho só vale para a equipe", () => {
  assert.match(SYSTEM_COPILOTO, /assistente virtual/);
  assert.match(SYSTEM_COPILOTO, /rascunho que uma pessoa da equipe vai ler/);
});

/** Corpo de uma função exportada. */
function corpo(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, nome);
  const j = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, j < 0 ? undefined : j);
}

test("servidor: consulta da pessoa vai para o histórico; sugestão não grava mensagem; devolver checa P3/P4", () => {
  const acoes = readFileSync(new URL("../../src/lib/data/atendimento-actions.ts", import.meta.url), "utf8");
  const quem = corpo(acoes, "quemEAPessoa");
  assert.match(quem, /exigirAdmin\(\)/);
  assert.match(quem, /acao: "consulta_pessoa"/);
  assert.ok(quem.indexOf('acao: "consulta_pessoa"') < quem.indexOf("if (!c.usuario_id)"), "registra antes de devolver os dados");
  assert.doesNotMatch(quem, /\bphone\b|\bcpf\b/i);
  const sug = corpo(acoes, "sugerirResposta");
  assert.match(sug, /exigirAdmin\(\)/);
  assert.doesNotMatch(sug, /chamado_mensagens/);
  assert.match(corpo(acoes, "devolverParaViva"), /exigirAdmin\(\)/);
  const servidor = readFileSync(new URL("../../src/lib/atendimento/viva-servidor.ts", import.meta.url), "utf8");
  assert.match(corpo(servidor, "devolverChamadoParaViva"), /podeDevolverParaViva\(c\.prioridade, c\.status\)/);
  assert.doesNotMatch(corpo(servidor, "sugerirRascunho"), /\.insert\(/);
});
