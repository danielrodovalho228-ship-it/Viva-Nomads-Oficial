/*
  E1232 (ORDENS-DUET 1143, 1184, 1185 e 1187) — a declaração do comprovante de caução.
  Antes: "{locador} declara o recebimento da caução de {R$}, depositada por {morador} em caderneta de poupança, nos termos
  do art. 38, §2º, da Lei 8.245/91 e do contrato {VN-CT}." — dizia que o MORADOR depositou na poupança, quando quem deve
  depositar a caução em dinheiro é o proprietário, e não dizia como a caução foi paga.
  Depois (texto do coordenador, ORDEM-DUET-1143, só para emissões novas):
    "Caução de {R$ X}, paga por {nome do morador} por {forma registrada}, em {data}. Pela Lei 8.245/91 (art. 38, §2º), a
     caução em dinheiro deve ser depositada pelo proprietário em caderneta de poupança."
  A forma é a do registro (pagamentos_bloco.forma, levada pela emissão como DadosDocumento.forma) — nunca fixa; a armadilha
  é contrato_blocos.caucao_forma, que diz como a caução é COBRADA, não como foi paga.
  Ficam como estão (ORDEM-DUET-1185): o 2.º parágrafo, o quadro ("Depositada em"), o título e o subtítulo do comprovante;
  e o recibo de aluguel e o termo de devolução, inteiros. Os documentos já emitidos são PDFs guardados (emitir.ts) e não
  mudam: só a emissão chama conteudoDocumento.
  Roda: node --test src/lib/fiscal/e1232-comprovante-caucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conteudoDocumento, type DadosDocumento } from "./documento.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const BASE: DadosDocumento = {
  tipo: "comprovante_caucao",
  numero: "REC-2026-000001",
  emitidoEm: "2026-10-06T15:00:00Z",
  locador: { nome: "Dono Um", doc: "123.456.789-00" },
  locatario: { nome: "Inquilina Dois", doc: "987.654.321-00" },
  imovelEndereco: "Rua das Flores 123, Uberlândia",
  contratoRef: "CT-D7400000",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-11-30",
  valor: 3000,
  encargos: [],
  dataPagamento: "2026-10-05",
  forma: "pix",
  conferirUrl: "https://vivanomads.com.br/conferir/x",
};
const LEI = "Pela Lei 8.245/91 (art. 38, §2º), a caução em dinheiro deve ser depositada pelo proprietário em caderneta de poupança.";
const declaracao = (forma: string) => `Caução de R$ 3.000,00, paga por Inquilina Dois por ${forma}, em 05/10/2026. ${LEI}`;

test("1. a declaração nova, à letra: valor, morador, forma registrada, data e a Lei 8.245/91", () => {
  const c = conteudoDocumento(BASE);
  assert.equal(c.corpo[0], declaracao("Pix"));
});

test("2. a forma é a do registro, nas 5 formas (nunca fixa)", () => {
  const esperadas: [string, string][] = [
    ["pix", "Pix"],
    ["boleto", "boleto"],
    ["transferencia", "transferência"],
    ["dinheiro", "dinheiro"],
    ["outro", "outra forma"],
  ];
  const vistas = new Set<string>();
  for (const [forma, texto] of esperadas) {
    const linha = conteudoDocumento({ ...BASE, forma }).corpo[0];
    assert.equal(linha, declaracao(texto), forma);
    vistas.add(linha);
  }
  assert.equal(vistas.size, 5, "cinco formas, cinco declarações");
});

test("3. o nome, o valor e a data vêm do documento (o morador e a data de outro registro mudam a frase)", () => {
  const c = conteudoDocumento({ ...BASE, locatario: { nome: "Caio Mota", doc: null }, valor: 1250.5, dataPagamento: "2026-12-01", forma: "dinheiro" });
  assert.equal(c.corpo[0], `Caução de R$ 1.250,50, paga por Caio Mota por dinheiro, em 01/12/2026. ${LEI}`);
});

test("4. a frase antiga sai: o morador nunca aparece como quem depositou na poupança", () => {
  const t = conteudoDocumento(BASE).corpo.join(" ");
  assert.doesNotMatch(t, /declara o recebimento da caução/);
  assert.doesNotMatch(t, /depositada por Inquilina Dois/);
  assert.doesNotMatch(t, /conta vinculada/i);
});

test("5. o resto do comprovante fica como está: o 2.º parágrafo, o quadro, o título e o subtítulo", () => {
  const c = conteudoDocumento(BASE);
  assert.equal(c.corpo.length, 2);
  assert.equal(c.corpo[1], "A caução é devolvida ao fim da locação, depois da vistoria de saída, com os eventuais descontos justificados.");
  assert.equal(c.titulo, "Comprovante de Caução");
  assert.equal(c.subtitulo, "Contrato CT-D7400000");
  assert.deepEqual(c.quadro.slice(-2), [
    ["Caução", "R$ 3.000,00"],
    ["Depositada em", "05/10/2026, por Pix"],
  ]);
});

test("6. o recibo de aluguel fica inteiro", () => {
  const c = conteudoDocumento({ ...BASE, tipo: "recibo_aluguel", encargos: [{ rotulo: "Condomínio", valor: 450 }] });
  assert.deepEqual(c.corpo, [
    "Dono Um declara ter recebido de Inquilina Dois a quantia de R$ 3.450,00 referente ao aluguel e encargos do imóvel acima, no período de 01/10/2026 a 30/11/2026, conforme o contrato CT-D7400000.",
    "O recebimento foi registrado pelo locador e confirmado pelo locatário na plataforma.",
  ]);
  assert.deepEqual(c.quadro.slice(-4), [
    ["Aluguel", "R$ 3.000,00"],
    ["Condomínio", "R$ 450,00"],
    ["Total", "R$ 3.450,00"],
    ["Pago em", "05/10/2026, por Pix"],
  ]);
});

test("7. o termo de devolução fica inteiro", () => {
  const c = conteudoDocumento({ ...BASE, tipo: "termo_devolucao_caucao", valor: 2500, caucaoTotal: 3000, confirmadoEm: "2026-12-02" });
  assert.deepEqual(c.corpo, [
    "Dono Um declara ter devolvido a Inquilina Dois o valor de R$ 2.500,00 referente à caução do contrato CT-D7400000, com descontos de R$ 500,00.",
    "O locatário confirmou o recebimento na plataforma. Este termo encerra a caução deste contrato.",
  ]);
});

test("8. a emissão leva a forma do REGISTRO (pagamentos_bloco.forma), nunca a caucao_forma do bloco", () => {
  const emitir = ler("src/lib/fiscal/emitir.ts");
  const doPagamento = emitir.slice(emitir.indexOf("export async function emitirDoPagamento"));
  assert.match(doPagamento, /\.from\("pagamentos_bloco"\)\s*\.select\("[^"]*\bforma\b/);
  assert.match(doPagamento, /forma: pg\.forma as string/);
  assert.doesNotMatch(emitir, /caucao_forma/);
});

test("9. os já emitidos não mudam: só a emissão monta o conteúdo (o reenvio usa o PDF guardado)", () => {
  const emitir = ler("src/lib/fiscal/emitir.ts");
  assert.equal((emitir.match(/conteudoDocumento\(/g) ?? []).length, 2, "a trava de contato e o PDF da emissão");
  assert.match(emitir, /\.storage\.from\(BUCKET_DOCUMENTOS\)\.download\(d\.pdf_path/);
});
