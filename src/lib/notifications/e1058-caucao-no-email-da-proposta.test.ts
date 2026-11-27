/*
  E1058 (prova de 20/11, Proposta e contrato): o e-mail da proposta — e os do aceite — não traziam a caução; a moradora
  recebia a proposta por e-mail sem o valor que o ecrã da proposta mostra. Agora o quadro do e-mail traz a MESMA linha da
  caução do ecrã (mesma função, caucaoDaProposta, e o mesmo rótulo), antes do número da proposta.
  Roda: node --test src/lib/notifications/e1058-caucao-no-email-da-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasProposta } from "./dados-negociacao.ts";
import { caucaoDaProposta, rotuloCaucaoDaProposta } from "../propostas/caucao-da-proposta.ts";
import { formatBRLExato } from "../precos.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const IM = { titulo: "Apto Santa Mônica", bairro: "Saraiva", cidade: "Uberlândia" };

test("E1058: o quadro do e-mail da proposta traz a linha da caução, com o rótulo e o valor do ecrã", () => {
  const c = caucaoDaProposta({ meses: 2, dias: 43 }, 2800);
  assert.ok(c);
  const linhas = linhasProposta({
    numero: "ORC-2026-0014", imovel: IM, entrada: "2027-01-10", saida: "2027-02-22", meses: 2, dias: 43, valorMensal: 2800,
    contaTotal: "x", responderAte: null, caucao: { rotulo: rotuloCaucaoDaProposta(c), valor: formatBRLExato(c.valor) },
  });
  const linha = linhas.find((l) => l.rotulo.startsWith("Caução"));
  assert.ok(linha, "o quadro tem a linha da caução");
  assert.equal(linha.rotulo, rotuloCaucaoDaProposta(c));
  assert.equal(linha.valor, formatBRLExato(c.valor));
  // E1061 (ORDEM-DUET-349): o e-mail herda a lei da caução — o rótulo da estadia toda e o valor da estadia toda.
  assert.equal(linha.rotulo, "Caução (50% do aluguel da estadia, 43 dias)");
  // Estadia longa: o e-mail leva a caução da estadia toda (R$ 3.750 a R$ 2.500/mês, 90 dias), não a do 1º bloco.
  const longa = caucaoDaProposta({ meses: 3, dias: 90 }, 2500);
  assert.ok(longa);
  const l90 = linhasProposta({
    numero: "X", imovel: IM, entrada: "2027-01-10", saida: "2027-04-09", meses: 3, dias: 90, valorMensal: 2500, contaTotal: "x",
    responderAte: null, caucao: { rotulo: rotuloCaucaoDaProposta(longa), valor: formatBRLExato(longa.valor) },
  }).find((l) => l.rotulo.startsWith("Caução"));
  assert.deepEqual(l90, { rotulo: "Caução (50% do aluguel da estadia, 90 dias)", valor: formatBRLExato(3750) });
  assert.equal(linhas.at(-1)?.rotulo, "Proposta", "o número da proposta continua a fechar o quadro");
});

test("E1058: sem caução (sem período ou sem valor), o quadro fica como antes", () => {
  const linhas = linhasProposta({ numero: "X", imovel: IM, entrada: "2026-11-01", saida: "2026-11-30", meses: 1, valorMensal: 1, contaTotal: "R$ 1", caucao: null });
  assert.ok(!linhas.some((l) => l.rotulo.startsWith("Caução")));
});

test("E1058: o e-mail (proposta, contraproposta e aceite) lê a caução pela função do ecrã, e o ecrã usa o mesmo rótulo", () => {
  const acoes = ler("../data/propostas-actions.ts");
  const quadro = acoes.slice(acoes.indexOf("function dadosDoEmailDaProposta"), acoes.indexOf("function dadosDoEmailDaProposta") + 2000);
  assert.match(quadro, /caucaoDaProposta\(c\.termos, tot\.valorMensal\)/);
  assert.match(quadro, /rotuloCaucaoDaProposta\(/);
  // Os dois lados: a proposta vai a quem a recebe; o aceite monta o quadro do dono E o do morador pela mesma função.
  assert.match(acoes, /dadosDoEmailDaProposta\(p\.numero, imovel, contexto, papelDestino\)/);
  assert.match(acoes, /const quadroDono = dadosDoEmailDaProposta\(p\.numero, imovel, \{ desfecho: "aceita", termos \}, "owner"\);/);
  assert.match(acoes, /const quadroMorador = dadosDoEmailDaProposta\(p\.numero, imovel, \{ desfecho: "aceita", termos \}, "tenant"\);/);
  const detalhe = ler("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  assert.match(detalhe, /rotulo=\{rotuloCaucaoDaProposta\(caucao\)\}/);
});
