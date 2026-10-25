/**
 * Vídeo institucional v3 ("A Viva em 30 segundos"). Player nativo, PARADO e com som: só toca quando a
 * pessoa clica no play (nada de autoplay). Legenda em pt-BR ligada por padrão.
 * D-V (22/10, o play demorava a começar): 720p a ~0,6 Mb/s (2,5 MB, era 1080p e 5 MB) e, no celular, 540p
 * (1,6 MB); os dois com o índice no começo do arquivo (faststart). preload="none" baixa só o cabeçalho
 * (alguns KB) para o play começar na hora, sem baixar o vídeo antes.
 */
export const VIDEO_INSTITUCIONAL = {
  mp4: "/media/institucional.mp4",
  mp4Celular: "/media/institucional-540.mp4",
  poster: "/media/institucional-poster.webp",
  legenda: "/media/institucional.pt-BR.vtt",
} as const;

export function VideoInstitucional({ titulo = "A Viva em 30 segundos", id = "video-institucional" }: { titulo?: string; id?: string }) {
  const tituloId = `${id}-titulo`;
  return (
    <section aria-labelledby={tituloId} data-testid="secao-video-institucional" className="container-page section-y">
      <h2 id={tituloId} className="font-title text-2xl font-semibold text-ink">
        {titulo}
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl bg-night ">
        <video
          data-testid="video-institucional"
          className="aspect-video h-auto w-full"
          controls
          preload="none"
          playsInline
          poster={VIDEO_INSTITUCIONAL.poster}
          aria-label="Vídeo institucional da Viva Nomads: como funciona, em 30 segundos"
        >
          <source src={VIDEO_INSTITUCIONAL.mp4Celular} type="video/mp4" media="(max-width: 767px)" />
          <source src={VIDEO_INSTITUCIONAL.mp4} type="video/mp4" />
          <track kind="captions" srcLang="pt-BR" label="Português (Brasil)" src={VIDEO_INSTITUCIONAL.legenda} default />
        </video>
      </div>
    </section>
  );
}
