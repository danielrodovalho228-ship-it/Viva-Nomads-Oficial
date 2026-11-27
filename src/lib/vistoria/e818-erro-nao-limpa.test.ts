/*
  E818 (relato do Rogério, uso real de 12/11): no cadastro de vistoriador (/dashboard/parceiro/avaliacao) o CNPJ foi
  dado como inválido e o formulário voltou EM BRANCO. Causa: o FormAcao enviava por <form action={…}> — no React 19 o
  formulário é LIMPO ao terminar a ação, mesmo quando ela devolve erro. Agora:
   (1) erro de validação nunca limpa o formulário (envio por onSubmit + startTransition; limpa só no sucesso);
   (2) o campo com erro fica em vermelho, com a mensagem própria junto dele;
   (3) a página rola e foca o primeiro campo com erro.
  Roda: node --test src/lib/vistoria/e818-erro-nao-limpa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarPedidoAvaliador } from "./entrada.ts";

const base = { jaParceiro: false, nome: "Rogério Vistorias", tipoPessoa: "pj", documento: "11.111.111/1111-11", cidade: "Uberlândia", experienciaLink: "https://exemplo.com.br/portfolio", experienciaArquivo: false, aceiteConduta: true };

test("o pedido de vistoriador aponta CADA campo com erro (nome do campo + mensagem própria)", () => {
  const r = validarPedidoAvaliador(base);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.campos, [{ campo: "documento", mensagem: "CNPJ inválido: confira os números." }]);
  assert.match(r.falta.join(" "), /CNPJ válido/, "a lista de antes continua (mensagem geral)");

  const varios = validarPedidoAvaliador({ ...base, nome: "Ro", documento: "529.982.247-25", cidade: "", experienciaLink: "", aceiteConduta: false });
  assert.equal(varios.ok, false);
  if (varios.ok) return;
  assert.deepEqual(varios.campos.map((c) => c.campo), ["nome", "documento", "cidade", "experienciaLink", "aceiteConduta"]);
  assert.match(varios.campos[1].mensagem, /CPF não é aceito/);
});

test("pedirCredenciamento devolve os campos com erro para a tela marcar", () => {
  const a = readFileSync("src/lib/vistoria/actions.ts", "utf8");
  assert.match(a, /if \(!v\.ok\) return \{ ok: false, erro: `Falta: \$\{v\.falta\.join\(" "\)\}`, campos: v\.campos \};/);
});

test("nenhum formulário com ação de servidor se limpa no erro: envio por onSubmit (não <form action>)", () => {
  for (const f of ["src/components/vistoria/form-acao.tsx", "src/app/(dashboard)/admin/destinos/forms.tsx", "src/app/(dashboard)/admin/cidades/forms.tsx"]) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /<form action=\{(executar|acao)\}/, f);
    assert.match(s, /onSubmit=\{enviarSemLimpar\}/, f);
  }
  const hook = readFileSync("src/components/ui/use-envio-sem-limpar.ts", "utf8");
  assert.match(hook, /e\.preventDefault\(\);/);
  assert.match(hook, /startTransition\(\(\) => despachar\(new FormData\(form\)\)\)/);
});

test("o FormAcao marca o campo com erro (aria-invalid + mensagem ao lado), rola e foca o primeiro", () => {
  const s = readFileSync("src/components/vistoria/form-acao.tsx", "utf8");
  assert.match(s, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(s, /data-testid", `campo-erro-\$\{c\.campo\}`/);
  assert.match(s, /scrollIntoView\(\{ block: "center" \}\)/);
  assert.match(s, /\.focus\(\{ preventScroll: true \}\)/);
});

/* Cadastro de parceiro (TODAS as categorias, /parceiros e /dashboard/parceiro): mesmo comportamento. */
import { validarSolicitacao, CATEGORIAS_PARCEIRO } from "../parceiros/regras.ts";

test("cadastro de parceiro: cada erro diz QUAL campo (CNPJ inválido → documento, em todas as categorias)", () => {
  const entrada = { nome: "Ana Serviços", tipoPessoa: "pj", documento: "11.111.111/1111-11", cidades: ["Uberlândia"], aceite: true, descricao: "Serviço", emiteNota: true, portfolioUrl: "https://exemplo.com.br/p", empresa: "Leva Já", veiculo: "Baú" };
  for (const c of CATEGORIAS_PARCEIRO.map((x) => x.valor).filter((x) => x !== "vistoria")) {
    const r = validarSolicitacao({ ...entrada, categorias: [c] });
    assert.equal(r.ok, false, c);
    if (!r.ok) assert.equal(r.campo, "documento", c);
  }
  const ok = { ...entrada, documento: "11.222.333/0001-81", categorias: ["limpeza"] };
  const casos: [Record<string, unknown>, string][] = [
    [{ nome: "An" }, "nome"],
    [{ categorias: [] }, "categorias"],
    [{ cidades: [] }, "cidades"],
    [{ categorias: ["fotografia"], portfolioUrl: "" }, "portfolioUrl"],
    [{ categorias: ["mudanca"], empresa: "" }, "empresa"],
    [{ categorias: ["mudanca"], veiculo: "" }, "veiculo"],
    [{ descricao: "" }, "descricao"],
    [{ telefone: "123" }, "telefone"],
    [{ emiteNota: undefined }, "emiteNota"],
    [{ aceite: false }, "aceite"],
  ];
  assert.equal(validarSolicitacao(ok).ok, true);
  for (const [mud, campo] of casos) {
    const r = validarSolicitacao({ ...ok, ...mud } as Parameters<typeof validarSolicitacao>[0]);
    assert.equal(r.ok ? "ok" : r.campo, campo, JSON.stringify(mud));
  }
});

test("seja-parceiro-form marca o campo (vermelho + aria-invalid + mensagem junto) e rola/foca nele; o servidor devolve o campo", () => {
  const f = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");
  assert.match(f, /falhar\(erroDoc, "documento"\)/);
  assert.match(f, /falhar\(v\.erro, v\.campo\)/);
  assert.match(f, /"aria-invalid": true/);
  assert.match(f, /data-testid=\{`sp-erro-\$\{k\}`\}/);
  assert.match(f, /scrollIntoView\(\{ block: "center" \}\)/);
  assert.match(f, /focus\(\{ preventScroll: true \}\)/);
  assert.match(f, /className=\{input \+ vermelho\("documento"\)\} \{\.\.\.marca\("documento"\)\}/);
  assert.doesNotMatch(f, /setC\(\s*\{\s*\.\.\.VAZIO|setC\(VAZIO/, "erro nunca zera os campos");
  const s = readFileSync("src/lib/parceiros/solicitacao-actions.ts", "utf8");
  assert.match(s, /return \{ ok: false, erro: v\.erro, campo: v\.campo \}/);
});

test("envio de arquivo do pedido de serviço: onSubmit (o arquivo escolhido não some quando o envio dá erro)", () => {
  const f = readFileSync("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx", "utf8");
  assert.doesNotMatch(f, /action=\{\(f\) =>/);
  assert.match(f, /const f = new FormData\(e\.currentTarget\);/);
});
