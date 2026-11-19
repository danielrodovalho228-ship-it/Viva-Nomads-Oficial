/*
  E950 — classificador da varredura logada/admin: uma fixture por tipo de achado, o inventário do Apêndice A (108 rotas),
  a resolução das rotas com parâmetro (registro semeado ou "não varrida" com o motivo) e a cobertura no resumo.
  Roda: node --test tests/laboratorio/e950-varredura-classificador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PERSONAS,
  TIPOS_ACHADO,
  classificar,
  juntar,
  BUSCAS_NO_BANCO,
  lerInventario,
  lerRedirecionamentos,
  resolverRota,
  resumoMarkdown,
  rotasDaPersona,
  type Observacao,
  type Parcial,
  type TipoAchado,
} from "../e2e/fixtures/e950-varredura.ts";

const limpa = (o: Partial<Observacao> = {}): Observacao => ({
  pedido: "/dashboard",
  final: "/dashboard",
  status: 200,
  console: [],
  pageErrors: [],
  imagensQuebradas: [],
  scrollWidth: 390,
  clientWidth: 390,
  texto: "Olá, Iara\nSuas estadias",
  esqueletoVisivel: [],
  ...o,
});
const tipos = (o: Observacao) => classificar(o).map((a) => a.tipo);

test("tela limpa: nenhum achado", () => {
  assert.deepEqual(classificar(limpa()), []);
});

const FIXTURES: [TipoAchado, Partial<Observacao>][] = [
  ["http", { status: 500 }],
  ["redirecionamento", { final: "/dashboard/imoveis" }],
  ["console", { console: ["TypeError: x is not a function"] }],
  ["pageerror", { pageErrors: ["ReferenceError: foo is not defined"] }],
  ["hidratacao", { console: ["Warning: Text content did not match. Server: \"a\" Client: \"b\""] }],
  ["imagem-quebrada", { imagensQuebradas: ["http://localhost:3123/_next/image"] }],
  ["estouro-horizontal", { scrollWidth: 412, clientWidth: 390 }],
  ["frase-proibida", { texto: "O telefone do proprietário é revelado depois do aceite." }],
  ["texto-quebrado", { texto: "Aluguel: R$ NaN" }],
  ["esqueleto-preso", { esqueletoVisivel: ['[data-testid="auth-guard-carregando"]'] }],
];

test("uma fixture por tipo: cada uma gera exatamente o seu tipo, e todos os tipos têm fixture", () => {
  assert.deepEqual(FIXTURES.map(([t]) => t).sort(), (Object.keys(TIPOS_ACHADO) as TipoAchado[]).sort());
  for (const [tipo, o] of FIXTURES) assert.deepEqual(tipos(limpa(o)), [tipo], tipo);
});

test("http: redirecionamento ou 200 não é http; erro de abertura é", () => {
  assert.deepEqual(tipos(limpa({ status: 200 })), []);
  assert.deepEqual(tipos(limpa({ status: null, final: null, erroAbertura: "Timeout 40000ms exceeded" })), ["http"]);
  assert.match(classificar(limpa({ status: 404 }))[0].detalhe, /HTTP 404/);
});

test("redirecionamento: cair no login é dito com todas as letras", () => {
  const [a] = classificar(limpa({ final: "/auth" }));
  assert.equal(a.tipo, "redirecionamento");
  assert.match(a.detalhe, /caiu no login/);
});

test("hidratação: as três formas pedidas, no console ou no pageerror", () => {
  for (const m of ["Hydration failed because the server rendered HTML didn't match", "Minified React error #418; visit https://react.dev", "Minified React error #423", "Minified React error #425"]) {
    assert.deepEqual(tipos(limpa({ pageErrors: [m] })), ["hidratacao"], m);
  }
  assert.deepEqual(tipos(limpa({ pageErrors: ["Minified React error #300"] })), ["pageerror"]);
});

test("texto quebrado: undefined, null, NaN, R$ NaN e [object Object]; palavras que só contêm as letras não contam", () => {
  for (const t of ["Olá, undefined", "Valor: null", "NaN dias", "Total R$NaN", "Imóvel [object Object]"]) assert.deepEqual(tipos(limpa({ texto: t })), ["texto-quebrado"], t);
  for (const t of ["Nulo não aparece", "Nanami Costa", "undefinedness?"]) assert.deepEqual(tipos(limpa({ texto: t })), [], t);
});

test("frase proibida: mesmo gate do E776/E785; telas do fluxo de parceiros ficam fora (FORA_DO_GATE)", () => {
  const texto = "O contato do proprietário é liberado depois do aceite.";
  assert.ok(tipos(limpa({ texto })).includes("frase-proibida"));
  assert.deepEqual(tipos(limpa({ pedido: "/dashboard/parceiro", final: "/dashboard/parceiro", texto })), []);
});

test("estouro: só quando scrollWidth passa de clientWidth", () => {
  assert.deepEqual(tipos(limpa({ scrollWidth: 390, clientWidth: 390 })), []);
  assert.match(classificar(limpa({ scrollWidth: 400, clientWidth: 390 }))[0].detalhe, /\+10px/);
});

test("inventário: as 108 rotas do Apêndice A; admin varre o /admin, as outras personas o resto", () => {
  const inv = lerInventario(readFileSync(new URL("../../docs/e793-painel-sessao-servidor.md", import.meta.url), "utf8"));
  assert.equal(inv.length, 108);
  assert.ok(inv.includes("/admin") && inv.includes("/dashboard") && inv.includes("/qualificar"));
  const admin = rotasDaPersona("admin", inv);
  const morador = rotasDaPersona("morador", inv);
  assert.equal(admin.length + morador.length, 108);
  assert.ok(admin.every((r) => r.startsWith("/admin")));
  assert.ok(!morador.some((r) => r.startsWith("/admin")));
});

test("rotas com parâmetro: usam o registro semeado; sem registro → não varrida com o motivo", () => {
  const massa = { imovel17: "i17", imovelTres: "i3", contrato: "c1", contratoTres: "c3" };
  assert.deepEqual(resolverRota("/dashboard/imoveis/[id]/editar", "proprietario", massa), { urls: ["/dashboard/imoveis/i17/editar"] });
  assert.deepEqual(resolverRota("/dashboard/estadia/[contratoId]/mensagens", "morador", massa), { urls: ["/dashboard/estadia/c1/mensagens"] });
  assert.deepEqual(resolverRota("/admin/contratos/[id]", "admin", massa), { urls: ["/admin/contratos/c1"] });
  assert.equal((resolverRota("/dashboard/conta/[secao]", "parceiro", massa) as { urls: string[] }).urls.length, 7);
  const sem = resolverRota("/dashboard/imoveis/[id]/editar", "morador", massa);
  assert.ok("motivo" in sem && /não cria imóvel para a persona morador/.test(sem.motivo));
  assert.deepEqual(resolverRota("/dashboard/leads/[id]", "proprietario", massa, { "/dashboard/leads/[id]": { proprietario: "L9" } }), { urls: ["/dashboard/leads/L9"] });
  const semLead = resolverRota("/dashboard/leads/[id]", "morador", massa, {});
  assert.ok("motivo" in semLead && /leads/.test(semLead.motivo));
  assert.ok("motivo" in resolverRota("/dashboard/imoveis/[id]/editar", "proprietario", null));
  assert.deepEqual(resolverRota("/dashboard/favoritos", "morador", null), { urls: ["/dashboard/favoritos"] });
});

test("saída e resumo: cobertura = rotas varridas ÷ rotas do inventário, execuções e não varridas com motivo", () => {
  const inv = ["/dashboard", "/dashboard/leads/[id]", "/admin"];
  const parciais: Parcial[] = [
    { persona: "morador", largura: 390, terminou: true, registros: [{ rota: "/dashboard", url: "/dashboard", persona: "morador", largura: 390, achados: [{ tipo: "console", detalhe: "x" }], captura: "c.png" }], naoVarridas: [{ rota: "/dashboard/leads/[id]", persona: "morador", motivo: "sem lead" }] },
    { persona: "admin", largura: 1280, terminou: false, registros: [{ rota: "/admin", url: "/admin", persona: "admin", largura: 1280, achados: [], captura: null }], naoVarridas: [] },
  ];
  const s = juntar(parciais, inv, "2026-11-15T00:00:00Z");
  assert.deepEqual(s.cobertura, { varridas: 2, total: 3, percentual: 66.7, rotasNaoVarridas: ["/dashboard/leads/[id]"] });
  assert.equal(s.porTipo.console, 1);
  assert.equal(s.registros.length, 2);
  const md = resumoMarkdown(s);
  assert.match(md, /\*\*Cobertura:\*\* 2 de 3 rotas do inventário varridas \(66\.7%\)/);
  assert.match(md, /\| admin \| 1280 \| \*\*não\*\* \| 1 \|/);
  assert.match(md, /`\/dashboard\/leads\/\[id\]`: sem lead/);
  assert.deepEqual([...PERSONAS], ["morador", "proprietario", "dois-papeis", "parceiro", "admin"]);
  // Modo: só é "completa" quando todas as parciais vieram do workflow da varredura completa; a amostra avisa no resumo.
  assert.equal(s.modo, "amostra");
  assert.match(md, /Modo \*\*amostra\*\*/);
  const completa = juntar(parciais.map((p) => ({ ...p, modo: "completa" as const })), inv, "x");
  assert.equal(completa.modo, "completa");
  assert.doesNotMatch(resumoMarkdown(completa), /Modo \*\*amostra\*\*/);
});

