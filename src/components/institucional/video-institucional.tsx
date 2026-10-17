/**
 * Vídeo institucional v3 ("A Viva em 30 segundos"). Player nativo, PARADO e com som: só toca quando a
 * pessoa clica no play (nada de autoplay). preload="none": o mp4 não baixa antes do play; a capa (poster)
 * é a única coisa que carrega. Legenda em pt-BR ligada por padrão.
 */
export const VIDEO_INSTITUCIONAL = {
  mp4: "/media/institucional.mp4",
  poster: "/media/institucional-poster.webp",
  legenda: "/media/institucional.pt-BR.vtt",
} as const;

export function VideoInstitucional({ titulo = "A Viva em 30 segundos", id = "video-institucional" }: { titulo?: string; id?: string }) {
  const tituloId = `${id}-titulo`;
  return (
    <section aria-labelledby={tituloId} data-testid="secao-video-institucional" className="container-page section-y">
      <h2 id={tituloId} className="font-title text-2xl font-bold text-ink sm:text-3xl">
        {titulo}
      </h2>
      <div className="mt-5 overflow-hidden rounded-2xl bg-night shadow-sm">
        <video
          data-testid="video-institucional"
          className="aspect-video h-auto w-full"
          controls
          preload="none"
          playsInline
          poster={VIDEO_INSTITUCIONAL.poster}
          aria-label="Vídeo institucional da Viva Nomads: como funciona, em 30 segundos"
        >
          <source src={VIDEO_INSTITUCIONAL.mp4} type="video/mp4" />
          <track kind="captions" srcLang="pt-BR" label="Português (Brasil)" src={VIDEO_INSTITUCIONAL.legenda} default />
        </video>
      </div>
    </section>
  );
}
