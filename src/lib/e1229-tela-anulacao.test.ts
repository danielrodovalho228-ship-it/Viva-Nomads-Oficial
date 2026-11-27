/*
  E1229 (ORDENS-DUET 1143 e 1160) — a tela da anulação (o complemento de texto; o comportamento está na trava da ação,
  src/lib/data/e1229-anulacao.test.ts):
   - o dono: os registros ainda por confirmar (aluguel e caução) têm "Anular registro"; os confirmados, na lista de
     recibos, têm "Pedir anulação à Central" — os dois pela mesma ação (anularRegistro), com o motivo;
   - o morador não vê nenhum dos dois (a lista de recibos dele não recebe a anulação);
   - a equipe: o chamado que nasceu de um registro (a nota do sistema) tem "Anular este registro", que chama
     anularRegistroPelaCentral; os outros chamados não.
  Roda: node --test src/lib/e1229-tela-anulacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const COMP = "src/components/anulacao/anular-registro.tsx";
const CENTRAL = "src/app/(dashboard)/admin/atendimento/[id]/anular-registro-central.tsx";

test("o botão do dono: um componente só, com o motivo, pela ação anularRegistro", () => {
  assert.ok(existsSync(COMP), COMP);
  const c = ler(COMP);
  assert.match(c, /anularRegistro\(\{ pagamentoId, motivo/);
  assert.match(c, /confirmado \? "Pedir anulação à Central" : "Anular registro"/);
  assert.match(c, /data-testid="anular-registro"/);
  assert.match(c, /data-testid="anular-motivo"/);
});

test("o dono: os registros por confirmar têm 'Anular registro'; os confirmados (recibos), 'Pedir anulação à Central'", () => {
  const tela = ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(tela, /data-testid="registros-por-confirmar"/);
  assert.match(tela, /<AnularRegistro pagamentoId=\{p\.id\} confirmado=\{false\}/);
  assert.match(tela, /<ListaDocumentos documentos=\{extra\.documentos\} recibos=\{extra\.recibos\} anular \/>/);
  const lista = ler("src/components/documentos/documentos-contrato.tsx");
  assert.match(lista, /anular && !r\.anulado && <AnularRegistro pagamentoId=\{r\.pagamentoId\} confirmado \/>/);
});

test("o morador não vê a anulação", () => {
  const loc = ler("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx");
  assert.doesNotMatch(loc, /AnularRegistro|<ListaDocumentos[^>]*\banular\b/);
});

test("a equipe: 'Anular este registro' só no chamado que nasceu de um registro, pela ação da Central", () => {
  assert.ok(existsSync(CENTRAL), CENTRAL);
  assert.match(ler(CENTRAL), /anularRegistroPelaCentral\(\{ chamadoId, motivo/);
  const cl = ler("src/app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx");
  assert.match(cl, /const pedidoDeAnulacao = dados\.mensagens\.some\(\(m\) => m\.autor === "sistema" && m\.interno && \/\^\\\[anulacao\\\] pagamento=\/\.test\(m\.corpo\)\);/);
  // E1246 (ORDEM-DUET-1220, asserção alterada): para a observadora da QA, o cartão some quando o contrato não é todo de teste.
  assert.match(cl, /\{pedidoDeAnulacao && !anularSoLeitura && <AnularRegistroCentral chamadoId=\{c\.id\} \/>\}/);
});
