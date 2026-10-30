/*
  P0 (uso real do Daniel, 30/10): o rascunho nunca sai do assistente por um atalho de pendência, "Começar outro" cria
  um rascunho novo de verdade e "Ventilador de teto" está nas comodidades (E280).
  Roda: node --test src/lib/anuncio/p0-assistente-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoPendencia, emCadastro, hrefPassoDoRascunho } from "./destino-pendencia.ts";
import { ETAPA } from "./etapas-ids.ts";
import { prontidaoAnuncio } from "./prontidao.ts";
import { emailDecisaoDocumento } from "../documento/aviso-decisao.ts";
import { AMENITY_GROUPS, AMENITY_LABEL, comodidadeValeParaTipo } from "../amenities.ts";
import { ICONE_POR_CHAVE } from "./comodidades-icones.ts";
import { etapaDaUrl } from "../etapas-anuncio.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const ID = "73a354cd-a5e8-47e8-8aa3-da8ffd8063eb";

test("rascunho: cada pendência abre o PASSO dela dentro do assistente (fotos → Passo 2, tipo de entrada → Regras)", () => {
  assert.equal(destinoPendencia({ id: ID, status: "draft" }, ETAPA.fotos), `/dashboard/imoveis/novo?draft=${ID}&etapa=1`);
  assert.equal(destinoPendencia({ id: ID, status: "draft" }, ETAPA.regras), `/dashboard/imoveis/novo?draft=${ID}&etapa=5`);
  assert.equal(destinoPendencia({ id: ID, status: "draft" }, ETAPA.endereco), `/dashboard/imoveis/novo?draft=${ID}&etapa=2`);
  // O assistente lê o número do passo da URL.
  assert.equal(etapaDaUrl("1"), ETAPA.fotos);
  assert.equal(etapaDaUrl("5"), ETAPA.regras);
  // Sem passo: o assistente retoma no primeiro passo incompleto.
  assert.equal(hrefPassoDoRascunho(ID), `/dashboard/imoveis/novo?draft=${ID}`);
});

test("publicado ou pausado: segue no editor por seções, na seção do assunto quando ela tem âncora", () => {
  assert.equal(destinoPendencia({ id: ID, status: "active" }, ETAPA.regras), `/dashboard/imoveis/${ID}/editar#secao-regras`);
  assert.equal(destinoPendencia({ id: ID, status: "paused" }, ETAPA.fotos), `/dashboard/imoveis/${ID}/editar#secao-fotos`);
  assert.equal(destinoPendencia({ id: ID, status: "paused" }, ETAPA.preco), `/dashboard/imoveis/${ID}/editar`);
  assert.equal(emCadastro("draft"), true);
  for (const s of ["active", "paused", "pending", null, undefined]) assert.equal(emCadastro(s), false, String(s));
  const editor = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(editor, /title="Fotos"\s+ancora="secao-fotos"/);
  assert.match(editor, /testid="secao-regras"\s+ancora="secao-regras"/);
});

test("todas as pendências obrigatórias de um rascunho vazio levam ao assistente (nenhuma ao editor)", () => {
  const p = prontidaoAnuncio({ enderecoOk: false, detalhesOk: false, periodoOk: false, fotos: 0, titulo: "", descricao: "", preco: 0, garantiaOk: false, documento: "none", selo: false, video: false, sublocacaoOk: true, privacidadeOk: false, tipoEntradaOk: false });
  const faltam = p.obrigatorios.filter((i) => !i.ok);
  assert.ok(faltam.length > 0);
  assert.ok(faltam.some((i) => i.key === "tipo_entrada"));
  for (const i of faltam) {
    const href = destinoPendencia({ id: ID, status: "draft" }, i.etapa);
    assert.match(href, /^\/dashboard\/imoveis\/novo\?draft=/, i.key);
    assert.doesNotMatch(href, /\/editar/, i.key);
  }
  assert.equal(destinoPendencia({ id: ID, status: "draft" }, faltam.find((i) => i.key === "tipo_entrada")!.etapa), `/dashboard/imoveis/novo?draft=${ID}&etapa=${ETAPA.regras}`);
});

test("telas: cartão, aviso do tipo de entrada, reativar e e-mail do documento usam o destino único", () => {
  const cartao = ler("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(cartao, /destinoPendencia\(p, o\.etapa\)/);
  assert.match(cartao, /data-testid=\{`pendencia-\$\{o\.key\}`\}/);
  // Rascunho: "Continuar editando" segue no assistente.
  assert.match(cartao, /p\.status === "draft"\s*\?\s*`\/dashboard\/imoveis\/novo\?draft=\$\{p\.id\}`/);
  const painel = ler("src/app/(dashboard)/dashboard/imoveis/page.tsx");
  assert.match(painel, /destinoPendencia\(i, ETAPA\.regras\)/);
  assert.doesNotMatch(painel, /\/editar`/);
  const actions = ler("src/lib/data/actions.ts");
  assert.match(actions, /href: destinoPendencia\(\{ id, status: p\.status \}, i\.etapa\)/);
  // Rascunho que chega ao editor por um link antigo ganha o caminho de volta ao passo a passo.
  const editor = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/page.tsx");
  assert.match(editor, /emCadastro\(property\.status\)[\s\S]{0,400}hrefPassoDoRascunho\(id\)/);
});

test("e-mail da decisão do documento: rascunho → assistente (Revisão se já pode publicar); publicado → editor", () => {
  const linhas = [{ documento: "Comprovante de propriedade do imóvel", aprovado: true, motivo: null }] as Parameters<typeof emailDecisaoDocumento>[0]["linhas"];
  const base = { propertyId: ID, titulo: "Apto", bairro: "Centro", linhas };
  assert.equal(emailDecisaoDocumento({ ...base, prontoParaPublicar: false, status: "draft" }).cta.path, `/dashboard/imoveis/novo?draft=${ID}`);
  assert.equal(emailDecisaoDocumento({ ...base, prontoParaPublicar: true, status: "draft" }).cta.path, `/dashboard/imoveis/novo?draft=${ID}&etapa=${ETAPA.revisao}`);
  assert.equal(emailDecisaoDocumento({ ...base, prontoParaPublicar: true, status: "active" }).cta.path, `/dashboard/imoveis/${ID}/editar`);
  assert.match(ler("src/lib/data/aviso-decisao-documento.ts"), /select\("title, address, status"\)[\s\S]*status: im\?\.status \?\? null/);
});

test("Passo 10: Editar e Resolver ficam DENTRO do assistente (vão ao passo, nunca a outra rota)", () => {
  const revisar = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");
  assert.match(revisar, /onClick=\{\(\) => p\.irPara\(ETAPA\[i\.id\]\)\}/);
  assert.doesNotMatch(revisar, /\/editar/);
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /function resolverItem\(item: ItemProntidao\) \{\s*irPara\(item\.etapa\);/);
});

test("Começar outro: a 1ª gravação pede rascunho NOVO e o servidor não reaproveita o inacabado", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /function comecarOutro\(\) \{[\s\S]{0,600}draftIdRef\.current = null;\s*comecouOutroRef\.current = true;/);
  // Os dois caminhos que criam o rascunho (autosave e fim da Qualificação) levam o pedido de novo.
  assert.match(pagina, /id: draftIdRef\.current,\s*novo: !draftIdRef\.current && comecouOutroRef\.current,/);
  assert.match(pagina, /saveDraftData\(\{ id: null, novo: comecouOutroRef\.current,/);
  // Depois de criado, volta ao normal (as próximas gravações vão para o rascunho novo pelo id).
  assert.equal((pagina.match(/comecouOutroRef\.current = false;/g) ?? []).length, 2);
  const actions = ler("src/lib/data/actions.ts");
  assert.match(actions, /const rascunhoId = snap\.id \|\| \(snap\.novo === true \? null : await rascunhoVazioRecente\(supabase, user\.id\)\);/);
});

test("E280: 'Ventilador de teto' nas comodidades do Passo 5 (Conforto), com ícone e na importação, em todo tipo", () => {
  const conforto = AMENITY_GROUPS.find((g) => g.category === "conforto")!;
  assert.ok(conforto.items.some((i) => i.key === "ventilador_teto" && i.label === "Ventilador de teto"));
  assert.equal(AMENITY_LABEL.ventilador_teto, "Ventilador de teto");
  assert.ok(ICONE_POR_CHAVE.ventilador_teto);
  for (const t of ["apartamento", "casa", "casa_condominio", "chacara", "studio"]) assert.equal(comodidadeValeParaTipo("ventilador_teto", t), true, t);
  assert.match(ler("src/lib/anuncio/importar-anuncio.ts"), /\["ventilador_teto", \/ventilador de teto\/i\]/);
});
