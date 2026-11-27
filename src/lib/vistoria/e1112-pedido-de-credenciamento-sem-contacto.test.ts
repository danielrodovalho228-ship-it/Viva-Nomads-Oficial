import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarPedidoAvaliador } from "./entrada.ts";
import { validarSolicitacao } from "../parceiros/regras.ts";
import { CONTATO_AVISO, contemContato } from "../pedidos/pedidos.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1112, a correcção da ORDEM-DUET-652. A guarda de contacto no nome estava no "Seja parceiro" (`validarSolicitacao`)
  e na página do parceiro (`salvarPagina` + gatilho da 0357). Mas a categoria "avaliador" não nasce pelo "Seja
  parceiro": nasce pelo PEDIDO DE CREDENCIAMENTO, e esse caminho (`validarPedidoAvaliador`) não conferia nada — um
  telefone no "Nome público" entrava no pedido e ia para o nome público do parceiro na aprovação (o gatilho do banco só
  olha as alterações, não a criação).
  Passa a valer a mesma guarda: contacto no nome é recusado, com o aviso da casa junto do campo, e nada fica gravado.
  Roda: node --test src/lib/vistoria/e1112-pedido-de-credenciamento-sem-contacto.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
const CNPJ = "11.222.333/0001-81";
const pedido = (nome: string) => ({ jaParceiro: false, nome, tipoPessoa: "pj", documento: CNPJ, cidade: "Uberlândia", experienciaLink: "https://portfolio.exemplo.com.br/abel", experienciaArquivo: false, aceiteConduta: true });
const COM_CONTACTO = ["Abel Avaliações (34) 99999-1234", "Abel Avaliações 34999991234", "Abel abel@exemplo.com.br", "Abel wa.me/5534999991234", "Abel, chama no zap", "Abel Avaliações - meu whats"];

test("E1112: pedido de credenciamento com contacto no nome é recusado, com o aviso da casa junto do campo do nome", () => {
  for (const nome of COM_CONTACTO) {
    assert.ok(contemContato(nome), `a regra da casa apanha "${nome}"`);
    const r = validarPedidoAvaliador(pedido(nome));
    assert.equal(r.ok, false, nome);
    if (r.ok) continue;
    // O resto do pedido está certo: o único campo marcado é o nome, com o aviso da casa.
    assert.deepEqual(r.campos, [{ campo: "nome", mensagem: CONTATO_AVISO }], nome);
    assert.deepEqual(r.falta, ["Tirar o contato do nome público."], nome);
  }
});

test("E1112: pedido limpo nasce — o nome sem contacto passa como antes", () => {
  for (const nome of ["Abel Avaliações", "Abel Avaliações Ltda. 2024", "Instalações e Avaliações Faceta", "Ana & Rui Avaliadores"]) {
    assert.equal(contemContato(nome), false, nome);
    const r = validarPedidoAvaliador(pedido(nome));
    assert.equal(r.ok, true, nome);
    if (r.ok) assert.deepEqual(r.valor.parceiro, { nome, tipoPessoa: "pj", documento: "11222333000181" });
  }
});

test("E1112: a recusa do contacto junta-se às outras — cada campo com a sua mensagem, o nome com o aviso da casa", () => {
  const r = validarPedidoAvaliador({ ...pedido("Abel (34) 99999-1234"), documento: "", cidade: "", experienciaLink: "", aceiteConduta: false });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.campos.map((c) => c.campo), ["nome", "documento", "cidade", "experienciaLink", "aceiteConduta"]);
  assert.equal(r.campos[0].mensagem, CONTATO_AVISO);
  // O nome curto demais continua com a mensagem dele (um erro por campo).
  const curto = validarPedidoAvaliador(pedido("Ab"));
  assert.equal(curto.ok, false);
  if (!curto.ok) assert.deepEqual(curto.campos, [{ campo: "nome", mensagem: "Informe o nome público (o seu ou o da empresa), com 3 letras ou mais." }]);
});

test("E1112: quem já é parceiro não manda nome no pedido — o nome dele já é guardado pela página do parceiro", () => {
  const r = validarPedidoAvaliador({ ...pedido("ignorado (34) 99999-1234"), jaParceiro: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valor.parceiro, null);
});

test("E1112: é a MESMA guarda do 'Seja parceiro' — a fonte única da casa, sem regra nova; e nada grava antes dela", () => {
  const entrada = semComentarios(ler("src/lib/vistoria/entrada.ts"));
  assert.match(entrada, /import \{ CONTATO_AVISO, contemContato \} from "\.\.\/pedidos\/pedidos\.ts";/);
  assert.doesNotMatch(entrada, /new RegExp|\/\\d|@\[/, "nenhuma expressão de contacto própria");
  // Os dois caminhos de entrada recusam o mesmo nome com o mesmo aviso.
  const nome = "Abel (34) 99999-1234";
  const seja = validarSolicitacao({ nome, tipoPessoa: "pj", documento: CNPJ, categorias: ["limpeza"], cidades: ["Uberlândia"] } as Parameters<typeof validarSolicitacao>[0]);
  assert.deepEqual(seja.ok ? null : { erro: seja.erro, campo: seja.campo }, { erro: CONTATO_AVISO, campo: "nome" });
  const cred = validarPedidoAvaliador(pedido(nome));
  assert.equal(cred.ok ? "" : cred.campos[0].mensagem, CONTATO_AVISO);
  // A ação: a validação vem antes do arquivo e de qualquer gravação; recusada, devolve os campos e sai.
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const pedir = acoes.slice(acoes.indexOf("export async function pedirCredenciamento("));
  const valida = pedir.indexOf("const v = validarPedidoAvaliador(");
  const sai = pedir.indexOf("if (!v.ok) return { ok: false, erro: `Falta: ${v.falta.join(\" \")}`, campos: v.campos };");
  assert.ok(valida > 0 && sai > valida);
  for (const grava of [".upload(", ".insert(", ".update(", ".upsert("]) {
    const i = pedir.indexOf(grava);
    assert.ok(i === -1 || i > sai, `nada grava antes da recusa (${grava})`);
  }
});
