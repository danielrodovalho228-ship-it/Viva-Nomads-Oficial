/**
 * Lógica pura da linha "Destaques" do Passo 7 (sem tela; testável). Sem dado novo: cada pílula é o mesmo fato dos passos 5 e 6.
 */
export const CHAVE_WIFI_DESTAQUE = "internet_fibra";

export interface EstadoDestaques {
  furnished: boolean;
  petsOk: boolean;
  amenityKeys: Record<string, boolean>;
}

export function destaquesDoAnuncio(e: EstadoDestaques): { chave: "mobiliado" | "wifi" | "pets"; rotulo: string; on: boolean }[] {
  return [
    { chave: "mobiliado", rotulo: "Mobiliado", on: e.furnished },
    { chave: "wifi", rotulo: "Wi-Fi incluído", on: !!e.amenityKeys[CHAVE_WIFI_DESTAQUE] },
    { chave: "pets", rotulo: "Aceita pets", on: e.petsOk },
  ];
}
