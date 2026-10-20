import type { UploadedPhoto } from "@/lib/data/storage";
import { validarArquivoFotoImovel } from "@/lib/upload-limits";
import { tratarFoto } from "@/lib/fotos/processar";
import { avisosDaFoto, type AvisoFoto } from "@/lib/fotos/qualidade";

/** Foto da galeria do anúncio (o mesmo formato do `PhotoUploader`). */
export interface FotoEnviada extends UploadedPhoto {
  id: string;
  name: string;
  hash?: string;
  assinatura?: string;
  avisos?: AvisoFoto[];
  melhorada?: boolean;
}

/**
 * Envio das fotos do anúncio — UM caminho só (prompt 20): a galeria do passo 2, o cartão "Preencher com IA" do
 * passo 1 e a barra de fotos do celular usam esta função. Mesma validação (JPG/PNG/WebP até o limite), mesmo
 * tratamento (rotação, tamanho, exposição), mesmos avisos de qualidade e de foto repetida.
 */
export async function enviarFotos(
  files: File[],
  opts: {
    atuais: FotoEnviada[];
    max: number;
    ownerId?: string;
    tratar?: boolean;
    uploader: (file: File, ownerId?: string) => Promise<UploadedPhoto>;
    aoProgresso?: (feitas: number, total: number) => void;
  },
): Promise<{ novas: FotoEnviada[]; originais: Record<string, File>; erro: string | null }> {
  const { atuais, max, ownerId, tratar = true, uploader, aoProgresso } = opts;
  const slots = Math.max(0, max - atuais.length);
  const escolhidas = files.slice(0, slots);
  let erro: string | null = null;
  const novas: FotoEnviada[] = [];
  const originais: Record<string, File> = {};
  const outras: { id: string; hash?: string; assinatura?: string }[] = atuais
    .filter((p) => p.hash || p.assinatura)
    .map((p) => ({ id: p.id, hash: p.hash, assinatura: p.assinatura }));
  let feitas = 0;
  aoProgresso?.(0, escolhidas.length);
  for (const file of escolhidas) {
    const invalido = validarArquivoFotoImovel({ type: file.type, size: file.size, name: file.name });
    if (invalido) {
      erro = invalido;
    } else {
      const t = tratar ? await tratarFoto(file) : null;
      try {
        const result = await uploader(t?.arquivo ?? file, ownerId);
        const id = crypto.randomUUID();
        const item: FotoEnviada = { ...result, id, name: file.name };
        if (t?.analise) {
          item.hash = t.analise.hash;
          item.assinatura = t.analise.assinatura;
          item.avisos = avisosDaFoto(t.analise, outras);
          item.melhorada = t.melhorada;
          outras.push({ id, hash: t.analise.hash, assinatura: t.analise.assinatura });
        }
        if (t?.melhorada) originais[id] = t.original;
        novas.push(item);
      } catch (e) {
        erro = e instanceof Error ? e.message : "Não foi possível enviar a foto agora.";
      }
    }
    feitas += 1;
    aoProgresso?.(feitas, escolhidas.length);
  }
  if (files.length > slots) erro = `Limite de ${max} fotos: as que passaram disso não foram enviadas.`;
  return { novas, originais, erro };
}
