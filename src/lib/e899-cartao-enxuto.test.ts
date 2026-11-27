/* Roda: node --test src/lib/e899-cartao-enxuto.test.ts
   E899 (Daniel, 13/11, uso real): o cartão de imóvel tinha texto demais (cerca de 9 linhas). Passa a mostrar só o essencial:
   local, título, "R$ X/mês", "R$ Y em N meses · aviso curto", especificações e disponibilidade. A composição do valor sai do
   cartão e fica na página do imóvel. Lei que não muda (E777): os números do cartão vêm da MESMA fonte única da página.
     T1 — lei E777: modeloDoCartao(p, meses) dá o /mês de calcularTudoIncluido e o total de estadiaDoImovel.
     T2 — honestidade do aviso: "tudo incluído" se, e somente se, as contas são fixas; senão "água, luz e gás à parte".
     T3 — estático: o cartão não importa composicaoDoMes nem desenha as três linhas que saíram. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { calcularTudoIncluido, estadiaDoImovel } from "./precos.ts";
import { resumoEmMeses, rotuloPreco } from "./cartao-preco.ts";
import { itensSintese } from "./cartao-sintese.ts";
import { formatBRL } from "./utils.ts";
import type { Property } from "./types.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const imovel = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;
const SEM_NBSP = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ");
const HOJE = new Date("2026-11-14T12:00:00-03:00");

const semLimpeza = (p: Property): Property => ({ ...p, id: `${p.id}-sem-limpeza`, prepFee: 0, checkoutCleaningEnabled: false, checkoutCleaningFee: 0 });

// Fixtures obrigatórias do T1: ube-001; contas fixas; contas medidas; com limpezas de preparação e de saída; sem nenhuma limpeza.
const FIXTURES: { nome: string; p: Property }[] = [
  { nome: "ube-001", p: imovel("ube-001") },
  { nome: "contas fixas (ube-002, com pacote de limpeza no mês)", p: imovel("ube-002") },
  { nome: "contas medidas (ube-003)", p: imovel("ube-003") },
  { nome: "com limpezas de preparação e de saída (ube-008)", p: imovel("ube-008") },
  { nome: "sem nenhuma limpeza, contas fixas (ube-005)", p: semLimpeza(imovel("ube-005")) },
  { nome: "sem nenhuma limpeza, contas medidas (ube-003)", p: semLimpeza(imovel("ube-003")) },
];
const MESES = [1, 2, 6];

test("T1 (lei E777): o /mês do cartão é o total do mês da fonte única e o total é o de estadiaDoImovel, com 1 e com N > 1 meses", async () => {
  const { modeloDoCartao } = await import("./cartao-modelo.ts");
  for (const { nome, p } of FIXTURES) {
    for (const n of MESES) {
      const m = modeloDoCartao(p, n, HOJE);
      const pagina = estadiaDoImovel(p, n)!;
      assert.equal(m.precoMes, formatBRL(calcularTudoIncluido(p).total), `${nome}, ${n} mês(es): precoMes`);
      assert.equal(m.totalEstadia.valor, pagina.total, `${nome}, ${n} mês(es): valor do totalEstadia`);
      assert.equal(m.totalEstadia.meses, n, `${nome}, ${n} mês(es): N`);
      assert.equal(m.totalEstadia.texto, resumoEmMeses(pagina.total, n), `${nome}, ${n} mês(es): texto do total`);
    }
  }
});

test("T1: os números que a prova ao vivo mede (ube-001 e ube-003) e as fixtures de limpeza", async () => {
  const { modeloDoCartao } = await import("./cartao-modelo.ts");
  const um = modeloDoCartao(imovel("ube-001"), 1, HOJE);
  assert.equal(SEM_NBSP(um.precoMes), "R$ 3.960");
  assert.equal(SEM_NBSP(um.totalEstadia.texto), "R$ 4.660 em 1 mês");
  assert.equal(SEM_NBSP(modeloDoCartao(imovel("ube-001"), 6, HOJE).totalEstadia.texto), "R$ 24.460 em 6 meses");
  const tres = modeloDoCartao(imovel("ube-003"), 2, HOJE);
  assert.equal(SEM_NBSP(tres.precoMes), "R$ 4.100");
  assert.equal(SEM_NBSP(tres.totalEstadia.texto), "R$ 8.900 em 2 meses");
  // Com limpezas: o total passa de N × mês; sem nenhuma: é exatamente N × mês.
  const com = imovel("ube-008");
  assert.equal(modeloDoCartao(com, 2, HOJE).totalEstadia.valor, 2 * calcularTudoIncluido(com).total + 650 + 380);
  const sem = semLimpeza(imovel("ube-003"));
  assert.equal(modeloDoCartao(sem, 2, HOJE).totalEstadia.valor, 8200);
  assert.equal(modeloDoCartao(sem, 1, HOJE).totalEstadia.valor, 4100);
});

test("T1: sem duração na busca, N é a estadia mínima do anúncio (a mesma regra de hoje, mesesDoCartao)", async () => {
  const { modeloDoCartao } = await import("./cartao-modelo.ts");
  assert.equal(modeloDoCartao(imovel("ube-001"), undefined, HOJE).totalEstadia.meses, 1);
  const tres = modeloDoCartao(imovel("ube-003"), undefined, HOJE);
  assert.equal(tres.totalEstadia.meses, 2, "ube-003 pede 60 dias");
  assert.equal(tres.totalEstadia.valor, estadiaDoImovel(imovel("ube-003"), 2)!.total);
});

test("T1: especificações e disponibilidade são as de hoje (itensSintese sem o nível, que é selo da foto; rotuloPreco)", async () => {
  const { modeloDoCartao } = await import("./cartao-modelo.ts");
  for (const p of SAMPLE_PROPERTIES) {
    const m = modeloDoCartao(p, 1, HOJE);
    assert.deepEqual(m.sintese, itensSintese(p).filter((i) => i.chave !== "nivel"), `${p.id}: síntese`);
    assert.equal(m.disponivel, rotuloPreco({ mensal: 0, disponivelEm: p.availableFrom, hoje: HOJE }).disponivel, `${p.id}: disponível`);
  }
  const futuro = modeloDoCartao({ ...imovel("ube-001"), availableFrom: "2027-01-15" }, 1, HOJE);
  assert.match(futuro.disponivel ?? "", /^Disponível a partir de /);
  assert.equal(modeloDoCartao({ ...imovel("ube-001"), availableFrom: "2026-01-15" }, 1, HOJE).disponivel, "Disponível agora");
});

test("T2 (honestidade): o aviso é 'tudo incluído' se, e somente se, as contas são fixas; senão, 'água, luz e gás à parte'", async () => {
  const { modeloDoCartao } = await import("./cartao-modelo.ts");
  const { AVISO_TUDO_INCLUIDO, AVISO_CONTAS_A_PARTE } = await import("./precos.ts");
  assert.equal(AVISO_TUDO_INCLUIDO, "tudo incluído");
  assert.equal(AVISO_CONTAS_A_PARTE, "água, luz e gás à parte");
  const todos: Property[] = [...SAMPLE_PROPERTIES, ...FIXTURES.map((f) => f.p)];
  // Qualquer valor que não seja "fixed" (medido, ausente, nulo ou desconhecido) NÃO pode dizer "tudo incluído".
  for (const modo of ["fixed", "real", undefined, null, "", "outro"]) todos.push({ ...imovel("ube-001"), utilitiesMode: modo as Property["utilitiesMode"] });
  let fixos = 0;
  let medidos = 0;
  for (const p of todos) {
    for (const n of MESES) {
      const { aviso } = modeloDoCartao(p, n, HOJE);
      const fixo = p.utilitiesMode === "fixed";
      assert.equal(aviso === AVISO_TUDO_INCLUIDO, fixo, `${p.id} (${String(p.utilitiesMode)}): "tudo incluído" ⇔ contas fixas`);
      assert.equal(aviso === AVISO_CONTAS_A_PARTE, !fixo, `${p.id} (${String(p.utilitiesMode)}): "à parte" ⇔ contas não fixas`);
      // Nunca os dois juntos, nunca nenhum: o aviso é exatamente um dos dois textos.
      assert.ok([AVISO_TUDO_INCLUIDO, AVISO_CONTAS_A_PARTE].includes(aviso), `${p.id}: nunca nenhum`);
      assert.ok(!(aviso.includes(AVISO_TUDO_INCLUIDO) && aviso.includes(AVISO_CONTAS_A_PARTE)), `${p.id}: nunca os dois juntos`);
      if (fixo) fixos++;
      else medidos++;
    }
  }
  assert.ok(fixos > 0 && medidos > 0, "a prova cobre os dois regimes");
  assert.equal(modeloDoCartao(imovel("ube-001"), 1, HOJE).aviso, "tudo incluído");
  assert.equal(modeloDoCartao(imovel("ube-003"), 2, HOJE).aviso, "água, luz e gás à parte");
});

test("T2: os dois textos curtos são definidos UMA vez, em src/lib/precos.ts", () => {
  const precos = ler("src/lib/precos.ts");
  assert.match(precos, /export const AVISO_TUDO_INCLUIDO = "tudo incluído";/);
  assert.match(precos, /export const AVISO_CONTAS_A_PARTE = "água, luz e gás à parte";/);
  // Nenhum outro arquivo de produção escreve os avisos à mão (o cartão e o modelo usam as constantes).
  const achados: string[] = [];
  const varrer = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) varrer(p);
      else if (/\.tsx?$/.test(n) && !/\.test\.ts$/.test(n) && p !== "src/lib/precos.ts" && /["'`>]\s*tudo incluído\s*["'`<]|água, luz e gás à parte/.test(ler(p))) achados.push(p);
    }
  };
  varrer("src");
  assert.deepEqual(achados, []);
});

test("T3 (estático): o cartão não importa composicaoDoMes nem desenha as três linhas que saíram", () => {
  const card = ler("src/components/property-card.tsx");
  assert.doesNotMatch(card, /composicaoDoMes/);
  for (const id of ["cartao-mes-composicao", "cartao-total-composicao", "cartao-total-rotulo"]) assert.ok(!card.includes(id), `${id} não volta ao cartão`);
  // Nada de "Detalhes do valor" expansível: o cartão inteiro é um link (botão ou <details> dentro dele é HTML inválido).
  assert.doesNotMatch(card, /<details|<summary/);
});

test("T3: o cartão desenha preço, total, aviso, especificações e disponibilidade SÓ a partir de modeloDoCartao", () => {
  const card = ler("src/components/property-card.tsx");
  assert.match(card, /modeloDoCartao\(property, periodMonths\)/);
  assert.doesNotMatch(card, /calcularTudoIncluido|rotuloPreco|estadiaNoCartao|itensSintese|resumoEmMeses|mesesDoCartao/, "as contas ficam na função pura, não no componente");
  // Ordem fixa: local → título → preço → total (com o aviso) → especificações → disponível.
  const ordem = ["cartao-local", "cartao-titulo", "cartao-preco-mes", "cartao-total-estadia", "cartao-aviso", "cartao-sintese", "cartao-disponivel"].map((id) => card.indexOf(`data-testid="${id}"`));
  assert.ok(ordem.every((i, k) => i > 0 && (k === 0 || i > ordem[k - 1])), `ordem ${ordem}`);
  // Local e título em no máximo 1 linha.
  const linha = (id: string) => card.split("\n").find((l) => l.includes(`data-testid="${id}"`)) ?? "";
  assert.match(linha("cartao-local"), /\bline-clamp-1\b/);
  assert.match(linha("cartao-titulo"), /\bline-clamp-1\b/);
});

test("E899: o rótulo duplicado saiu de cartao-preco.ts; o de precos.ts é o único", async () => {
  assert.doesNotMatch(ler("src/lib/cartao-preco.ts"), /ROTULO_TOTAL_MES/);
  const { ROTULO_TOTAL_MES } = await import("./precos.ts");
  assert.equal(ROTULO_TOTAL_MES, "Total por mês (com contas)");
});

test("E899: a página do imóvel mostra as duas composições pelas MESMAS funções que o cartão usava", () => {
  const lateral = ler("src/components/property/price-card.tsx");
  assert.match(lateral, /import \{[^}]*\bcomposicaoDoMes\b[^}]*\} from "@\/lib\/cartao-estadia"/);
  assert.match(lateral, /data-testid="cartao-lateral-mes-composicao"[^>]*>\s*\{composicaoDoMes\(property\)\}/);
  assert.match(lateral, /estadiaDoImovel\(property, Math\.max\(1, meses\)\)/);
  assert.match(lateral, /<FormulaDoTotal conta=\{estadia\.conta\} testid="cartao-lateral-estadia-conta" \/>/);
});
