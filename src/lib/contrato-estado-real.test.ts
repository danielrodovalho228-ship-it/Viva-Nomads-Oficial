import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDoContratoUnico } from "./contrato-estado.ts";

const t = "2026-10-12T12:00:00Z";
const base = { status: "ativo", assinado_proprietario_em: null, assinado_inquilino_em: null, pagamentos_bloco: [] as { tipo: string; confirmado_pelo_inquilino: boolean }[] };
const pago = [{ tipo: "aluguel", confirmado_pelo_inquilino: true }];

test("p28 — estado real do contrato (agora pela fonte única), com o mesmo texto do Fechamento, de Contratos e da página do contrato", () => {
  const e = estadoDoContratoUnico(base, "proprietario");
  assert.deepEqual([e.chave, e.selo, e.faltaVoce], ["aguardando_assinatura", "Aguardando assinatura · falta você e o inquilino", true]);
  assert.equal(estadoDoContratoUnico({ ...base, assinado_proprietario_em: t }, "inquilino").selo, "Aguardando assinatura · falta você");
  assert.equal(estadoDoContratoUnico({ ...base, assinado_inquilino_em: t }, "inquilino").faltaVoce, false);
  // O caso do reteste: o contrato devolvido (de 12/10) já estava assinado pelas duas partes.
  assert.equal(estadoDoContratoUnico({ ...base, assinado_proprietario_em: t, assinado_inquilino_em: t }, "proprietario").selo, "Aguardando 1º pagamento");
  assert.equal(estadoDoContratoUnico({ ...base, assinado_proprietario_em: t, assinado_inquilino_em: t, pagamentos_bloco: pago }, "inquilino").selo, "Em vigência");
  assert.equal(estadoDoContratoUnico({ ...base, status: "encerrado_sem_renovacao" }, "inquilino").selo, "Encerrado (sem renovação)");
  assert.equal(estadoDoContratoUnico({ ...base, status: "cancelado" }, "inquilino").selo, "Cancelado");
});

test("p28 — o Resumo lê o estado do banco (nunca supõe 'aguardando assinatura'); Contratos do inquilino; Locações só assinadas", () => {
  const fluxo = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.match(fluxo, /lerEstadoDoContrato\(idRegistrado, "proprietario"\)/);
  assert.doesNotMatch(fluxo, /"TESTE · aguardando assinatura"/);
  assert.match(fluxo, /Este contrato foi gerado em/);
  const shell = readFileSync(new URL("../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  const ownerOnly = shell.slice(shell.indexOf("const OWNER_ONLY"), shell.indexOf("];", shell.indexOf("const OWNER_ONLY")));
  assert.doesNotMatch(ownerOnly, /"\/dashboard\/contratos"/);
  const locacoes = readFileSync(new URL("../app/(dashboard)/dashboard/locacoes/page.tsx", import.meta.url), "utf8");
  assert.match(locacoes, /etapa !== "aguardando_assinatura"/);
});

test("p28 — Nova jornada: documentos fictícios no caminho que o banco aceita (<inquilino>/<candidatura>/<uuid>.pdf) e erro não é engolido", () => {
  const acao = readFileSync(new URL("./data/jornada-teste-actions.ts", import.meta.url), "utf8");
  assert.match(acao, /caminho: `\$\{input\.tenantId\}\/\$\{lead\.id\}\/\$\{randomUUID\(\)\}\.pdf`/);
  assert.match(acao, /if \(eDoc\) return \{ ok: false/);
  const re = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/; // documentos_inquilino_caminho_check
  assert.match("0c5f1b2a-1111-4222-8333-444455556666/1d6e2c3b-1111-4222-8333-444455556666/2e7f3d4c-1111-4222-8333-444455556666.pdf", re);
});
