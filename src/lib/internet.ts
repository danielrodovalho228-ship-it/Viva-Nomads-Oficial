/**
 * Qualidade da internet por CATEGORIA DE USO (rodada 20).
 *
 * Em vez de Mbps (número técnico que o proprietário muitas vezes não sabe e que
 * não diz ao inquilino se "aguenta o trabalho"), classificamos a internet por
 * nível de uso — respondendo à pergunta real do profissional. O proprietário
 * escolhe a categoria; o anúncio mostra o benefício.
 */

export type InternetTier = "basica" | "trabalho_remoto" | "home_office";

export interface InternetTierMeta {
  value: InternetTier;
  /** Rótulo curto (escolha no cadastro). */
  label: string;
  /** Descrição clara para o proprietário escolher sem saber o número. */
  description: string;
  /** Frase de benefício exibida no anúncio (linguagem do inquilino). */
  anuncio: string;
  /** Mesma frase quando o anúncio declara internet fibra (não mistura "boa" com "fibra"). */
  anuncioFibra: string;
}

export const INTERNET_TIERS: InternetTierMeta[] = [
  {
    value: "basica",
    label: "Básica",
    description: "Boa para navegar, e-mails e streaming.",
    anuncio: "Internet básica — boa para navegar e streaming.",
    anuncioFibra: "Internet fibra — boa para navegar e streaming.",
  },
  {
    value: "trabalho_remoto",
    label: "Boa para trabalho remoto",
    description: "Aguenta videochamadas e o trabalho do dia a dia.",
    anuncio: "Internet boa para trabalho remoto — aguenta videochamadas.",
    anuncioFibra: "Internet fibra para trabalho remoto — aguenta videochamadas.",
  },
  {
    value: "home_office",
    label: "Excelente para home office",
    description:
      "Ideal para videochamadas pesadas, uploads e vários dispositivos ao mesmo tempo.",
    anuncio:
      "Internet excelente para home office — videochamadas pesadas e vários dispositivos.",
    anuncioFibra:
      "Internet fibra para home office — videochamadas pesadas e vários dispositivos.",
  },
];

export const INTERNET_META: Record<InternetTier, InternetTierMeta> = Object.fromEntries(
  INTERNET_TIERS.map((t) => [t.value, t])
) as Record<InternetTier, InternetTierMeta>;

/**
 * Frase da internet no anúncio. Se o anúncio declara "Internet fibra" (recursos de trabalho
 * ou comodidades), a frase usa o mesmo termo — o ube-005 dizia "fibra" e "boa" ao mesmo tempo.
 */
export function fraseInternetAnuncio(tier: InternetTier, declarados: readonly string[] = []): string {
  const meta = INTERNET_META[tier];
  return declarados.some((d) => /internet fibra/i.test(d)) ? meta.anuncioFibra : meta.anuncio;
}

/**
 * A internet aguenta trabalho? (categoria >= "trabalho_remoto"). É o critério
 * de internet da etiqueta "Para trabalhar de casa" e do selo Pronto para Morar.
 */
export function internetWorksForRemote(tier?: InternetTier | null): boolean {
  return tier === "trabalho_remoto" || tier === "home_office";
}
