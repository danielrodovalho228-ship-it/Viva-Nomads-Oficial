/*
  E832 — vídeo da home ("A Viva em 30 segundos"):
  1. O selo dizia 0:33 e a duração real é 0:32. O arquivo tem 32,618 s; os players (o nativo do navegador incluído)
     mostram os segundos INTEIROS, sem arredondar para cima. O teste lê a duração do próprio mp4 (caixa mvhd), sem
     ffprobe, e exige o selo igual ao que o player mostra.
  2. Os botões do cartão final ("Encontrar meu lar" / "Anunciar grátis") fazem parte da IMAGEM do vídeo e não eram
     clicáveis. Agora, quando o cartão final aparece (25,6 s, a última fala da legenda) e quando o vídeo termina, dois
     links REAIS ficam exatamente por cima dos botões pintados (posição medida no quadro final, 1280×720).
  Roda: node --test src/lib/e832-video-fim-clicavel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTOES_DO_FIM, INICIO_DO_CARTAO_FINAL } from "../components/institucional/video-dados.ts";

// O player é componente de cliente (não se importa no node): os dados do vídeo saem do código-fonte dele.
const PLAYER = readFileSync("src/components/institucional/video-institucional.tsx", "utf8");
const campo = (k: string) => PLAYER.match(new RegExp(`${k}: "([^"]+)"`))?.[1] ?? "";
const VIDEO_INSTITUCIONAL = { mp4: campo("mp4"), mp4Celular: campo("mp4Celular"), duracao: campo("duracao") };

/** Duração do mp4 em segundos, lida da caixa mvhd (versão 0 ou 1). */
function duracaoMp4(caminho: string): number {
  const b = readFileSync(caminho);
  const i = b.indexOf("mvhd");
  assert.ok(i > 0, `${caminho}: sem caixa mvhd`);
  const versao = b[i + 4];
  if (versao === 1) return Number(b.readBigUInt64BE(i + 4 + 4 + 16 + 4)) / b.readUInt32BE(i + 4 + 4 + 16);
  return b.readUInt32BE(i + 4 + 4 + 8 + 4) / b.readUInt32BE(i + 4 + 4 + 8);
}
const comoPlayer = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

test("E832 — o selo mostra a duração como o player mostra (segundos inteiros), nos dois arquivos", () => {
  for (const f of [VIDEO_INSTITUCIONAL.mp4, VIDEO_INSTITUCIONAL.mp4Celular]) {
    const s = duracaoMp4(`public${f}`);
    assert.ok(s > 32 && s < 33, `${f}: ${s} s`);
    assert.equal(VIDEO_INSTITUCIONAL.duracao, comoPlayer(s), `${f}: ${s} s → o player mostra ${comoPlayer(s)}`);
  }
});

test("E832 — os botões do cartão final são links reais, com destino e posição dos botões pintados", () => {
  assert.deepEqual(
    BOTOES_DO_FIM.map((b) => [b.rotulo, b.href]),
    [
      ["Encontrar meu lar", "/buscar"],
      // Visitante sem sessão cai no login de anunciar (o proxy põe motivo=anunciar), como o E807/E833.
      ["Anunciar grátis", "/dashboard/imoveis/novo"],
    ],
  );
  // Posição (em % da caixa 16:9) medida no quadro final de institucional.mp4 (1280×720): os botões pintados ocupam
  // y 347–420 e x 250–624 / 656–1030. O link real cobre o botão pintado inteiro.
  const pintados = [
    { x0: 250, x1: 624 },
    { x0: 656, x1: 1030 },
  ];
  BOTOES_DO_FIM.forEach((b, k) => {
    const c = b.caixa;
    assert.ok(c.esquerda <= (pintados[k].x0 / 1280) * 100 && c.esquerda + c.largura >= (pintados[k].x1 / 1280) * 100, `${b.rotulo}: cobre a largura`);
    assert.ok(c.topo <= (347 / 720) * 100 && c.topo + c.altura >= (420 / 720) * 100, `${b.rotulo}: cobre a altura`);
  });
  // Os dois não se tocam.
  assert.ok(BOTOES_DO_FIM[0].caixa.esquerda + BOTOES_DO_FIM[0].caixa.largura < BOTOES_DO_FIM[1].caixa.esquerda);
  // O cartão final começa com a última fala da legenda.
  const vtt = readFileSync("public/media/institucional.pt-BR.vtt", "utf8");
  assert.match(vtt, /00:25\.600 --> 00:30\.200\nEncontre seu lar ou anuncie grátis/);
  assert.equal(INICIO_DO_CARTAO_FINAL, 25.6);
});

test("E832 — o player mostra os links reais no fim (cartão final e vídeo terminado)", () => {
  const c = readFileSync("src/components/institucional/video-institucional.tsx", "utf8");
  assert.match(c, /onEnded=/, "ao terminar, os links aparecem");
  assert.match(c, /onTimeUpdate=/, "no cartão final, os links aparecem");
  assert.match(c, /BOTOES_DO_FIM\.map/);
  assert.match(c, /data-testid="video-institucional-fim"/);
  assert.match(c, /<Link[\s\S]*href=\{b\.href\}/, "link de verdade (next/link), não imagem");
});
