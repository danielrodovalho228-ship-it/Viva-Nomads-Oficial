/*
  CONTA-A, entrega 1 (Perfil): o espelho, o avatar sem "?", o recorte da foto, o topo único com um H1 só, a ordem dos
  blocos e o fluxo único da foto (input acessível, convites abrem o fluxo, nunca uma âncora).
  Roda: node --test src/lib/perfil/espelho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PILULA_EMAIL, TITULO_ESPELHO, linhaIntencaoCidade, nomeNoEspelho } from "./espelho.ts";
import { rostoDoAvatar } from "../avatar.ts";
import { FOTO_ACEITA, MSG_HEIC, ZOOM_MAX, ehHeic, limitarDeslocamento, recorteComZoom, squareCrop } from "../avatar-image.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");
const semComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("espelho: título, pílula e a linha 'Quer morar · cidade' (o que falta some)", () => {
  assert.equal(TITULO_ESPELHO, "É assim que o proprietário te vê quando você pede para morar"); // E55
  assert.equal(PILULA_EMAIL, "E-mail confirmado");
  assert.equal(linhaIntencaoCidade(["morar"], "Santa Mônica"), "Quer morar · Santa Mônica");
  assert.equal(linhaIntencaoCidade(["anunciar", "morar"], ""), "Tem imóvel");
  assert.equal(linhaIntencaoCidade([], "Uberlândia (MG)"), "Uberlândia (MG)");
  assert.equal(linhaIntencaoCidade([], "  "), "");
  // Mockup perfil-01 (decisão de 24/10): o espelho mostra o nome completo.
  assert.equal(nomeNoEspelho("  Ana  Clara Souza "), "Ana Clara Souza");
  assert.equal(nomeNoEspelho("Ana"), "Ana");
  assert.equal(nomeNoEspelho(""), "Seu nome");
  for (const t of [TITULO_ESPELHO, PILULA_EMAIL]) assert.doesNotMatch(t, TEXTO_PROIBIDO);
});

test("avatar sem nome: silhueta, nunca '?'; com nome: iniciais", () => {
  assert.deepEqual(rostoDoAvatar(""), { tipo: "silhueta" });
  assert.deepEqual(rostoDoAvatar(null), { tipo: "silhueta" });
  assert.deepEqual(rostoDoAvatar("(exemplo)"), { tipo: "silhueta" });
  assert.deepEqual(rostoDoAvatar("Ana Souza"), { tipo: "iniciais", texto: "AS" });
  const av = ler("src/components/ui/avatar.tsx");
  assert.match(av, /rostoDoAvatar\(name\)/);
  assert.match(av, /UserRound/);
  // O selo do cabeçalho não usa mais o nome do papel como se fosse o nome da pessoa ("P" de Proprietário).
  for (const f of ["src/components/layout/papel-ativo.tsx", "src/components/papel/troca-papel.tsx"]) assert.match(ler(f), /<Avatar name=\{nome\} size=\{28\}/);
});

test("recorte com zoom e arrasto: zoom 1 e centro = recorte central; o quadrado nunca sai da imagem", () => {
  assert.deepEqual(recorteComZoom(1200, 800, 1, 0, 0), squareCrop(1200, 800));
  const z2 = recorteComZoom(1200, 800, 2, 0, 0);
  assert.equal(z2.size, 400);
  assert.deepEqual([z2.sx, z2.sy], [400, 200]);
  const longe = recorteComZoom(1200, 800, 2, 10, -10);
  assert.ok(longe.sx >= 0 && longe.sx + longe.size <= 1200 && longe.sy >= 0 && longe.sy + longe.size <= 800);
  assert.equal(recorteComZoom(1200, 800, 99, 0, 0).size, Math.round(800 / ZOOM_MAX));
  const lim = limitarDeslocamento(1200, 800, 1, 5, 5);
  assert.equal(lim.dy, 0, "zoom 1 numa foto deitada: não sobe nem desce");
  assert.ok(lim.dx > 0 && lim.dx <= 0.25);
});

test("formatos: JPG, PNG, WebP e HEIC no seletor; HEIC ilegível recebe 'Envie em JPG ou PNG'", () => {
  for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic"]) assert.ok(FOTO_ACEITA.includes(t), t);
  assert.equal(MSG_HEIC, "Envie em JPG ou PNG");
  assert.equal(ehHeic({ type: "image/heic" }), true);
  assert.equal(ehHeic({ type: "", name: "IMG_0001.HEIC" }), true);
  assert.equal(ehHeic({ type: "image/jpeg", name: "a.jpg" }), false);
});

test("fluxo único da foto: input acessível (sr-only, nunca display:none), recorte, Salvar/Cancelar, avisa topo e cabeçalho", () => {
  const f = semComentarios(ler("src/components/account/foto-perfil.tsx"));
  assert.match(f, /type="file"[\s\S]*className="sr-only"/);
  assert.doesNotMatch(f, /className="hidden"/);
  assert.match(f, /Salvar foto/);
  assert.match(f, /Cancelar/);
  assert.match(f, /Foto atualizada/);
  assert.match(f, /Tentar de novo/);
  assert.match(f, /avisarFotoAtualizada\(nova\.url\)/);
  assert.match(ler("src/components/layout/dashboard-shell.tsx"), /FOTO_ATUALIZADA/);
  // Todos os pontos de foto usam o MESMO fluxo; os convites nunca mais levam a uma âncora.
  for (const p of ["src/components/account/perfil-tela.tsx", "src/components/account/convite-foto-perfil.tsx", "src/components/account/convite-foto-candidatura.tsx"]) {
    const s = ler(p);
    assert.match(s, /<EnviarFoto\b/, p);
    assert.doesNotMatch(s, /type="file"/, `${p} não tem seletor próprio`);
  }
  assert.doesNotMatch(ler("src/components/account/convite-foto-perfil.tsx"), /href=|#perfil-publico/);
});

test("Conta (A1): um H1 visível por largura (nome da seção), sem títulos numerados, âncoras do celular e documento mantidas", () => {
  const conta = semComentarios(ler("src/app/(dashboard)/dashboard/conta/page.tsx"));
  const casca = ler("src/components/account/casca-conta.tsx");
  // Casca: um H1 no topo (some a partir de 1280 px quando o título vai para a coluna da direita) e o lateral.
  assert.equal((casca.match(/<h1\b/g) ?? []).length, 2);
  assert.match(casca, /topoDireita && "xl:hidden"/);
  assert.match(casca, /<header className="hidden xl:block" data-testid="conta-cabecalho-lateral">/);
  assert.doesNotMatch(conta, /<h1\b|<PageTitle/);
  assert.match(ler("src/components/account/perfil-tela.tsx"), /<TituloSecaoLateral ativo="perfil"/);
  assert.doesNotMatch(ler("src/components/account/conta-blocos.tsx"), /numero\}|\{numero/);
  for (const id of ["celular", "documento"]) assert.match(ler("src/components/account/" + (id === "celular" ? "telefone-verificacao.tsx" : "conta-secoes.tsx")), new RegExp(`id="${id}"`), id);
});

test("progresso que anda: degraus, tela do Perfil e o medidor releem quando o perfil muda", () => {
  for (const p of ["src/components/account/degraus-perfil.tsx", "src/components/account/perfil-tela.tsx"]) assert.match(ler(p), /PERFIL_ATUALIZADO/, p);
  assert.match(ler("src/components/account/conta-secoes.tsx"), /window\.dispatchEvent\(new Event\(PERFIL_ATUALIZADO\)\)/);
});

test("espelho e celular (perfil-01): pílula verde do título; E61: no celular o 'Salvar alterações' vem logo depois do conteúdo", () => {
  const tela = ler("src/components/account/perfil-tela.tsx");
  // E61 (print do Daniel, 24/10): sem faixa presa — o botão fica na ordem da página, sem vão morto antes ou depois.
  assert.doesNotMatch(tela, /vn-salvar-perfil|sticky/);
  assert.doesNotMatch(ler("src/app/globals.css"), /vn-salvar-perfil|perfil-salvar-celular/);
  assert.match(tela, /<div className="lg:hidden" data-testid="perfil-salvar-celular-faixa">/);
  assert.match(tela, /data-testid="perfil-salvar"/);
  assert.doesNotMatch(tela, /Salvar e ver imóveis/);
  assert.match(ler("src/components/account/espelho-perfil.tsx"), /bg-forest/);
});

test("E62: o medidor lista só o que falta; a 100% é um estado de sucesso curto, sem a linha 'Cadastro completo: sim'", async () => {
  const tela = ler("src/components/account/perfil-tela.tsx");
  assert.doesNotMatch(tela, /Cadastro completo:|nada faltando/);
  assert.match(tela, /Perfil completo/);
  assert.match(tela, /const faltam = p\.itens\.filter\(\(i\) => !i\.feito\)/);
  assert.doesNotMatch(tela, /i\.feito \? <Check/, "a lista não mostra mais os itens já feitos");
  const { LINHA_PERFIL_COMPLETO } = await import("./perfil-publico.ts");
  assert.ok(LINHA_PERFIL_COMPLETO.length > 0 && LINHA_PERFIL_COMPLETO.length <= 80, "uma linha");
});

test("E60: no celular o 'Fale com a Viva' não monta sobre a barra de abas (piso) e sai da tela Perfil", () => {
  const css = ler("src/app/globals.css");
  assert.match(css, /@media \(max-width: 767px\) \{\s*body \{\s*--viva-piso: var\(--ajuda-bottom, 5\.25rem\);/);
  const chat = ler("src/components/ajuda/viva-chat.tsx");
  const linha = chat.split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.match(linha, /"\/dashboard\/conta\/perfil"/);
});

test("extras do E62: cada falta leva ao lugar dela e o Salvar mostra 'há alterações' × 'tudo salvo'", async () => {
  const { destinoDaFalta, ESTADO_SALVAR } = await import("./perfil-publico.ts");
  assert.deepEqual(destinoDaFalta("bio"), { tipo: "campo", alvo: "perfil-bio" });
  assert.deepEqual(destinoDaFalta("foto"), { tipo: "campo", alvo: "topo-foto" });
  assert.deepEqual(destinoDaFalta("documento"), { tipo: "rota", href: "/dashboard/conta/dados#documento" });
  assert.deepEqual(destinoDaFalta("telefone"), { tipo: "rota", href: "/dashboard/conta/dados#celular" });
  assert.deepEqual(destinoDaFalta("desconhecida"), { tipo: "rota", href: "/dashboard/conta/dados" });
  assert.equal(ESTADO_SALVAR.alterado, "Há alterações para salvar");
  assert.equal(ESTADO_SALVAR.salvo, "Tudo salvo");
  const tela = ler("src/components/account/perfil-tela.tsx");
  assert.match(tela, /data-testid=\{`perfil-falta-\$\{i\.chave\}`\}/);
  assert.equal((tela.match(/<EstadoSalvar alterado=\{alterado\} \/>/g) ?? []).length, 2, "junto do botão no computador e no celular");
});
