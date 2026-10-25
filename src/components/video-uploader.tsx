"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Trash2, Video } from "lucide-react";
import { enviarVideoAnuncio, ErroEnvioVideo, removerVideoAnuncio, VIDEO_ACCEPT } from "@/lib/data/storage-video";
import { erroDoLinkDeVideo, formatarDuracao, GUIA_VIDEO_HREF, segundosDoCaminho, TEXTO_LIMITES_VIDEO } from "@/lib/video-anuncio";
import { useAuthStore } from "@/lib/store";
import { conferirVideo } from "@/lib/fotos/conferir-cliente";
import { AVISO_VIDEO_NAO_IMOVEL, ROTULO_MOTIVO, confirmarConteudo, conteudoPendente, type ConteudoFoto } from "@/lib/fotos/conteudo";
import { conferirLinkVideo } from "@/lib/data/video-link-actions";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";

/**
 * Vídeo do anúncio (ordem 8681ae95; 65-B): 1 por anúncio, até 60 s e 50 MB, MP4/MOV. Funciona pelo celular (abre a
 * câmera ou a galeria) e pelo computador. Opcional: nunca bloqueia publicar.
 * Duas partes: "Enviar um vídeo curto" e, com `onVideoUrlChange`, "Ou colar um link do YouTube ou Vimeo". Com arquivo
 * enviado, a página mostra o arquivo; o link só aparece sem arquivo (videoDoAnuncio).
 * Usado no editor por seções (seção Vídeo) e no passo Fotos do assistente (bloco próprio, antes da caixa da IA).
 */
