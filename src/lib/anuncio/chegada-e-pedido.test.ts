import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISO_SEM_TIPO_ENTRADA,
  CONVIDADO_NUNCA_VE,
  CONVIDADO_VE,
  LIMITE_CONSIDERAR_TEXTO,
  LIMITE_MENSAGEM_PEDIDO,
  avisoTipoEntradaNoPainel,
  considerarPreenchido,
  convidadoVence,
  limiteConvidados,
  mensagemParaExibir,
  mostraClasseDeRuido,
  podeConvidar,
  rotuloTipoEntrada,
  tipoEntradaBloqueia,
  tipoEntradaValido,
  validarConsiderar,
  validarMensagemParaPedido,
} from "./chegada-e-pedido.ts";

test("tipo de entrada: só as chaves da lista; o rótulo não carrega código nem local", () => {
  assert.equal(tipoEntradaValido("cofre_de_chaves"), true);
  assert.equal(tipoEntradaValido("cofre na caixa de luz, senha 1234"), false);
  assert.equal(tipoEntradaValido(null), false);
  assert.equal(rotuloTipoEntrada("fechadura_com_codigo"), "Fechadura com código");
  assert.equal(rotuloTipoEntrada("xyz"), null);
});

test("tipo de entrada: obrigatório só para publicar anúncio novo; publicado sem ele ganha aviso, sem bloqueio", () => {
  assert.equal(tipoEntradaBloqueia({ tipoEntrada: null, jaPublicado: false }), true);
  assert.equal(tipoEntradaBloqueia({ tipoEntrada: "porteiro", jaPublicado: false }), false);
  assert.equal(tipoEntradaBloqueia({ tipoEntrada: null, jaPublicado: true }), false);
  assert.equal(avisoTipoEntradaNoPainel({ tipoEntrada: null, status: "active" }), AVISO_SEM_TIPO_ENTRADA);
  assert.equal(avisoTipoEntradaNoPainel({ tipoEntrada: null, status: "draft" }), null);
  assert.equal(avisoTipoEntradaNoPainel({ tipoEntrada: "outro", status: "active" }), null);
});

test("mensagem para quem pede: até 500, contato mascarado ao salvar e ao exibir", () => {
  assert.deepEqual(validarMensagemParaPedido("   "), { ok: true, valor: null, mascarou: false });
  const r = validarMensagemParaPedido("Prefiro quem fica 3 meses. Me chama no 11 99876-5432 ou ana@exemplo.com");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.mascarou, true);
    assert.doesNotMatch(r.valor ?? "", /99876|ana@exemplo/);
  }
  assert.equal(validarMensagemParaPedido("a".repeat(LIMITE_MENSAGEM_PEDIDO)).ok, true);
  assert.equal(validarMensagemParaPedido("a".repeat(LIMITE_MENSAGEM_PEDIDO + 1)).ok, false);
  // texto gravado por outro caminho nunca exibe contato
  assert.doesNotMatch(mensagemParaExibir("whats 11 99876-5432") ?? "", /99876/);
  assert.equal(mensagemParaExibir(""), null);
});

test("o que considerar: filtra a lista, limita o texto, soma quando preenchido e nunca bloqueia vazio", () => {
  const r = validarConsiderar(["barulho", "barulho", "piscina", "escada"], "  Rua de bares às sextas ");
  assert.deepEqual(r, { ok: true, itens: ["barulho", "escada"], texto: "Rua de bares às sextas" });
  assert.deepEqual(validarConsiderar(undefined, null), { ok: true, itens: [], texto: null });
  assert.equal(validarConsiderar([], "x".repeat(LIMITE_CONSIDERAR_TEXTO + 1)).ok, false);
  assert.equal(considerarPreenchido({ itens: [], texto: "" }), false);
  assert.equal(considerarPreenchido({ itens: ["obra"] }), true);
  assert.equal(considerarPreenchido({ texto: "Escada estreita" }), true);
  assert.equal(mostraClasseDeRuido(["barulho"]), true);
  assert.equal(mostraClasseDeRuido(["obra"]), false);
});

