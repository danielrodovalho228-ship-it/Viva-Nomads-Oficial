/*
  Fotos das categorias do catálogo de serviços do morador (complemento da ordem 521c5af7). O Moacir fornece as 4, em
  public/images/servicos/<id>.webp, formato 4:3. Cartão SEM foto não aparece: nada de ícone no lugar da foto. Ao
  receber cada foto, ponha o arquivo na pasta e a entrada aqui (o teste confere que o arquivo existe e é 4:3).
  Esperadas: limpeza.webp, lavanderia_enxoval.webp, frete_mudanca.webp, assistencia_24h.webp.
*/
export interface FotoServico {
  src: string;
  alt: string;
}

export const FOTOS_SERVICOS: Readonly<Record<string, FotoServico>> = {};

export const FOTOS_ESPERADAS = ["limpeza", "lavanderia_enxoval", "frete_mudanca", "assistencia_24h"] as const;

export function fotoDoServico(id: string): FotoServico | null {
  return FOTOS_SERVICOS[id] ?? null;
}
