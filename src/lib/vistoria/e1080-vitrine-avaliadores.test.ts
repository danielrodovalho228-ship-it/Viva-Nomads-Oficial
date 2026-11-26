/*
  E1079/E1080 (ORDEM-DUET-385/386, condições do coordenador DUET-1455): a base dos cartões do avaliador.
  Roda: node --test src/lib/vistoria/e1080-vitrine-avaliadores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VITRINE_AVALIADORES_ABERTA, cartoesDaCidade, fotoPublicaPermitida, rostoDoAvaliador, type FonteAvaliador } from "./vitrine-avaliadores.ts";

const f = (o: Partial<FonteAvaliador>): FonteAvaliador => ({
  numero: "UDI-001",
  nome: "Ana Souza",
  cidade: "Uberlândia",
  selo: null,
  avaliacoesFeitas: 0,
  notaConduta: null,
  contaTeste: true,
  fotoUrl: null,
  ...o,
});

test("E1080: a listagem pública por cidade nasce desligada (só piloto, até o Daniel abrir)", () => {
  assert.equal(VITRINE_AVALIADORES_ABERTA, false);
});

test("E1080 (386): foto quando há e pode; senão iniciais — nunca vazio nem '?'; conta real não mostra foto sem o Daniel", () => {
  assert.deepEqual(rostoDoAvaliador("Ana Souza", "https://x/foto.webp", true), { tipo: "foto", url: "https://x/foto.webp" });
  assert.deepEqual(rostoDoAvaliador("Ana Souza", null, true), { tipo: "iniciais", texto: "AS" });
  assert.deepEqual(rostoDoAvaliador("Rogério Silva", "https://x/r.webp", false), { tipo: "iniciais", texto: "RS" }, "conta real: sem foto pública por agora");
  assert.deepEqual(rostoDoAvaliador("", null, true), { tipo: "iniciais", texto: "AV" });
  assert.equal(fotoPublicaPermitida(false), false);
  assert.equal(fotoPublicaPermitida(true), true);
});

test("E1080: os cartões da cidade — várias cidades contam, número único (o primeiro vence), mais avaliações primeiro", () => {
  const fontes = [
    f({ numero: "UDI-001", nome: "Bruno", avaliacoesFeitas: 2 }),
    f({ numero: "UBE-001", nome: "Rogério Silva", cidade: "Uberlandia, Araguari, Ituiutaba", contaTeste: false }),
    f({ numero: "UDI-001", nome: "Duplicado", avaliacoesFeitas: 9 }),
    f({ numero: "UBA-001", nome: "Carla", cidade: "Uberaba", avaliacoesFeitas: 5 }),
  ];
  const c = cartoesDaCidade(fontes, "Araguari");
  assert.deepEqual(c.map((x) => x.numero), ["UBE-001"]);
  const u = cartoesDaCidade(fontes, "Uberlândia");
  assert.deepEqual(u.map((x) => [x.numero, x.nome]), [["UDI-001", "Bruno"], ["UBE-001", "Rogério Silva"]]);
  assert.equal(u[0].href, "/avaliadores/UDI-001");
  assert.deepEqual(cartoesDaCidade([], "Uberlândia"), []);
});

test("E1080: nada na base diz 'credenciado com o CNPJ da Viva' nem guarda telefone ou e-mail", () => {
  const s = fonteSemComentarios(readFileSync("src/lib/vistoria/vitrine-avaliadores.ts", "utf8"));
  assert.doesNotMatch(s, /CNPJ da Viva|telefone|phone|e-?mail|whats/i);
});

import { linhaDaCidade, novoNaViva, quadroDePreco, reaisCurtos, ufDaCidade } from "./vitrine-avaliadores.ts";

test("E1079 (397): o quadro de preço é o da TABELA DA CIDADE, por porte, com os rótulos do desenho", () => {
  const linha = (cidade: string, porte: "estudio" | "q1_2" | "q3_mais", valor: number) => ({ cidade, porte, valor, incluiTexto: null, vigenteDesde: "2026-11-01T00:00:00Z" });
  const tabela = [linha("Uberlandia", "estudio", 150), linha("Uberlandia", "q1_2", 250), linha("Uberlandia", "q3_mais", 350), linha("Uberaba", "q1_2", 999)];
  const q = quadroDePreco(tabela, "Uberlândia", new Date("2026-11-22T00:00:00Z"));
  assert.deepEqual(q.map((l) => [l.rotulo, reaisCurtos(l.valor)]), [["Estúdio", "R$ 150"], ["1–2 quartos", "R$ 250"], ["3+ quartos", "R$ 350"]]);
  assert.deepEqual(quadroDePreco(tabela, "Araguari", new Date("2026-11-22T00:00:00Z")), [], "sem tabela na cidade, sem quadro");
  assert.equal(reaisCurtos(150.5), "R$ 150,50");
});

test("E1079: a UF só quando a cidade é única no IBGE; 'Novo na Viva' só sem avaliações nem nota", () => {
  const ibge = { MG: ["Uberlândia", "Santa Luzia"], PB: ["Santa Luzia"] };
  assert.equal(ufDaCidade(ibge, "Uberlandia"), "MG");
  assert.equal(ufDaCidade(ibge, "Santa Luzia"), null);
  assert.equal(linhaDaCidade("Uberlândia", "MG"), "Uberlândia • MG");
  assert.equal(novoNaViva(0, null), true);
  assert.equal(novoNaViva(2, null), false);
  assert.equal(novoNaViva(0, 4.5), false);
});

import { cidadeDoSlug, ehNumeroDeAvaliador, slugDaCidade, vitrineAberta } from "./vitrine-avaliadores.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

test("E1080: /avaliadores/<…> — número de avaliador × cidade; o caminho da cidade pelo IBGE", () => {
  assert.equal(ehNumeroDeAvaliador("UDI-003"), true);
  assert.equal(ehNumeroDeAvaliador("udi-003"), true);
  assert.equal(ehNumeroDeAvaliador("uberlandia"), false);
  const ibge = { MG: ["Uberlândia", "Santa Luzia"], PB: ["Santa Luzia"], SP: ["São Paulo"] };
  assert.deepEqual(cidadeDoSlug(ibge, "uberlandia"), { cidade: "Uberlândia", uf: "MG" });
  assert.deepEqual(cidadeDoSlug(ibge, "sao-paulo"), { cidade: "São Paulo", uf: "SP" });
  assert.equal(cidadeDoSlug(ibge, "santa-luzia"), null, "ambígua");
  assert.equal(cidadeDoSlug(ibge, "atlantida"), null);
  assert.equal(slugDaCidade("São Paulo"), "sao-paulo");
});

test("E1080: a listagem fica fechada ao público (só no laboratório, para construir e testar)", () => {
  assert.equal(vitrineAberta(false), false);
  assert.equal(vitrineAberta(true), true);
  const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
  assert.match(pagina, /if \(!vitrineAberta\(integracoesSimuladas\(\)\)\) notFound\(\);/);
  assert.match(pagina, /robots: \{ index: false, follow: false \}/);
  const vitrine = readFileSync("src/components/vistoria/vitrine-avaliadores.tsx", "utf8");
  assert.doesNotMatch(fonteSemComentarios(vitrine), /tel:|mailto:|wa\.me|telefone|e-?mail|CNPJ da Viva/i);
});

test("E1079 (385, tela 3): a escolha do dono em cartões — rosto, selo, termos e o preço da TABELA DA CIDADE para o porte", () => {
  const b = fonteSemComentarios(readFileSync("src/components/vistoria/bloco-avaliacao-dono.tsx", "utf8"));
  assert.match(b, /Avaliadores disponíveis em \{im\.city\}/);
  assert.match(b, /data-testid="avaliacao-sugerido-rosto"/);
  // Nenhuma foto de pessoa real sem o Daniel: na escolha do dono, só as iniciais.
  assert.match(b, /rostoDoAvaliador\(a\.nome, a\.fotoUrl, a\.teste\)/); // asserção alterada (386): a foto de conta de teste entra
  assert.match(b, /data-testid="avaliacao-sugerido-selo"[\s\S]{0,200}a\.teste \? ROTULO_AVALIADOR_EM_TESTE : ROTULO_AVALIADOR_CREDENCIADO/);
  assert.match(b, /data-testid="avaliacao-sugerido-preco"[^>]*>\s*Avaliação: \{reaisCurtos\(Number\(preco\.valor\)\)\}/);
  // O que as specs já leem continua: o número, os termos e o botão.
  assert.match(b, /data-testid="avaliacao-sugerido-termos"/);
  assert.match(b, /nº\{" "\}/);
  // E1096 (ORDEM-DUET-453, asserção alterada): o botão passa a ser o do mockup, "Escolher" (antes "Escolher este avaliador").
  assert.match(b, />\{ROTULO_ESCOLHER\}<\/Button>/);
  assert.doesNotMatch(b, /preco_proprio\)\s*\}/, "o preço mostrado é o da tabela, não o próprio do avaliador");
});

test("E1079 (385, tela 4): 'Avaliação do imóvel — Laudo com o nível do imóvel' na grade de Serviços, para todo dono (E1104)", () => {
  const painel = readFileSync("src/components/parceiros/servicos-painel.tsx", "utf8");
  assert.match(painel, /\{avaliacao && \([\s\S]*?data-testid="servicos-avaliacao"[\s\S]*?Avaliação do imóvel[\s\S]*?Laudo com o nível do imóvel/);
  assert.match(painel, /href=\{avaliacao\.href\}/);
  // A avaliação não vira categoria contratável do catálogo (segue só de credenciamento).
  assert.doesNotMatch(painel, /CATEGORIAS_PARCEIRO\b/);
  const pagina = readFileSync("src/app/(dashboard)/dashboard/servicos/page.tsx", "utf8");
  assert.match(pagina, /avaliacaoNaGrade\(\)/);
  assert.match(pagina, /<ServicosPainel cidade=\{cidade\} avaliacao=\{avaliacao\} \/>/);
  const srv = readFileSync("src/lib/vistoria/servico-avaliacao.ts", "utf8");
  // E1104 (ORDEM-DUET-470): o cartão deixou de ser fechado com a chave — é a porta de todo dono. O que a chave fecha
  // agora é a leitura dos pedidos (atrás de `chaveAberta`) e o destino (fora do piloto, a porta diz o estado honesto).
  // As regras novas estão travadas em e1104-porta-da-avaliacao.test.ts.
  assert.doesNotMatch(srv, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(srv, /const chaveAberta = await vistoriaAtiva\(\);/);
  assert.match(srv, /\.eq\("owner_id", user\.id\)/);
  assert.match(srv, /hrefDoCartaoDaAvaliacao\(/);
});

test("E1079 (385/386): o perfil do CREDENCIADO no desenho do mockup — foto da conta (só conta de teste) ou iniciais, cidade com UF, preço da tabela da cidade", () => {
  const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
  const cred = pagina.slice(pagina.indexOf("export default async function AvaliadorPage"), pagina.indexOf("async function PerfilPublico"));
  assert.match(cred, /fotoDoCredenciado\(admin, a\.numero_credenciado, a\.teste\)/);
  // E1208 (asserção alterada, ORDEM-DUET-989): o nome e a cidade vêm da vista pública (a linha curada ligada manda).
  assert.match(cred, /rostoDoAvaliador\(vista\.nome, foto, a\.teste\)/);
  assert.match(cred, /data-testid="avaliador-foto"/);
  assert.match(cred, /quadroDePreco\(await tabelaDaCidade\(admin, vista\.cidade\), vista\.cidade, new Date\(\)\)/);
  assert.match(cred, /data-testid="avaliador-uf"/);
  assert.match(cred, /\{TITULO_PERFIL\}/);
  const srv = readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8");
  assert.match(srv, /export async function fotoDoCredenciado[\s\S]*?if \(!fotoPublicaPermitida\(contaTeste\)\) return null;/);
});

test("E1079 (386): a escolha do dono mostra a foto de perfil da conta — só de conta de teste; conta real, as iniciais", () => {
  const b = readFileSync("src/components/vistoria/bloco-avaliacao-dono.tsx", "utf8");
  assert.match(b, /rostoDoAvaliador\(a\.nome, a\.fotoUrl, a\.teste\)/);
  assert.match(b, /fotoPublicaPermitida\(teste\) \? await signAvatarPath\(/);
  assert.match(b, /data-testid="avaliacao-sugerido-foto"/);
});

test("E1094: a página pública do avaliador é a MESMA para todos — o credenciado ativo vê o desenho novo, nunca a página antiga", () => {
  const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
  // A página antiga dizia que a Viva designa o avaliador — contra a escolha pelo dono (E648).
  assert.doesNotMatch(pagina, /A Viva designa o avaliador|O proprietário não escolhe/);
  const cred = pagina.slice(pagina.indexOf("export default async function AvaliadorPage"), pagina.indexOf("async function PerfilPublico"));
  const minimo = pagina.slice(pagina.indexOf("async function PerfilPublico"), pagina.indexOf("async function PaginaDaCidade"));
  for (const parte of ['{TITULO_PERFIL}', 'data-testid="avaliador-foto"', 'data-testid="avaliador-uf"', 'data-testid="avaliador-preco"', "<ShieldCheck"]) {
    assert.ok(cred.includes(parte), `credenciado sem ${parte}`);
    assert.ok(minimo.includes(parte), `perfil mínimo sem ${parte}`);
  }
});