// ORDEM-DUET-102: as 6 telas que redirecionam de propósito ficam na tabela do Apêndice A; a varredura afirma o destino.
const DOC = readFileSync(new URL("../../docs/e793-painel-sessao-servidor.md", import.meta.url), "utf8");
const REGRAS = lerRedirecionamentos(DOC);

test("redirecionam de propósito: as 6 telas do Apêndice A, cada uma com o destino nomeado; o inventário segue com 108", () => {
  assert.deepEqual(
    REGRAS.map((r) => [r.de, r.para, r.larguraMinima ?? null]),
    [
      ["/qualificar", "/dashboard/imoveis/novo", null],
      ["/dashboard/conta", "/dashboard/conta/perfil", 1024],
      ["/dashboard/conta/notificacoes", "/dashboard/notificacoes", null],
      ["/dashboard/conta/avaliacoes", "/dashboard/avaliacoes", null],
      ["/dashboard/assinatura", "/dashboard", null],
      ["/dashboard/qa/emails", "/dashboard/conta/ajuda", null],
    ],
  );
  for (const r of REGRAS) assert.ok(r.motivo.length > 10, `${r.de}: o porquê está escrito`);
  assert.equal(lerInventario(DOC).length, 108, "a tabela dos redirecionamentos não soma rotas ao inventário");
});

