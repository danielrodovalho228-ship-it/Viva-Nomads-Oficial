/*
  Prompt 22: quando reduzir a imagem do documento antes da leitura pela IA. O limite da API para imagem é menor que
  o de PDF (5 MB por imagem, já em base64, e lados grandes são reduzidos do lado de lá); foto de celular de matrícula
  passa disso com facilidade. Reduzimos acima de ~3,7 MB (≈ 5 MB em base64) ou de IMAGEM_LADO_MAX_PX no maior lado.
*/
export const IMAGEM_LADO_MAX_PX = 2400;
export const IMAGEM_MAX_BYTES_ENVIO = Math.floor((5 * 1024 * 1024 * 3) / 4) - 64 * 1024;

export function precisaReduzirImagem(bytes: number, largura: number, altura: number): boolean {
  return bytes > IMAGEM_MAX_BYTES_ENVIO || Math.max(largura, altura) > IMAGEM_LADO_MAX_PX;
}
