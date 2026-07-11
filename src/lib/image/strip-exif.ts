"use client";

/**
 * Remove os metadados (EXIF) de uma imagem re-codificando-a via <canvas>.
 *
 * Por quê: foto de imóvel tirada no celular embute GPS no EXIF — ou seja, o
 * ENDEREÇO EXATO do imóvel. Como a regra é só liberar o endereço após o aceite,
 * publicar a foto com GPS vazaria isso. O desenho do <canvas> + re-encode
 * DESCARTA todo o EXIF (inclusive geolocalização), como já fazemos na foto de
 * perfil (item 3 do QA — "vale dobrado para fotos do imóvel").
 *
 * Mantém a proporção; limita a maior dimensão a MAX_DIM (reduz peso sem crop).
 * Se a imagem não puder ser decodificada, devolve o arquivo original — mas o
 * bucket só aceita jpeg/png/webp (todos decodificáveis), então na prática o
 * caminho de fallback não sobe foto com EXIF.
 */
const MAX_DIM = 1920;
const QUALITY = 0.85;

export async function stripImageExif(file: File): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await loadBitmap(file);
    const maior = Math.max(bitmap.width, bitmap.height) || 1;
    const escala = Math.min(1, MAX_DIM / maior);
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob) return file;
    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* cai para o fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img-load"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
