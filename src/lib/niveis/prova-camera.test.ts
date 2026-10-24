/*
  FOTO-NA-HORA-B — a prova de nível é a foto feita na hora. Regras puras + guardas de fonte (todo caminho que grava foto
  de prova passa pelo token). Roda: node --test src/lib/niveis/prova-camera.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVISO_PROVA_NA_HORA,
  BOTAO_FOTOGRAFAR,
  BOTAO_FOTOGRAFAR_CELULAR,
  DICA_CAMERA,
  ERRO_FOTO_REPETIDA,
  ERRO_SEM_TOKEN,
  MARCA_FOTO_ANTERIOR,
  PERMISSAO_CAMERA,
  SUGESTAO_FOTOGRAFAR,
  SUGESTAO_SEM_FOTO,
  SUGESTAO_SO_REFERENCIA,
  TOKEN_CAPTURA_MINUTOS,
  LINK_CELULAR_MINUTOS,
  PRAZO_REFAZER_DIAS,
  conferirCaptura,
  ehCelular,
  hashComparavel,
  provaAntigaNoPrazo,
  provaAntigaVencida,
  textoFotoRecebida,
  textoRefazerFoto,
  type CapturaGravada,
  ESPERA_MODO_MS,
  PREPARANDO_CAMERA,
  modoDaProva,
  modoSemListaDeAparelhos,
} from "./prova-camera.ts";
import { fatosAtendidos, itemConta, type EntradaNivel } from "./regras.ts";
import { prontidaoAnuncio, hrefParaMelhorar, type FatosAnuncio } from "../anuncio/prontidao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const DONO = "11111111-1111-1111-1111-111111111111";
const IMOVEL = "22222222-2222-2222-2222-222222222222";
const AGORA = new Date("2026-10-24T15:00:00Z");
const FOTO = `${DONO}/33333333-3333-3333-3333-333333333333.webp`;
const quem = { ownerId: DONO, propertyId: IMOVEL, chave: "cozinha_microondas" };
const cap = (o: Partial<CapturaGravada> = {}): CapturaGravada => ({
  owner_id: DONO,
  property_id: IMOVEL,
  chave: "cozinha_microondas",
  expira_em: new Date(AGORA.getTime() + 5 * 60_000).toISOString(),
  usado_em: null,
  foto_path: FOTO,
  ...o,
});

test("textos exatos da ordem", () => {
  assert.equal(AVISO_PROVA_NA_HORA, "Para provar o nível, a foto é feita na hora, pela câmera. Fotos da galeria não valem para comprovação, mas continuam valendo para as fotos do anúncio.");
  assert.equal(BOTAO_FOTOGRAFAR, "Fotografar agora");
  assert.equal(BOTAO_FOTOGRAFAR_CELULAR, "Fotografar pelo celular");
  assert.equal(DICA_CAMERA, "Mostre o item inteiro, sem pessoas, com boa luz.");
  assert.equal(textoFotoRecebida("Micro-ondas"), "Foto de Micro-ondas recebida. O item já conta enquanto a foto é analisada.");
  assert.equal(ERRO_SEM_TOKEN, "Esta foto não foi feita na hora. Abra a câmera e fotografe o item agora.");
  assert.equal(ERRO_FOTO_REPETIDA, "Esta foto já foi usada. Fotografe o item agora.");
  assert.equal(PERMISSAO_CAMERA, "Para comprovar o nível, permita o uso da câmera. As fotos ficam só no seu anúncio.");
  assert.equal(MARCA_FOTO_ANTERIOR, "Foto anterior à regra");
  assert.equal(textoRefazerFoto("Micro-ondas", "2026-11-23T15:00:00Z"), "Refaça a foto de Micro-ondas pela câmera até 23/11/2026");
  assert.equal(SUGESTAO_FOTOGRAFAR, "Parece que você tem isto: fotografe agora para comprovar");
  assert.equal(SUGESTAO_SO_REFERENCIA, "Esta foto é do anúncio e não serve de prova");
  assert.equal(SUGESTAO_SEM_FOTO, "Confirmada, falta a foto");
  assert.deepEqual([TOKEN_CAPTURA_MINUTOS, LINK_CELULAR_MINUTOS, PRAZO_REFAZER_DIAS], [10, 30, 30]);
});

test("token: sem token, vencido, reusado, de outra conta ou de outro item → recusado", () => {
  assert.deepEqual(conferirCaptura(null, quem, AGORA, FOTO), { ok: false, motivo: "sem_token" });
  assert.deepEqual(conferirCaptura(cap({ expira_em: "2026-10-24T14:59:59Z" }), quem, AGORA, FOTO), { ok: false, motivo: "vencido" });
  assert.deepEqual(conferirCaptura(cap({ expira_em: AGORA.toISOString() }), quem, AGORA, FOTO), { ok: false, motivo: "vencido" }, "no limite já venceu");
  assert.deepEqual(conferirCaptura(cap({ usado_em: "2026-10-24T14:58:00Z" }), quem, AGORA, FOTO), { ok: false, motivo: "usado" });
  assert.deepEqual(conferirCaptura(cap({ owner_id: "44444444-4444-4444-4444-444444444444" }), quem, AGORA, FOTO), { ok: false, motivo: "outra_conta" });
  assert.deepEqual(conferirCaptura(cap({ chave: "sala_tv" }), quem, AGORA, FOTO), { ok: false, motivo: "outro_item" });
  assert.deepEqual(conferirCaptura(cap({ property_id: DONO }), quem, AGORA, FOTO), { ok: false, motivo: "outro_item" });
  // Foto da galeria (outro caminho) com um token válido: recusada — o token só vale para a foto que ele mesmo prendeu.
  assert.deepEqual(conferirCaptura(cap(), quem, AGORA, `${DONO}/55555555-5555-5555-5555-555555555555.webp`), { ok: false, motivo: "outra_foto" });
  assert.deepEqual(conferirCaptura(cap({ foto_path: null }), quem, AGORA, FOTO), { ok: false, motivo: "sem_foto" });
  assert.deepEqual(conferirCaptura(cap(), quem, AGORA, FOTO), { ok: true });
  // Na hora do envio (sem caminho): o token não pode já ter foto (uma foto por token).
  assert.deepEqual(conferirCaptura(cap({ foto_path: null }), quem, AGORA), { ok: true });
  assert.deepEqual(conferirCaptura(cap(), quem, AGORA), { ok: false, motivo: "usado" });
});

test("hash: liso não compara; o resto compara", () => {
  assert.equal(hashComparavel("0000000000000000"), false);
  assert.equal(hashComparavel("ffffffffffffffff"), false);
  assert.equal(hashComparavel("0123456789abcdef"), true);
  assert.equal(hashComparavel("xyz"), false);
  assert.equal(hashComparavel(null), false);
});

test("prova anterior à regra: conta até o prazo; depois do prazo, não conta e o nível cai", () => {
  const ate = "2026-11-23T15:00:00Z";
  const antiga = { chave: "cozinha_microondas", declarado: true, fotoPath: FOTO, fotoStatus: "pendente" as const, fotoOrigem: "arquivo" as const, refazerAte: ate };
  assert.equal(itemConta(antiga, new Date("2026-11-23T14:59:59Z")), true);
  assert.equal(itemConta(antiga, new Date(ate)), false);
  assert.equal(provaAntigaNoPrazo(antiga, AGORA), true);
  assert.equal(provaAntigaVencida(antiga, new Date("2026-12-01T00:00:00Z")), true);
  // Câmera não vence; sem origem (dado antigo sem a 0242) conta como antes.
  assert.equal(itemConta({ ...antiga, fotoOrigem: "camera", refazerAte: null }, new Date("2027-06-01T00:00:00Z")), true);
  assert.equal(itemConta({ ...antiga, fotoOrigem: undefined, refazerAte: undefined }, new Date("2027-06-01T00:00:00Z")), true);
  // No cálculo do nível, o item some depois do prazo (o mesmo cálculo que a rotina recalcula).
  const entrada = (agora: Date): EntradaNivel => ({ declaracoesConforto: [], itens: [antiga], medidas: [], ruido: null, bloqueadas: [], agora });
  assert.equal(fatosAtendidos(entrada(AGORA)).has("cozinha_microondas"), true);
  assert.equal(fatosAtendidos(entrada(new Date("2026-12-01T00:00:00Z"))).has("cozinha_microondas"), false);
});

test("celular x computador: toque + câmera = celular; sem câmera ou mouse = QR", () => {
  assert.equal(ehCelular({ ponteiroGrosso: true, toque: true, temCamera: true }), true);
  assert.equal(ehCelular({ ponteiroGrosso: true, toque: true, temCamera: null }), true);
  assert.equal(ehCelular({ ponteiroGrosso: true, toque: true, temCamera: false }), false, "aparelho sem câmera vai pelo QR");
  assert.equal(ehCelular({ ponteiroGrosso: false, toque: false, temCamera: true }), false, "computador com webcam: QR, nunca a webcam");
});

test("prontidão: item pendente 'Refaça a foto … até …' (não barra), com o link para a câmera do item", () => {
  const base = { enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Apto", preco: 1, garantiaOk: true, sublocacaoOk: true, privacidadeOk: true, documento: "approved", limitePlanoOk: true, descricao: "x".repeat(60), selo: true, video: true } as FatosAnuncio;
  const p = prontidaoAnuncio({ ...base, provasParaRefazer: [{ chave: "cozinha_microondas", rotulo: "Micro-ondas", ate: "2026-11-23T15:00:00Z" }] });
  assert.equal(p.podePublicar, true);
  assert.deepEqual(p.melhorar, ["Refaça a foto de Micro-ondas pela câmera até 23/11/2026"]);
  assert.equal(hrefParaMelhorar("refazer_foto_cozinha_microondas", IMOVEL, false), `/dashboard/imoveis/${IMOVEL}/nivel?fotografar=cozinha_microondas#nivel-itens`);
});

test("GUARDA: salvarItemNivel recusa foto sem token válido (qualquer chamador) e consome o token antes de gravar", () => {
  const a = ler("src/lib/data/nivel-actions.ts");
  const corpo = a.slice(a.indexOf("export async function salvarItemNivel"), a.indexOf("/** As 4 perguntas de ruído"));
  const iToken = corpo.indexOf("const lida = await capturaPeloToken(c.admin, tokenCaptura);");
  const iRecusa = corpo.indexOf("if (!lida || !v.ok) return { ok: false, erro: ERRO_SEM_TOKEN };");
  const iConsome = corpo.indexOf('.update({ usado_em: new Date().toISOString() }).eq("id", lida.id).is("usado_em", null)');
  const iGrava = corpo.indexOf('.from("nivel_itens").upsert(');
  assert.ok(iToken > 0 && iRecusa > iToken && iConsome > iRecusa && iGrava > iConsome, "token → recusa → consumo → gravação");
  assert.match(corpo, /conferirCaptura\(lida, \{ ownerId: c\.uid, propertyId, chave \}, new Date\(\), novaFoto\)/);
  assert.match(corpo, /foto_origem: "camera"/);
  // Os chamadores com foto: só a câmera (com o token). As telas do nível e a sugestão das fotos não passam caminho.
  assert.match(ler("src/components/niveis/camera-prova.tsx"), /salvarItemNivel\(propertyId, chave, true, j\.path, token\.current\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/form-nivel.tsx"), /salvarItemNivel\(propertyId, chave, declarado\)/);
  assert.doesNotMatch(ler("src/components/niveis/nivel-cadastro.tsx"), /salvarItemNivel/);
  assert.doesNotMatch(ler("src/lib/data/deteccao-actions.ts"), /salvarItemNivel\(/);
  // A correção da pendência do padrão mínimo não troca a prova do item (antes copiava a foto para nivel_itens).
  assert.doesNotMatch(ler("src/lib/data/conforto-actions.ts"), /from\("nivel_itens"\)\.update\(\{ foto_path/);
});

test("GUARDA: o envio da prova confere o token antes do arquivo, compara o hash e prende a foto ao token", () => {
  const r = ler("src/app/api/upload/prova/route.ts");
  assert.ok(r.indexOf("capturaPeloToken(admin") < r.indexOf('form?.get("file")'), "token antes do arquivo");
  assert.match(r, /return NextResponse\.json\(\{ error: ERRO_SEM_TOKEN, motivo: ok && !ok\.ok \? ok\.motivo : "sem_token" \}, \{ status: 403 \}\)/);
  assert.match(r, /fotoJaUsada\(admin, hash, \{ propertyId: captura\.property_id, ownerId: user\.id, capturaId: captura\.id \}\)[\s\S]{0,80}ERRO_FOTO_REPETIDA/);
  assert.match(r, /\.is\("foto_path", null\)\s*\.is\("usado_em", null\)/);
  const s = ler("src/lib/niveis/prova-servidor.ts");
  assert.match(s, /from\("fotos_anuncio_hash"\)\.select\("id"\)\.eq\("hash", hash\)\.or\(`property_id\.eq\.\$\{ctx\.propertyId\},owner_id\.eq\.\$\{ctx\.ownerId\}`\)/);
  assert.match(s, /from\("nivel_itens"\)\.select\("chave"\)\.eq\("foto_hash", hash\)/);
  // A foto do anúncio (galeria) segue aceitando envio de arquivo, sem token.
  const g = ler("src/app/api/upload/foto/route.ts");
  assert.doesNotMatch(g, /token|prova_capturas/);
});

test("GUARDA: a câmera não tem campo de arquivo nem galeria e ignora arquivo arrastado; o computador não oferece a webcam", () => {
  const c = ler("src/components/niveis/camera-prova.tsx");
  assert.doesNotMatch(c, /type="file"|<input/);
  assert.match(c, /window\.addEventListener\("drop", parar, true\)/);
  assert.match(c, /facingMode: \{ ideal: frente \? "user" : "environment" \}/);
  assert.match(c, /\{aberto && celular && \(\s*<CameraProva/);
  assert.match(c, /\{aberto && !celular && modo && \(\s*<PeloCelular/);
});

test("GUARDA: link do celular de uso único, ligado ao dono, nunca entra como outra conta", () => {
  const r = ler("src/app/prova/celular/route.ts");
  assert.match(r, /if \(user && user\.id !== link\.owner_id\) return para\(request, "\/prova\/celular\/aviso\?m=outra-conta"\);/);
  assert.ok(r.indexOf("outra-conta") < r.indexOf('update({ usado_em'), "outra conta é recusada antes de consumir o link");
  assert.match(r, /\.eq\("id", link\.id\)\.is\("usado_em", null\)/);
  assert.match(r, /getUserById\(link\.owner_id as string\)/);
  const a = ler("src/lib/data/prova-actions.ts");
  assert.match(a, /event: "nivel_prova_celular"/);
  assert.match(a, /LINK_CELULAR_MINUTOS \* 60_000/);
});

test("migração 0242: colunas, backfill 'arquivo' com prazo de 30 dias, tokens só do servidor, aplicar/rollback", () => {
  const m = ler("supabase/migrations/0242_foto_na_hora.sql");
  assert.match(m, /set foto_origem = 'arquivo', refazer_ate = now\(\) \+ interval '30 days'\s*where foto_path is not null and foto_origem is null;/);
  assert.match(m, /create table if not exists public\.prova_capturas/);
  assert.match(m, /revoke all on public\.prova_capturas from public, anon, authenticated;/);
  assert.match(m, /revoke all on public\.prova_links_celular from public, anon, authenticated;/);
  assert.match(m, /'confirmada_sem_foto'/);
  const ap = ler("supabase/producao/aplicar-0242.sql");
  assert.match(ap, /^-- Viva Nomads — aplicar 0242/);
  assert.match(ap, /begin;[\s\S]*commit;\s*$/);
  assert.match(ap, /select '20261024000242', '0242_foto_na_hora',/);
  assert.match(ap, /'danielrodovalho228@gmail\.com'/);
  const rb = ler("supabase/producao/rollback/0242_rollback.sql");
  assert.match(rb, /drop table if exists public\.prova_capturas;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261024000242';/);
});

test("rotina dos prazos: prova vencida recalcula o nível e avisa o dono uma vez", () => {
  const r = ler("src/lib/prazos-59-servidor.ts");
  assert.match(r, /\.eq\("foto_origem", "arquivo"\)\.lte\("refazer_ate", agora\.toISOString\(\)\)\.is\("vencida_avisada_em", null\)/);
  assert.match(r, /await recalcularNivel\(admin, propertyId, agora\);\s*await avisarProvaVencida\(/);
});

test("E100: o caminho é decidido na montagem, sem permissão de câmera, em até 1 s; falha = computador (QR)", () => {
  // Sem toque (ou sem getUserMedia): computador já, sem esperar a lista de aparelhos.
  assert.equal(modoSemListaDeAparelhos({ ponteiroGrosso: false, toque: false, getUserMedia: true }), "computador");
  assert.equal(modoSemListaDeAparelhos({ ponteiroGrosso: true, toque: true, getUserMedia: false }), "computador");
  assert.equal(modoSemListaDeAparelhos({ ponteiroGrosso: true, toque: true, getUserMedia: true }), null);
  // Com toque: câmera na lista = celular; sem câmera = computador; sem resposta em 1 s (null) = celular.
  const toque = { ponteiroGrosso: true, toque: true, getUserMedia: true };
  assert.equal(modoDaProva({ ...toque, temCamera: true }), "celular");
  assert.equal(modoDaProva({ ...toque, temCamera: false }), "computador");
  assert.equal(modoDaProva({ ...toque, temCamera: null }), "celular");
  assert.equal(ESPERA_MODO_MS, 1000);
  assert.equal(PREPARANDO_CAMERA, "Preparando…");
  const c = ler("src/components/niveis/camera-prova.tsx");
  const hook = c.slice(c.indexOf("function useModoProva"), c.indexOf("/** Arquivo arrastado"));
  assert.doesNotMatch(hook, /getUserMedia\(/, "nada de pedir a câmera para decidir o caminho");
  assert.match(hook, /window\.setTimeout\(\(\) => fim\(modoDaProva\(\{ \.\.\.ambiente, temCamera: null \}\)\), ESPERA_MODO_MS\)/);
  assert.match(hook, /fim\("computador"\)/);
  assert.match(c, /\{!modo \? PREPARANDO_CAMERA : celular \?/);
  assert.match(c, /aria-busy=\{!modo\}/);
});