test("convidar quem mora junto: até ocupantes − 1, sem repetir nem convidar a si mesmo", () => {
  assert.equal(limiteConvidados(1), 0);
  assert.equal(limiteConvidados(3), 2);
  assert.equal(limiteConvidados(null), 0);
  const base = { qtdOcupantes: 3, ativos: 0, jaConvidados: [] as string[], emailDoMorador: "eu@x.com" };
  assert.deepEqual(podeConvidar({ ...base, email: "Bia@X.com" }), { ok: true });
  assert.equal(podeConvidar({ ...base, email: "eu@x.com" }).ok, false);
  assert.equal(podeConvidar({ ...base, email: "bia@x.com", jaConvidados: ["BIA@x.com"] }).ok, false);
  assert.equal(podeConvidar({ ...base, email: "nao-e-email" }).ok, false);
  const cheio = podeConvidar({ ...base, ativos: 2, email: "c@x.com" });
  assert.equal(cheio.ok, false);
  const sozinho = podeConvidar({ ...base, qtdOcupantes: 1, email: "c@x.com" });
  assert.equal(sozinho.ok, false);
});

test("convidado: só leitura do que precisa; valores, contrato e conversa nunca", () => {
  for (const c of CONVIDADO_VE) assert.equal((CONVIDADO_NUNCA_VE as readonly string[]).includes(c), false);
  assert.ok(CONVIDADO_NUNCA_VE.includes("valores"));
  assert.ok(CONVIDADO_NUNCA_VE.includes("conversa"));
  assert.equal(convidadoVence("2026-12-01T00:00:00Z")?.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.equal(convidadoVence(null), null);
  assert.equal(convidadoVence("lixo"), null);
});

test("colunas: ausente não mexe, vazio limpa, inválido recusa, contato mascarado", async () => {
  const { colunasChegadaEPedido, chegadaDoRascunho } = await import("./chegada-e-pedido.ts");
  assert.deepEqual(colunasChegadaEPedido({}), { ok: true, colunas: {} });
  assert.deepEqual(colunasChegadaEPedido({ tipoEntrada: "" }), { ok: true, colunas: { tipo_entrada: null } });
  assert.equal(colunasChegadaEPedido({ tipoEntrada: "senha 1234" }).ok, false);
  const r = colunasChegadaEPedido({ tipoEntrada: "porteiro", mensagemParaPedido: "liga 11 99876-5432", considerarAntes: ["obra", "x"] });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.colunas.tipo_entrada, "porteiro");
    assert.doesNotMatch(String(r.colunas.mensagem_para_pedido), /99876/);
    assert.deepEqual(r.colunas.considerar_antes, ["obra"]);
    assert.equal("considerar_antes_texto" in r.colunas, false);
  }
  assert.deepEqual(chegadaDoRascunho({ tipoEntrada: "outro", lixo: 1 }), { tipoEntrada: "outro", mensagemParaPedido: undefined, considerarAntes: undefined, considerarAntesTexto: undefined });
  assert.deepEqual(chegadaDoRascunho(null).tipoEntrada, undefined);
});

test("leitura: sem a 0225 some; lixo do banco não aparece; mensagem antiga com contato sai mascarada", async () => {
  const { chegadaEPedidoDaLinha } = await import("./chegada-e-pedido.ts");
  assert.equal(chegadaEPedidoDaLinha(null), undefined);
  const c = chegadaEPedidoDaLinha({ tipo_entrada: "xyz", mensagem_para_pedido: "zap 11 99876-5432", considerar_antes: ["obra", "piscina"], considerar_antes_texto: " " });
  assert.equal(c?.tipoEntrada, null);
  assert.doesNotMatch(c?.mensagemParaPedido ?? "", /99876/);
  assert.deepEqual(c?.considerarAntes, ["obra"]);
  assert.equal(c?.considerarAntesTexto, null);
});

