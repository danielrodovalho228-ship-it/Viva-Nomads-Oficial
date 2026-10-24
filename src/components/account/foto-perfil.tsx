"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Minus, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import {
  AVATARS_BUCKET,
  AVATAR_QUALITY,
  FOTO_ACEITA,
  MSG_HEIC,
  ZOOM_MAX,
  ZOOM_MIN,
  avatarPath,
  ehHeic,
  limitarDeslocamento,
  outputSize,
  recorteComZoom,
  validarArquivoAvatar,
} from "@/lib/avatar-image";
import { getMyAvatarUrl, setMyAvatarPath } from "@/lib/data/avatar-actions";
import { cn } from "@/lib/utils";

/*
  CONTA-A — o fluxo ÚNICO da foto de perfil (topo da Conta e todos os convites de foto abrem ESTE fluxo):
  seletor acessível (input sr-only, nunca display:none) → recorte quadrado com arrastar e zoom (teclado: setas movem,
  + e − aproximam) → prévia → "Salvar foto" / "Cancelar". O processamento continua o mesmo (512 px, WebP, sem EXIF).
  HEIC: o navegador que sabe ler (Safari) segue; o que não sabe recebe "Envie em JPG ou PNG".
  Depois de salvar, o evento FOTO_ATUALIZADA leva a nova foto ao topo, ao selo do cabeçalho e ao perfil.
*/

export const FOTO_ATUALIZADA = "vn:foto-atualizada";
export const PERFIL_ATUALIZADO = "vn:perfil-atualizado";

export function avisarFotoAtualizada(url: string | null) {
  window.dispatchEvent(new CustomEvent(FOTO_ATUALIZADA, { detail: { url } }));
  window.dispatchEvent(new Event(PERFIL_ATUALIZADO));
}

/** A minha foto atual, sempre em dia com o fluxo (escuta FOTO_ATUALIZADA). */
export function useMinhaFoto(): { url: string | null; carregado: boolean } {
  const [estado, setEstado] = useState<{ url: string | null; carregado: boolean }>({ url: null, carregado: false });
  useEffect(() => {
    let vivo = true;
    getMyAvatarUrl()
      .then((r) => vivo && setEstado({ url: r.url, carregado: true }))
      .catch(() => vivo && setEstado((e) => ({ ...e, carregado: true })));
    const aoMudar = (e: Event) => setEstado({ url: (e as CustomEvent<{ url: string | null }>).detail?.url ?? null, carregado: true });
    window.addEventListener(FOTO_ATUALIZADA, aoMudar);
    return () => {
      vivo = false;
      window.removeEventListener(FOTO_ATUALIZADA, aoMudar);
    };
  }, []);
  return estado;
}

type Imagem = { fonte: ImageBitmap | HTMLImageElement; url: string; w: number; h: number };

async function abrirImagem(file: File): Promise<Imagem> {
  const url = URL.createObjectURL(file);
  if (typeof createImageBitmap === "function") {
    try {
      const b = await createImageBitmap(file);
      return { fonte: b, url, w: b.width, h: b.height };
    } catch {
      /* cai para o <img> */
    }
  }
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((ok, erro) => {
    img.onload = () => ok();
    img.onerror = () => erro(new Error("decodificar"));
    img.src = url;
  });
  return { fonte: img, url, w: img.naturalWidth, h: img.naturalHeight };
}

async function recortar(im: Imagem, zoom: number, dx: number, dy: number): Promise<Blob> {
  const c = recorteComZoom(im.w, im.h, zoom, dx, dy);
  const lado = outputSize(c.size);
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(im.fonte, c.sx, c.sy, c.size, c.size, 0, 0, lado, lado);
  // Re-codificar pelo canvas descarta o EXIF (inclusive a localização) do arquivo original.
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", AVATAR_QUALITY));
  if (!blob) throw new Error("codificar");
  return blob;
}

/**
 * O botão que abre o fluxo. `variante="camera"`: o botão redondo sobre o avatar do topo; `"botao"`: o botão dos
 * convites ("Adicionar foto"). O seletor de arquivo é um input sr-only (acessível), aberto pelo botão.
 */
export function EnviarFoto({
  temFoto,
  variante = "botao",
  rotulo,
  className,
  testId = "foto-enviar",
  onSalva,
}: {
  temFoto: boolean;
  variante?: "camera" | "botao";
  rotulo?: string;
  className?: string;
  testId?: string;
  onSalva?: () => void;
}) {
  const usuario = useAuthStore((s) => s.user);
  const input = useRef<HTMLInputElement>(null);
  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const texto = rotulo ?? (temFoto ? "Trocar foto" : "Adicionar foto");

  function escolher() {
    setErro(null);
    setOk(null);
    input.current?.click();
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    setOk(null);
    const invalido = validarArquivoAvatar({ type: file.type || (ehHeic(file) ? "image/heic" : ""), size: file.size });
    if (invalido) return setErro(invalido);
    try {
      setImagem(await abrirImagem(file));
    } catch {
      setErro(ehHeic(file) ? `${MSG_HEIC}.` : "Não foi possível abrir esta imagem. Envie em JPG ou PNG.");
    }
  }

  function fechar() {
    if (imagem) {
      URL.revokeObjectURL(imagem.url);
      if ("close" in imagem.fonte && typeof imagem.fonte.close === "function") imagem.fonte.close();
    }
    setImagem(null);
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={FOTO_ACEITA}
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher a foto de perfil"
        onChange={aoEscolher}
        data-testid={`${testId}-input`}
      />
      {variante === "camera" ? (
        <button
          type="button"
          onClick={escolher}
          aria-label={texto}
          title={texto}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-forest text-white outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
            className,
          )}
          data-testid={testId}
        >
          {temFoto ? <Pencil className="h-5 w-5" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
        </button>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={escolher} className={className} data-testid={testId}>
          <Camera className="h-4 w-4" aria-hidden /> {texto}
        </Button>
      )}
      {(erro || ok) && (
        <p role="status" className={cn("mt-2 text-sm", erro ? "text-red-700" : "text-forest")} data-testid={`${testId}-msg`}>
          {erro ?? ok}{" "}
          {erro && (
            <button type="button" onClick={escolher} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2">
              Tentar de novo
            </button>
          )}
        </p>
      )}
      {imagem && usuario && (
        <RecorteFoto
          imagem={imagem}
          userId={usuario.id}
          onCancelar={fechar}
          onErro={(m) => {
            fechar();
            setErro(m);
          }}
          onSalva={() => {
            fechar();
            setOk("Foto atualizada");
            onSalva?.();
          }}
        />
      )}
    </>
  );
}