export function VideoUploader({
  path,
  onChange,
  videoUrl,
  onVideoUrlChange,
  conteudo,
  onConteudo,
  segurarAteConferir = false,
}: {
  path: string;
  onChange: (path: string) => void;
  videoUrl?: string;
  onVideoUrlChange?: (url: string) => void;
  /** E133 (c): a triagem dos quadros do vídeo enviado (início, meio, fim) e a confirmação do dono, se sinalizado. */
  conteudo?: ConteudoFoto | null;
  onConteudo?: (c: ConteudoFoto | null, caminho: string) => void;
  /**
   * Edição de anúncio publicado (o vídeo vai para o anúncio ao gravar): o vídeo novo só é entregue (`onChange`) depois
   * da triagem; sinalizado, fica aqui esperando o dono confirmar ou descartar — nunca aparece no anúncio antes.
   */
  segurarAteConferir?: boolean;
}) {
  const ownerId = useAuthStore((s) => s.user?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  // `arquivo`: queda de rede — o mesmo arquivo pode ir de novo pelo "Tentar de novo".
  const [erro, setErro] = useState<{ texto: string; arquivo: File | null } | null>(null);
  const segundos = segundosDoCaminho(path);
  const erroFormato = erroDoLinkDeVideo(videoUrl ?? "");
  // E133 (d): o link de formato válido é conferido no provedor (existe e pode ser incorporado).
  const [linkConferido, setLinkConferido] = useState<{ url: string; ok: boolean; erro?: string } | null>(null);
  const [conferindoLink, setConferindoLink] = useState(false);
  const [conferindoVideo, setConferindoVideo] = useState(false);
  // Vídeo enviado e sinalizado que ainda não foi entregue (só com segurarAteConferir).
  const [segurado, setSegurado] = useState<{ caminho: string; conteudo: ConteudoFoto } | null>(null);
  const linkAtual = (videoUrl ?? "").trim();
  useEffect(() => {
    if (!linkAtual || erroFormato || !onVideoUrlChange) return;
    if (linkConferido?.url === linkAtual) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setConferindoLink(true);
      const r = await conferirLinkVideo(linkAtual).catch(() => ({ ok: false as const, erro: "Não conseguimos conferir o vídeo agora. Tente de novo em instantes." }));
      if (!vivo) return;
      setConferindoLink(false);
      setLinkConferido({ url: linkAtual, ok: r.ok, erro: r.ok ? undefined : r.erro });
    }, 700);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [linkAtual, erroFormato, onVideoUrlChange, linkConferido?.url]);
  const erroLink = erroFormato ?? (linkConferido?.url === linkAtual && !linkConferido.ok ? linkConferido.erro ?? null : null);
  const linkOk = !erroFormato && linkConferido?.url === linkAtual && linkConferido.ok;

  async function escolher(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setEnviando(true);
    try {
      const novo = await enviarVideoAnuncio(file, ownerId);
      const antigo = path;
      if (segurarAteConferir && onConteudo) {
        // E133 (c), edição: confere ANTES de entregar; sinalizado fica segurado até o dono decidir.
        setConferindoVideo(true);
        const c = await conferirVideo(file).catch(() => null);
        setConferindoVideo(false);
        if (conteudoPendente(c)) {
          if (segurado) await removerVideoAnuncio(segurado.caminho);
          setSegurado({ caminho: novo, conteudo: c! });
          return;
        }
        onChange(novo);
        onConteudo(c, novo);
      } else {
        onChange(novo);
        // E133 (c): início, meio e fim do vídeo passam pela mesma conferência das fotos.
        if (onConteudo) {
          setConferindoVideo(true);
          onConteudo(await conferirVideo(file).catch(() => null), novo);
          setConferindoVideo(false);
        }
      }
      if (antigo) await removerVideoAnuncio(antigo); // troca: o anterior sai do bucket
    } catch (e) {
      const tentarDeNovo = e instanceof ErroEnvioVideo && e.tentarDeNovo;
      setErro({ texto: e instanceof Error ? e.message : "Não foi possível enviar o vídeo agora.", arquivo: tentarDeNovo ? file : null });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    const antigo = path;
    onChange("");
    onConteudo?.(null, "");
    await removerVideoAnuncio(antigo);
  }

  return (
    <div className="space-y-4" data-testid="video-uploader">
      <div className="rounded-xl border border-sage-200 p-4">
        <p className="text-sm font-semibold text-ink">Enviar um vídeo curto</p>
        <p className="mt-1 text-xs text-muted" data-testid="video-limites">{TEXTO_LIMITES_VIDEO}</p>
        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          className="sr-only"
          data-testid="video-input"
          aria-label="Escolher vídeo do imóvel"
          onChange={(e) => void escolher(e.target.files?.[0])}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest px-4 text-sm font-medium text-forest disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            {enviando ? "Enviando…" : path ? "Trocar vídeo" : "Enviar vídeo"}
          </button>
          {path && !enviando && (
            <>
              <span className="text-sm text-forest" data-testid="video-enviado">
                Vídeo enviado{segundos != null ? ` (${formatarDuracao(segundos)})` : ""}
              </span>
              <button type="button" onClick={() => void remover()} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-red-600 underline" data-testid="video-remover">
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            </>
          )}
        </div>
        {conferindoVideo && (
          <p className="mt-2 text-sm text-muted" data-testid="video-conferindo">
            Conferindo se o vídeo mostra o imóvel…
          </p>
        )}
        {segurado && (
          <div role="alert" className="mt-3 rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-800" data-testid="aviso-video-nao-imovel">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong>{AVISO_VIDEO_NAO_IMOVEL}.</strong> {segurado.conteudo.motivo ? ROTULO_MOTIVO[segurado.conteudo.motivo] : ""} Ele só vai para o anúncio se
                você confirmar.
              </span>
            </p>
            <span className="mt-2 flex flex-wrap items-start gap-2">
              <ConfirmarNaPagina
                aviso="Confirmo que este vídeo mostra o imóvel anunciado."
                confirmar="Confirmo, é do imóvel"
                onConfirmar={async () => {
                  const s2 = segurado;
                  setSegurado(null);
                  const antigo = path;
                  onChange(s2.caminho);
                  onConteudo?.(confirmarConteudo(s2.conteudo), s2.caminho);
                  if (antigo) await removerVideoAnuncio(antigo);
                }}
                size="sm"
                variant="ghost"
                testid="video-nao-imovel-confirmar"
              >
                É do imóvel
              </ConfirmarNaPagina>
              <button
                type="button"
                className="min-h-11 font-semibold text-red-700 underline underline-offset-4"
                onClick={async () => {
                  const s2 = segurado;
                  setSegurado(null);
                  await removerVideoAnuncio(s2.caminho);
                }}
                data-testid="video-nao-imovel-descartar"
              >
                Descartar este vídeo
              </button>
            </span>
          </div>
        )}
        {!segurado && path && conteudoPendente(conteudo) && (
          <div role="alert" className="mt-3 rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-800" data-testid="aviso-video-nao-imovel">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong>{AVISO_VIDEO_NAO_IMOVEL}.</strong> {conteudo?.motivo ? ROTULO_MOTIVO[conteudo.motivo] : ""} Ele não deixa publicar até você trocar,
                remover ou confirmar.
              </span>
            </p>
            <span className="mt-2 flex flex-wrap items-start gap-2">
              <ConfirmarNaPagina
                aviso="Confirmo que este vídeo mostra o imóvel anunciado."
                confirmar="Confirmo, é do imóvel"
                onConfirmar={() => conteudo && onConteudo?.(confirmarConteudo(conteudo), path)}
                size="sm"
                variant="ghost"
                testid="video-nao-imovel-confirmar"
              >
                É do imóvel
              </ConfirmarNaPagina>
            </span>
          </div>
        )}
        {path && conteudo?.naoImovel && conteudo.confirmadaEm && (
          <p className="mt-2 text-xs text-muted" data-testid="video-conteudo-confirmado">
            Você confirmou que o vídeo é do imóvel.
          </p>
        )}
        {erro && (
          <div className="mt-2">
            <p role="alert" className="text-sm text-red-600" data-testid="video-erro">
              {erro.texto}
            </p>
            {erro.arquivo && !enviando && (
              <button
                type="button"
                onClick={() => void escolher(erro.arquivo ?? undefined)}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-forest px-3 text-sm font-semibold text-forest"
                data-testid="video-tentar-de-novo"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Tentar de novo
              </button>
            )}
          </div>
        )}
      </div>

      {onVideoUrlChange && (
        <div className="rounded-xl border border-sage-200 p-4">
          <label className="block text-sm font-semibold text-ink" htmlFor="video-link">
            Ou colar um link do YouTube ou Vimeo
          </label>
          <input
            id="video-link"
            className="input mt-2"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={videoUrl ?? ""}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            aria-invalid={!!erroLink}
            data-testid="video-link"
          />
          {erroLink ? (
            <p role="alert" className="mt-2 text-sm text-red-600" data-testid="video-link-erro">{erroLink}</p>
          ) : conferindoLink ? (
            <p className="mt-2 text-xs text-muted" data-testid="video-link-conferindo">
              Conferindo o vídeo…
            </p>
          ) : linkOk && !path ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-muted" data-testid="video-link-ok">
              <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
              Vídeo encontrado. Ele aparece no anúncio depois que a equipe conferir que mostra o imóvel.
            </p>
          ) : (
            path && videoUrl?.trim() && <p className="mt-2 text-xs text-muted">Com um vídeo enviado, o anúncio mostra o vídeo enviado. O link fica guardado.</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted">
        Dúvidas?{" "}
        <Link href={GUIA_VIDEO_HREF} target="_blank" className="font-medium text-forest underline" data-testid="video-ajuda">
          Como pôr um vídeo no anúncio
        </Link>
      </p>
    </div>
  );
}
