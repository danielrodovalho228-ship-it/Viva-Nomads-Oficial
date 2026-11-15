/* Roda: node --test src/lib/e923-contas-fixas-sem-estimativa.test.ts
   E923 (dúvida nº 6 do PR #3823): anúncio com contas FIXAS mas com a estimativa vazia mostrava "tudo incluído" na linha do total.
   Nesse caso o total do mês não tem nenhum valor de água, luz e gás (o dono escolheu "valor fixo estimado" e não informou o valor),
   então "tudo incluído" não é verdade. Regra do coordenador, absoluta: "tudo incluído" nunca aparece quando não está tudo incluído.
   Dados (14/11): nenhum anúncio de exemplo e nenhum anúncio ATIVO em produção está no caso; 36 rascunhos e 10 pausados estão.
   Correção: três situações das contas, numa função só (situacaoDasContas, em precos.ts):
     • no total      — contas fixas COM estimativa (> 0): entram no total do mês  → "tudo incluído";
     • medidas       — consumo real, medido                                       → "água, luz e gás à parte";
     • não informadas — contas fixas SEM estimativa (vazia, nula ou zero)         → "água, luz e gás não informados". */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { AVISO_CONTAS_A_PARTE, AVISO_TUDO_INCLUIDO, calcularTotalMensal, calcularTudoIncluido } from "./precos.ts";
import { modeloDoCartao } from "./cartao-modelo.ts";
import { composicaoDoMes } from "./cartao-estadia.ts";
import type { Property } from "./types.ts";

const SEM_NBSP = (s: string) => s.replace(/ /g, " ");
const ube001 = SAMPLE_PROPERTIES.find((p) => p.id === "ube-001")!;
const HOJE = new Date("2026-11-14T12:00:00-03:00");
const VAZIAS: unknown[] = [undefined, null, 0, -50, Number.NaN, ""];
const comEstimativa = (modo: Property["utilitiesMode"], e: unknown): Property => ({ ...ube001, id: `ube-001-${String(modo)}-${String(e)}`, utilitiesMode: modo, utilitiesEstimate: e as number });

test("E923: contas fixas com a estimativa vazia NÃO dizem 'tudo incluído'; dizem 'água, luz e gás não informados'", async () => {
  const { AVISO_CONTAS_NAO_INFORMADAS, avisoCurtoDoTotal, situacaoDasContas } = await import("./precos.ts");
  assert.equal(AVISO_CONTAS_NAO_INFORMADAS, "água, luz e gás não informados");
  for (const e of VAZIAS) {
    const p = comEstimativa("fixed", e);
    assert.equal(situacaoDasContas(p), "nao_informadas", `estimativa ${String(e)}`);
    assert.equal(avisoCurtoDoTotal(p), AVISO_CONTAS_NAO_INFORMADAS, `estimativa ${String(e)}`);
    for (const n of [1, 2, 6]) {
      const { aviso } = modeloDoCartao(p, n, HOJE);
      assert.equal(aviso, AVISO_CONTAS_NAO_INFORMADAS, `cartão, estimativa ${String(e)}, ${n} mês(es)`);
      assert.notEqual(aviso, AVISO_TUDO_INCLUIDO);
    }
  }
});

test("E923: 'tudo incluído' se, e somente se, as contas fixas estão NO total (estimativa > 0)", async () => {
  const { AVISO_CONTAS_NAO_INFORMADAS, avisoCurtoDoTotal, situacaoDasContas } = await import("./precos.ts");
  const todos: Property[] = [...SAMPLE_PROPERTIES];
  for (const modo of ["fixed", "real", undefined, null, "outro"]) for (const e of [...VAZIAS, 1, 280]) todos.push(comEstimativa(modo as Property["utilitiesMode"], e));
  const vistos = new Set<string>();
  for (const p of todos) {
    const noTotal = p.utilitiesMode === "fixed" && typeof p.utilitiesEstimate === "number" && p.utilitiesEstimate > 0;
    const aviso = avisoCurtoDoTotal(p);
    assert.equal(aviso === AVISO_TUDO_INCLUIDO, noTotal, `${p.id}: "tudo incluído" ⇔ contas no total`);
    assert.equal(situacaoDasContas(p) === "no_total", noTotal, `${p.id}: situação`);
    // Com "tudo incluído", o total do mês tem mesmo um valor de contas dentro dele; sem ele, não tem. (Estimativa negativa ou que
    // não é número não existe nos dados — 0 em produção em 14/11 — e a conta do total não é assunto deste item: fica de fora aqui.)
    const estimativaPossivel = p.utilitiesEstimate == null || (Number.isFinite(p.utilitiesEstimate) && p.utilitiesEstimate >= 0);
    if (aviso === AVISO_TUDO_INCLUIDO) assert.ok(calcularTudoIncluido(p).consumoFixo > 0, `${p.id}: há contas no total`);
    else if (estimativaPossivel) assert.equal(calcularTudoIncluido(p).consumoFixo, 0, `${p.id}: sem contas no total, sem "tudo incluído"`);
    // Exatamente um dos três textos: nunca dois, nunca nenhum.
    assert.ok([AVISO_TUDO_INCLUIDO, AVISO_CONTAS_A_PARTE, AVISO_CONTAS_NAO_INFORMADAS].includes(aviso), p.id);
    // Consumo real (ou modo desconhecido) segue "à parte", com ou sem número na estimativa.
    if (p.utilitiesMode !== "fixed") assert.equal(aviso, AVISO_CONTAS_A_PARTE, `${p.id}: medidas`);
    vistos.add(aviso);
  }
  assert.equal(vistos.size, 3, "a prova cobre as três situações");
});

test("E923: os anúncios de exemplo não estão no caso (levantamento de 14/11): contas fixas sempre com estimativa", async () => {
  const { situacaoDasContas } = await import("./precos.ts");
  const noCaso = SAMPLE_PROPERTIES.filter((p) => situacaoDasContas(p) === "nao_informadas").map((p) => p.id);
  assert.deepEqual(noCaso, []);
  assert.deepEqual(SAMPLE_PROPERTIES.filter((p) => situacaoDasContas(p) === "medidas").map((p) => p.id), ["ube-003"]);
});

test("E923: a página diz o mesmo — a composição do mês e a nota do total avisam que as contas não foram informadas", () => {
  const p = comEstimativa("fixed", 0);
  const texto = SEM_NBSP(composicaoDoMes(p));
  assert.equal(texto, "Por mês: valor mensal R$ 3.200 + condomínio R$ 480 = R$ 3.680 · água, luz e gás não informados, fora do total");
  assert.doesNotMatch(texto, /tudo incluído/);
  const mes = calcularTotalMensal(p) as ReturnType<typeof calcularTotalMensal> & { contasNaoInformadas?: boolean };
  assert.equal(mes.contasNaoInformadas, true);
  assert.equal(mes.contasMedidas, false);
  assert.equal((calcularTotalMensal(ube001) as typeof mes).contasNaoInformadas, false, "com estimativa, nada a avisar");
  // Contas fixas com estimativa e consumo real seguem como eram.
  assert.equal(SEM_NBSP(composicaoDoMes(ube001)), "Por mês: valor mensal R$ 3.200 + condomínio R$ 480 + contas R$ 280 = R$ 3.960");
  assert.match(SEM_NBSP(composicaoDoMes(comEstimativa("real", 0))), / · água, luz e gás medidos à parte, fora do total$/);
});
