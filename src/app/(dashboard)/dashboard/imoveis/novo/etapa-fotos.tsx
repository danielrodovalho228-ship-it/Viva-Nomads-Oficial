"use client";

import { useEffect } from "react";
import { AlertTriangle, Info, Loader2, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { GuiaFotos } from "@/components/fotos/guia-fotos";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { VideoUploader } from "@/components/video-uploader";
import { MAX_FOTOS_POR_ANUNCIO } from "@/lib/fotos/qualidade";
import { MIN_PHOTOS, SUGGESTED_ROOMS, tierFromPhotoCount, TIER_META } from "@/lib/listing";
import { mensagemFaltamFotosIa, iaFotosLiberada } from "@/lib/ai/fotos-prompt";
import { PHOTOS } from "@/lib/media";
import { cn } from "@/lib/utils";
import { ANCORA_VIDEO_ASSISTENTE } from "@/lib/anuncio/prontidao";
import { Erro } from "./campos";
import type { EstadoIaFotos, FalhaIaFotos } from "./tipos";
import type { ConteudoFoto, EstadoPassoFotos } from "@/lib/fotos/conteudo";

/** Mockup cadastro-imovel-02: a dica embaixo da galeria. */
export const DICA_FOTOS = "Dica: use fotos com boa iluminação e ambiente organizado.";

/** Mockup cadastro-imovel-02: a frase embaixo do "Continuar" neste passo. */
export const FOTOS_REORGANIZAR = "Você pode reorganizar as fotos depois de enviar.";

/** Busca de fotógrafos da cidade do imóvel; com o rascunho salvo, o imóvel vai junto até o "Solicitar orçamento". */
function linkFotografos(cep: string, imovelId?: string | null): string {
  const q = new URLSearchParams();
  if (cep) q.set("cep", cep);
  if (imovelId) {
    q.set("imovel", imovelId);
    q.set("cadastro", "1");
  }
  const s = q.toString();
  return `/parceiros/fotografos${s ? `?${s}` : ""}`;
}

/**
 * Etapa 2 — Fotos (prompt 10): envio como antes (até 40, a 1ª é a capa, sem metadados nem GPS). Ao terminar o
 * envio, com o mínimo de fotos, a IA analisa SOZINHA (uma vez por rascunho) e as sugestões aparecem na etapa 3.
 */
export function EtapaFotos({
  photos,
  setPhotos,
  cep,
  videoUrl,
  setVideoUrl,
  videoArquivo,
  setVideoArquivo,
  videoConteudo,
  setVideoConteudo,
  passoFotos,
  iaEstado,
  iaFalha,
  onTentarDeNovo,
  erroFotos,
  imovelId,
}: {
  /** Rascunho já salvo: o pedido ao fotógrafo nasce ligado a este imóvel (Prompt 31b). */
  imovelId?: string | null;
  photos: PhotoItem[];
  setPhotos: (p: PhotoItem[]) => void;
  cep: string;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  /** Vídeo enviado como arquivo (ordem 8681ae95): caminho no bucket anuncio-videos, "" = sem vídeo. */
  videoArquivo: string;
  setVideoArquivo: (v: string) => void;
  /** E133 (c): triagem do vídeo enviado e a confirmação do dono. */
  videoConteudo?: ConteudoFoto | null;
  setVideoConteudo?: (c: ConteudoFoto | null) => void;
  /** E133: o que trava o "Continuar" deste passo (contagem, foto ou vídeo sinalizado). */
  passoFotos?: EstadoPassoFotos;
  iaEstado: EstadoIaFotos;
  iaFalha?: FalhaIaFotos | null;
  onTentarDeNovo?: () => void;
  erroFotos?: string;
}) {
  // 65-B: "Para melhorar: Vídeo do imóvel" chega com #bloco-video; o bloco só existe depois de o rascunho carregar.
  useEffect(() => {
    if (window.location.hash === `#${ANCORA_VIDEO_ASSISTENTE}`) document.getElementById(ANCORA_VIDEO_ASSISTENTE)?.scrollIntoView({ block: "start" });
  }, []);
  const faltam = Math.max(0, MIN_PHOTOS - photos.length);
  const bloqueado = photos.length < MIN_PHOTOS;
  return (
    <div data-testid="etapa-fotos">
      {/* Mockup cadastro-imovel-02: a galeria logo abaixo do título (foto principal larga, miniaturas e o "+ Adicionar
          foto" tracejado), a dica de luz e, depois, a contagem e o resto do passo. */}
      <PhotoUploader photos={photos} onChange={setPhotos} max={MAX_FOTOS_POR_ANUNCIO} variante="cadastro" imagemVazia={PHOTOS.cadastro.uploadEmpty} />
      <Erro msg={erroFotos} />

      <p className="mt-4 flex items-start gap-2 text-sm text-muted" data-testid="fotos-dica">
        <Info className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
        {DICA_FOTOS}
      </p>

      <div className="mt-4 rounded-xl border border-sage-200 p-4" data-testid="fotos-contagem">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink">
            {photos.length} / {MIN_PHOTOS} fotos
            {bloqueado && <span className="ml-2 text-red-600">{faltam === 1 ? "Falta 1 foto" : `Faltam ${faltam} fotos`}</span>}
          </span>
          {photos.length >= MIN_PHOTOS && (
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", TIER_META[tierFromPhotoCount(photos.length)].tone)}>
              {TIER_META[tierFromPhotoCount(photos.length)].label}
            </span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className={cn("h-full rounded-full transition-all", bloqueado ? "bg-champagne" : "bg-forest")} style={{ width: `${Math.min(100, (photos.length / 20) * 100)}%` }} />
        </div>
        {passoFotos && !passoFotos.podeContinuar && passoFotos.mensagem && (
          <p className="mt-2 text-sm font-semibold text-red-700" data-testid="fotos-trava" data-trava={passoFotos.trava ?? undefined}>
            {passoFotos.mensagem}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          8–11 padrão · 12–19 <strong>Anúncio completo</strong> · 20+ <strong>Anúncio premium</strong> (mais prioridade na busca).
        </p>
      </div>

      <details className="mt-3 rounded-xl border border-sage-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-forest underline">Ver dicas de foto</summary>
        <div className="mt-3">
          <p className="text-sm text-muted">Ambientes que valem uma foto:</p>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="fotos-ambientes">
            {SUGGESTED_ROOMS.map((r) => (
              <span key={r} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
                {r}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <GuiaFotos comCta={false} />
          </div>
        </div>
      </details>

      {/* Prompt 31a: porta para os fotógrafos parceiros da cidade do imóvel (o CEP do cadastro vira a cidade). */}
      <div className="mt-3 rounded-xl border border-sage-200 bg-sage-50 p-3 text-sm" data-testid="porta-fotografo">
        <p className="font-semibold text-ink">Quer um fotógrafo profissional?</p>
        <p className="mt-1 text-muted">Veja os fotógrafos parceiros que atendem a cidade deste imóvel. As fotos vão direto para o anúncio.</p>
        <a href={linkFotografos(cep, imovelId)} target="_blank" rel="noopener" className="mt-1 inline-block font-medium text-forest underline">
          Ver fotógrafos na cidade do imóvel
        </a>
      </div>

      {/* 65-B: o vídeo num bloco próprio, logo depois das fotos e antes da caixa da IA. Nunca bloqueia avançar. */}
      <section id={ANCORA_VIDEO_ASSISTENTE} className="mt-6 scroll-mt-24" data-testid="bloco-video">
        <h3 className="mb-3 font-title text-base font-semibold text-ink">Vídeo do imóvel (opcional)</h3>
        <VideoUploader path={videoArquivo} onChange={setVideoArquivo} videoUrl={videoUrl} onVideoUrlChange={setVideoUrl} conteudo={videoConteudo} onConteudo={setVideoConteudo} />
      </section>

      {/* Análise automática das fotos (uma vez por rascunho). */}
      <div className="mt-4 rounded-xl bg-champagne/10 px-4 py-3 text-sm" data-testid="ia-fotos" data-estado={iaEstado}>
        {!iaFotosLiberada(photos.length) ? (
          <p className="text-forest" data-testid="ia-faltam-fotos">
            <Sparkles className="mr-1 inline h-4 w-4" aria-hidden />
            {mensagemFaltamFotosIa(photos.length)}
          </p>
        ) : iaEstado === "analisando" ? (
          <p className="flex items-center gap-2 text-forest">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando as fotos para preencher o cadastro…
          </p>
        ) : iaEstado === "feita" ? (
          <p className="text-forest">
            <Sparkles className="mr-1 inline h-4 w-4" aria-hidden />
            Pronto: preenchemos o que dá para ver nas fotos. Confira na próxima etapa, tudo marcado com “Sugerido · confira”.
          </p>
        ) : iaEstado === "erro" && iaFalha ? (
          <FalhaIa falha={iaFalha} onTentarDeNovo={onTentarDeNovo} />
        ) : iaEstado === "sem_sugestoes" ? (
          <p className="text-muted">A IA não encontrou o que sugerir nestas fotos. Você preenche na próxima etapa.</p>
        ) : (
          <p className="text-muted">Ao terminar o envio, a IA lê as fotos e sugere o cadastro.</p>
        )}
        <p className="mt-2 text-xs text-muted">
          A IA pode errar e só sugere: nada vai ao anúncio sem você confirmar. Mandamos as fotos em tamanho reduzido, sem
          endereço nem contato.
        </p>
      </div>

      {/* Q7: uma frase só, numa coluna (antes o flex quebrava o texto em 3 colunas no celular). */}
      <p className="mt-2 text-xs text-muted" data-testid="aviso-metadados">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-sage" aria-hidden />
        Removemos os metadados das fotos ao enviar, <strong className="text-ink">inclusive a localização (GPS)</strong>, para o
        endereço exato nunca sair na imagem.
      </p>
    </div>
  );
}

/**
 * Prompt 22: a falha da IA das fotos com o motivo real e "Tentar de novo" (desligada não tem o que tentar: o texto
 * diz que o dono preenche na próxima etapa). Compartilhada com o cartão do passo 1.
 */
export function FalhaIa({ falha, onTentarDeNovo }: { falha: FalhaIaFotos; onTentarDeNovo?: () => void }) {
  return (
    <div className="text-amber-900" role="status" data-testid="ia-fotos-falha" data-motivo={falha.motivo}>
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
        <span>{falha.texto}</span>
      </p>
      {falha.motivo !== "desligada" && falha.motivo !== "limite" && onTentarDeNovo && (
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-forest px-3 py-2 text-sm font-semibold text-forest hover:bg-sage-50"
          data-testid="ia-fotos-tentar-de-novo"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Tentar de novo
        </button>
      )}
    </div>
  );
}
