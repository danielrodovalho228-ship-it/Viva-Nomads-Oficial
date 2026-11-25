/*
  E1079 (ORDEM-DUET-385/386), fatia 1 — Central → Avaliadores pelos mockups aprovados (admin-avaliadores-novo):
  a chave em cartão com o estado de cada condição, o credenciamento em cartões com a foto da conta (ou as iniciais)
  e a pílula do estado, a tabela de preço limpa por cidade e a lista do piloto no mesmo padrão.
  O que o desenho mostra como exemplo (nomes, valores, contagens) vem sempre do sistema.
  Roda: node --test src/lib/vistoria/e1079-central-cartoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { condicoesParaLigar, type LinhaPreco } from "./regras.ts";
import { ROTULO_PORTE_CURTO, TEXTO_REGRA_CHAVE, TITULO_CHAVE, cartaoDaCondicao, linhaDoCredenciado, subtituloDaCentral, tabelaLimpaPorCidade, tomDoStatus, valorDaTabela } from "./central-cartoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const cond = (e: { tabelaCompleta: boolean; avaliadoresAtivos: number; parecerItem14: boolean }) => condicoesParaLigar(e).map((c) => cartaoDaCondicao(c, e.avaliadoresAtivos));

test("a chave: cada condição vira uma linha com rótulo curto e pílula de estado (o caso do desenho)", () => {
  assert.equal(TITULO_CHAVE, "Chave da Vistoria");
  assert.equal(TEXTO_REGRA_CHAVE, "A chave é liberada apenas quando todos os itens forem cumpridos.");
  assert.deepEqual(cond({ tabelaCompleta: true, avaliadoresAtivos: 1, parecerItem14: false }), [
    { rotulo: "Tabela de preço preenchida", pilula: "Cumprida", tom: "ok" },
    { rotulo: "2 avaliadores ativos na cidade", pilula: "Falta 1", tom: "atencao" },
    { rotulo: "Parecer jurídico", pilula: "Pendente", tom: "pendente" },
  ]);
});

test("a chave: tudo cumprido, e o que falta diz quanto falta", () => {
  assert.deepEqual(cond({ tabelaCompleta: true, avaliadoresAtivos: 2, parecerItem14: true }).map((c) => `${c.pilula}/${c.tom}`), ["Cumprida/ok", "Cumprida/ok", "Cumprida/ok"]);
  const nada = cond({ tabelaCompleta: false, avaliadoresAtivos: 0, parecerItem14: false });
  assert.deepEqual(nada.map((c) => `${c.pilula}/${c.tom}`), ["Falta/atencao", "Falta 2/atencao", "Pendente/pendente"]);
});

test("credenciamento: a linha 'número • cidade' e o tom da pílula por estado", () => {
  assert.equal(linhaDoCredenciado({ numero: "UDI-003", cidade: "Uberlândia" }), "UDI-003 • Uberlândia");
  assert.equal(tomDoStatus("ativo"), "ok");
  assert.equal(tomDoStatus("em_teste"), "teste");
  assert.equal(tomDoStatus("solicitado"), "pendente");
  assert.equal(tomDoStatus("suspenso"), "pendente");
  assert.equal(tomDoStatus("descredenciado"), "pendente");
});

test("tabela limpa: por cidade, os 3 portes na ordem do desenho com o valor vigente (a regra da casa); sem valor, travessão", () => {
  const l = (cidade: string, porte: LinhaPreco["porte"], valor: number, vigenteDesde: string): LinhaPreco => ({ cidade, porte, valor, vigenteDesde, incluiTexto: null } as LinhaPreco);
  // Vale a linha mais recente já em vigor; a que só começa amanhã não conta; a cidade compara sem acento.
  const tabela = [l("Uberlândia", "q1_2", 999, "2026-11-22T12:00:00Z"), l("Uberlandia", "q1_2", 200, "2026-11-01"), l("Uberlândia", "q1_2", 250, "2026-11-20"), l("Uberlândia", "estudio", 150, "2026-11-01"), l("Araguari", "q3_mais", 350.5, "2026-11-01")];
  assert.deepEqual(tabelaLimpaPorCidade(tabela, ["Uberlândia", "Araguari"], new Date("2026-11-21T12:00:00Z")), [
    { cidade: "Uberlândia", linhas: [{ porte: "estudio", rotulo: "Estúdio", valor: "R$ 150" }, { porte: "q1_2", rotulo: "1–2 quartos", valor: "R$ 250" }, { porte: "q3_mais", rotulo: "3+ quartos", valor: "—" }] },
    { cidade: "Araguari", linhas: [{ porte: "estudio", rotulo: "Estúdio", valor: "—" }, { porte: "q1_2", rotulo: "1–2 quartos", valor: "—" }, { porte: "q3_mais", rotulo: "3+ quartos", valor: "R$ 350,50" }] },
  ]);
  assert.deepEqual(ROTULO_PORTE_CURTO, { estudio: "Estúdio", q1_2: "1–2 quartos", q3_mais: "3+ quartos" });
  assert.equal(valorDaTabela(1250), "R$ 1.250");
  assert.equal(valorDaTabela(null), "—");
});

test("subtítulo do desenho: com uma cidade só, diz a cidade; com várias ou nenhuma, não inventa", () => {
  assert.equal(subtituloDaCentral(["Uberlândia"]), "Gerencie os avaliadores e a chave da vistoria da cidade de Uberlândia");
  assert.equal(subtituloDaCentral(["Uberlândia", "Araguari"]), "Gerencie os avaliadores e a chave da vistoria de cada cidade");
  assert.equal(subtituloDaCentral([]), "Gerencie os avaliadores e a chave da vistoria");
});

test("a página usa os cartões novos e mantém os pontos de apoio das travas que já existem", () => {
  const p = ler("app/(dashboard)/admin/avaliadores/page.tsx");
  // Chave: o cartão, cada condição com o estado e o motivo (o motivo continua no texto da linha).
  assert.match(p, /data-testid="avaliadores-chave"/);
  assert.match(p, /<LinhaCondicao key=\{c\.id\} id=\{c\.id\} ok=\{c\.ok\} detalhe=\{c\.detalhe\} \{\.\.\.cartaoDaCondicao\(c, ativos\)\} \/>/);
  // Credenciamento: a foto da conta (ou as iniciais) e a pílula; o item guarda número e estado como antes.
  assert.match(p, /<CartaoPessoa\s[^>]*nome=\{nomeDoCredenciado\(c\)\}[^>]*fotoUrl=\{c\.user_id \? fotos\.get\(c\.user_id\) : undefined\}/);
  assert.match(p, /data-testid="credenciamento-item" data-numero=\{c\.numero_credenciado\} data-status=\{c\.status\}/);
  assert.match(p, /pilula=\{ROTULO_STATUS\[c\.status\]\} tom=\{tomDoStatus\(c\.status\)\}/);
  // Tabela limpa por cidade, antes do formulário e do histórico (que continuam).
  assert.match(p, /tabelaLimpaPorCidade\(tabela, cidades, agora\)/);
  assert.ok(p.indexOf('data-testid="precos-limpa"') < p.indexOf('testid="preco-form"'), "a tabela limpa vem antes do formulário");
  assert.match(p, /data-testid="precos-historico"/);
  // Piloto no mesmo padrão: foto ou iniciais.
  assert.match(p, /<CartaoPessoa\s[^>]*nome=\{l\.nome\}[^>]*fotoUrl=\{fotos\.get\(l\.userId\)\}/);
  assert.match(p, /data-testid="piloto-conta" data-teste=\{l\.teste \? "1" : "0"\}/);
});

test("foto: fonte única (a foto de perfil da conta); sem foto ou com a leitura a falhar, ficam as iniciais", () => {
  const f = ler("lib/vistoria/fotos-servidor.ts");
  assert.match(f, /signAvatarPath\(/, "assina o caminho canónico da própria conta");
  assert.match(f, /catch \{/, "foto é enfeite: falha de leitura não derruba a Central");
  const c = ler("components/avaliadores/central.tsx");
  assert.match(c, /<Avatar name=\{nome\} size=\{56\} photoUrl=\{fotoUrl\}/, "o Avatar da casa: iniciais por baixo, foto por cima");
  assert.doesNotMatch(c, /required|obrigat/i, "foto nunca é obrigatória");
});

test("os estilos que só o desenho permite ficam no arquivo de exceção que já existe; a guarda geral não mudou", () => {
  // O mesmo lugar dos mockups da Conta: a guarda continua a isentar UM arquivo só (nenhuma isenção nova).
  const guarda = ler("lib/estilo/estilo-padrao.test.ts");
  assert.equal((guarda.match(/visual-mockup/g) ?? []).length, 1);
  assert.match(ler("lib/conta/visual-mockup.ts"), /Área de avaliadores \(E1079\)/);
  const c = ler("components/avaliadores/central.tsx");
  assert.match(c, /from "@\/lib\/conta\/visual-mockup"/);
  // Nada de cor de fundo de estado nem sombra escrita na página do admin ou no componente: vem tudo do arquivo de exceção.
  assert.doesNotMatch(c, /bg-\[#|shadow-\[/);
  assert.doesNotMatch(ler("app/(dashboard)/admin/avaliadores/page.tsx"), /bg-\[#|shadow-\[/);
});
