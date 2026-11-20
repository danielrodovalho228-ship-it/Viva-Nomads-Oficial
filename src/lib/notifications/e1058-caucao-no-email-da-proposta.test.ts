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
  const detalhe = ler("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  assert.match(detalhe, /rotulo=\{rotuloCaucaoDaProposta\(caucao\)\}/);
});
