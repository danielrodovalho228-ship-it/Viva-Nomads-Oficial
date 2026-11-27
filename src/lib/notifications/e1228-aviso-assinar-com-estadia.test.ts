/*
  E1228 (ORDENS-DUET 1138, 1147, 1148 e 1151) — o aviso de assinatura pendente identifica a ESTADIA.
  O defeito (ensaio da Estadia, 26/11): o aviso crítico "assinar o contrato" só nomeava o imóvel ("Atualização do seu
  contrato · {imóvel}"); com dois contratos do mesmo imóvel, os avisos eram indistinguíveis — o dono via "assinar" e
  lia "o que já assinei", quando faltava assinar OUTRO contrato do mesmo imóvel.
  A correção (texto do coordenador): o título do aviso de assinatura pendente é
    "Assinar o contrato — {título do imóvel}, estadia de {entrada} a {saída}"
  com as datas lidas dos blocos do contrato (o início do 1.º e o fim do último); sem as datas, o código VN-CT no lugar.
  O VN-CT vai no corpo do aviso. Os avisos já gravados não se regravam (ORDEM-DUET-1151). A resolução ao assinar e a
  conferência do E676 ficam como estão.
  A trava: dois contratos do mesmo imóvel aguardando assinatura geram dois avisos que se distinguem pelas datas — na
  função pura do título e no gravarAviso REAL (Supabase falso, harness e1072).
  Roda: node --test src/lib/notifications/e1228-aviso-assinar-com-estadia.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as avisos from "./avisos.ts";

register("../data/e1072-teto-harness/loader.mjs", import.meta.url);
const { gravarAviso } = await import("./avisos-servidor.ts");

type FnTitulo = (o: { imovel?: string | null; entrada?: string | null; saida?: string | null; contratoId: string }) => string;
const tituloAvisoAssinar = (avisos as unknown as { tituloAvisoAssinar?: FnTitulo }).tituloAvisoAssinar;

const IMOVEL = "TESTE QA - Casa mobiliada 2 quartos no Centro";
const C1 = "e2986ca4-1111-4111-8111-111111111111";
const C2 = "78af9c56-2222-4222-8222-222222222222";

test("1. a função pura: 'Assinar o contrato — {imóvel}, estadia de {entrada} a {saída}'", () => {
  assert.equal(typeof tituloAvisoAssinar, "function", "avisos exporta tituloAvisoAssinar");
  assert.equal(
    tituloAvisoAssinar!({ imovel: IMOVEL, entrada: "2026-12-01", saida: "2027-01-29", contratoId: C1 }),
    `Assinar o contrato — ${IMOVEL}, estadia de 01/12/2026 a 29/01/2027`,
  );
});

test("2. dois contratos do mesmo imóvel → dois títulos que se distinguem pelas datas", () => {
  const a = tituloAvisoAssinar!({ imovel: IMOVEL, entrada: "2026-12-01", saida: "2027-01-29", contratoId: C1 });
  const b = tituloAvisoAssinar!({ imovel: IMOVEL, entrada: "2027-03-18", saida: "2027-04-30", contratoId: C2 });
  assert.notEqual(a, b);
  assert.match(b, /estadia de 18\/03\/2027 a 30\/04\/2027$/);
});

test("3. sem as datas, o código VN-CT no lugar (nunca só o imóvel)", () => {
  assert.equal(tituloAvisoAssinar!({ imovel: IMOVEL, entrada: null, saida: null, contratoId: C2 }), `Assinar o contrato — ${IMOVEL}, contrato VN-CT-78AF9C56`);
  assert.equal(tituloAvisoAssinar!({ imovel: null, entrada: "2027-03-18", saida: "2027-04-30", contratoId: C2 }), "Assinar o contrato — estadia de 18/03/2027 a 30/04/2027");
});

// ── o gravarAviso real ─────────────────────────────────────────────────────────────────────────────────────────────
const g = globalThis as unknown as { __e1072Admin: unknown };
const BLOCOS: Record<string, { numero_bloco: number; inicio: string; fim: string }[] | "falha"> = {
  [C1]: [{ numero_bloco: 2, inicio: "2026-12-31", fim: "2027-01-29" }, { numero_bloco: 1, inicio: "2026-12-01", fim: "2026-12-30" }],
  [C2]: [{ numero_bloco: 1, inicio: "2027-03-18", fim: "2027-04-30" }],
};
const PRAZO: Record<string, number> = {};
function adminFalso() {
  const gravados: Record<string, unknown>[] = [];
  return {
    gravados,
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      for (const m of ["select", "is", "in", "order", "limit", "delete"]) b[m] = () => b;
      b.eq = (k: string, v: unknown) => ((filtros[k] = v), b);
      const resposta = () => {
        if (tabela === "properties") return { data: { title: IMOVEL }, error: null };
        // E1239: o prazo do contrato (a saída = entrada + prazo_total_dias). Sem entrada no mapa, o contrato não se lê.
        if (tabela === "contratos") return PRAZO[String(filtros.id)] != null ? { data: { prazo_total_dias: PRAZO[String(filtros.id)] }, error: null } : { data: null, error: null };
        if (tabela === "contrato_blocos") {
          const bl = BLOCOS[String(filtros.contrato_id)];
          return bl === "falha" ? { data: null, error: { message: "falhou" } } : { data: bl ?? [], error: null };
        }
        return { data: tabela === "avisos" ? [] : null, error: null };
      };
      b.maybeSingle = async () => (tabela === "avisos" ? { data: null, error: null } : resposta());
      b.insert = async (linha: Record<string, unknown>) => (gravados.push(linha), { error: null });
      b.update = () => b;
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, ko);
      return b;
    },
  };
}
const gravar = (contratoId: string, extra: Record<string, unknown> = {}) =>
  gravarAviso({ usuarioId: "dono-1", evento: "contract_status", papel: "dono", url: `/dashboard/contratos/${contratoId}`, refId: contratoId, imovelId: "11111111-aaaa-4aaa-8aaa-111111111111", ...extra });

beforeEach(() => {
  BLOCOS[C2] = [{ numero_bloco: 1, inicio: "2027-03-18", fim: "2027-04-30" }];
  // E1239: o prazo de cada contrato, coerente com os blocos (C1: 01/12 a 29/01, 60 noites; C2: 18/03 a 30/04, 44 noites).
  PRAZO[C1] = 60;
  PRAZO[C2] = 44;
});

test("4. o gravarAviso: dois contratos do mesmo imóvel por assinar → dois avisos distinguíveis pelas datas, com o VN-CT no corpo", async () => {
  const a = adminFalso();
  g.__e1072Admin = a;
  assert.equal(await gravar(C1), true);
  assert.equal(await gravar(C2), true);
  assert.equal(a.gravados.length, 2);
  // E1239 (ORDEM-DUET-1200, asserção alterada): o fim é a SAÍDA (entrada + prazo), não a última noite.
  assert.equal(a.gravados[0].titulo, `Assinar o contrato — ${IMOVEL}, estadia de 01/12/2026 a 30/01/2027`);
  assert.equal(a.gravados[1].titulo, `Assinar o contrato — ${IMOVEL}, estadia de 18/03/2027 a 01/05/2027`);
  assert.notEqual(a.gravados[0].titulo, a.gravados[1].titulo);
  assert.equal(a.gravados[0].texto, "Contrato VN-CT-E2986CA4");
  assert.equal(a.gravados[1].texto, "Contrato VN-CT-78AF9C56");
  assert.equal(a.gravados[0].prioridade, "critico");
  assert.equal(a.gravados[0].ref_id, C1, "a resolução ao assinar continua pelo ref_id");
});

test("5. o gravarAviso: sem as datas lidas, o VN-CT no título", async () => {
  BLOCOS[C2] = "falha";
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C2);
  assert.equal(a.gravados[0].titulo, `Assinar o contrato — ${IMOVEL}, contrato VN-CT-78AF9C56`);
});

test("6. o gravarAviso: o 'contrato assinado' (normal) e o contract_status sem contrato não mudam de título", async () => {
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C1, { prioridade: "normal" });
  await gravarAviso({ usuarioId: "dono-1", evento: "contract_status", papel: "dono", url: "/dashboard/propostas/x", imovelId: "11111111-aaaa-4aaa-8aaa-111111111111" });
  assert.equal(a.gravados[0].titulo, `Atualização do seu contrato · ${IMOVEL}`);
  assert.equal(a.gravados[1].titulo, `Atualização do seu contrato · ${IMOVEL}`);
});

// ── ORDEM-DUET-1161: os quatro casos das fugas da mordida (P7–P10) ──────────────────────────────────────────────────

test("7. (P10) um aviso crítico de OUTRO evento, ligado a um registro, mantém o título do catálogo", async () => {
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravarAviso({ usuarioId: "dono-1", evento: "manutencao_nova", papel: "dono", prioridade: "critico", url: "/dashboard/solicitacoes", refId: C1, imovelId: "11111111-aaaa-4aaa-8aaa-111111111111" });
  assert.equal(a.gravados[0].titulo, `Pedido de manutenção no seu imóvel · ${IMOVEL}`);
  assert.doesNotMatch(String(a.gravados[0].titulo), /Assinar o contrato/);
  assert.notEqual(a.gravados[0].texto, "Contrato VN-CT-E2986CA4");
});

test("8. (P9) o gravarAviso sem imóvel: o título novo, sem o nome, com a estadia", async () => {
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C2, { imovelId: undefined });
  // E1239 (asserção alterada): a saída (entrada + prazo).
  assert.equal(a.gravados[0].titulo, "Assinar o contrato — estadia de 18/03/2027 a 01/05/2027");
});

test("9. (P8) com só uma das datas, o mesmo recurso das datas em falta: o VN-CT, nunca 'null' escrito", async () => {
  assert.equal(tituloAvisoAssinar!({ imovel: IMOVEL, entrada: "2026-12-01", saida: null, contratoId: C1 }), `Assinar o contrato — ${IMOVEL}, contrato VN-CT-E2986CA4`);
  assert.equal(tituloAvisoAssinar!({ imovel: IMOVEL, entrada: null, saida: "2027-01-29", contratoId: C1 }), `Assinar o contrato — ${IMOVEL}, contrato VN-CT-E2986CA4`);
  BLOCOS[C2] = [{ numero_bloco: 1, inicio: "2027-03-18", fim: null as unknown as string }];
  delete PRAZO[C2]; // sem o fim e sem o prazo: nenhuma saída a dizer
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C2);
  assert.equal(a.gravados[0].titulo, `Assinar o contrato — ${IMOVEL}, contrato VN-CT-78AF9C56`);
  assert.doesNotMatch(String(a.gravados[0].titulo), /null|undefined/);
});

test("10. (P7) o corpo do aviso de assinatura é o VN-CT, venha o que vier no corpo", async () => {
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C1, { texto: "outro corpo qualquer" });
  assert.equal(a.gravados[0].texto, "Contrato VN-CT-E2986CA4");
});

// ── E1239 (ORDEM-DUET-1200): o título diz a SAÍDA (entrada + prazo_total_dias), não a última noite ───────────────────
const C3 = "77541238-3333-4333-8333-333333333333";

test("11. (E1239) dois blocos em que a última noite e a saída diferem: o título diz a SAÍDA (o caso ao vivo do VN-CT-77541238)", async () => {
  BLOCOS[C3] = [
    { numero_bloco: 2, inicio: "2027-08-01", fim: "2027-09-29" },
    { numero_bloco: 1, inicio: "2027-06-02", fim: "2027-07-31" },
  ];
  PRAZO[C3] = 120;
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C3);
  assert.equal(a.gravados[0].titulo, `Assinar o contrato — ${IMOVEL}, estadia de 02/06/2027 a 30/09/2027`);
  assert.doesNotMatch(String(a.gravados[0].titulo), /29\/09\/2027/, "nunca a última noite");
});

test("12. (E1239) o fim do título = entrada + prazo_total_dias do contrato (31 dias: 20/12 → 20/01)", async () => {
  BLOCOS[C3] = [{ numero_bloco: 1, inicio: "2026-12-20", fim: "2027-01-19" }];
  PRAZO[C3] = 31;
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C3);
  assert.equal(a.gravados[0].titulo, `Assinar o contrato — ${IMOVEL}, estadia de 20/12/2026 a 20/01/2027`);
});

test("13. (E1239, ORDEM-DUET-1203) o prazo não se lê: o título fica SEM datas, com o VN-CT — nunca a última noite como saída", async () => {
  BLOCOS[C3] = [{ numero_bloco: 1, inicio: "2027-06-02", fim: "2027-09-29" }];
  delete PRAZO[C3];
  const a = adminFalso();
  g.__e1072Admin = a;
  await gravar(C3);
  assert.equal(a.gravados[0].titulo, `Assinar o contrato — ${IMOVEL}, contrato VN-CT-77541238`);
  assert.doesNotMatch(String(a.gravados[0].titulo), /29\/09\/2027/);
});
