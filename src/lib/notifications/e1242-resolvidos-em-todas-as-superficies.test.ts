/*
  E1242 reaberto (ORDEM-DUET 1247; ronda ao vivo das 15h, 27/11) — a lei do E777: UMA regra de resolução para TODAS as
  superfícies de avisos. A correção do #4264 valia no painel do sino, mas a faixa crítica, a página completa
  (/dashboard/notificacoes#avisos), o filtro "Críticos" e o "Não lido"/contagem ainda mostravam avisos resolvidos.
  Agora:
   - uma leitura só (avisosParaAsTelas, src/lib/data/avisos-telas.ts) serve a rota do sino (painel + faixa) e a página;
   - uma regra só (superficieDosAvisos): resolvido = resolvido no banco, ou resolvido agora pela conferência com o
     mesmo critério da gravação (visita de avaliação; assinar/aditivo COM referência — ORDEM-1224);
   - o resolvido sai da lista, da faixa, dos filtros e da contagem de não lidas — nos dois papéis;
   - a contagem lê só os não resolvidos (a mesma regra), e desconta os que a conferência resolveu agora.
  Roda: node --test src/lib/notifications/e1242-resolvidos-em-todas-as-superficies.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as sino from "./sino.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

type A = sino.AvisoTela;
type Sup = { visiveis: A[]; criticos: A[]; naoLidas: number; maiorPrioridade: string | null };
const superficie = (sino as unknown as { superficieDosAvisos?: (resumo: { naoLidas: number; maiorPrioridade: sino.AvisoTela["prioridade"] | null }, antes: readonly A[], conferidos: readonly A[]) => Sup }).superficieDosAvisos;
const C1 = "11111111-1111-4111-8111-111111111111";
const AGORA = "2026-11-27T15:00:00Z";
const base = { criado_em: "2026-11-27T10:00:00Z", lido_em: null, resolvido_em: null, texto: null };
const av = (o: Partial<A> & { id: string; evento: string }): A => ({ ...base, prioridade: "critico", titulo: "Atualização do seu contrato · TESTE QA - Casa", url: `/dashboard/contratos/${C1}`, ref_id: C1, ...o }) as A;
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8"));

test("1. o resolvido no banco (de QUALQUER evento) sai da lista, da faixa e da contagem — o caso da ronda", () => {
  assert.equal(typeof superficie, "function");
  const resolvido = av({ id: "a", evento: "contract_status", resolvido_em: "2026-11-27T12:00:00Z" });
  const proposta = av({ id: "b", evento: "proposal_received", ref_id: "p1", url: "/dashboard/propostas/p1", titulo: "Proposta recebida", resolvido_em: "2026-11-27T12:00:00Z" });
  const vivo = av({ id: "c", evento: "new_message", prioridade: "normal", titulo: "Nova mensagem", url: "/dashboard/mensagens", ref_id: null });
  const antes = [resolvido, proposta, vivo];
  // O resumo do banco já não conta os resolvidos (a mesma regra): 1 não lida.
  const s = superficie!({ naoLidas: 1, maiorPrioridade: "normal" }, antes, antes);
  assert.deepEqual(s.visiveis.map((x) => x.id), ["c"]);
  assert.deepEqual(s.criticos, []);
  assert.equal(s.naoLidas, 1);
  assert.equal(s.maiorPrioridade, "normal");
});

test("2. o que a conferência resolve agora (com referência) também sai, e desconta das não lidas", () => {
  const esquecido = av({ id: "a", evento: "contract_status" });
  const conferidos = sino.resolvidosNaPratica([esquecido], { assinarPendente: new Set(), aditivoAberto: new Set() }, AGORA);
  const s = superficie!({ naoLidas: 1, maiorPrioridade: "critico" }, [esquecido], conferidos);
  assert.deepEqual(s.visiveis, []);
  assert.deepEqual(s.criticos, []);
  assert.equal(s.naoLidas, 0);
  assert.equal(s.maiorPrioridade, null);
});

test("3. guarda (ORDEM-1224): sem referência, a conferência não o dá por resolvido — fica na lista e conta, mas não na faixa", () => {
  const semRef = av({ id: "a", evento: "contract_status", ref_id: null });
  const conferidos = sino.resolvidosNaPratica([semRef], { assinarPendente: new Set(), aditivoAberto: new Set() }, AGORA);
  const s = superficie!({ naoLidas: 1, maiorPrioridade: "critico" }, [semRef], conferidos);
  assert.deepEqual(s.visiveis.map((x) => x.id), ["a"]);
  assert.equal(s.naoLidas, 1);
  assert.deepEqual(s.criticos, [], "a faixa continua a escondê-lo, como hoje");
});

test("4. guarda: o crítico que ainda vale fica em todas as superfícies", () => {
  const falta = av({ id: "a", evento: "contract_status" });
  const conferidos = sino.resolvidosNaPratica([falta], { assinarPendente: new Set([C1]), aditivoAberto: new Set() }, AGORA);
  const s = superficie!({ naoLidas: 1, maiorPrioridade: "critico" }, [falta], conferidos);
  assert.deepEqual(s.visiveis.map((x) => x.id), ["a"]);
  assert.deepEqual(s.criticos.map((x) => x.id), ["a"]);
  assert.equal(s.naoLidas, 1);
  assert.equal(s.maiorPrioridade, "critico");
});

test("5. uma leitura só: a rota do sino e a página completa usam avisosParaAsTelas; a contagem lê só os não resolvidos", () => {
  const rota = ler("app/api/painel/avisos/route.ts");
  assert.match(rota, /avisosParaAsTelas\(60\)/);
  assert.doesNotMatch(rota, /meusAvisos\(/, "a rota não lê os avisos por conta própria");
  const pagina = ler("app/(dashboard)/dashboard/notificacoes/page.tsx");
  assert.match(pagina, /avisosParaAsTelas\(100\)/);
  assert.doesNotMatch(pagina, /meusAvisos\(/, "a página não lê os avisos crus");
  const telas = ler("lib/data/avisos-telas.ts");
  assert.match(telas, /superficieDosAvisos\(/);
  assert.match(telas, /resolucoesConferidasAGravar\(/);
  assert.match(ler("lib/data/avisos-actions.ts"), /\.is\("lido_em", null\)\.is\("resolvido_em", null\)/, "a contagem: não lidas E não resolvidas");
});
