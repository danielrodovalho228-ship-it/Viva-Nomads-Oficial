/*
  E1238 (ORDENS-DUET 1207, 1231 e 1233; MAPA-E1238 e FRESCURA-E1238-E1230 da Fable) — o prazo de 48 h da conferência.
   (1) âncora = a hora das instruções de entrada (contratos_checkin.horario); a coluna do anúncio sai da conta;
   (2) ORDEM-DUET 1269: a conferência nasce SEM prazo nos QUATRO pontos de abertura; o prazo congela no momento da
       entrada (e1238-congelar-na-entrada.test.ts); depois não muda;
   (3) sem hora: 23:59 do dia da entrada e do dia da saída (decisão do coordenador; ORDEM-DUET 1269 corrige a entrada);
   (4) com linha, lê o prazo gravado; sem linha, calcula pela mesma regra;
   (5) as já fechadas ficam; nada reabre; nenhum encerramento antes da data da entrada.
  Roda: node --test src/lib/e1238-prazo-congelado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as conf from "./conferencia.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

type Datas = conf.EntradaDoContrato;
const c = conf as unknown as {
  prazoDaJanela?: (tipo: conf.TipoConferencia, datas: Datas | null, gravado?: string | null) => Date | null;
  janelaEncerrada: (tipo: conf.TipoConferencia, datas: Datas | null, agora?: Date, gravado?: string | null) => boolean;
};
const janela = (await import("./data/janela-conferencia.ts").catch(() => ({}))) as {
  congelarJanelaDeConferencia?: (admin: unknown, p: { contratoId: string; tipo: conf.TipoConferencia; abertaPor: string; datas: Datas }) => unknown;
  janelasDosContratos?: (admin: unknown, ids: string[]) => Promise<Map<string, { hora: string | null; gravado: { entrada: string | null; saida: string | null } }>>;
  datasDaJanela?: (blocos: { inicio: string | null; fim: string | null; status?: string | null }[], hora: string | null) => Datas;
};
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(rel, import.meta.url), "utf8"));
const CONTRATO = "11111111-2222-4333-8444-555555555555";
const ENTRADA_14 = { inicio: "2026-12-01", checkinAfter: "14:00", fim: "2027-01-30", checkoutBefore: null };

test("1. instrução 14:00 → prazo às 14:00 do 2.º dia depois da entrada; sem hora, 23:59", () => {
  assert.equal(conf.prazoConferenciaEntrada(ENTRADA_14)?.toISOString(), "2026-12-03T17:00:00.000Z");
  assert.equal(conf.prazoConferenciaEntrada({ inicio: "2026-12-01", checkinAfter: null })?.toISOString(), "2026-12-04T02:59:00.000Z", "sem hora: 23:59 (ORDEM-DUET 1269)");
});

test("2. a saída sem hora conta das 23:59 do dia da saída (decisão do coordenador, 27/11)", () => {
  // última noite 30/01 → saída 31/01, 23:59 de Brasília = 01/02 02:59Z; + 48 h.
  assert.equal(conf.prazoConferenciaSaida({ fim: "2027-01-30", checkoutBefore: null })?.toISOString(), "2027-02-03T02:59:00.000Z");
});

test("3. o prazo gravado vence o calculado; sem gravado, calcula pela mesma regra", () => {
  assert.equal(typeof c.prazoDaJanela, "function");
  assert.equal(c.prazoDaJanela!("entrada", ENTRADA_14, "2026-12-03T03:00:00.000Z")?.toISOString(), "2026-12-03T03:00:00.000Z", "gravado");
  assert.equal(c.prazoDaJanela!("entrada", ENTRADA_14, null)?.toISOString(), "2026-12-03T17:00:00.000Z", "calculado");
  assert.equal(c.prazoDaJanela!("entrada", ENTRADA_14, "lixo")?.toISOString(), "2026-12-03T17:00:00.000Z", "gravado inválido: calcula");
});

test("4. a janela: aberta às 34 h depois das 14:00, fechada só depois das 48 h; nunca antes da data da entrada", () => {
  const as34h = new Date(Date.parse("2026-12-01T17:00:00Z") + 34 * 3600_000);
  assert.equal(c.janelaEncerrada("entrada", ENTRADA_14, as34h), false, "às 34 h ainda aberta");
  assert.equal(c.janelaEncerrada("entrada", ENTRADA_14, new Date("2026-12-03T17:01:00Z")), true, "depois das 48 h, fechada");
  assert.equal(c.janelaEncerrada("entrada", ENTRADA_14, new Date("2026-12-03T05:00:00Z"), "2026-12-03T03:00:00.000Z"), true, "o gravado manda");
  assert.equal(c.janelaEncerrada("entrada", ENTRADA_14, new Date("2026-11-30T12:00:00Z"), "2026-11-01T00:00:00.000Z"), false, "antes da entrada, nada fecha");
});

test("6. a leitura: a hora das instruções e os prazos gravados, por contrato", async () => {
  assert.equal(typeof janela.janelasDosContratos, "function");
  const admin = {
    from: (tabela: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.in = () => b;
      b.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve(
          tabela === "contratos_checkin"
            ? { data: [{ contrato_id: CONTRATO, horario: "14:00" }], error: null }
            : { data: [{ contrato_id: CONTRATO, tipo: "entrada", prazo_em: "2026-12-03T03:00:00+00:00", fechada_em: null }], error: null },
        ).then(ok);
      return b;
    },
  };
  const m = await janela.janelasDosContratos!(admin, [CONTRATO]);
  // E1240: a janela leva também a hora de saída das instruções (aqui sem ela: null).
  assert.deepEqual(m.get(CONTRATO), { hora: "14:00", horaSaida: null, gravado: { entrada: "2026-12-03T03:00:00+00:00", saida: null }, aberta: { entrada: true, saida: false } });
  assert.deepEqual(janela.datasDaJanela!([{ inicio: "2026-12-01", fim: "2026-12-31" }, { inicio: "2027-01-01", fim: "2027-01-30", status: "ativo" }, { inicio: "2027-02-01", fim: "2027-02-28", status: "nao_aceito" }], "14:00"), { inicio: "2026-12-01", checkinAfter: "14:00", fim: "2027-01-30", checkoutBefore: null });
});

test("7. os QUATRO pontos de abertura abrem pela função única; nenhum upsert de conferência fica à mão", () => {
  const acoes = ler("./data/conferencia-actions.ts");
  assert.equal((acoes.match(/abrirConferencia\(admin, \{/g) ?? []).length, 4);
  assert.doesNotMatch(acoes, /from\("conferencias"\)\s*\.upsert\(/);
});

test("8. estático: nenhum leitor do PRAZO lê a coluna do anúncio (checkin_after / checkout_before)", () => {
  assert.doesNotMatch(ler("./data/conferencia-actions.ts"), /checkin_after|checkout_before/, "A — servidor e secção");
  const rota = ler("../app/api/cron/automacoes/route.ts");
  const fechar = rota.slice(rota.indexOf("async function fecharConferenciasVencidas("), rota.indexOf("async function fecharConferenciasVencidas(") + 2500);
  assert.doesNotMatch(fechar, /checkin_after|checkout_before/, "D — a rotina");
  const assinar = ler("./data/contrato-assinar-actions.ts");
  for (const campo of ["prazoConferenciaEm:", "prazoConferenciaSaidaEm:"]) {
    const linha = assinar.slice(assinar.indexOf(campo), assinar.indexOf("\n", assinar.indexOf(campo)));
    assert.doesNotMatch(linha, /checkin_after|checkout_before/, `B — ${campo}`);
  }
  const estadia = ler("./estadia/estadia.ts");
  const prazoDaConf = estadia.slice(estadia.indexOf("export function prazoDaConferencia("), estadia.indexOf("export function prazoDaConferencia(") + 300);
  assert.doesNotMatch(prazoDaConf, /checkinAfter: p\.checkinAfter/, "C — a lista antes da entrada");
  const conf2 = ler("./estadia/confirmacao.ts");
  assert.doesNotMatch(conf2, /checkinAfter: p\.checkinAfter/, "C — estadia confirmada");
  const linha = ler("./estadia-linha-tempo.ts");
  assert.doesNotMatch(linha, /checkinAfter: p\.checkinAfter|checkoutBefore: p\.checkoutBefore/, "a linha do tempo recebe o prazo (a hora mostrada não entra na conta)");
});

test("9. guardas da fusão: nada de '% 30' fora da fonte única; prazo_total_dias continua nas colunas da estadia", () => {
  const estadia = ler("./estadia/estadia.ts");
  assert.doesNotMatch(estadia, /%\s*30\b/);
  assert.match(ler("./data/estadia.ts"), /prazo_total_dias/);
});

test("10. a rotina fecha pelo prazo GRAVADO; sem ele, pela regra com a hora das instruções", async () => {
  const { conferenciasParaFechar } = await import("./fiscal/fechamento.ts");
  const abertas = [
    { id: "gravada", tipo: "entrada" as const, datas: ENTRADA_14, prazoGravado: "2026-12-03T03:00:00.000Z" },
    { id: "calculada", tipo: "entrada" as const, datas: ENTRADA_14, prazoGravado: null },
  ];
  // 05:00Z: a gravada (03:00Z) já venceu; a calculada (14:00 BRT = 17:00Z) ainda não.
  assert.deepEqual(conferenciasParaFechar(abertas, new Date("2026-12-03T05:00:00Z")).map((c) => c.id), ["gravada"]);
  assert.deepEqual(conferenciasParaFechar(abertas, new Date("2026-12-03T17:01:00Z")).map((c) => c.id), ["gravada", "calculada"]);
});

test("11. os quatro leitores passam a hora das INSTRUÇÕES e o prazo gravado", () => {
  assert.match(ler("./data/conferencia-actions.ts"), /entrada: janela\.datas,/, "A — as datas da janelaVigente (hora das instruções)");
  assert.match(ler("./data/contrato-assinar-actions.ts"), /checkinAfter: janela\?\.hora \?\? null/, "B");
  assert.match(ler("./data/estadia.ts"), /janelaVigente\(admin, c\.id, blocosOrdenados\(c\)\)/, "C");
  const rota = ler("../app/api/cron/automacoes/route.ts");
  // E1240: a rotina passa também a hora de saída das instruções.
  assert.match(rota, /datasDaJanela\(c\.contratos\?\.contrato_blocos \?\? \[\], janelas\.get\(c\.contrato_id\)\?\.hora \?\? null, janelas\.get\(c\.contrato_id\)\?\.horaSaida \?\? null\)/, "D");
  assert.match(rota, /prazoGravado: congelados \? \(congelados\.get\(`\$\{c\.contrato_id\}:\$\{c\.tipo\}`\) \?\? null\) : \(c\.prazo_em \?\? null\)/, "D — o gravado (congelado pela rotina)");
});