/** O recorte quadrado (arrastar + zoom), a prévia e "Salvar foto" / "Cancelar". */
function RecorteFoto({ imagem, userId, onCancelar, onSalva, onErro }: { imagem: Imagem; userId: string; onCancelar: () => void; onSalva: () => void; onErro: (m: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const [d, setD] = useState({ dx: 0, dy: 0 });
  const [salvando, setSalvando] = useState(false);
  const arrasto = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const janela = useRef<HTMLDivElement>(null);
  const LADO = 280;

  const mover = (dx: number, dy: number, z = zoom) => setD(limitarDeslocamento(imagem.w, imagem.h, z, dx, dy));
  const aproximar = (z: number) => {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
    setZoom(nz);
    mover(d.dx, d.dy, nz);
  };

  useEffect(() => {
    janela.current?.focus();
  }, []);

  // Geometria da prévia: o recorte ocupa a janela inteira.
  const c = recorteComZoom(imagem.w, imagem.h, zoom, d.dx, d.dy);
  const escala = LADO / c.size;

  async function salvar() {
    setSalvando(true);
    try {
      const blob = await recortar(imagem, zoom, d.dx, d.dy);
      const supabase = createClient();
      if (!supabase) throw new Error("sem-supabase");
      const path = avatarPath(userId);
      const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "0" });
      if (error) {
        const m = (error.message || "").toLowerCase();
        throw new Error(m.includes("bucket") ? "O envio de foto ainda não está habilitado nesta conta." : "Não foi possível enviar a foto agora.");
      }
      const r = await setMyAvatarPath(path);
      if (!r.ok) throw new Error("A foto subiu, mas não foi salva no seu perfil.");
      const nova = await getMyAvatarUrl();
      avisarFotoAtualizada(nova.url);
      onSalva();
    } catch (e) {
      onErro(e instanceof Error && e.message && !["canvas", "codificar", "sem-supabase"].includes(e.message) ? e.message : "Não foi possível processar a imagem.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet open onClose={onCancelar} title="Ajuste sua foto" testId="foto-recorte">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-sm text-muted">Arraste para enquadrar. Use o zoom ou as teclas + e −; as setas também movem.</p>
        <div
          ref={janela}
          tabIndex={0}
          role="img"
          aria-label="Área de recorte da foto"
          className="relative mx-auto mt-3 cursor-move touch-none overflow-hidden rounded-full bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-forest"
          style={{ width: LADO, height: LADO }}
          data-testid="foto-recorte-area"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            arrasto.current = { x: e.clientX, y: e.clientY, dx: d.dx, dy: d.dy };
          }}
          onPointerMove={(e) => {
            const a = arrasto.current;
            if (!a) return;
            // Arrastar a foto para a direita mostra o que está à esquerda: o centro do recorte anda ao contrário.
            mover(a.dx - (e.clientX - a.x) / LADO, a.dy - (e.clientY - a.y) / LADO);
          }}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
          onKeyDown={(e) => {
            const passo = 0.05;
            if (e.key === "ArrowLeft") mover(d.dx - passo, d.dy);
            else if (e.key === "ArrowRight") mover(d.dx + passo, d.dy);
            else if (e.key === "ArrowUp") mover(d.dx, d.dy - passo);
            else if (e.key === "ArrowDown") mover(d.dx, d.dy + passo);
            else if (e.key === "+" || e.key === "=") aproximar(zoom + 0.1);
            else if (e.key === "-") aproximar(zoom - 0.1);
            else return;
            e.preventDefault();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (objectURL), nunca sai do navegador */}
          <img
            src={imagem.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ width: imagem.w * escala, height: imagem.h * escala, left: -c.sx * escala, top: -c.sy * escala }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => aproximar(zoom - 0.1)} aria-label="Afastar" className="grid h-11 w-11 place-items-center rounded-full text-ink">
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.1}
            value={zoom}
            onChange={(e) => aproximar(Number(e.target.value))}
            aria-label="Zoom"
            className="min-w-0 flex-1 accent-forest"
            data-testid="foto-zoom"
          />
          <button type="button" onClick={() => aproximar(zoom + 0.1)} aria-label="Aproximar" className="grid h-11 w-11 place-items-center rounded-full text-ink">
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando} data-testid="foto-cancelar">
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando} data-testid="foto-salvar">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Salvar foto
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
