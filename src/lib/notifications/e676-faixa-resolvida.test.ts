/*
  E676 (07/11, retomada do E652): as faixas críticas não somem depois que o problema se resolve. "Assinar o contrato"
  seguiu no painel do Lucas depois do contrato assinado pelos dois, e "Proposta de alteração da estadia" seguiu no
  painel do Paulo depois do Aditivo 1 assinado pelos dois.
  Causas: (1) os avisos da estadia eram gravados SEM ref_id (o resolvedor casa por ref_id) e nada os resolvia quando o
  aditivo era respondido ou assinado; (2) a faixa só olhava resolvido_em, sem conferir a situação real do contrato.
  Roda: node --test src/lib/notifications/e676-faixa-resolvida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contratoDoAviso, resolvidosNaPratica, type AvisoTela } from "./sino.ts";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const base = { prioridade: "critico" as const, titulo: "x", url: null, criado_em: "2026-11-07T01:00:00Z", lido_em: null, resolvido_em: null };
const aviso = (o: Partial<AvisoTela> & { id: string; evento: string }): AvisoTela => ({ ...base, ...o });

test("E676: o contrato do aviso vem do ref_id ou, nos avisos antigos, do endereço da estadia", () => {
  assert.equal(contratoDoAviso({ ref_id: C1, url: null }), C1);
  assert.equal(contratoDoAviso({ ref_id: null, url: `/dashboard/estadia/${C2}` }), C2);
  assert.equal(contratoDoAviso({ ref_id: null, url: `/dashboard/contratos/${C2}` }), C2);
  assert.equal(contratoDoAviso({ ref_id: null, url: "/dashboard" }), null);
});

test("E676: contrato assinado por quem recebeu o aviso → o crítico 'assinar' sai; ainda pendente → fica", () => {
  const a = aviso({ id: "a", evento: "contract_status", url: `/dashboard/estadia/${C1}/contrato` });
  const b = aviso({ id: "b", evento: "contract_status", url: `/dashboard/estadia/${C2}/contrato` });
  const sit = { assinarPendente: new Set([C2]), aditivoAberto: new Set<string>() };
  const r = resolvidosNaPratica([a, b], sit, "2026-11-07T09:00:00Z");
  assert.ok(r[0].resolvido_em, "C1 já foi assinado");
  assert.equal(r[1].resolvido_em, null, "C2 ainda falta assinar");
});

test("E676: aditivo respondido/assinado → a 'Proposta de alteração da estadia' sai; aditivo ainda aberto → fica", () => {
  const velho = aviso({ id: "v", evento: "estadia_aditivo_proposto", url: `/dashboard/estadia/${C1}` });
  const aberto = aviso({ id: "o", evento: "estadia_aditivo_proposto", ref_id: C2, url: null });
  const sit = { assinarPendente: new Set<string>(), aditivoAberto: new Set([C2]) };
  const r = resolvidosNaPratica([velho, aberto], sit, "2026-11-07T09:00:00Z");
  assert.ok(r[0].resolvido_em);
  assert.equal(r[1].resolvido_em, null);
});

test("E676: sem a situação do contrato (leitura falhou) ou aviso sem contrato, nada é escondido", () => {
  const a = aviso({ id: "a", evento: "contract_status", url: `/dashboard/estadia/${C1}` });
  const solto = aviso({ id: "s", evento: "contract_status", url: "/dashboard" });
  assert.equal(resolvidosNaPratica([a], null, "2026-11-07T09:00:00Z")[0].resolvido_em, null);
  assert.equal(resolvidosNaPratica([solto], { assinarPendente: new Set(), aditivoAberto: new Set() }, "2026-11-07T09:00:00Z")[0].resolvido_em, null);
  const outro = aviso({ id: "p", evento: "proposta_recebida", ref_id: C1 });
  assert.equal(resolvidosNaPratica([outro], { assinarPendente: new Set(), aditivoAberto: new Set() }, "2026-11-07T09:00:00Z")[0].resolvido_em, null);
});

test("E676: os avisos da estadia levam o ref_id do contrato e o aditivo resolve o aviso de quem respondeu e assinou", () => {
  const est = ler("lib/data/estadia-actions.ts");
  const avisar = est.slice(est.indexOf("function avisar("), est.indexOf("function avisar(") + 900);
  assert.match(avisar, /refId: contratoId/);
  assert.match(est, /resolverAvisos\(/);
  assert.match(est, /eventos: \["estadia_aditivo_proposto"\]/);
  const ass = ler("lib/data/contrato-assinar-actions.ts");
  assert.match(ass, /outraJaAssinou[\s\S]{0,400}resolverAvisos|resolverAvisos[\s\S]{0,400}outroId/);
});

test("E676: a rota do sino aplica a situação real do contrato antes de montar a faixa", () => {
  const rota = ler("app/api/painel/avisos/route.ts");
  assert.match(rota, /resolvidosNaPratica\(/);
  assert.match(rota, /situacaoDosContratos\(/);
});
