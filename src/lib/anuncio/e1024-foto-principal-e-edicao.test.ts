/*
  E1024 (t2139 vermelha na main 1c22fadb): no Passo 2 do cadastro, "Usar como foto principal" muda a ordem das fotos na
  tela (a pré-visualização mostra a foto escolhida), mas o rascunho gravado ficava com a ordem antiga — e o cartão
  "Continue seu anúncio" do Início, que lê o banco, mostrava a foto antiga.
  Causa: a troca é um clique. Não dispara input/change, então não marcava editouRef. Se caía nos primeiros segundos
  depois de abrir o rascunho (E516: a janela em que o estado aberto vira a "base"), a ordem nova entrava na base e
  nunca era gravada. É a mesma família do t389 (confirmar a sugestão de uma foto).
  Agora toda mudança da lista de fotos que vem do Passo 2 marca a edição antes de mudar o estado: escolher a principal,
  remover, reordenar arrastando, voltar ao original e confirmar uma foto sinalizada.
  Roda: node --test src/lib/anuncio/e1024-foto-principal-e-edicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisaoAutosave } from "./salvo-fantasma.ts";

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const page = ler("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx");
const etapaFotos = ler("../../app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx");
const uploader = ler("../../components/photo-uploader.tsx");

test("E1024: sem a marca de edição, a troca da foto principal na janela da base vira base (não grava)", () => {
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: false, base: null, conteudo: "fotos na ordem nova" }), "base");
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: true, base: null, conteudo: "fotos na ordem nova" }), "edicao");
});

test("E1024: o Passo 2 recebe um setPhotos que marca editouRef antes de mudar a lista", () => {
  const i = page.indexOf("<EtapaFotos ");
  assert.ok(i > 0, "o cadastro monta o Passo 2 (EtapaFotos)");
  const uso = page.slice(i, page.indexOf("/>", i));
  assert.match(uso, /setPhotos=\{mudarFotos\}/, "o Passo 2 recebe mudarFotos, não o setPhotos cru");
  assert.doesNotMatch(uso, /setPhotos=\{setPhotos\}/);
  const j = page.indexOf("const mudarFotos = ");
  assert.ok(j > 0, "mudarFotos existe na página do cadastro");
  const corpo = page.slice(j, page.indexOf("};", j));
  assert.match(corpo, /editouRef\.current = true/);
  assert.ok(corpo.indexOf("editouRef.current = true") < corpo.indexOf("setPhotos("), "a marca vem antes da mudança");
});

test("E1024: tudo o que o Passo 2 faz com setPhotos é repassar ao enviador de fotos — toda chamada é do dono", () => {
  // Se o Passo 2 passasse a mudar a lista sozinho (num efeito, ao abrir), marcar a edição carimbaria "Salvo às" sem
  // ninguém mexer (o defeito do E516). Hoje o único uso é o onChange do enviador.
  const usos = etapaFotos.split("\n").filter((l) => /\bsetPhotos\b/.test(l) && !/^\s*setPhotos,?\s*$/.test(l) && !/setPhotos: \(/.test(l));
  assert.deepEqual(usos.map((l) => l.trim()), ["onChange={setPhotos}"]);
  // No enviador, quem chama onChange são ações do dono: reordenar, enviar, voltar ao original, remover, escolher a
  // principal e confirmar a foto. Nenhuma está dentro de um efeito.
  for (const bloco of uploader.split(/\n {2}useEffect\(/).slice(1)) assert.doesNotMatch(bloco.slice(0, bloco.indexOf("\n  }, [")), /\bonChange\(/);
});

test("E1024: escolher a principal põe a foto escolhida em 1.º lugar e mantém as outras", () => {
  const i = uploader.indexOf("function makeCover(");
  const corpo = uploader.slice(i, uploader.indexOf("\n  }\n", i));
  assert.match(corpo, /onChange\(\[item, \.\.\.photos\.filter\(\(p\) => p\.id !== item\.id\)\]\)/);
});
