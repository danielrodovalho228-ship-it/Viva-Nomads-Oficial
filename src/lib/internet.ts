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
}

export const INTERNET_TIERS: InternetTierMeta[] = [
  {
    value: "basica",
    label: "Básica",
    description: "Boa para navegar, e-mails e streaming.",
    anuncio: "Internet básica — boa para navegar e streaming.",
  },
  {
    value: "trabalho_remoto",
    label: "Boa para trabalho remoto",
    description: "Aguenta videochamadas e o trabalho do dia a dia.",
    anuncio: "Internet boa para trabalho remoto — aguenta videochamadas.",
  },
  {
    value: "home_office",
    label: "Excelente para home office",
    description:
      "Ideal para videochamadas pesadas, uploads e vários dispositivos ao mesmo tempo.",
    anuncio:
      "Internet excelente para home office — videochamadas pesadas e vários dispositivos.",
  },
];

export const INTERNET_META: Record<InternetTier, InternetTierMeta> = Object.fromEntries(
  INTERNET_TIERS.map((t) => [t.value, t])
) as Record<InternetTier, InternetTierMeta>;

/**
 * A internet aguenta trabalho? (categoria >= "trabalho_remoto"). É o critério
 * de internet da etiqueta "Para trabalhar de casa" e do selo Pronto para Morar.
 */
export function internetWorksForRemote(tier?: InternetTier | null): boolean {
  return tier === "trabalho_remoto" || tier === "home_office";
}
