/*
  E1247, passo 1 (ORDEM-DUET 1233, decisão do coordenador; MAPA-E1247 da Fable) — os avisos das rotinas que viajam com o
  evento do contrato (caução, parcela mensal, pré-aceite de 72 h):
   - o TÍTULO do aviso é o assunto do e-mail do mesmo evento, lido da MESMA constante (ASSUNTOS), nunca escrito à mão;
   - o BOTÃO leva ao lugar da ação daquele evento, nunca "Assinar o contrato";
   - o CORPO traz o número (VN-CT do contrato; no pré-aceite, que ainda não tem contrato, a proposta);
   - CRÍTICO só quando pede uma ação da pessoa com prazo em até 24 h ou já vencido; o resto é normal.
  E as guardas: a conferência do sino (E676/E1242) não confunde estes avisos com o de assinar (o crítico da caução
  vencida não some da faixa); dois assuntos da mesma pessoa ficam em duas linhas; o aviso de assinar segue como hoje.
  O passo 2 (eventos próprios, ref_id, resolução pela ação) é a condição para ligar cada chave — fora daqui.
  Roda: node --test src/lib/notifications/e1247-avisos-das-rotinas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASSUNTOS } from "./assuntos.ts";
import * as sino from "./sino.ts";
import { chaveDoAvisoPendente } from "./avisos.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

type Papel = "proprietario" | "inquilino";
type Aviso = { titulo: string; prioridade: "critico" | "normal"; botao: string };
const mod = (await import("./avisos-rotinas-contrato.ts").catch(() => ({}))) as { avisoDaRotina?: (chave: string, papel: Papel) => Aviso };
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8"));

test("1. a tabela do coordenador: título = ASSUNTOS, prioridade pela regra, botão do lugar da ação", () => {
  assert.equal(typeof mod.avisoDaRotina, "function");
  const a = mod.avisoDaRotina!;
  assert.deepEqual(a("caucaoLiberacaoIntegral", "proprietario"), { titulo: ASSUNTOS.caucaoLiberacaoIntegral, prioridade: "normal", botao: "Ver a caução" });
  assert.deepEqual(a("caucaoLiberacaoIntegral", "inquilino"), { titulo: ASSUNTOS.caucaoLiberacaoIntegral, prioridade: "normal", botao: "Ver a caução" });
  assert.deepEqual(a("caucaoDevolucaoAtraso", "proprietario"), { titulo: ASSUNTOS.caucaoDevolucaoAtraso, prioridade: "critico", botao: "Ver a caução" });
  assert.deepEqual(a("lembreteParcelaAluguel", "inquilino"), { titulo: ASSUNTOS.lembreteParcelaAluguel, prioridade: "normal", botao: "Ver os pagamentos" });
  assert.deepEqual(a("pagamentoRegistradoMorador", "proprietario"), { titulo: ASSUNTOS.pagamentoRegistradoMorador, prioridade: "normal", botao: "Ver os pagamentos" });
  assert.deepEqual(a("preAceitacaoLembrete", "inquilino"), { titulo: ASSUNTOS.preAceitacaoLembrete, prioridade: "critico", botao: "Responder à proposta" });
  assert.deepEqual(a("preAceitacaoLembrete", "proprietario"), { titulo: ASSUNTOS.preAceitacaoLembrete, prioridade: "normal", botao: "Ver a proposta" });
  for (const k of ["preAceitacaoExpirou", "preAceitacaoPerdeuVez", "preAceitacaoEncerrada"]) {
    for (const p of ["inquilino", "proprietario"] as const) assert.deepEqual(a(k, p), { titulo: ASSUNTOS[k as keyof typeof ASSUNTOS], prioridade: "normal", botao: "Ver a proposta" }, `${k}/${p}`);
  }
});

test("2. o botão da faixa: o da rotina, nunca 'Assinar o contrato'; o aviso de assinar continua igual", () => {
  const acao = sino.acaoDaFaixa as unknown as (evento: string, titulo?: string | null) => string;
  assert.equal(acao("contract_status", ASSUNTOS.caucaoDevolucaoAtraso), "Ver a caução");
  assert.equal(acao("contract_status", `${ASSUNTOS.caucaoDevolucaoAtraso} · Casa no Centro`), "Ver a caução", "com o imóvel no título");
  assert.equal(acao("contract_status", ASSUNTOS.preAceitacaoLembrete), "Responder à proposta");
  assert.equal(acao("contract_status", "Assinar o contrato — Studio, estadia de 01/12 a 31/01"), "Assinar o contrato");
  assert.equal(acao("contract_status"), "Assinar o contrato");
  assert.match(ler("components/painel/sino-avisos.tsx"), /acaoDaFaixa\(c\.evento, c\.titulo\)/);
});

test("3. a conferência do sino não dá o crítico da caução vencida por 'assinatura cumprida' (não some da faixa)", () => {
  const C = "11111111-1111-4111-8111-111111111111";
  const base = { criado_em: "2026-11-27T10:00:00Z", lido_em: null, resolvido_em: null };
  const caucao = { ...base, id: "a", evento: "contract_status", prioridade: "critico" as const, titulo: ASSUNTOS.caucaoDevolucaoAtraso, url: `/dashboard/contratos/${C}`, ref_id: null };
  const assinar = { ...base, id: "b", evento: "contract_status", prioridade: "critico" as const, titulo: "Assinar o contrato — Studio", url: `/dashboard/contratos/${C}`, ref_id: C };
  const r = sino.resolvidosNaPratica([caucao, assinar], { assinarPendente: new Set(), aditivoAberto: new Set() }, "2026-11-27T12:00:00Z");
  assert.equal(r.find((x) => x.id === "a")!.resolvido_em, null, "a caução vencida fica");
  assert.ok(r.find((x) => x.id === "b")!.resolvido_em, "o de assinar, já assinado, resolve como hoje");
});

test("4. dois assuntos da mesma pessoa ficam em duas linhas (chaves diferentes)", () => {
  const k1 = chaveDoAvisoPendente({ evento: "contract_status", refId: null, titulo: ASSUNTOS.lembreteParcelaAluguel });
  const k2 = chaveDoAvisoPendente({ evento: "contract_status", refId: null, titulo: ASSUNTOS.caucaoLiberacaoIntegral });
  assert.notDeepEqual(k1, k2);
});

test("5. estático: nenhuma chamada com o evento do contrato fica sem título e prioridade ditos (fora as da assinatura)", () => {
  for (const f of ["lib/caucao/prazos-servidor.ts", "lib/cobranca-mensal/acoes.ts", "lib/cobranca-mensal/servidor.ts", "lib/propostas/pre-aceitacao-servidor.ts"]) {
    const src = ler(f);
    // E1247 passo 2 (PR 1): a parcela passou ao evento próprio (EVENTO_DA_ROTINA); a regra vale para os dois.
    const chamadas = src.split(/event: (?:"contract_status"|EVENTO_DA_ROTINA\.\w+)/).slice(1);
    assert.ok(chamadas.length > 0, f);
    for (const c of chamadas) {
      const corpo = c.slice(0, c.indexOf("});") > 0 ? c.indexOf("});") : 600);
      assert.match(corpo, /tituloAviso: \w+\.titulo/, `${f}: o título da rotina`);
      assert.match(corpo, /prioridadeAviso: \w+\.prioridade/, `${f}: a prioridade da rotina`);
      assert.match(corpo, /textoAviso: /, `${f}: o número no corpo`);
    }
    assert.match(src, /avisoDaRotina\(/, `${f}: a tabela única`);
  }
  // O texto do aviso chega ao sino.
  assert.match(ler("lib/notifications/index.ts"), /texto: params\.textoAviso \?\? mensagem\?\.texto/);
});
