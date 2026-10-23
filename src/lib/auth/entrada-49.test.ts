/*
  Prompt 49 — entrada sem senha (e-mail + código), intenção como camada e convidado sem conta.
  Regras puras + guardas lidas da fonte (rota de envio, tela, intenção, convidado, e-mails do Supabase).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_ENVIOS_HORA,
  MSG_CODIGO_VENCIDO,
  VALIDADE_CODIGO_S,
  avaliarEnvioCodigo,
  codigoVencido,
  contaNova,
  mensagemEnvioCodigo,
  type Limitar,
} from "../seguranca/codigo-acesso.ts";
import { destinoDepoisDaEntrada, motivoDaEntrada, normalizarIntencoes, painelInicial, urlEntrada } from "./entrada.ts";
import { alternarNaLista, armazenamentoDisponivel, lerLista, mesclarSemDuplicar } from "../convidado/guardados.ts";
import { VALIDADE_OTP_S, corpoConfigAuth } from "../notifications/supabase-auth-config.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");

/** Limitador em memória com a mesma semântica do consumir_limite (conta e recusa acima do máximo). */
function limitadorMemoria(): Limitar {
  const contagem = new Map<string, number>();
  return async (chave, maximo) => {
    const n = (contagem.get(chave) ?? 0) + 1;
    contagem.set(chave, n);
    return n > maximo ? "estourou" : "ok";
  };
}

test("limite de envios: 5 por hora por e-mail; o 6º é recusado", async () => {
  const limitar = limitadorMemoria();
  for (let i = 0; i < MAX_ENVIOS_HORA; i++) assert.equal(await avaliarEnvioCodigo("email-a", `ip-${i}`, limitar), true);
  assert.equal(await avaliarEnvioCodigo("email-a", "ip-novo", limitar), false);
  assert.equal(MAX_ENVIOS_HORA, 5);
});

test("limite de envios: 5 por hora por IP, mesmo trocando de e-mail", async () => {
  const limitar = limitadorMemoria();
  for (let i = 0; i < 5; i++) assert.equal(await avaliarEnvioCodigo(`email-${i}`, "ip-x", limitar), true);
  assert.equal(await avaliarEnvioCodigo("email-novo", "ip-x", limitar), false);
});

test("limitador fora do ar não tranca ninguém (falha aberta; o Supabase mantém o dele)", async () => {
  const erro: Limitar = async () => "erro";
  assert.equal(await avaliarEnvioCodigo("e", "i", erro), true);
});

test("resposta neutra: conta inexistente ou cadastro fechado não aparecem; limite e CAPTCHA aparecem", () => {
  assert.equal(mensagemEnvioCodigo("Signups not allowed for otp"), null);
  assert.equal(mensagemEnvioCodigo("User not found"), null);
  assert.match(mensagemEnvioCodigo("email rate limit exceeded")!, /Muitos pedidos/);
  assert.match(mensagemEnvioCodigo("captcha protection: request disallowed")!, /robô/);
  // A rota responde { ok: true } igual com ou sem conta; só o limite vira 429.
  const rota = ler("src/app/api/auth/codigo/route.ts");
  assert.match(rota, /shouldCreateUser: true/);
  assert.match(rota, /if \(msg\) return NextResponse\.json/);
  assert.match(rota, /return NextResponse\.json\(\{ ok: true \}\);\s*\}\s*$/);
  assert.match(rota, /avaliarEnvioCodigo\(emailHash, ipHash\(request\), situacaoLimite\)/);
});

test("validade: o código vale 10 minutos (tela, Supabase e e-mail dizem o mesmo); vencido pede outro com a causa", () => {
  assert.equal(VALIDADE_CODIGO_S, 600);
  assert.equal(VALIDADE_OTP_S, VALIDADE_CODIGO_S);
  assert.equal(corpoConfigAuth().mailer_otp_exp, 600);
  assert.equal(codigoVencido(0, 599_999), false);
  assert.equal(codigoVencido(0, 600_000), true);
  assert.equal(MSG_CODIGO_VENCIDO, "Código vencido: enviamos um novo para o seu e-mail.");
  const tela = ler("src/components/auth/login-por-codigo.tsx");
  assert.match(tela, /codigoVencido\(enviadoEm, Date\.now\(\)\)/);
  assert.match(tela, /setAviso\(MSG_CODIGO_VENCIDO\)/);
  assert.match(ler("supabase/templates/codigo-de-acesso.html"), /10 minutos/);
});

