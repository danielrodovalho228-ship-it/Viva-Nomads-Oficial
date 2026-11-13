/*
  E870 — o que a busca conta e calcula, dito de um jeito que a visitante consegue conferir. PURO.
   • Contagens do "Mais filtros" são facetadas: com algo marcado, cada número já conta com o que está marcado.
   • Sem tempo de rota (linha reta), "até N min" só tira quem, nem na velocidade máxima do modo, chegaria a tempo — a mesma
     conta de `foraDoTempoPelaReta`; o cartão mostra a distância em linha reta, não o tempo.
*/
import { VELOCIDADE_MAX_KMH, type ModoRota } from "../rotas/tempo.ts";

export const TEXTO_CONTAGEM_FACETADA = "Os números já contam com os filtros marcados: mudam quando você marca ou desmarca outro.";

/** O alcance em linha reta (km, 1 casa) que o limite "até N min" usa sem rota. */
export function alcanceSemRotaKm(modo: ModoRota, ateMin: number): number {
  return Math.round(((VELOCIDADE_MAX_KMH[modo] * ateMin) / 60) * 10) / 10;
}

const COMO: Record<ModoRota, string> = { carro: "de carro", a_pe: "a pé", bicicleta: "de bicicleta", onibus: "de ônibus" };
const km = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function textoLimiteSemRota(modo: ModoRota, ateMin: number): string {
  return (
    `Tempo de deslocamento indisponível agora. O limite "até ${ateMin} min ${COMO[modo]}" tira só quem fica a mais de ` +
    `${km(alcanceSemRotaKm(modo, ateMin))} km em linha reta — longe demais até a ${VELOCIDADE_MAX_KMH[modo]} km/h. ` +
    `Os cartões mostram a distância em linha reta, não o tempo.`
  );
}
