/*
  NIVEIS-MEDIR-B (E25b) — medir a internet ANTES de publicar. A medição do rascunho (quarto principal e ponto de
  trabalho) vale ao publicar, com as mesmas validações; a videochamada não tem foto (é a medição do ponto de trabalho
  que passa a regra); o nível recalcula na validação e cai quando a medição vence.
  Roda: node --test src/lib/niveis/medir-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_NIVEL_FOTO, MATRIZ, itemNivel } from "../../config/niveis.ts";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../config/conforto-minimo.ts";
import { nivelDoImovel, type EntradaNivel, type ItemDeclarado, type MedidaPonto } from "./regras.ts";
import { BOTAO_MEDIR_AGORA, chaveLinkMedicao, destinoLinkCelular, pontoDaChaveLink, pontoDoItemInternet } from "./prova-camera.ts";
import { RODADA_SIMULADA } from "../internet-motor.ts";
import { boaParaVideochamada } from "../internet-medida.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-10-24T12:00:00Z");
const essencial = CHAVES_CONFORTO.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO }));
const foto = (chave: string): ItemDeclarado => ({ chave, declarado: true, fotoPath: `dono/${chave}.webp`, fotoStatus: "aceita", fotoOrigem: "camera" });
const medida = (ponto: MedidaPonto["ponto"], extra: Partial<MedidaPonto> = {}): MedidaPonto => ({
  ponto,
  validada: true,
  medidoEm: "2026-10-24T11:00:00Z",
  validoAte: "2027-04-24T11:00:00Z",
  ...RODADA_SIMULADA,
  ...extra,
});
/** Rascunho com todas as fotos do Premium aceitas e o ruído baixo — só a internet decide. */
const rascunho = (medidas: MedidaPonto[]): EntradaNivel => ({
  declaracoesConforto: essencial,
  itens: CHAVES_NIVEL_FOTO.map(foto),
  medidas,
  ruido: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false },
  bloqueadas: [],
  agora: AGORA,
});

test("com as fotos do Premium e as duas medições válidas (trabalho passa a videochamada), o rascunho é Premium", () => {
  assert.equal(boaParaVideochamada(RODADA_SIMULADA), true, "a medição simulada do laboratório passa a regra");
  const r = nivelDoImovel(rascunho([medida("quarto_principal"), medida("trabalho")]));
  assert.equal(r.nivel, "premium");
  assert.equal(r.porArea.internet, "premium");
  assert.equal(r.porArea.trabalho, "premium");
});

test("sem medição, todo o resto não basta: Essencial, e o que falta inclui as medições", () => {
  const r = nivelDoImovel(rascunho([]));
  assert.equal(r.nivel, "essencial");
  assert.equal(r.porArea.internet, "essencial");
  assert.deepEqual(r.faltaParaProximo.internet, ["internet_medida_quarto", "internet_medida_trabalho"]);
});

test("videochamada: sem foto — sai do 'Para subir de nível' assim que a medição do ponto de trabalho valida", () => {
  assert.equal(itemNivel("internet_videochamada_trabalho").prova, "medida");
  assert.ok(!(CHAVES_NIVEL_FOTO as readonly string[]).includes("internet_videochamada_trabalho"), "nenhum slot de foto");
  assert.ok(MATRIZ.internet.premium.includes("internet_videochamada_trabalho") && MATRIZ.trabalho.premium.includes("internet_videochamada_trabalho"));
  const lenta = nivelDoImovel(rascunho([medida("quarto_principal"), medida("trabalho", { downloadMbps: 10, uploadMbps: 2, latenciaMs: 150 })]));
  assert.equal(lenta.nivel, "conforto");
  assert.ok(lenta.faltaParaProximo.internet?.includes("internet_videochamada_trabalho"));
  const boa = nivelDoImovel(rascunho([medida("quarto_principal"), medida("trabalho")]));
  assert.equal(boa.faltaParaProximo.internet, undefined);
});

test("medição vencida: o nível cai para o que os outros itens sustentam (e uma não validada nunca conta)", () => {
  const vencida = { validoAte: "2026-10-24T10:00:00Z" };
  assert.equal(nivelDoImovel(rascunho([medida("quarto_principal", vencida), medida("trabalho", vencida)])).nivel, "essencial");
  assert.equal(nivelDoImovel(rascunho([medida("quarto_principal"), medida("trabalho", vencida)])).porArea.internet, "essencial");
  assert.equal(nivelDoImovel(rascunho([medida("quarto_principal", { validada: false }), medida("trabalho")])).porArea.internet, "essencial");
});

