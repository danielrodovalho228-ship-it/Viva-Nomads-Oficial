import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AVISO_FIXO,
  FORMULA_RESUMO,
  filtrarRecibos,
  informeAnual,
  informeCsv,
  mesesComDocumento,
  pendenciasDeNota,
  resumoAnualParceiro,
  resumoCarneLeao,
  resumoReembolso,
  type Recibo,
  type ServicoConcluido,
} from "./regras.ts";

const ana = { nome: "Ana Lima", doc: "52998224725" };
const bruno = { nome: "Bruno Costa", doc: "111.444.777-35" };
const dono = { nome: "Paulo Essencial", doc: "39053344705" };

let n = 0;
const r = (o: Partial<Recibo>): Recibo => ({
  id: `doc-${++n}`,
  tipo: "recibo_aluguel",
  numero: `REC-2026-${String(n).padStart(6, "0")}`,
  valor: 3200,
  data: "2026-10-05",
  pagador: ana,
  recebedor: dono,
  contratoId: "c1",
  imovelId: "i1",
  imovelTitulo: "Studio Centro",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-10-31",
  anulado: false,
  ...o,
});

test("resumoCarneLeao: soma do mês por pagador; dois pagadores; Caução e anulado fora", () => {
  const lista = [
    r({ valor: 3200, data: "2026-10-05" }),
    r({ valor: 150.55, data: "2026-10-20" }),
    r({ pagador: bruno, contratoId: "c2", imovelId: "i2", imovelTitulo: "Apto Jardim", valor: 2800, data: "2026-10-10" }),
    r({ tipo: "comprovante_caucao", valor: 6400, data: "2026-10-05" }),
    r({ valor: 999, data: "2026-10-07", anulado: true }),
    r({ valor: 3200, data: "2026-09-30" }),
  ];
  const s = resumoCarneLeao(lista, "2026-10");
  assert.equal(s.total, 6150.55);
  assert.equal(s.recibos.length, 3);
  assert.deepEqual(
    s.porPagador.map((p) => [p.nome, p.doc, p.total, p.recibos]),
    [
      ["Ana Lima", "529.982.247-25", 3350.55, 2],
      ["Bruno Costa", "111.444.777-35", 2800, 1],
    ],
  );
  assert.equal(s.formula, FORMULA_RESUMO);
  // O resumo confere com a soma dos recibos listados.
  assert.equal(Math.round(s.recibos.reduce((t, x) => t + x.valor, 0) * 100) / 100, s.total);
});

test("resumoCarneLeao: mês sem recibo dá total zero e lista vazia; mês inválido é recusado", () => {
  const s = resumoCarneLeao([r({ data: "2026-10-05" })], "2026-11");
  assert.equal(s.total, 0);
  assert.deepEqual(s.porPagador, []);
  assert.throws(() => resumoCarneLeao([], "2026-13"));
  assert.throws(() => resumoCarneLeao([], "out/2026"));
});

test("resumoCarneLeao: o mesmo CPF com formatos diferentes é um pagador só", () => {
  const s = resumoCarneLeao([r({ pagador: { nome: "Ana Lima", doc: "529.982.247-25" } }), r({ pagador: { nome: "Ana Lima", doc: "52998224725" } })], "2026-10");
  assert.equal(s.porPagador.length, 1);
  assert.equal(s.porPagador[0].total, 6400);
});

test("informeAnual: total por pagador no ano com a quebra por mês; o CSV traz a fórmula e o aviso", () => {
  const lista = [
    r({ data: "2026-01-05", valor: 3000 }),
    r({ data: "2026-02-05", valor: 3000 }),
    r({ data: "2026-02-20", valor: 100 }),
    r({ pagador: bruno, data: "2026-12-01", valor: 2800 }),
    r({ data: "2025-12-31", valor: 5000 }),
  ];
  const inf = informeAnual(lista, 2026);
  assert.equal(inf.total, 8900);
  assert.equal(inf.linhas[0].nome, "Ana Lima");
  assert.equal(inf.linhas[0].total, 6100);
  assert.equal(inf.linhas[0].meses["02"], 3100);
  assert.equal(inf.linhas[0].meses["12"], 0);
  assert.equal(inf.linhas[1].meses["12"], 2800);
  const csv = informeCsv(inf);
  const linhas = csv.trim().split("\n");
  assert.match(linhas[0], /^Pagador;CPF\/CNPJ;01\/2026;.*;12\/2026;Total no ano$/);
  assert.match(linhas[1], /^Ana Lima;529\.982\.247-25;3000,00;3100,00;/);
  assert.match(linhas[3], /^Total;;3000,00;3100,00;.*;8900,00$/);
  assert.ok(csv.includes("soma dos recibos confirmados no ano"));
  assert.ok(csv.includes(AVISO_FIXO));
  assert.throws(() => informeAnual([], 1999));
});

