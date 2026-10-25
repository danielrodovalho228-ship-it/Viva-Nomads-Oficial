"use client";

/*
  E133 — o lado do navegador da conferência "é do imóvel?": prepara miniaturas (fotos já enviadas e 3 quadros do vídeo)
  e chama /api/fotos/conferir em lotes de até 6. Falha de rede ou da rota = null (a foto fica sem conferência e não
  trava; a regra que trava é só a da foto SINALIZADA).
*/
import { miniaturaBase64 } from "./miniatura";
import { FOTOS_LADO_MAX_PX, FOTOS_MAX_MINIATURAS } from "../ai/fotos-prompt";
import { conteudoDoVideo, quadrosDoVideo, type ConteudoFoto } from "./conteudo";

export async function conferirMiniaturas(minis: (string | null)[]): Promise<(ConteudoFoto | null)[]> {
  const saida: (ConteudoFoto | null)[] = minis.map(() => null);
  const validos = minis.map((m, i) => ({ m, i })).filter((x): x is { m: string; i: number } => !!x.m);
  for (let k = 0; k < validos.length; k += FOTOS_MAX_MINIATURAS) {
    const lote = validos.slice(k, k + FOTOS_MAX_MINIATURAS);
    try {
      const res = await fetch("/api/fotos/conferir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miniaturas: lote.map((x) => x.m) }),
      });
      if (!res.ok) continue;
      const { resultados } = (await res.json()) as { resultados?: ConteudoFoto[] };
      lote.forEach((x, j) => (saida[x.i] = resultados?.[j] ?? null));
    } catch {
      /* sem conferência: a foto segue sem aviso */
    }
  }
  return saida;
}

/** Confere fotos já enviadas (pela URL pública). */
export async function conferirFotos(urls: string[]): Promise<(ConteudoFoto | null)[]> {
  const minis = await Promise.all(urls.map((u) => miniaturaBase64(u, FOTOS_LADO_MAX_PX)));
  return conferirMiniaturas(minis);
}

/** Um quadro do vídeo (no instante `t`) em JPEG base64. */
function quadro(video: HTMLVideoElement, t: number, ladoMax: number): Promise<string | null> {
  return new Promise((ok) => {
    const fim = () => {
      try {
        const k = Math.min(1, ladoMax / Math.max(video.videoWidth || 1, video.videoHeight || 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((video.videoWidth || 1) * k));
        c.height = Math.max(1, Math.round((video.videoHeight || 1) * k));
        c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", 0.7).split(",")[1] || null);
      } catch {
        ok(null);
      }
    };
    video.addEventListener("seeked", fim, { once: true });
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
    const minis: (string | null)[] = [];
    for (const t of quadrosDoVideo(video.duration)) minis.push(await quadro(video, t, FOTOS_LADO_MAX_PX));
    const r = (await conferirMiniaturas(minis)).filter((x): x is ConteudoFoto => !!x);
    return conteudoDoVideo(r);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
