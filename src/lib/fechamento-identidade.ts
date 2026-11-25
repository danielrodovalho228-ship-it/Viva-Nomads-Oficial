/*
  E1064 — o que o Fechamento mostra sobre identidade, pela fonte única (identidade/estado.ts). Puro.
  São duas pessoas e duas leituras: a identidade do MORADOR (o selo, o que o dono vê da outra parte) e a verificação
  de QUEM ESTÁ FECHANDO, o dono (o portão do passo 1). Antes o passo exigia sempre o clique "Verificar identidade",
  mesmo com a identidade do dono já confirmada, e o selo não dizia de quem era.
*/
import { identidadeParaOutraParte, type EstadoIdentidade } from "./identidade/estado.ts";

/** O portão do passo 1: já aberto quando a identidade do dono está confirmada e válida (o texto é o da fonte única). */
export function portaoDaIdentidade(propria: EstadoIdentidade | null | undefined): { aberto: boolean; texto: string | null } {
  return propria?.estado === "confirmada" ? { aberto: true, texto: propria.texto } : { aberto: false, texto: null };
}

/** O selo do morador, dizendo de quem é: "Identidade do morador: verificada" / "pendente" / "não conferida agora". */
export function rotuloIdentidadeDoMorador(e: EstadoIdentidade | null | undefined): string {
  const rotulo = identidadeParaOutraParte(e).rotulo; // "Identidade verificada" | "Identidade pendente" | "Identidade não conferida agora"
  return `Identidade do morador: ${rotulo.replace(/^Identidade\s+/, "")}`;
}
