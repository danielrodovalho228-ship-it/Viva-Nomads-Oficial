/*
  E1100 (ORDEM-DUET-465) — a troca de avaliador pelo dono, com a proposta viva. Fonte única dos textos e da regra da
  confirmação. Antes, "Escolher outro avaliador" descartava o avaliador e a proposta num clique, sem dizer o que se
  perdia e sem volta. Agora:
   • o primeiro clique só abre a confirmação, que escreve o que se perde e se há outro avaliador para escolher;
   • o servidor só descarta com a confirmação explícita (CAMPO_CONFIRMAR_TROCA = "1");
   • depois da troca, a tela diz o que aconteceu e leva o dono à escolha do novo avaliador.
  Regras puras: sem banco, sem tela.
*/
import { dias } from "./pedido-avaliador.ts";
import { SEM_OUTRO_AVALIADOR } from "./espera-de-avaliador.ts";

export const ROTULO_ESCOLHER_OUTRO = "Escolher outro avaliador";
export const ROTULO_CONFIRMAR_TROCA = "Descartar e escolher outro";
export const ROTULO_MANTER_PROPOSTA = "Manter esta proposta";

/** O campo que o formulário da confirmação envia; sem ele, a ação do servidor recusa. */
export const CAMPO_CONFIRMAR_TROCA = "confirmar";
export const ERRO_TROCA_SEM_CONFIRMAR = "Confirme a troca: você perde o avaliador escolhido e a proposta dele.";

export function trocaConfirmada(form: FormData): boolean {
  return form.get(CAMPO_CONFIRMAR_TROCA) === "1";
}

export interface TextoDaTroca {
  titulo: string;
  /** O que se perde, uma linha por item. */
  perde: string[];
  /** O que acontece depois (quantos avaliadores sobram, ou o aviso de que não há outro). */
  depois: string;
  /** Não há outro avaliador para escolher: o pedido fica aguardando. */
  semOutro: boolean;
}

/**
 * O texto da confirmação. `valor` já vem formatado (R$ 380,00). `outros` é quantos avaliadores o dono poderá escolher
 * depois da troca (o descartado não volta); null quando a leitura falhou — aí não se inventa número.
 */
export function textoDaTroca(e: { numero: string | null; valor: string; prazoDias: number; prazoPorExtenso?: string; outros: number | null; cidade: string | null }): TextoDaTroca {
  const onde = e.cidade ? ` em ${e.cidade}` : "";
  const quem = e.numero ? `O avaliador nº ${e.numero}` : "O avaliador escolhido";
  const perde = [
    `${quem} sai deste pedido e não volta a aparecer na lista.`,
    // E1156: com o prazo novo, a tela passa o compromisso por extenso (o mesmo que o dono lê na proposta).
    `A proposta dele é descartada: ${e.valor} · ${e.prazoPorExtenso ?? `laudo em ${dias(e.prazoDias)}`}.`,
    "Não dá para desfazer.",
  ];
  const semOutro = e.outros === 0;
  const depois =
    e.outros === null
      ? "Depois, você escolhe o novo avaliador na lista."
      : e.outros === 0
        ? // E1177: sem a promessa do aviso — quem sai fica fora deste pedido, e a regra não garante que haja outro.
          `Atenção: não há outro avaliador disponível${onde} agora. Se você descartar, o pedido fica aguardando e a equipe da Viva é avisada.`
        : e.outros === 1
          ? `Depois, você escolhe o novo avaliador: há 1 disponível${onde}.`
          : `Depois, você escolhe entre os ${e.outros} avaliadores disponíveis${onde}.`;
  return { titulo: `${ROTULO_ESCOLHER_OUTRO}?`, perde, depois, semOutro };
}

/** O que a tela diz logo depois da troca. `aguardando`: não sobrou avaliador para escolher. */
export function mensagemDepoisDaTroca(aguardando: boolean): string {
  return aguardando
    ? `Avaliador e proposta descartados. ${SEM_OUTRO_AVALIADOR}`
    : "Avaliador e proposta descartados. Escolha o novo avaliador na lista abaixo.";
}

/** A marca (no navegador) de que a troca acabou de ser confirmada neste pedido: a tela seguinte mostra o aviso e foca a escolha. */
export const CHAVE_TROCA_FEITA = "vn-troca-de-avaliador";
