/*
  E422 + E423 (reprova consolidada 01/11) — o diálogo de visita escolhe a modalidade.
  Antes, cada botão abria um diálogo preso à sua modalidade. Com uma visita por vídeo já confirmada (o caso da conta
  de QA, confirmada para 03/11), o botão "Visita por vídeo" aparecia no 1º desenho e, quando a consulta chegava, virava
  "Visita agendada"; sobrava só o diálogo presencial, que gravava presencial sem dizer nada sobre o vídeo. Agora o
  diálogo mostra as duas opções, diz qual está ocupada e por quê, e o rodapé do celular abre na que estiver livre.
  PURO. Roda: node --test src/lib/visitas/escolha-modalidade.test.ts
*/
import type { EstadoVisitaAnuncio, ModalidadeVisita } from "../visitas-video.ts";
import { explicacaoPedidoAberto } from "./um-pedido-aberto.ts";

export type EstadosVisita = Partial<Record<ModalidadeVisita, EstadoVisitaAnuncio>>;

export interface OpcaoModalidade {
  modalidade: ModalidadeVisita;
  rotulo: string;
  livre: boolean;
  /** Por que a opção está ocupada (null quando livre). */
  motivo: string | null;
}

const ORDEM: ModalidadeVisita[] = ["presencial", "video"];
const ROTULO: Record<ModalidadeVisita, string> = { presencial: "Presencial", video: "Por vídeo" };

/** Uma visita confirmada que já passou ainda conta como aberta no banco até o dono marcar como feita. */
function motivoOcupada(modalidade: ModalidadeVisita, estado: EstadoVisitaAnuncio): string {
  if (estado === "ver")
    return `Sua visita ${modalidade === "video" ? "por vídeo" : "presencial"} já aconteceu e ainda aparece em Visitas. Veja lá antes de pedir outra.`;
  return explicacaoPedidoAberto(modalidade, estado);
}

export function opcoesDeModalidade(estados: EstadosVisita): OpcaoModalidade[] {
  return ORDEM.map((m) => {
    const e = estados[m];
    return { modalidade: m, rotulo: ROTULO[m], livre: !e, motivo: e ? motivoOcupada(m, e) : null };
  });
}

/** A modalidade em que o diálogo abre: a pedida, se livre; senão a outra, se livre; senão nenhuma. */
export function modalidadeInicial(preferida: ModalidadeVisita, estados: EstadosVisita): ModalidadeVisita | null {
  if (!estados[preferida]) return preferida;
  const outra: ModalidadeVisita = preferida === "video" ? "presencial" : "video";
  return estados[outra] ? null : outra;
}

/** "Agendar visita" do rodapé do celular: abre o diálogo se houver modalidade livre; senão leva a Visitas. */
export function destinoDoRodape(estados: EstadosVisita): ModalidadeVisita | "visitas" {
  return modalidadeInicial("presencial", estados) ?? "visitas";
}

/** "2026-11-03T10:00" (o campo, já em Brasília) → "03/11 às 10:00". Valor estranho volta como veio. */
export function rotuloCampoBrasilia(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]} às ${m[4]}:${m[5]}` : valor;
}

/** E424: a confirmação na tela, com os horários propostos (já no texto de Brasília). */
export function confirmacaoNaTela(modalidade: ModalidadeVisita, horarios: string[]): string {
  const tipo = modalidade === "video" ? "por vídeo" : "presencial";
  const quando = horarios.length ? ` Horários propostos: ${horarios.join("; ")} (horário de Brasília).` : "";
  const depois =
    modalidade === "video"
      ? "O proprietário confirma um deles e envia o link da chamada."
      : "O proprietário confirma um deles; o endereço exato aparece depois da confirmação.";
  return `Pedido de visita ${tipo} enviado.${quando} ${depois} Você recebe um e-mail com o resumo e acompanha tudo em Visitas.`;
}
