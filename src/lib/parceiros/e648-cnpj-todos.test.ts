/*
  E648 (2) — REGRA DE CADASTRO, decisão do Daniel (06/11/2026): CNPJ para TODOS os parceiros, sem exceção de categoria. Avaliador,
  limpeza (recorrente ou não), fotografia e serviços avulsos exigem CNPJ (MEI onde a atividade permite). CPF NÃO é aceito em nenhuma
  categoria de parceiro: quem quiser ser parceiro abre empresa. Cadastros CPF que já existem (só massa de teste hoje) não recebem
  serviço até apresentarem CNPJ. Sem tocar em fluxos de pagamento.
  Roda: node --test src/lib/parceiros/e648-cnpj-todos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_SO_CNPJ, filtrarParceiros, parceiroPodeReceberServico, validarSolicitacao, CATEGORIAS_PARCEIRO, faltaParaPublicar } from "./regras.ts";
import { faltaParaCredenciamento } from "../vistoria/regras.ts";
import { validarPedidoAvaliador } from "../vistoria/entrada.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const CPF = "529.982.247-25";
const CNPJ = "11.222.333/0001-81";
const base = { nome: "Ana Limpezas", cidades: ["Uberlândia"], aceite: true, descricao: "Limpeza residencial", emiteNota: true };

test("a mensagem diz a regra sem rodeio: só CNPJ, MEI onde a atividade permite, CPF não é aceito", () => {
  assert.match(MSG_SO_CNPJ, /CNPJ/);
  assert.match(MSG_SO_CNPJ, /MEI/);
  assert.match(MSG_SO_CNPJ, /CPF não é aceito/);
});

test("CPF é recusado em TODAS as categorias de parceiro (pessoa física, ou CPF digitado como documento)", () => {
  for (const c of CATEGORIAS_PARCEIRO.map((x) => x.valor)) {
    const entrada = { ...base, categorias: [c], portfolioUrl: "https://exemplo.com.br/portfolio", empresa: "Mudanças Ltda", veiculo: "Baú" };
    const pf = validarSolicitacao({ ...entrada, tipoPessoa: "pf", documento: CPF });
    if (c === "vistoria") continue; // credenciamento próprio (testado abaixo); fora do catálogo da solicitação
    assert.equal(pf.ok, false, `${c} (pf + CPF)`);
    if (!pf.ok) assert.equal(pf.erro, MSG_SO_CNPJ, c);
    const pjComCpf = validarSolicitacao({ ...entrada, tipoPessoa: "pj", documento: CPF });
    assert.equal(pjComCpf.ok, false, `${c} (pj com CPF no campo)`);
  }
});

test("CNPJ válido continua passando em todas as categorias do catálogo", () => {
  for (const c of ["limpeza", "fotografia", "mudanca", "manutencao"]) {
    const r = validarSolicitacao({ ...base, categorias: [c], portfolioUrl: "https://exemplo.com.br/p", empresa: "Mudanças Ltda", veiculo: "Baú", tipoPessoa: "pj", documento: CNPJ });
    assert.equal(r.ok, true, c);
    if (r.ok) assert.equal(r.valor.tipoPessoa, "pj");
  }
  // quem não marcou o tipo (a tela deixou de perguntar) é tratado como empresa
  const sem = validarSolicitacao({ ...base, categorias: ["limpeza"], tipoPessoa: "", documento: CNPJ });
  assert.equal(sem.ok, true);
});

test("CNPJ inválido continua recusado, com a frase do CNPJ", () => {
  const r = validarSolicitacao({ ...base, categorias: ["limpeza"], tipoPessoa: "pj", documento: "11.222.333/0001-82" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /CNPJ inválido/);
});

test("cadastro que já existe com CPF não recebe serviço: sai da busca pública e não recebe pedido, até apresentar CNPJ", () => {
  assert.equal(parceiroPodeReceberServico("pj"), true);
  assert.equal(parceiroPodeReceberServico("pf"), false);
  assert.equal(parceiroPodeReceberServico(null), false, "sem tipo registrado não recebe");
  const p = (id: string, tipoPessoa: string | null) =>
    ({ id, status: "publicado", teste: false, categorias: ["limpeza"], cidades: ["Uberlândia"], lat: null, lng: null, raioKm: null, avaliacoesQtd: 0, notaMedia: null, publicadoEm: null, tipoPessoa, emiteNota: true }) as never;
  const lista = filtrarParceiros([p("a", "pj"), p("b", "pf"), p("c", null)], { categoria: "limpeza", cidade: "Uberlândia" }) as unknown as { id: string }[];
  assert.deepEqual(lista.map((x) => x.id), ["a"]);
  // o pedido de orçamento ao parceiro confere o tipo no servidor
  const pedido = ler("src/lib/parceiros/pedido-actions.ts");
  assert.match(pedido, /select\("id, user_id, status, categorias, tipo_pessoa"\)/);
  assert.match(pedido, /!parceiroPodeReceberServico\(parceiro\.tipo_pessoa\)/);
});

test("avaliador: o credenciamento exige CNPJ válido no cadastro de parceiro (CPF não vale) e o pedido de entrada só aceita empresa", () => {
  const falta = faltaParaCredenciamento({ identidadeVerificada: true, documentoValido: false, experienciaArquivo: true, experienciaLink: null, aceiteConduta: true, cidade: "Uberlândia" });
  assert.deepEqual(falta, ["CNPJ válido no cadastro de parceiro (CPF não é aceito)."]);
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.match(acoes, /parc\.tipo_pessoa === "pj" && cnpjValido\(doc\)/);
  assert.doesNotMatch(acoes, /parc\.tipo_pessoa === "pj" \? cnpjValido\(doc\) : cpfValido\(doc\)/);
  const pf = validarPedidoAvaliador({ jaParceiro: false, nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF, cidade: "Uberlândia", experienciaLink: "https://exemplo.com.br/p", experienciaArquivo: false, aceiteConduta: true });
  assert.equal(pf.ok, false);
  if (!pf.ok) assert.ok(pf.falta.some((f) => /CPF não é aceito/.test(f)));
  const pj = validarPedidoAvaliador({ jaParceiro: false, nome: "Ana Avaliações ME", tipoPessoa: "pj", documento: CNPJ, cidade: "Uberlândia", experienciaLink: "https://exemplo.com.br/p", experienciaArquivo: false, aceiteConduta: true });
  assert.equal(pj.ok, true);
});

test("a tela do cadastro não oferece mais 'Pessoa física (CPF)' e diz a regra; nada do pagamento muda", () => {
  const form = ler("src/components/parceiros/seja-parceiro-form.tsx");
  assert.doesNotMatch(form, /Pessoa física \(CPF\)/);
  assert.match(form, /MSG_SO_CNPJ/);
  assert.match(form, /tipoPessoa: "pj"/);
  // nenhum arquivo de pagamento foi tocado por esta regra (a taxa e o recebimento seguem como estão)
  assert.doesNotMatch(ler("src/lib/parceiros/pedido-actions.ts"), /parceiroPodeReceberServico\([^)]*\)[^\n]*(cobranca|asaas)/i);
});

test("o admin vê quem ainda está só com CPF (fila 'apresentar CNPJ'): sem CNPJ não publica", () => {
  const f = faltaParaPublicar({ avatarPath: "a", descricao: "x".repeat(40), servicosAtivos: 1, cidades: ["Uberlândia"], categorias: ["limpeza"], fotosGaleria: 0, tipoPessoa: "pf", emiteNota: null });
  assert.ok(f.some((x) => /CNPJ/.test(x)), `faltaParaPublicar deve pedir o CNPJ: ${JSON.stringify(f)}`);
});
