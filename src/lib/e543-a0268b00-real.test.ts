// E543 (reprovado de novo em 05/11): o contrato VN-CT-A0268B00 como está em produção (1 linha só, status "ativo",
// período [30/09, 31/10), 1 bloco "encerrado" 30/09–30/10, sem pagamento) tem UM estado em toda tela.
import test from "node:test";
import assert from "node:assert/strict";
import { estadoDoContratoUnico, seloParaEquipe, situacaoParaEquipe } from "./contrato-estado.ts";
import { rotuloDoBloco } from "./bloco-status.ts";
import { topoDaEstadia, periodoDaEstadia } from "./estadia/estadia.ts";

const LINHA = { status: "ativo", periodo: "[2026-09-30,2026-10-31)", assinado_proprietario_em: "2026-10-31T02:32:00Z", assinado_inquilino_em: "2026-10-31T02:33:00Z", pagamentos_bloco: [] };
const HOJE = new Date("2026-11-06T15:00:00Z");

test("lista, detalhe, bloco e estadia dizem a mesma coisa para o contrato A0268B00", () => {
  const e = estadoDoContratoUnico(LINHA, "proprietario", HOJE);
  assert.equal(e.ativo, false);
  assert.equal(e.selo, "Encerrado em 30/10/2026");
  assert.equal(seloParaEquipe(LINHA, HOJE), "Encerrado em 30/10/2026");
  assert.equal(situacaoParaEquipe(LINHA, HOJE).chave, "encerrado");
  assert.equal(rotuloDoBloco("encerrado", e.etapa, e.ativo).label, "Encerrado");
  assert.equal(rotuloDoBloco("ativo", e.etapa, e.ativo).label, "Encerrado");
  const per = periodoDaEstadia([{ inicio: "2026-09-30", fim: "2026-10-30" }], null);
  assert.equal(topoDaEstadia(per, { status: "ativo" }, HOJE).texto, "Encerrada em 30/10/2026");
});
