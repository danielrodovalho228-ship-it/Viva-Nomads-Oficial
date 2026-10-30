/*
  Privacidade e acesso do imóvel (ordem f92bc582). node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  colunasPrivacidade,
  declaracaoCamerasFeita,
  linhasPrivacidadePublica,
  limparCamerasExternas,
  privacidadeDaLinha,
  TEXTO_DECLARACAO_CAMERAS,
 tipoAcessoDaEntrada } from "./privacidade.ts";
import { fatosDaLinha, prontidaoAnuncio, ROTULO_FALTA_PRIVACIDADE, type FatosAnuncio, type LinhaAnuncio } from "./prontidao.ts";

const LINHA: LinhaAnuncio = {
  title: "Apto 2 quartos",
  address: "Saraiva",
  city: "Uberlândia",
  bathrooms: 1,
  area_m2: 65,
  min_period_days: 30,
  monthly_price: 2900,
  garantias_aceitas: ["caucao_avista"],
  ownership_type: "own",
  sublease_authorized: true,
  description: "x".repeat(100),
  ready_to_live_badge: false,
  video_url: null,
};
const fatos = (extra: Partial<LinhaAnuncio> = {}): FatosAnuncio => fatosDaLinha({ ...LINHA, ...extra }, 8, "approved");

test("publicar sem a declaração de câmeras = bloqueado, com o item na lista do que falta", () => {
  const p = prontidaoAnuncio(fatos({ sem_cameras_interior: false }));
  assert.equal(p.podePublicar, false);
  assert.deepEqual(p.faltam, [ROTULO_FALTA_PRIVACIDADE]);
  assert.equal(p.obrigatorios.find((i) => i.key === "privacidade")?.etapa, 4, "passo 5, Comodidades (assistente em 10 passos)");
});

test("com a declaração feita publica; banco sem a coluna (undefined) não barra", () => {
  assert.equal(prontidaoAnuncio(fatos({ sem_cameras_interior: true })).podePublicar, true);
  assert.equal(prontidaoAnuncio(fatos({})).podePublicar, true);
  assert.equal(declaracaoCamerasFeita(null), false);
  assert.equal(declaracaoCamerasFeita(true), true);
});

test("servidor valida a forma: tipo inválido vira null; senha só com fechadura; texto limpo e limitado", () => {
  assert.deepEqual(colunasPrivacidade({ semCamerasInterior: true, tipoAcesso: "porta-aberta" as never, senhaTrocadaEstadia: true }), {
    sem_cameras_interior: true,
    cameras_externas: null,
    tipo_acesso: null,
    senha_trocada_estadia: false,
  });
  const c = colunasPrivacidade({ semCamerasInterior: true, tipoAcesso: "fechadura_senha", senhaTrocadaEstadia: true, camerasExternas: "  portaria\n e  garagem " });
  assert.equal(c.senha_trocada_estadia, true);
  assert.equal(c.cameras_externas, "portaria e garagem");
  assert.equal(limparCamerasExternas("x".repeat(500)).length, 200);
  assert.equal(colunasPrivacidade({}).sem_cameras_interior, false);
  assert.equal(colunasPrivacidade({ semCamerasInterior: "true" as never }).sem_cameras_interior, false);
});

test("bloco público: só o declarado, sempre 'declarado pelo anunciante'", () => {
  assert.deepEqual(linhasPrivacidadePublica(undefined), []);
  assert.deepEqual(linhasPrivacidadePublica({ semCamerasInterior: false }), []);
  const l = linhasPrivacidadePublica({ semCamerasInterior: true, camerasExternas: "portaria", tipoAcesso: "fechadura_senha", senhaTrocadaEstadia: true });
  assert.deepEqual(l, [
    "Sem câmeras no interior (declarado pelo anunciante)",
    "Câmeras externas: portaria",
    "Acesso: Fechadura com senha",
    "A senha é trocada antes de cada nova estadia",
  ]);
  assert.ok(linhasPrivacidadePublica({ semCamerasInterior: true })[1].includes("Sem câmeras externas"));
});

test("linha do banco → Privacidade; coluna ausente = indefinido", () => {
  assert.equal(privacidadeDaLinha(null), undefined);
  assert.equal(privacidadeDaLinha({}), undefined);
  assert.deepEqual(privacidadeDaLinha({ sem_cameras_interior: true, cameras_externas: null, tipo_acesso: "cofre", senha_trocada_estadia: true }), {
    semCamerasInterior: true,
    camerasExternas: "",
    tipoAcesso: "cofre",
    senhaTrocadaEstadia: true,
  });
});

test("texto da declaração e ligações no código (anúncio público, editores, servidor)", () => {
  assert.match(TEXTO_DECLARACAO_CAMERAS, /Não há câmeras, babás eletrônicas, microfones/);
  assert.doesNotMatch(TEXTO_DECLARACAO_CAMERAS, /vistoria/i);
  const le = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(le("app/(public)/imoveis/[id]/property-detail.tsx"), /<PrivacidadeAcesso privacidade=\{property\.privacidade\}/);
  assert.match(le("app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"), /<PrivacidadeCampos/);
  assert.match(le("app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), /<PrivacidadeCampos/);
  const acoes = le("lib/data/actions.ts");
  assert.ok(acoes.indexOf("await gravarPrivacidade(supabase, user.id, data.id") < acoes.indexOf("faltaParaPublicar(supabase, user.id, data.id"));
});

test("lembrete de senha nova: só ao inquilino, com fechadura com senha, contrato em andamento e assinado pelas duas partes", async () => {
  const { mostrarLembreteSenha } = await import("./privacidade.ts");
  const ok = { papel: "inquilino", tipoAcesso: "fechadura_senha", status: "ativo", assinadoPelasDuasPartes: true } as const;
  assert.equal(mostrarLembreteSenha(ok), true);
  assert.equal(mostrarLembreteSenha({ ...ok, papel: "proprietario" }), false);
  assert.equal(mostrarLembreteSenha({ ...ok, tipoAcesso: "chave" }), false);
  assert.equal(mostrarLembreteSenha({ ...ok, tipoAcesso: null }), false);
  assert.equal(mostrarLembreteSenha({ ...ok, status: "concluido" }), false);
  assert.equal(mostrarLembreteSenha({ ...ok, assinadoPelasDuasPartes: false }), false);
});

test("o detalhe do contrato mostra o lembrete (ordem f92bc582, item 3)", () => {
  const le = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const d = le("components/contrato/contrato-detalhe.tsx");
  assert.match(d, /mostrarLembreteSenha\(/);
  assert.match(d, /data-testid="lembrete-senha-entrada"/);
  assert.match(d, /LEMBRETE_SENHA_ENTRADA/);
});

test("checklist de câmeras na conferência de entrada: só o inquilino, contrato em andamento (ordem f92bc582, item 5)", async () => {
  const m = await import("./privacidade.ts");
  assert.equal(m.mostrarChecklistCameras({ papel: "inquilino", status: "ativo" }), true);
  assert.equal(m.mostrarChecklistCameras({ papel: "proprietario", status: "ativo" }), false);
  assert.equal(m.mostrarChecklistCameras({ papel: "inquilino", status: "encerrado" }), false);
  assert.match(m.ITEM_CONFERENCIA_CAMERAS, /Conferi que não há câmeras/);
  assert.ok(!/vistoria/i.test(m.ITEM_CONFERENCIA_CAMERAS + m.DICAS_CONFERENCIA_CAMERAS.join(" ")));
  const src = readFileSync(new URL("../../components/contrato/contrato-detalhe.tsx", import.meta.url), "utf8");
  assert.match(src, /checklist-cameras/);
});

test("E259 (2): a entrada é uma pergunta só (Passo 6) — o público lê dela; a coluna antiga sai derivada", () => {
  assert.equal(tipoAcessoDaEntrada("chave_com_proprietario"), "chave");
  assert.equal(tipoAcessoDaEntrada("cofre_de_chaves"), "cofre");
  assert.equal(tipoAcessoDaEntrada("fechadura_com_codigo"), "fechadura_senha");
  assert.equal(tipoAcessoDaEntrada("porteiro"), null);
  assert.equal(tipoAcessoDaEntrada("qualquer"), null);
  // Com a resposta do Passo 6, o "Acesso" usa o vocabulário dela (mesmo com um tipo_acesso antigo diferente gravado).
  assert.deepEqual(linhasPrivacidadePublica({ semCamerasInterior: true, camerasExternas: "", tipoAcesso: "chave", senhaTrocadaEstadia: false }, "porteiro"), [
    "Sem câmeras no interior (declarado pelo anunciante)",
    "Sem câmeras externas declaradas",
    "Acesso: Porteiro ou recepção",
  ]);
  assert.deepEqual(linhasPrivacidadePublica({ semCamerasInterior: false, camerasExternas: "", tipoAcesso: "fechadura_senha", senhaTrocadaEstadia: true }, "fechadura_com_codigo"), [
    "Acesso: Fechadura com código",
    "A senha é trocada antes de cada nova estadia",
  ]);
  assert.deepEqual(linhasPrivacidadePublica(null, "cofre_de_chaves"), ["Acesso: Cofre de chaves"]);
  // Anúncio antigo, sem a resposta do Passo 6: continua mostrando o que tinha.
  assert.deepEqual(linhasPrivacidadePublica({ semCamerasInterior: false, camerasExternas: "", tipoAcesso: "chave", senhaTrocadaEstadia: false }), ["Acesso: Chave"]);
});

test("E259 (2): o Passo 5 não pergunta mais a entrada; a senha trocada vai para o Passo 6, com a fechadura com código", () => {
  const ler = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  const priv = ler("components/anuncio/privacidade-campos.tsx");
  assert.doesNotMatch(priv, /Tipo de acesso ao imóvel|tipo-acesso|TIPOS_ACESSO|senha-trocada/);
  const passo6 = ler("components/anuncio/chegada-e-pedido-campos.tsx");
  assert.match(passo6, /value\.tipoEntrada === "fechadura_com_codigo" && onSenhaTrocada && \(/);
  assert.match(ler("app/(public)/imoveis/[id]/property-detail.tsx"), /<PrivacidadeAcesso privacidade=\{property\.privacidade\} tipoEntrada=\{property\.chegadaEPedido\?\.tipoEntrada\} \/>/);
  for (const f of ["app/(dashboard)/dashboard/imoveis/novo/page.tsx", "app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"])
    assert.match(ler(f), /tipoAcesso: chegada\.tipoEntrada \? tipoAcessoDaEntrada\(chegada\.tipoEntrada\) : privacidade\.tipoAcesso,/);
});