test("informeAnual do morador: por recebedor (a quem pagou)", () => {
  const inf = informeAnual([r({}), r({ recebedor: { nome: "Outra Dona", doc: null } })], 2026, "recebedor");
  assert.equal(inf.lado, "recebedor");
  assert.deepEqual(inf.linhas.map((l) => l.nome).sort(), ["Outra Dona", "Paulo Essencial"]);
  assert.match(informeCsv(inf), /^Recebedor;/);
});

test("resumoReembolso: só a estadia pedida (recibo de outra estadia nunca entra), mês a mês, Caução à parte", () => {
  const lista = [
    r({ contratoId: "c1", data: "2026-08-03", valor: 6400, periodoInicio: "2026-08-01", periodoFim: "2026-09-30" }),
    r({ contratoId: "c1", data: "2026-10-02", valor: 3200, periodoInicio: "2026-10-01", periodoFim: "2026-10-31" }),
    r({ contratoId: "c1", tipo: "comprovante_caucao", data: "2026-07-30", valor: 6400, periodoInicio: null, periodoFim: null }),
    r({ contratoId: "c9", data: "2026-08-03", valor: 9999, imovelTitulo: "Outra estadia" }),
  ];
  const s = resumoReembolso(lista, "c1");
  assert.deepEqual(s.meses.map((m) => [m.mes, m.total]), [["2026-08", 6400], ["2026-10", 3200]]);
  assert.equal(s.total, 9600);
  assert.equal(s.caucao, 6400);
  assert.equal(s.periodoInicio, "2026-08-01");
  assert.equal(s.periodoFim, "2026-10-31");
  assert.equal(s.imovelTitulo, "Studio Centro");
  assert.ok(!s.meses.some((m) => m.recibos.some((x) => x.valor === 9999)));
});

test("filtros do dono: por imóvel e por mês; meses em ordem do mais recente", () => {
  const lista = [r({ imovelId: "i1", data: "2026-10-01" }), r({ imovelId: "i2", data: "2026-10-03" }), r({ imovelId: "i1", data: "2026-09-01" })];
  assert.equal(filtrarRecibos(lista, { imovelId: "i1" }).length, 2);
  assert.equal(filtrarRecibos(lista, { imovelId: "i1", mes: "2026-10" }).length, 1);
  assert.equal(filtrarRecibos(lista, {}).length, 3);
  assert.deepEqual(mesesComDocumento(lista), ["2026-10", "2026-09"]);
});

const sv = (o: Partial<ServicoConcluido>): ServicoConcluido => ({
  id: "p1",
  codigo: "VN-SV-AAAA1111",
  categoria: "limpeza",
  cliente: "Ana L.",
  valor: 200,
  valorTaxa: 20,
  valorParceiro: 180,
  concluidoEm: "2026-10-10T12:00:00Z",
  temDocumento: true,
  ...o,
});

test("parceiro: 'Falta a nota do serviço X' só para o concluído sem documento; resumo anual com 90/10", () => {
  const lista = [sv({}), sv({ id: "p2", codigo: "VN-SV-BBBB2222", temDocumento: false, valor: 300, valorTaxa: 30, valorParceiro: 270 }), sv({ id: "p3", concluidoEm: "2025-12-31T12:00:00Z" })];
  assert.deepEqual(pendenciasDeNota(lista), ["Falta a nota do serviço VN-SV-BBBB2222"]);
  const a = resumoAnualParceiro(lista, 2026);
  assert.deepEqual([a.servicos, a.total, a.taxa, a.liquido, a.semDocumento], [2, 500, 50, 450, 1]);
  assert.equal(a.porMes["10"].servicos, 2);
});

/** Nenhum código de "Recibos e notas" grava documento: só lê. */
test("nenhuma função de Recibos e notas cria linha em documentos_fiscais (nem chama a emissão)", () => {
  const raiz = new URL("../../", import.meta.url).pathname;
  const arquivos: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(ts|tsx)$/.test(nome) && !nome.endsWith(".test.ts")) arquivos.push(p);
    }
  };
  andar(join(raiz, "lib/recibos"));
  andar(join(raiz, "app/api/recibos"));
  arquivos.push(join(raiz, "lib/data/recibos.ts"), join(raiz, "app/(dashboard)/dashboard/recibos/page.tsx"));
  assert.ok(arquivos.length >= 4);
  for (const f of arquivos) {
    const fonte = readFileSync(f, "utf8");
    assert.doesNotMatch(fonte, /\.(insert|upsert|update|delete)\(/, f);
    assert.doesNotMatch(fonte, /emitir\w*\(|registrarDocumento\(/, f);
  }
});