test("redirecionam de propósito: o destino nomeado é a regra; outro destino, ou ficar na tela, continua achado", () => {
  const de = (pedido: string, final: string, largura = 390) => classificar(limpa({ pedido, final, largura }), REGRAS);
  assert.deepEqual(de("/qualificar", "/dashboard/imoveis/novo"), []);
  assert.deepEqual(de("/dashboard/assinatura", "/dashboard", 1280), []);
  const errado = de("/qualificar", "/dashboard");
  assert.equal(errado.length, 1);
  assert.equal(errado[0].tipo, "redirecionamento");
  assert.match(errado[0].detalhe, /devia ir para \/dashboard\/imoveis\/novo e foi para \/dashboard/);
  assert.match(de("/dashboard/conta/notificacoes", "/dashboard/conta/notificacoes")[0].detalhe, /ficou na própria tela/);
  assert.match(de("/dashboard/conta/avaliacoes", "/auth")[0].detalhe, /devia ir para \/dashboard\/avaliacoes e foi para o login/);
  // Sem a tabela, o comportamento antigo: todo redirecionamento é achado.
  assert.equal(classificar(limpa({ pedido: "/qualificar", final: "/dashboard/imoveis/novo" }))[0].tipo, "redirecionamento");
});

test("redirecionam de propósito: a Conta só vai para o Perfil a partir de 1024 px; no celular abre na própria tela", () => {
  const conta = (final: string, largura: number) => classificar(limpa({ pedido: "/dashboard/conta", final, largura }), REGRAS);
  assert.deepEqual(conta("/dashboard/conta/perfil", 1280), []);
  assert.deepEqual(conta("/dashboard/conta", 390), [], "a 390 a Conta abre o próprio menu");
  assert.match(conta("/dashboard/conta", 1280)[0].detalhe, /devia ir para \/dashboard\/conta\/perfil e ficou na própria tela/);
  assert.match(conta("/dashboard/conta/perfil", 390)[0].detalhe, /foi para \/dashboard\/conta\/perfil/, "a 390 redirecionar é achado");
});

test("rotas com [id]: a avaliação do parceiro procura o credenciamento do avaliador, não a conta", () => {
  const b = BUSCAS_NO_BANCO.find((x) => x.rota === "/dashboard/parceiro/avaliacao/[pedido]")!;
  assert.deepEqual(b.colunas, ["avaliador_id"]);
  assert.equal(b.viaAvaliador, true);
});
