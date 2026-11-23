/*
  E1064 — o Fechamento lê o estado REAL: a verificação de identidade e o contrato.
  Na prova ao vivo de 20/11 o passo 1 exigia o clique "Verificar identidade" de um dono que já tinha a identidade
  confirmada, o selo "Identidade pendente" (do morador) ficava igual depois de o portão abrir e, com o contrato já
  assinado, o Fechamento reaberto recomeçava no passo 1.
  Depois: o servidor lê a identidade do dono pela fonte única e, se está confirmada, o portão já abre aberto; o selo
  diz de quem é ("Identidade do morador: …"); o Resumo separa a identidade do morador da verificação do dono; e, havendo
  contrato, a página diz a situação real dele desde o passo 1.
  Roda: node --test src/lib/e1064-fechamento-le-o-estado-real.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { portaoDaIdentidade, rotuloIdentidadeDoMorador } from "./fechamento-identidade.ts";
import { IDENTIDADE_INDISPONIVEL, estadoIdentidadeDe, type EstadoIdentidade } from "./identidade/estado.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-21T12:00:00Z");
const confirmada: EstadoIdentidade = { estado: "confirmada", texto: "Identidade confirmada · válida até 21/11/2027", validoAte: "2027-11-21T12:00:00Z", vencidaEm: null, acao: null };
const semLaudoTeste = estadoIdentidadeDe(null, true, AGORA); // conta de teste sem laudo: "simulavel"
const semLaudoReal = estadoIdentidadeDe(null, false, AGORA); // conta real: "em_breve"

test("dono com a identidade confirmada: o portão já abre aberto, com o texto da fonte única", () => {
  assert.deepEqual(portaoDaIdentidade(confirmada), { aberto: true, texto: "Identidade confirmada · válida até 21/11/2027" });
});

test("dono sem confirmação válida (sem laudo, vencida, leitura falhou ou sem dado): o portão continua fechado", () => {
  const vencida: EstadoIdentidade = { estado: "vencida", texto: "Identidade vencida em 01/11/2026 · Confirmar de novo", validoAte: null, vencidaEm: "2026-11-01T12:00:00Z", acao: null };
  for (const e of [semLaudoTeste, semLaudoReal, vencida, IDENTIDADE_INDISPONIVEL, null, undefined]) {
    assert.deepEqual(portaoDaIdentidade(e), { aberto: false, texto: null });
  }
});

test("o selo diz de quem é a identidade: a do morador, pela fonte única", () => {
  assert.equal(rotuloIdentidadeDoMorador(confirmada), "Identidade do morador: verificada");
  assert.equal(rotuloIdentidadeDoMorador(semLaudoTeste), "Identidade do morador: pendente");
  assert.equal(rotuloIdentidadeDoMorador(semLaudoReal), "Identidade do morador: pendente");
  assert.equal(rotuloIdentidadeDoMorador(null), "Identidade do morador: pendente");
  // Leitura que falhou nunca vira "pendente".
  assert.equal(rotuloIdentidadeDoMorador(IDENTIDADE_INDISPONIVEL), "Identidade do morador: não conferida agora");
});

test("o servidor lê a identidade do dono e o contrato já existente; a tela usa os dois", () => {
  const ctx = ler("src/lib/data/leads-actions.ts");
  assert.match(ctx, /identidadePropria/);
  assert.match(ctx, /estadosIdentidade\(admin, \[lead\.tenant_id as string, user\.id\]\)/);
  assert.match(ctx, /contratoExistente/);
  const tela = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(tela, /portaoDaIdentidade\(ctx\.identidadePropria\)/);
  assert.match(tela, /rotuloIdentidadeDoMorador\(ctx\.identidadeInquilino\)/);
  assert.match(tela, /data-testid="fechamento-identidade-propria"/);
  assert.match(tela, /label="Identidade do morador"/);
  assert.match(tela, /label="Sua verificação"/);
  assert.match(tela, /data-testid="fechamento-contrato-existente"/);
  // O laudo do DONO deixou de ser apresentado como "Verificação do morador".
  assert.doesNotMatch(tela, /label="Verificação do morador"/);
});
