/*
  64-B — pausar e reativar anúncio, limite do plano numa conta só, aceite de IA que não some.
  Roda: node --test src/lib/anuncio/pausa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MOTIVOS_PAUSA,
  donoPodeReativar,
  linhasDoLimite,
  mensagemLimitePublicar,
  mensagemLimiteReativar,
  situacaoComLimite,
  situacaoLimite,
  textoDaPausa,
  textoEmAndamento,
} from "./pausa.ts";
import { prontidaoAnuncio, textoVagaNoPlano } from "./prontidao.ts";
import { AVISO_TEXTO_MUDOU, aceiteParaRascunho, aceiteRestaurado, impressaoDoTexto } from "./aceite-ia-rascunho.ts";
import { TERMO_IA_VERSAO } from "./termo-ia.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("situacaoLimite: abaixo, igual e acima do limite; X a pausar exato", () => {
  assert.deepEqual(situacaoLimite("free", 0), { limite: 1, ativos: 0, excedente: 0, podePublicarNovo: true, precisaPausar: 0 });
  assert.deepEqual(situacaoLimite("free", 1), { limite: 1, ativos: 1, excedente: 0, podePublicarNovo: false, precisaPausar: 1 });
  // proprietario1: 4 publicados no Gratuito → para publicar mais um, pausar 4.
  assert.deepEqual(situacaoLimite("free", 4), { limite: 1, ativos: 4, excedente: 3, podePublicarNovo: false, precisaPausar: 4 });
  assert.equal(situacaoLimite("essential", 3).podePublicarNovo, true);
  assert.equal(situacaoLimite("essential", 5).precisaPausar, 1);
  assert.equal(situacaoLimite("nao-existe", 1).limite, 1); // plano desconhecido = Gratuito
  assert.deepEqual(situacaoComLimite(1, 4), situacaoLimite("free", 4));
});

test("mensagens do limite: publicar e reativar dizem o número exato; o painel tem as duas linhas", () => {
  assert.equal(mensagemLimitePublicar(situacaoLimite("free", 4)), "Seu plano permite 1 anúncio publicado e você tem 4. Para publicar este, pause 4 anúncios ou mude de plano");
  // Reativar: os publicados contam SEM o pausado. 1 publicado no Gratuito → pause 1.
  assert.equal(mensagemLimiteReativar(situacaoLimite("free", 1)), "Seu plano permite 1 publicado e você tem 1. Para reativar, pause 1 anúncio ou mude de plano");
  assert.deepEqual(linhasDoLimite(situacaoLimite("free", 1)), ["1 publicado — seu plano permite 1"]);
  assert.deepEqual(linhasDoLimite(situacaoLimite("free", 4)), [
    "4 publicados — seu plano permite 1",
    "Os que já estavam publicados continuam. Para publicar outro, pause 4 anúncios ou mude de plano.",
  ]);
});

test("uma conta só: prontidão (telas) e servidor (limiteDePublicacao) dão o mesmo número", () => {
  // Prontidão com os publicados conhecidos usa a mesma mensagem do servidor.
  const pr = prontidaoAnuncio({
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio no Centro com varanda", preco: 3000, garantiaOk: true,
    sublocacaoOk: true, privacidadeOk: true, operacao: "own", documento: "approved", limitePlanoOk: false, limiteAnuncios: 1, ativosAnuncios: 4,
    descricao: "x".repeat(200), selo: false, video: false,
  });
  assert.equal(pr.obrigatorios.find((i) => i.key === "limite")?.detalhe, mensagemLimitePublicar(situacaoLimite("free", 4)));
  assert.equal(textoVagaNoPlano(1, 4), mensagemLimitePublicar(situacaoLimite("free", 4)));
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /return s\.podePublicarNovo \? null : `\$\{mensagemLimitePublicar\(s\)\}\.`;/);
  assert.match(acoes, /return situacaoLimite\(plan as string, count \?\? 0\);/);
  const servidor = ler("src/lib/anuncio/prontidao-servidor.ts");
  assert.match(servidor, /const sit = situacaoLimite\(plano as string, ativos \?\? 0\);/);
  assert.match(servidor, /fatosDaLinha\(p, fotosPor\.get\(p\.id\) \?\? 0, docPor\.get\(p\.id\) \?\? "none", limiteOk, sit\.limite, sit\.ativos\)/);
});

test("motivo da pausa: só o dono reativa o que ele pausou; pausa da Viva mostra motivo e caminho, nunca Reativar", () => {
  assert.deepEqual([...MOTIVOS_PAUSA], ["dono", "conforto", "camera", "admin", "avaliacao", "conta"]);
  assert.equal(donoPodeReativar("dono"), true);
  for (const m of ["conforto", "camera", "admin", "avaliacao", "conta", null, undefined, "x"]) assert.equal(donoPodeReativar(m), false, String(m));
  assert.equal(textoDaPausa("conforto").caminho?.rotulo, "Confirme o padrão mínimo");
  assert.equal(textoDaPausa("camera").caminho?.rotulo, "Fale com a Viva");
  assert.equal(textoDaPausa(null).motivo, "Pausado pela Viva."); // sem motivo = da Viva, nunca do dono
  const ui = ler("src/components/anuncio/estado-anuncio.tsx");
  // Pausa da Viva: o bloco desenha o motivo e retorna antes do menu com "Reativar".
  const viva = ui.slice(ui.indexOf("const daViva"), ui.indexOf("function abrirPausa"));
  assert.match(viva, /data-testid="pausa-viva"/);
  assert.doesNotMatch(viva, /reativar-anuncio|>\s*Reativar/);
});

test("pausar: sempre permitido e só pelo dono; grava motivo dono pelo servidor; nada em andamento muda", () => {
  const acoes = ler("src/lib/data/actions.ts");
  const pausar = acoes.slice(acoes.indexOf("export async function pausarAnuncio"), acoes.indexOf("export async function reativarAnuncio"));
  assert.match(pausar, /anuncioDoDono\(id\)/);
  assert.match(pausar, /update\(\{ status: "paused", pausa_motivo: "dono" \}\)/);
  assert.match(pausar, /\.eq\("owner_id", a\.userId\)/);
  // Pausar não consulta limite, prontidão nem pendências (nunca é bloqueado) e não toca em contrato/proposta/visita.
  assert.doesNotMatch(pausar, /situacaoDoLimite|prontidao|contratos|propostas|visitas|leads/);
  assert.match(acoes, /\.from\("anuncio_aceites_ia"\)/);
  assert.deepEqual(textoEmAndamento({ candidaturasAbertas: 2, propostasAceitas: 0, visitasMarcadas: 1, contratosVigentes: 0 }), [
    "1 visita marcada continua.",
    "2 candidaturas abertas continuam; você pode responder a elas.",
  ]);
  assert.deepEqual(textoEmAndamento({ candidaturasAbertas: 0, propostasAceitas: 0, visitasMarcadas: 0, contratosVigentes: 0 }), []);
});

test("reativar: só motivo dono e pela MESMA porta da publicação (cidade, prontidão, aceite de IA, limite sem ele)", () => {
  const acoes = ler("src/lib/data/actions.ts");
  const reativar = acoes.slice(acoes.indexOf("export async function reativarAnuncio"), acoes.indexOf("/** 64-B: o limite do plano do dono logado"));
  assert.match(reativar, /if \(!donoPodeReativar\(p\.pausa_motivo\)\)/);
  assert.match(reativar, /cidadeFechada\(supabase, userId, p\.city\)/);
  assert.match(reativar, /prontidaoDoImovel\(supabase, userId, id\)/);
  assert.match(reativar, /versao_termo", TERMO_IA_VERSAO/);
  assert.match(reativar, /situacaoDoLimite\(supabase, userId, id\)/); // conta os publicados SEM este
  assert.match(reativar, /mensagemLimiteReativar\(lim\)/);
  // A volta passa pela sessão do dono: os gatilhos de publicação do banco conferem de novo.
  assert.match(reativar, /supabase\.from\("properties"\)\.update\(\{ status: "active" \}\)/);
  // E o banco nunca deixa o dono reativar pausa da Viva por outro caminho.
  const mig = ler("supabase/migrations/0223_pausa_anuncio.sql");
  assert.match(mig, /coalesce\(old\.pausa_motivo, 'admin'\) <> 'dono'/);
  assert.match(mig, /revoke update \(pausa_motivo, pausado_em\) on public\.properties from anon, authenticated/);
  // O revoke da coluna não basta (update da tabela inteira é o padrão do Supabase): o gatilho recusa quem grava o motivo.
  assert.match(mig, /before update of pausa_motivo, pausado_em on public\.properties/);
  assert.match(mig, /'O motivo da pausa é gravado pela Viva\.'/);
});

test("toda pausa existente grava o motivo, e cada volta automática só devolve a sua", () => {
  assert.match(ler("src/lib/atendimento/servidor.ts"), /status: "paused", pausa_motivo: "camera"/);
  assert.match(ler("src/lib/prazos-59-servidor.ts"), /status: "paused", pausa_motivo: "conforto"/);
  assert.match(ler("src/lib/conforto/servidor.ts"), /\.eq\("status", "paused"\)\.eq\("pausa_motivo", "conforto"\)/);
  assert.match(ler("src/lib/vistoria/laudo-servidor.ts"), /status: "paused", pausa_motivo: "avaliacao"/);
  assert.match(ler("src/lib/vistoria/laudo-servidor.ts"), /\.eq\("pausa_motivo", "avaliacao"\)/);
  assert.match(ler("src/lib/saida/acoes.ts"), /pausado_pela_conta: true, pausa_motivo: "conta"/);
  const mig = ler("supabase/migrations/0223_pausa_anuncio.sql");
  // Pausados de antes: conforto / conta / avaliação inferidos; o resto, da Viva (admin).
  assert.match(mig, /when p\.pausado_pela_conta then 'conta'/);
  assert.match(mig, /c\.pausado_em is not null\) then 'conforto'/);
  assert.match(mig, /else 'admin'/);
});

test("pausado fica fora da busca, do mapa e dos alertas; sem candidatura, proposta ou visita nova; página pública diz que está pausado", () => {
  const props = ler("src/lib/data/properties.ts");
  assert.match(props, /export async function listProperties[\s\S]*?\.eq\("status", "active"\)/);
  assert.match(ler("src/lib/data/alerta-busca-servidor.ts"), /imovel\.status !== "active"/);
  // Candidatura e visita: a RLS só mostra anúncio publicado (0001/0057); proposta: barrada aqui.
  assert.match(ler("supabase/migrations/0001_initial_schema.sql"), /status = 'active' or owner_id = auth\.uid\(\)/);
  assert.match(ler("src/lib/data/propostas-actions.ts"), /if \(im\.status === "paused"\) return \{ ok: false/);
  // Página pública: pausado não é 404 e não tem preço nem botão.
  assert.match(ler("src/app/(public)/imoveis/[id]/layout.tsx"), /!\(await getProperty\(id\)\) && !\(await anuncioPausadoPublico\(id\)\)/);
  assert.match(ler("src/app/(public)/imoveis/[id]/page.tsx"), /return <AnuncioPausado titulo=\{pausado\.titulo\} cidade=\{pausado\.cidade\} \/>/);
  const pagina = ler("src/components/anuncio/anuncio-pausado.tsx");
  const jsx = pagina.slice(pagina.indexOf("return ("));
  assert.match(jsx, /Este anúncio está pausado/);
  assert.doesNotMatch(jsx, /R\$|price|preco|Candidat|PedidoForm|requestLead/);
});

test("aceite de IA: volta com o rascunho e cai quando o título ou a descrição mudam", () => {
  const salvo = aceiteParaRascunho(true, "Studio Centro", "Descrição longa do imóvel.");
  assert.deepEqual(salvo, { marcado: true, versao: TERMO_IA_VERSAO, texto: impressaoDoTexto("Studio Centro", "Descrição longa do imóvel.") });
  assert.equal(aceiteParaRascunho(false, "a", "b"), null);
  assert.deepEqual(aceiteRestaurado(salvo, "Studio Centro", "Descrição longa do imóvel."), { marcado: true, aviso: null });
  assert.deepEqual(aceiteRestaurado(salvo, "Studio Centro", "Descrição editada."), { marcado: false, aviso: AVISO_TEXTO_MUDOU });
  assert.deepEqual(aceiteRestaurado({ ...salvo, versao: "2020-01-01" }, "Studio Centro", "Descrição longa do imóvel."), { marcado: false, aviso: null });
  assert.deepEqual(aceiteRestaurado(null, "a", "b"), { marcado: false, aviso: null });
  // Espaço nas pontas não muda; uma letra muda.
  assert.equal(impressaoDoTexto(" a ", "b "), impressaoDoTexto("a", "b"));
  assert.notEqual(impressaoDoTexto("a", "b"), impressaoDoTexto("a", "c"));
  const editor = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(editor, /aceiteIa: aceiteParaRascunho\(aceiteValido, title, description\)/);
  assert.match(editor, /const aceite = aceiteRestaurado\(d\.aceiteIa/);
  assert.match(editor, /const podePublicar = prontidao\.podePublicar && qualificado && aceiteValido;/);
  assert.match(AVISO_TEXTO_MUDOU, /^Você mudou o texto depois de aceitar: confira e aceite de novo\.$/);
});
