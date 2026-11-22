/*
  E1079 (ORDEM-DUET-385), fatia 4 — a visita do avaliador, como no mockup aprovado (avaliador-visita): os textos da tela,
  o "Roteiro da visita" e as vagas da grade de fotos. PURO (testado em e1079-visita-avaliador.test.ts).
  O roteiro não cria dado novo: fica marcado pelo que o avaliador já enviou em "Fotos dos cômodos" (o nome do cômodo é
  texto livre, como antes).
*/
export const TITULO_VISITA = "Visita em andamento";
export const TITULO_ROTEIRO = "Roteiro da visita";
export const TITULO_FOTOS_VISITA = "Fotos do imóvel";
export const ROTULO_ADICIONAR_FOTO = "Adicionar foto";
export const ROTULO_CONTINUAR = "Continuar";

/** As linhas do roteiro, na ordem do desenho; `pistas` são as palavras que o nome do cômodo traz. */
export const ROTEIRO_DA_VISITA = [
  { id: "fachada", rotulo: "Fotos da fachada", pistas: ["fachada"] },
  { id: "sala", rotulo: "Sala", pistas: ["sala"] },
  { id: "cozinha", rotulo: "Cozinha", pistas: ["cozinha"] },
  { id: "quartos", rotulo: "Quartos", pistas: ["quarto", "quartos", "suite", "suites"] },
  { id: "banheiros", rotulo: "Banheiros", pistas: ["banheiro", "banheiros", "lavabo"] },
] as const;

export interface LinhaRoteiro {
  id: (typeof ROTEIRO_DA_VISITA)[number]["id"];
  rotulo: string;
  /** Já há foto desse cômodo. */
  feito: boolean;
}

const palavras = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** O roteiro marcado pelas fotos de cômodo já enviadas (foto de item não conforme não tem cômodo e não conta). */
export function roteiroDaVisita(comodos: readonly (string | null | undefined)[]): LinhaRoteiro[] {
  const ditas = new Set(comodos.flatMap((c) => (c ? palavras(c) : [])));
  return ROTEIRO_DA_VISITA.map((r) => ({ id: r.id, rotulo: r.rotulo, feito: r.pistas.some((p) => ditas.has(p)) }));
}

/** Quantas vagas "Adicionar foto" a grade mostra: completa a linha de 3; com a linha cheia (ou vazia), uma linha nova. */
export function vagasDeFoto(nFotos: number): number {
  const resto = Math.max(0, nFotos) % 3;
  return resto === 0 ? 3 : 3 - resto;
}
