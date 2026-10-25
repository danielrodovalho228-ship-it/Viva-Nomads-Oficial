/* Roda: node --test src/lib/fotos/conteudo.test.ts — E133: foto, vídeo e link que não mostram o imóvel. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  conteudoDoVideo,
  conteudoPendente,
  confirmarConteudo,
  estadoPassoFotos,
  juntarConteudo,
  linkAprovado,
  medirTela,
  oembedDoLink,
  pareceTela,
  podeSerPrincipal,
  quadrosDoVideo,
  resultadoOembed,
  statusOembedLab,
  validarConteudo,
  ERRO_LINK_NAO_EXISTE,
  ERRO_LINK_NAO_INCORPORAVEL,
  type ConteudoFoto,
} from "./conteudo.ts";

const boa = { conteudo: { naoImovel: false, motivo: null } as ConteudoFoto };
const print = { conteudo: { naoImovel: true, motivo: "print" } as ConteudoFoto };
const oito = (f = boa) => Array.from({ length: 8 }, () => f);

test("E133 (a) — abaixo de 8 fotos o Passo 2 não continua e a contagem explica", () => {
  const e = estadoPassoFotos([boa]);
  assert.equal(e.podeContinuar, false);
  assert.equal(e.trava, "faltam");
  assert.equal(e.mensagem, "Faltam 7 fotos para continuar (mínimo de 8).");
  assert.equal(estadoPassoFotos(Array.from({ length: 7 }, () => boa)).mensagem, "Falta 1 foto para continuar (mínimo de 8).");
  assert.equal(estadoPassoFotos(oito()).podeContinuar, true);
  assert.equal(estadoPassoFotos([]).trava, "faltam");
});

test("E133 (b) — foto sinalizada não é a principal e trava até remover ou confirmar (por foto, não por lote)", () => {
  assert.equal(podeSerPrincipal(print.conteudo), false);
  assert.equal(podeSerPrincipal(boa.conteudo), true);
  assert.equal(podeSerPrincipal(undefined), true, "foto sem conferência (antiga) não trava");
  assert.equal(estadoPassoFotos([print, ...oito()]).trava, "principal");
  const umaNoMeio = [...oito(), print];
  const e = estadoPassoFotos(umaNoMeio);
  assert.equal(e.trava, "sinalizadas");
  assert.equal(e.pendentes, 1);
  assert.equal(e.mensagem, "1 foto não parece ser do imóvel. Remova ou confirme cada uma para continuar.");
  const confirmada = { conteudo: confirmarConteudo(print.conteudo, new Date("2026-10-25T09:00:00Z")) };
  assert.equal(confirmada.conteudo.confirmadaEm, "2026-10-25T09:00:00.000Z", "a confirmação fica com a data");
  assert.equal(conteudoPendente(confirmada.conteudo), false);
  assert.equal(estadoPassoFotos([confirmada, ...oito()]).podeContinuar, true);
});

test("E133 (c) — vídeo: 3 quadros (início, meio, fim); sinalizado com metade ou mais; trava como a foto", () => {
  assert.deepEqual(quadrosDoVideo(9), [0.9, 4.5, 8.1]);
  assert.deepEqual(quadrosDoVideo(NaN), [0]);
  const n = (naoImovel: boolean): ConteudoFoto => ({ naoImovel, motivo: naoImovel ? "objeto" : null });
  assert.deepEqual(conteudoDoVideo([n(true), n(true), n(false)]), { naoImovel: true, motivo: "objeto" });
  assert.deepEqual(conteudoDoVideo([n(false), n(true), n(false)]), { naoImovel: false, motivo: null });
  assert.equal(conteudoDoVideo([]), null);
  assert.equal(estadoPassoFotos(oito(), { naoImovel: true, motivo: "pessoa" }).trava, "video");
  assert.equal(estadoPassoFotos(oito(), confirmarConteudo({ naoImovel: true, motivo: "pessoa" })).podeContinuar, true);
});

test("E133 — resposta do modelo validada; regra local de tela; qualquer um que sinalize, sinaliza", () => {
  assert.deepEqual(validarConteudo({ imovel: true, motivo: null }), { naoImovel: false, motivo: null });
  assert.deepEqual(validarConteudo({ imovel: false, motivo: "print" }), { naoImovel: true, motivo: "print" });
  assert.deepEqual(validarConteudo({ imovel: false, motivo: "inventado" }), { naoImovel: true, motivo: "outro" });
  assert.equal(validarConteudo("lixo"), null);
  assert.equal(validarConteudo({ motivo: "print" }), null);
  // Tela chapada (4 cores, áreas lisas) × "foto" com ruído (cada pixel diferente).
  const w = 32, h = 32;
  const tela = new Uint8Array(w * h * 3).map((_, i) => (Math.floor(i / 3 / w) < 8 ? 20 : 240));
  const foto = new Uint8Array(w * h * 3).map((_, i) => (i * 37 + ((i * i) % 251)) % 256);
  assert.equal(pareceTela(medirTela(tela, w, h)), true);
  assert.equal(pareceTela(medirTela(foto, w, h)), false);
  assert.deepEqual(juntarConteudo(null, true), { naoImovel: true, motivo: "print" });
  assert.deepEqual(juntarConteudo({ naoImovel: true, motivo: "pessoa" }, false), { naoImovel: true, motivo: "pessoa" });
  assert.deepEqual(juntarConteudo({ naoImovel: false, motivo: null }, false), { naoImovel: false, motivo: null });
});

test("E133 (d) — link: só YouTube/Vimeo de formato válido; oEmbed decide existe/incorpora; mensagem clara", () => {
  assert.equal(oembedDoLink("https://example.com/v.mp4"), null);
  assert.equal(oembedDoLink("https://youtu.be/curto"), null);
  const y = oembedDoLink("https://youtu.be/dQw4w9WgXcQ")!;
  assert.equal(y.provedor, "youtube");
  assert.match(y.endereco, /^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
  assert.equal(oembedDoLink("https://vimeo.com/123456")!.endereco, "https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F123456");
  assert.deepEqual(resultadoOembed(200, "youtube"), { ok: true, provedor: "youtube" });
  assert.deepEqual(resultadoOembed(404, "youtube"), { ok: false, erro: ERRO_LINK_NAO_EXISTE });
  assert.deepEqual(resultadoOembed(401, "youtube"), { ok: false, erro: ERRO_LINK_NAO_INCORPORAVEL });
  assert.equal(statusOembedLab("Xaaaaaaaaaa"), 404);
  assert.equal(statusOembedLab("Naaaaaaaaaa"), 401);
  assert.equal(statusOembedLab("dQw4w9WgXcQ"), 200);
});

test("E133 (d) — o anúncio só mostra o link que o admin aprovou (a última decisão sobre ESTE link)", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";
  assert.equal(linkAprovado(url, []), false, "sem decisão = pendente, não aparece");
  assert.equal(linkAprovado(url, [{ acao: "aprovar_video_link", motivo: url, criado_em: "2026-10-25T10:00:00Z" }]), true);
  assert.equal(linkAprovado(url, [{ acao: "aprovar_video_link", motivo: "https://youtu.be/outroooooo1", criado_em: "2026-10-25T10:00:00Z" }]), false, "aprovar outro link não vale");
  assert.equal(
    linkAprovado(url, [
      { acao: "aprovar_video_link", motivo: url, criado_em: "2026-10-25T10:00:00Z" },
      { acao: "recusar_video_link", motivo: url, criado_em: "2026-10-25T11:00:00Z" },
    ]),
    false,
  );
});

test("E133 — a tela usa as regras: Continuar desabilitado no Passo 2, uploader confere, página pública filtra o link", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const pagina = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /step === ETAPA\.fotos && !passoFotos\.podeContinuar \? \{ disabled: true/);
  assert.match(pagina, /if \(s === ETAPA\.fotos && !passoFotos\.podeContinuar\)/);
  const up = ler("components/photo-uploader.tsx");
  assert.match(up, /conferirFotos\(/);
  assert.match(up, /if \(!podeSerPrincipal\(item\.conteudo\)\) return;/);
  assert.match(ler("components/video-uploader.tsx"), /conferirVideo\(file\)/);
  assert.match(ler("app/(public)/imoveis/[id]/page.tsx"), /linkDeVideoAprovado\(property\.id, property\.videoUrl\)/);
  assert.match(ler("lib/data/actions.ts"), /verificarLinkVideo\(linkVideo\)/);
});

// E164 (QA ao vivo do Muse, 25/10): a prévia do anúncio nunca mostra a foto sinalizada pendente como principal.
import { fotosDaPrevia } from "./conteudo.ts";
test("E164 — a prévia só mostra foto elegível; a sinalizada pendente fica de fora, a confirmada volta", () => {
  const print = { url: "print", conteudo: { naoImovel: true, motivo: "print" as const } };
  const boa = { url: "sala", conteudo: { naoImovel: false, motivo: null } };
  const confirmada = { url: "print2", conteudo: { naoImovel: true, motivo: "print" as const, confirmadaEm: "2026-10-25T10:00:00Z" } };
  assert.deepEqual(fotosDaPrevia([print]).map((f) => f.url), [], "só a sinalizada: a prévia fica sem foto");
  assert.deepEqual(fotosDaPrevia([print, boa]).map((f) => f.url), ["sala"], "pendente: a 1ª elegível é a principal");
  assert.deepEqual(fotosDaPrevia([confirmada, boa]).map((f) => f.url), ["print2", "sala"], "confirmada: volta na posição dela");
  const antiga: { url: string; conteudo?: null } = { url: "antiga" };
  assert.deepEqual(fotosDaPrevia([antiga]).map((f) => f.url), ["antiga"], "foto sem conferência (antiga) aparece");
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /const fotosPrevia = fotosDaPrevia\(photos\)\.map\(\(p\) => p\.url\);/);
  assert.match(pagina, /foto=\{fotosPrevia\[0\] \?\? null\}/);
  assert.match(pagina, /photos: fotosPrevia,/);
  assert.match(pagina, /fotos=\{fotosPrevia\}/);
  assert.doesNotMatch(pagina, /foto=\{photos\[0\]/);
});
