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
  assert.equal(TITULO_ESPELHO, "É assim que o proprietário te vê");
  assert.equal(PILULA_EMAIL, "E-mail confirmado");
  assert.equal(linhaIntencaoCidade(["morar"], "Santa Mônica"), "Quer morar · Santa Mônica");
  assert.equal(linhaIntencaoCidade(["anunciar", "morar"], ""), "Tem imóvel");
  assert.equal(linhaIntencaoCidade([], "Uberlândia (MG)"), "Uberlândia (MG)");
  assert.equal(linhaIntencaoCidade([], "  "), "");
  assert.equal(nomeNoEspelho("Ana Clara Souza"), "Ana S.");
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
  for (const p of ["src/components/account/topo-conta.tsx", "src/components/account/convite-foto-perfil.tsx", "src/components/account/convite-foto-candidatura.tsx", "src/components/account/avatar-uploader.tsx"]) {
    const s = ler(p);
    assert.match(s, /<EnviarFoto\b/, p);
    assert.doesNotMatch(s, /type="file"/, `${p} não tem seletor próprio`);
  }
  assert.doesNotMatch(ler("src/components/account/convite-foto-perfil.tsx"), /href=|#perfil-publico/);
});

test("Conta: um H1 só (o nome, ou 'Sua conta'), sem títulos numerados, âncoras mantidas", () => {
  const conta = semComentarios(ler("src/app/(dashboard)/dashboard/conta/page.tsx"));
  const topo = ler("src/components/account/topo-conta.tsx");
  assert.equal((topo.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(conta, /<h1\b|<PageTitle/);
  assert.match(topo, /export const tituloDaConta = \(nome: string \| null \| undefined\) => \(nome \?\? ""\)\.trim\(\) \|\| "Sua conta"/);
  assert.match(topo, /Ver meu perfil público/);
  assert.doesNotMatch(ler("src/components/account/conta-blocos.tsx"), /numero\}|\{numero/);
  for (const id of ["perfil-publico", "dados", "sair-da-viva"]) assert.match(conta, new RegExp(`id="${id}"`));
});

test("progresso que anda: degraus, formulário e topo releem quando o perfil muda", () => {
  for (const p of ["src/components/account/degraus-perfil.tsx", "src/components/account/perfil-publico-form.tsx", "src/components/account/topo-conta.tsx"]) assert.match(ler(p), /PERFIL_ATUALIZADO/, p);
  assert.match(ler("src/components/account/conta-secoes.tsx"), /window\.dispatchEvent\(new Event\(PERFIL_ATUALIZADO\)\)/);
});

test("espelho e celular: um verde só, o botão preso 'Salvar e ver imóveis' só no celular", () => {
  const form = ler("src/components/account/perfil-publico-form.tsx");
  assert.match(form, /Salvar e ver imóveis/);
  assert.match(form, /vn-salvar-perfil sticky[^"]*lg:hidden/);
  assert.match(form, /className="hidden lg:inline-flex"/);
  assert.match(ler("src/components/account/espelho-perfil.tsx"), /bg-areia/);
});