test("cada item de internet aponta o seu ponto; o link do celular leva à medição desse ponto", () => {
  assert.equal(pontoDoItemInternet("internet_medida_quarto"), "quarto_principal");
  assert.equal(pontoDoItemInternet("internet_medida_trabalho"), "trabalho");
  assert.equal(pontoDoItemInternet("internet_videochamada_trabalho"), "trabalho");
  assert.equal(pontoDoItemInternet("ar_todos_quartos"), null);
  assert.equal(chaveLinkMedicao("trabalho"), "medir_trabalho");
  assert.match(chaveLinkMedicao("quarto_principal"), /^[a-z_]{3,40}$/, "cabe na restrição da coluna chave (0242)");
  assert.equal(pontoDaChaveLink("medir_quarto_principal"), "quarto_principal");
  assert.equal(pontoDaChaveLink("medir_sala"), null);
  assert.equal(pontoDaChaveLink("cozinha_microondas"), null);
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(destinoLinkCelular(id, "medir_trabalho"), `/dashboard/imoveis/${id}/nivel?medir=trabalho#internet`);
  assert.equal(destinoLinkCelular(id, "cozinha_microondas"), `/dashboard/imoveis/${id}/nivel?fotografar=cozinha_microondas#nivel-itens`);
});

test("cadastro: 'Meça agora, no imóvel' no lugar de 'depois de publicar'; no computador, o QR do FOTO-NA-HORA", () => {
  assert.equal(BOTAO_MEDIR_AGORA, "Meça agora, no imóvel");
  const cad = ler("components/niveis/nivel-cadastro.tsx");
  assert.doesNotMatch(cad, /depois de publicar/);
  assert.match(cad, /<MedirNoImovel propertyId=\{propertyId\} ponto=\{ponto\} origem="cadastro"/);
  const medir = ler("components/niveis/medir-no-imovel.tsx");
  assert.match(medir, /useModoProva\(\)/);
  assert.match(medir, /\{!modo \? PREPARANDO_CAMERA : BOTAO_MEDIR_AGORA\}/);
  assert.match(medir, /<MedirInternet imovelId=\{propertyId\} origem=\{origem\} pontoInicial=\{ponto\}/);
  assert.match(medir, /pedirLinkMedicao\(propertyId, ponto\)/);
  assert.match(medir, /medicaoDoPonto\(propertyId, ponto\)/);
  // O link do celular é o mesmo (uso único, 30 min, ligado ao dono); a rota decide o destino pela chave.
  assert.match(ler("app/prova/celular/route.ts"), /destinoLinkCelular\(link\.property_id as string, link\.chave as string\)/);
  assert.match(ler("lib/data/prova-actions.ts"), /chave: chaveLinkMedicao\(ponto\)/);
  // A página do nível (onde o link chega) mede com o ponto pedido.
  assert.match(ler("app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx"), /<MedirNoNivel propertyId=\{id\} ponto=\{pontoMedir\} \/>/);
});

test("servidor: as MESMAS validações no rascunho; só o ponto no mapa é obtido antes, e nunca o aproximado", () => {
  const srv = ler("lib/internet-medida-servidor.ts");
  // Raio e Wi-Fi: o mesmo validarLocal, agora com as coordenadas do rascunho.
  assert.match(srv, /validarLocal\(aparelho, await coordenadasParaMedir\(admin, supabase, imovelId\), entrada\.confirmouWifi === true\)/);
  assert.match(srv, /temCoordenadas: !!\(await coordenadasParaMedir\(admin, supabase, imovelId\)\)/);
  // Geocodifica só quem não está no ar e só com resultado preciso (o centro da cidade não serve).
  assert.match(srv, /if \(!r \|\| r\.status === "active"\) return null;/);
  assert.match(srv, /if \(g\.approximate\) return null;/);
  assert.match(srv, /\.neq\("status", "active"\)/);
  // O endereço privado do rascunho vem pela RPC do dono, nunca por select direto.
  assert.match(srv, /sessao\.rpc\("property_private_details", \{ prop_id: imovelId \}\)/);
  // O dono do rascunho mede (o papel é pela posse, não pelo status) e o nível recalcula na hora.
  assert.match(srv, /if \(origem !== "conferencia_entrada"\) return \(p as \{ owner_id: string \}\)\.owner_id === userId \? "dono" : null;/);
  assert.match(srv, /if \(papel === "dono" && ehPontoMedicao\(entrada\.ponto\)\) await recalcularNivel\(admin, imovelId, agora\);/);
  // A view pública continua só com anúncio publicado.
  assert.match(ler("../supabase/migrations/0205_internet_medida.sql"), /p\.status = 'active'/);
  // Medição vencida: a rotina dos prazos recalcula o nível (passo E).
  const prazos = ler("lib/prazos-59-servidor.ts");
  assert.match(prazos, /\.lte\("valido_ate", agora\.toISOString\(\)\)/);
  assert.match(prazos, /if \(await recalcularNivel\(admin, propertyId, agora\)\) r\.medicoesVencidas\+\+;/);
});
