"use client";

/*
  E133 — o lado do navegador da conferência "é do imóvel?": prepara miniaturas (fotos já enviadas e 3 quadros do vídeo)
  e chama /api/fotos/conferir em lotes de até 6. Falha de rede ou da rota = null (a foto fica sem conferência e não
  trava; a regra que trava é só a da foto SINALIZADA).
*/
import { FOTOS_LADO_MAX_PX, FOTOS_MAX_MINIATURAS } from "../ai/fotos-prompt";
import { conteudoDoVideo, medirTela, pareceTela, quadrosDoVideo, type ConteudoFoto } from "./conteudo";

/** Miniatura JPEG (para o servidor) + a medida de "tela" feita nos pixels CRUS (o JPEG pequeno apaga as áreas lisas). */
export interface Amostra {
  base64: string;
  tela: boolean;
}

function amostrar(fonte: CanvasImageSource, largura: number, altura: number): Amostra | null {
  try {
    const k = Math.min(1, FOTOS_LADO_MAX_PX / Math.max(largura || 1, altura || 1));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((largura || 1) * k));
    c.height = Math.max(1, Math.round((altura || 1) * k));
    c.getContext("2d")?.drawImage(fonte, 0, 0, c.width, c.height);
    // Medida em ~256 px, como no servidor.
    const km = Math.min(1, 256 / Math.max(c.width, c.height));
    const m = document.createElement("canvas");
    m.width = Math.max(2, Math.round(c.width * km));
    m.height = Math.max(2, Math.round(c.height * km));
    const ctx = m.getContext("2d", { willReadFrequently: true });
    ctx?.drawImage(c, 0, 0, m.width, m.height);
    const rgba = ctx?.getImageData(0, 0, m.width, m.height).data;
    let tela = false;
    if (rgba) {
      const rgb = new Uint8Array(m.width * m.height * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) (rgb[j] = rgba[i]), (rgb[j + 1] = rgba[i + 1]), (rgb[j + 2] = rgba[i + 2]);
      tela = pareceTela(medirTela(rgb, m.width, m.height));
    }
    const base64 = c.toDataURL("image/jpeg", 0.7).split(",")[1] || "";
    return base64 ? { base64, tela } : null;
  } catch {
    return null;
  }
}

async function amostraDaUrl(url: string): Promise<Amostra | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error("foto"));
      img.src = url;
    });
    return amostrar(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  }
}

export async function conferirMiniaturas(amostras: (Amostra | null)[]): Promise<(ConteudoFoto | null)[]> {
  const saida: (ConteudoFoto | null)[] = amostras.map(() => null);
  const validos = amostras.map((m, i) => ({ m, i })).filter((x): x is { m: Amostra; i: number } => !!x.m);
  for (let k = 0; k < validos.length; k += FOTOS_MAX_MINIATURAS) {
    const lote = validos.slice(k, k + FOTOS_MAX_MINIATURAS);
    try {
      const res = await fetch("/api/fotos/conferir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miniaturas: lote.map((x) => x.m.base64) }),
      });
      if (!res.ok) continue;
      const { resultados } = (await res.json()) as { resultados?: ConteudoFoto[] };
      lote.forEach((x, j) => (saida[x.i] = resultados?.[j] ?? null));
    } catch {
      /* sem conferência: a foto segue sem aviso */
    }
    // A medida crua do navegador também vale (só acrescenta aviso, nunca tira).
    for (const x of lote) if (x.m.tela && !saida[x.i]?.naoImovel) saida[x.i] = { naoImovel: true, motivo: "print" };
  }
  return saida;
}

/** Confere fotos já enviadas (pela URL pública). */
export async function conferirFotos(urls: string[]): Promise<(ConteudoFoto | null)[]> {
  return conferirMiniaturas(await Promise.all(urls.map((u) => amostraDaUrl(u))));
}

/** Um quadro do vídeo (no instante `t`). */
function quadro(video: HTMLVideoElement, t: number): Promise<Amostra | null> {
  return new Promise((ok) => {
    video.addEventListener("seeked", () => ok(amostrar(video, video.videoWidth, video.videoHeight)), { once: true });
    video.currentTime = t;
  });
}

/** Amostra início, meio e fim do vídeo (arquivo local, antes ou depois do envio) e devolve o veredito do vídeo. */
export async function conferirVideo(arquivo: Blob): Promise<ConteudoFoto | null> {
  const url = URL.createObjectURL(arquivo);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    await new Promise<void>((ok, erro) => {
      video.onloadeddata = () => ok();
      video.onerror = () => erro(new Error("video"));
      video.src = url;
    });
    const minis: (Amostra | null)[] = [];
    for (const t of quadrosDoVideo(video.duration)) minis.push(await quadro(video, t));
    const r = (await conferirMiniaturas(minis)).filter((x): x is ConteudoFoto => !!x);
    return conteudoDoVideo(r);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
