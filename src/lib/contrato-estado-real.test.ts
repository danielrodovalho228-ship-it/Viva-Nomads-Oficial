import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDoContrato } from "./fechamento-contrato.ts";

const t = "2026-10-12T12:00:00Z";
const base = { status: "ativo", assinadoProprietarioEm: null, assinadoInquilinoEm: null, primeiroPagamentoConfirmado: false };

test("p28 — estado real do contrato, com o mesmo texto do Fechamento, de Contratos e da página do contrato", () => {
  assert.deepEqual(estadoDoContrato(base, "proprietario"), { chave: "aguardando_assinatura", texto: "Aguardando assinatura · falta você e o inquilino", faltaVoce: true });
  assert.equal(estadoDoContrato({ ...base, assinadoProprietarioEm: t }, "inquilino").texto, "Aguardando assinatura · falta você");
  assert.equal(estadoDoContrato({ ...base, assinadoInquilinoEm: t }, "inquilino").faltaVoce, false);
  // O caso do reteste: o contrato devolvido (de 12/10) já estava assinado pelas duas partes.
  assert.deepEqual(estadoDoContrato({ ...base, assinadoProprietarioEm: t, assinadoInquilinoEm: t }, "proprietario"), {
    chave: "assinado",
    texto: "As duas partes assinaram · Aguardando 1º pagamento",
    faltaVoce: false,
  });
  assert.equal(estadoDoContrato({ ...base, assinadoProprietarioEm: t, assinadoInquilinoEm: t, primeiroPagamentoConfirmado: true }, "inquilino").texto, "Locação ativa");
  assert.equal(estadoDoContrato({ ...base, status: "encerrado_sem_renovacao" }, "inquilino").texto, "Encerrado");
  assert.equal(estadoDoContrato({ ...base, status: "cancelado" }, "inquilino").texto, "Cancelado");
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
