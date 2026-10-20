"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AVATAR_ACCEPT, MAX_AVATAR_BYTES, validarArquivoAvatar } from "@/lib/avatar-image";
import { recorteImagem, type TipoImagemParceiro } from "@/lib/parceiros/regras";
import { enviarImagemParceiro } from "@/lib/parceiros/painel-actions";

/**
 * Foto, capa ou galeria da página do parceiro (Prompt 31a): mesmo cuidado do envio de avatar — recorte central,
 * redução de tamanho e regravação em WebP no navegador (apaga o EXIF). O servidor confere de novo (WebP, 5 MB).
 */
async function paraWebp(file: File, tipo: TipoImagemParceiro): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const r = recorteImagem(bmp.width, bmp.height, tipo);
  const canvas = document.createElement("canvas");
  canvas.width = r.ow;
  canvas.height = r.oh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, 0, 0, r.ow, r.oh);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("webp");
  return blob;
}

export function EnviarImagemParceiro({
  tipo,
  rotulo,
  onEnviado,
  legenda,
  testid,
}: {
  tipo: TipoImagemParceiro;
  rotulo: string;
  /** Recebe a imagem gravada (na galeria, com o id e a legenda) — a tela mostra na hora, sem esperar o recarregamento. */
  onEnviado: (r: { url: string; id: string | null; legenda: string | null }) => void;
  /** Só galeria: a legenda digitada antes de escolher a foto. */
  legenda?: string;
  testid?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);
  // A gravação roda numa transição: a revalidação da página não troca a tela pelo "carregando" (que desmontava o
  // painel e perdia a prévia da foto recém-enviada).
  const [gravando, iniciar] = useTransition();
  const enviando = preparando || gravando;
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(file: File | undefined) {
    if (!file) return;
    setErro(null);
    const problema = validarArquivoAvatar({ type: file.type, size: file.size });
    if (problema) return setErro(problema);
    setPreparando(true);
    let blob: Blob;
    try {
      blob = await paraWebp(file, tipo);
    } catch {
      setPreparando(false);
      setErro("Não foi possível ler esta imagem. Tente outra (JPG, PNG ou WebP).");
      return;
    } finally {
      if (ref.current) ref.current.value = "";
    }
    setPreparando(false);
    const fd = new FormData();
    fd.set("tipo", tipo);
    fd.set("arquivo", blob, `${tipo}.webp`);
    if (legenda) fd.set("legenda", legenda);
    iniciar(async () => {
      const r = await enviarImagemParceiro(fd).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (r.ok) onEnviado(r.valor);
      else setErro(r.erro);
    });
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={AVATAR_ACCEPT.join(",")}
        className="sr-only"
        aria-label={rotulo}
        data-testid={testid ? `${testid}-arquivo` : undefined}
        onChange={(e) => void escolher(e.target.files?.[0])}
      />
      <Button type="button" variant="secondary" size="sm" disabled={enviando} onClick={() => ref.current?.click()} data-testid={testid}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />} {rotulo}
      </Button>
      <p className="mt-1 text-xs text-muted">JPG, PNG ou WebP até {Math.round(MAX_AVATAR_BYTES / 1024 / 1024)} MB. Recortamos e reduzimos aqui mesmo.</p>
      {erro && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
