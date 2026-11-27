import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarPedidoAvaliador } from "./entrada.ts";
import { MSG_SO_CNPJ } from "../parceiros/regras.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1152 (ORDEM-DUET-644; linha Parceiros, classe B). No pedido de credenciamento do avaliador, quem põe um CPF lia a
  regra três vezes, com três redações: a nota fixa da tela ("A Viva só trabalha com parceiros que têm CNPJ…"), a recusa
  junto do campo ("CPF não é aceito: informe o CNPJ…") e a lista geral ("Falta: CNPJ válido (CPF não é aceito…)").
  Agora a recusa é a frase da regra, da MESMA fonte do "Seja parceiro" (`MSG_SO_CNPJ`); a nota sai da tela enquanto a
  recusa está lá; e a lista geral diz só o que falta.
  Roda: node --test src/lib/vistoria/e1152-recusa-do-cpf-uma-fonte.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
const CPF = "52998224725";
const base = { jaParceiro: false, nome: "Ana Avaliadora", cidade: "Uberlândia", experienciaLink: "https://exemplo.com.br/p", experienciaArquivo: false, aceiteConduta: true };

test("E1152: a recusa do CPF, junto do campo, é a frase da regra — a mesma do formulário público", () => {
  for (const entrada of [{ ...base, tipoPessoa: "pf", documento: CPF }, { ...base, tipoPessoa: "pj", documento: CPF }]) {
    const r = validarPedidoAvaliador(entrada);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.deepEqual(r.campos.filter((c) => c.campo === "documento"), [{ campo: "documento", mensagem: MSG_SO_CNPJ }]);
  }
});

test("E1152: a lista geral diz só o que falta — a regra do CPF não é dita outra vez, com outra redação", () => {
  const r = validarPedidoAvaliador({ ...base, tipoPessoa: "pf", documento: CPF });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.falta, ["CNPJ válido."]);
  assert.ok(!r.falta.some((f) => /CPF/.test(f)));
});

test("E1152: outro erro do documento continua com a frase própria (a nota fica)", () => {
  const invalido = validarPedidoAvaliador({ ...base, tipoPessoa: "pj", documento: "11111111000100" });
  assert.equal(invalido.ok, false);
  if (!invalido.ok) assert.equal(invalido.campos.find((c) => c.campo === "documento")?.mensagem, "CNPJ inválido: confira os números.");
  const vazio = validarPedidoAvaliador({ ...base, tipoPessoa: "pj", documento: "" });
  assert.equal(vazio.ok, false);
  if (!vazio.ok) assert.equal(vazio.campos.find((c) => c.campo === "documento")?.mensagem, "Informe o CNPJ.");
});

test("E1152 (varredura): a regra não está escrita à mão na validação — lê a fonte", () => {
  const entrada = ler("src/lib/vistoria/entrada.ts");
  assert.match(entrada, /import \{ MSG_SO_CNPJ \} from "\.\.\/parceiros\/regras\.ts";/);
  assert.match(entrada, /campos\.push\(\{ campo: "documento", mensagem: MSG_SO_CNPJ \}\);/);
  assert.doesNotMatch(entrada, /CPF não é aceito/);
});

test("E1152 (varredura): a nota da tela é a da fonte e sai quando a recusa do campo diz a mesma frase", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(pagina, /data-testid="credenciamento-so-cnpj" data-nota-do-campo="documento">\{MSG_SO_CNPJ\}<\/p>/);
  const form = ler("src/components/vistoria/form-acao.tsx");
  // Esconde só a nota do MESMO campo com a MESMA frase; a tentativa seguinte devolve-a.
  assert.match(form, /nota\.getAttribute\(NOTA_DO_CAMPO\) !== c\.campo \|\| nota\.textContent\?\.trim\(\) !== c\.mensagem\) return;/);
  assert.match(form, /nota\.setAttribute\("hidden", ""\);/);
  assert.match(form, /form\.querySelectorAll\(`\[\$\{NOTA_ESCONDIDA\}\]`\)\.forEach\(\(n\) => \{\s*n\.removeAttribute\("hidden"\);/);
});