test("GUARDA: tipo_entrada é público; como_entrar só nos leitores da estadia (nunca na API pública nem no anúncio)", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const raiz = new URL("../../../", import.meta.url).pathname;
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const c = join(d, n);
      if (statSync(c).isDirectory()) andar(c);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) arquivos.push(c.slice(raiz.length));
    }
  };
  andar(join(raiz, "src"));
  const LEITORES = new Set([
    "src/lib/estadia/instrucoes.ts",
    "src/lib/data/estadia.ts",
    "src/lib/data/estadia-actions.ts",
    "src/app/api/cron/automacoes/route.ts",
    // E209: o lembrete D-2/D-1 leva as instruções no corpo — só ao morador, com contrato assinado + 1º pagamento.
    "src/app/api/cron/checkin-lembretes/route.ts",
    "src/config/retencao.ts",
    "src/lib/anuncio/chegada-e-pedido.ts",
  ]);
  const fora = arquivos.filter((a) => !LEITORES.has(a) && /como_entrar|imovel_instrucoes_chegada/.test(readFileSync(join(raiz, a), "utf8")));
  assert.deepEqual(fora, [], "como_entrar lido fora da página da estadia");
  const props = readFileSync(join(raiz, "src/lib/data/properties.ts"), "utf8");
  assert.match(props, /tipo_entrada/, "o anúncio lê o tipo de entrada");
  const mig = readFileSync(join(raiz, "supabase/migrations/0225_chegada_e_pedido.sql"), "utf8");
  assert.match(mig, /grant select \(tipo_entrada, mensagem_para_pedido, considerar_antes, considerar_antes_texto\) on public\.properties to anon, authenticated/);
  assert.doesNotMatch(mig, /como_entrar[^\n]*to anon/);
});

test("GUARDA do convidado: a visão só lê datas, endereço, instruções e linha do tempo; nenhuma ação da estadia o aceita", async () => {
  const { readFileSync } = await import("node:fs");
  const raiz = new URL("../../../", import.meta.url).pathname;
  const ler = (a: string) => readFileSync(raiz + a, "utf8");
  // Sem comentários (/* … */ e //): só o código que lê dados.
  const semComentario = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
  const visao = semComentario(ler("src/lib/data/estadia-convidados.ts") + ler("src/app/(dashboard)/dashboard/estadia/[contratoId]/convidado/page.tsx"));
  // pagamentos_bloco entra só na condição da liberação (D-7, igual à do morador); nada dele sai na visão.
  for (const proibido of ["contrato_aditivos", "documentos_fiscais", "messages", "conversa", "aluguel_mensal", "caucao", "comissao", "contrato_notas", "contrato_ocupantes", "recibo"]) {
    const usos = visao.split("\n").filter((l) => l.includes(proibido) && !/^\s*(\*|\/\/|\/\*)/.test(l) && !l.includes("<p ") && !l.includes("COLUNAS_ESTADIA"));
    assert.deepEqual(usos, [], `a visão do convidado não pode ler ${proibido}`);
  }
  // A visão não devolve linha do contrato: só os campos escolhidos.
  const fonte = ler("src/lib/data/estadia-convidados.ts");
  const ini = fonte.indexOf("export interface VisaoConvidado {");
  const tipo = fonte.slice(ini, fonte.indexOf("\n}\n", ini));
  assert.match(tipo, /endereco: string;/);
  assert.doesNotMatch(tipo, /valor|caucao|pagamento|documento|conversa/i);
  // contextoDaEstadia (porta de TODAS as ações da estadia) só aceita morador e dono: o convidado cai em "não encontrado".
  assert.match(ler("src/lib/data/estadia.ts"), /c\.tenant_id === user\.id \? "inquilino" : c\.properties\?\.owner_id === user\.id \? "proprietario" : null/);
  // Convidar e remover: só o morador, sempre por contextoDaEstadia.
  const acoes = ler("src/lib/data/estadia-convidados-actions.ts");
  assert.equal((acoes.match(/contextoDaEstadia\(/g) ?? []).length, 2);
  assert.equal((acoes.match(/ctx\.papel !== "inquilino"/g) ?? []).length, 2);
});