test("conta nova = criada há menos de 30 minutos; data ruim não é nova", () => {
  const agora = Date.parse("2026-10-23T12:00:00Z");
  assert.equal(contaNova("2026-10-23T11:59:00Z", agora), true);
  assert.equal(contaNova("2026-10-23T11:00:00Z", agora), false);
  assert.equal(contaNova(undefined, agora), false);
  assert.equal(contaNova("lixo", agora), false);
});

test("entrada única: nenhuma conta nova cria senha; 'Entrar com senha' é terciário; 'Esqueci a senha' só dentro dele", () => {
  const tela = ler("src/app/auth/page.tsx");
  assert.doesNotMatch(tela, /signUp\(/);
  assert.match(tela, /useState<Mode>\("entrada"\)/);
  assert.match(tela, /data-testid="entrar-com-senha"/);
  assert.match(tela, /if \(params\.get\("senha"\) === "1"\) setMode\("senha"\)/);
  // "Esqueci minha senha" aparece só nos blocos do modo senha.
  const entrada = tela.slice(tela.indexOf('mode === "entrada" ?'), tela.indexOf('mode === "forgot" ?'));
  assert.doesNotMatch(entrada, /Esqueci/);
  // Links antigos (?cadastro=1, ?codigo=1) caem na entrada única: não há mais modo de cadastro.
  assert.doesNotMatch(tela, /"signup"|"codigo"/);
});

test("e-mail do código: assunto único, código em destaque, sem link de login", () => {
  for (const arq of ["codigo-de-acesso.html", "confirmar-cadastro.html"]) {
    const html = ler(`supabase/templates/${arq}`);
    assert.match(html, /\{\{ \.Token \}\}/, arq);
    assert.doesNotMatch(html, />Entrar<|\/auth["?]|TokenHash/, arq);
  }
  const cfg = corpoConfigAuth();
  assert.equal(cfg.mailer_subjects_magic_link, "Seu código de acesso · Viva Nomads");
  assert.equal(cfg.mailer_subjects_confirmation, "Seu código de acesso · Viva Nomads");
});

test("admin com código continua exigindo AAL2 em /admin (o portão não depende de como entrou)", () => {
  assert.match(ler("src/app/(dashboard)/admin/layout.tsx"), /decidirPortaoMfa\(aal\?\.currentLevel, aal\?\.nextLevel\)/);
  assert.match(ler("src/proxy.ts"), /decidirPortaoMfa\(aal\?\.currentLevel, aal\?\.nextLevel\)/);
});

test("conta só no momento de valor: o porquê vem de texto fixo (nunca da URL) e volta para a ação", () => {
  assert.equal(motivoDaEntrada("pedido"), "Para enviar seu pedido, entre com seu e-mail.");
  assert.equal(motivoDaEntrada("<script>"), null);
  assert.equal(motivoDaEntrada("toString"), null);
  assert.equal(urlEntrada("orcamento", "/parceiros/x?y=1"), "/auth?motivo=orcamento&redirect=%2Fparceiros%2Fx%3Fy%3D1");
  assert.equal(destinoDepoisDaEntrada("/imoveis/1", false), "/imoveis/1");
  assert.equal(destinoDepoisDaEntrada("/imoveis/1", true), "/auth/intencao?redirect=%2Fimoveis%2F1");
  assert.match(ler("src/app/(public)/pedidos/novo/page.tsx"), /urlEntrada\("pedido", volta\)/);
  assert.match(ler("src/app/(public)/imoveis/[id]/property-detail.tsx"), /urlEntrada\(kind === "candidatura" \? "candidatura" : "mensagem"/);
  assert.match(ler("src/proxy.ts"), /searchParams\.set\("motivo", "anunciar"\)/);
});

test("intenção não muda permissão: grava só intencao (e a preferência de modo do painel), nunca role", () => {
  assert.deepEqual(normalizarIntencoes(["anunciar", "lixo", "morar", "morar"]), ["morar", "anunciar"]);
  assert.deepEqual(normalizarIntencoes("admin"), []);
  assert.deepEqual(painelInicial(["anunciar", "morar"], "/dashboard"), { destino: "/dashboard", modo: "owner" });
  assert.deepEqual(painelInicial(["morar"], "/dashboard"), { destino: "/dashboard", modo: "tenant" });
  assert.deepEqual(painelInicial(["servicos"], "/dashboard"), { destino: "/parceiros#h-form", modo: null });
  assert.deepEqual(painelInicial([], "/dashboard"), { destino: "/dashboard", modo: null });
  // A ação que pediu a conta vence o painel da intenção.
  assert.deepEqual(painelInicial(["servicos"], "/pedidos/novo?cidade=x"), { destino: "/pedidos/novo?cidade=x", modo: null });
  const acoes = ler("src/lib/data/intencao-actions.ts");
  // Os únicos updates: intencao e preferred_mode (a preferência do seletor do topo).
  const updates = [...acoes.matchAll(/\.update\(\{([^}]*)\}\)/g)].map((m) => m[1].trim());
  assert.deepEqual(updates, ["intencao", "preferred_mode: modo"]);
  assert.match(acoes, /\.update\(\{ intencao \}\)/);
  const sql = ler("supabase/migrations/0214_intencao_perfil.sql");
  assert.match(sql, /grant update \(intencao\) on public\.profiles to authenticated/);
  assert.match(sql, /intencao <@ array\['morar', 'anunciar', 'servicos'\]/);
  const aplicar = ler("supabase/producao/aplicar-0214.sql");
  assert.match(aplicar, /^-- [\s\S]*\nbegin;[\s\S]*'0214_intencao_perfil'[\s\S]*commit;\n$/);
});

test("convidado: favoritos e buscas do aparelho mesclam sem duplicar", () => {
  assert.deepEqual(mesclarSemDuplicar(["a", "b", "b", "c"], ["b", "x"]), { novos: ["a", "c"], todos: ["b", "x", "a", "c"] });
  assert.deepEqual(mesclarSemDuplicar([], ["x"]), { novos: [], todos: ["x"] });
  assert.deepEqual(lerLista('["a","a",3,"b"]'), ["a", "b"]);
  assert.deepEqual(lerLista("lixo"), []);
  assert.deepEqual(alternarNaLista(["a"], "a"), []);
  assert.deepEqual(alternarNaLista(["a"], "b"), ["a", "b"]);
});

test("convidado sem armazenamento pede a conta; com armazenamento guarda no aparelho", () => {
  const quebrado = { setItem: () => { throw new Error("QuotaExceeded"); }, removeItem: () => {} };
  const ok = { setItem: () => {}, removeItem: () => {} };
  assert.equal(armazenamentoDisponivel(quebrado), false);
  assert.equal(armazenamentoDisponivel(null), false);
  assert.equal(armazenamentoDisponivel(ok), true);
  const coracao = ler("src/components/favorite-button.tsx");
  assert.match(coracao, /if \(!logado && !armazenamentoDisponivel\(armazenamentoDoNavegador\(\)\)\) \{\s*window\.location\.assign\(urlEntrada\("favorito"/);
  const busca = ler("src/components/busca/salvar-busca.tsx");
  assert.match(busca, /router\.push\(urlEntrada\("busca"/);
  // Ao entrar, mescla e limpa o local.
  const mescla = ler("src/lib/convidado/mesclar.ts");
  assert.match(mescla, /mesclarFavoritosConvidado\(pendentes\)/);
  assert.match(mescla, /window\.localStorage\.removeItem\(CHAVE_BUSCAS_CONVIDADO\)/);
  assert.match(ler("src/lib/store.ts"), /mesclarGuardadosDoConvidado\(user\?\.id\)/);
});

test("degraus: e-mail na entrada → telefone no 1º contato → identidade depois do pré-aceite", async () => {
  const { degrausExigidos } = await import("./degraus.ts");
  assert.deepEqual(degrausExigidos("entrada"), ["email"]);
  assert.deepEqual(degrausExigidos("primeiro_contato"), ["email", "telefone"]);
  assert.deepEqual(degrausExigidos("pre_aceite"), ["email", "telefone", "identidade"]);
  assert.deepEqual(degrausExigidos("contrato"), ["email", "telefone", "identidade"]);
  // Nenhuma tela anterior ao pré-aceite exige documento: candidatura/mensagem e pedido de moradia não conferem documento
  // nem identidade; o documento só é cobrado no fechamento (contexto do aceite) e no contrato.
  const acoes = ler("src/lib/data/actions.ts");
  const requestLead = acoes.slice(acoes.indexOf("export async function requestLead"), acoes.indexOf("\nexport ", acoes.indexOf("export async function requestLead") + 10));
  assert.ok(requestLead.length > 200);
  assert.doesNotMatch(requestLead, /documentoCompleto|estadoIdentidade|lerDocumento/);
  assert.doesNotMatch(ler("src/lib/data/pedidos-actions.ts"), /documentoCompleto|estadoIdentidade|lerDocumento/);
  assert.doesNotMatch(ler("src/app/auth/page.tsx") + ler("src/components/auth/login-por-codigo.tsx"), /cpf|documento|telefone/i);
  assert.match(ler("src/lib/contrato-trava.ts"), /documentoCompleto\(i\.inquilino\)/);
});
