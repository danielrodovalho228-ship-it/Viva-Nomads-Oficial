"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Fase = "carregando" | "pronta" | "erro";

/**
 * E469 (PC13): imagem que NÃO nasce cinza, borrada nem em branco. Enquanto o arquivo chega, a moldura mostra o fundo
 * claro com um indicador (e, se houver, um aviso como "Gerando a prévia…"); a foto entra inteira e nítida quando
 * termina de carregar. O `src` não muda (nada de otimizador no meio): os testes e a página pública seguem com a
 * mesma URL. A moldura recebe o tamanho/arredondamento; a <img> ocupa a moldura.
 */
export function ImagemNitida({
  src,
  alt,
  moldura = "",
  className = "",
  aviso,
  ...resto
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onLoad" | "onError"> & { src: string; alt: string; moldura?: string; aviso?: string }) {
  const [estado, setEstado] = useState<{ src: string; fase: Fase }>({ src, fase: "carregando" });
  // Trocou a imagem (nova versão, nova foto): volta a "carregando" sem esperar efeito.
  const fase: Fase = estado.src === src ? estado.fase : "carregando";
  const marcar = (f: Fase) => setEstado((e) => (e.src === src && e.fase === f ? e : { src, fase: f }));
  return (
    <span className={`relative block overflow-hidden bg-surface ${moldura}`} data-imagem-fase={fase}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem do armazenamento/gerada no servidor, já no tamanho de uso */}
      <img
        {...resto}
        // Já em cache (ou carregada antes da hidratação): o onLoad não dispara de novo.
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0 && fase === "carregando") marcar("pronta");
        }}
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => marcar("pronta")}
        onError={() => marcar("erro")}
        className={`${className} transition-opacity duration-200 ${fase === "pronta" ? "opacity-100" : "opacity-0"}`}
      />
      {fase === "carregando" && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-muted" data-testid="imagem-carregando">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          {aviso && <span>{aviso}</span>}
        </span>
      )}
      {fase === "erro" && (
        <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted" role="status">
          Não foi possível carregar a imagem.
        </span>
      )}
    </span>
  );
}
