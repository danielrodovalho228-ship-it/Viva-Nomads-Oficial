/*
  Prompt 62-B2 — o conteúdo do LAUDO VIS (documento da plataforma, Prompt 56). PURO.
  Emitido pela plataforma via registrarDocumento: número VIS-AAAA-NNNNNN, versão, hash e /conferir. O avaliador aparece
  por nome curto + número de credenciado. Sem valor (nem da tabela) e sem nome de dono ou morador.
  dB(A) e a prova de local da internet NUNCA entram no laudo: são apoio interno.
*/
import type { CabecalhoDocumento, ConteudoDocumento } from "../fiscal/documento.ts";
import { DELIMITACAO_LAUDO, ROTULO_VALOR, itemChecklist, type ValorItem } from "../../config/checklist-avaliacao.ts";
import { ROTULO_NIVEL, ROTULO_RUIDO, type ClasseRuido } from "../../config/niveis.ts";
import { ROTULO_RESULTADO, type Resultado, type ResultadoAvaliacao, type resumoPorGrupo } from "./laudo.ts";

export interface DadosLaudoDocumento {
  imovel: string;
  cidade: string;
  visitaEm: string;
  avaliador: { nomeCurto: string; numero: string };
  resultado: ResultadoAvaliacao;
  nivel: keyof typeof ROTULO_NIVEL_LAUDO;
  resumo: ReturnType<typeof resumoPorGrupo>;
  /** Não conformes com a observação do avaliador (a foto fica no registro da avaliação). */
  naoConformes: { chave: string; valor: ValorItem; observacao: string | null; temFoto: boolean }[];
  ruido: ClasseRuido | null;
  internet: { ponto: "quarto_principal" | "trabalho"; downloadMbps: number; uploadMbps: number; latenciaMs: number | null }[];
  prazoRessalvaAte: string | null;
  /** Versão nova: o que mudou (correção da ressalva, contestação, reverificação). */
  motivoVersao: "correcao" | "contestacao" | "reverificacao" | null;
}

const ROTULO_NIVEL_LAUDO = { em_adequacao: "Em adequação", ...ROTULO_NIVEL } as const;
const PONTO: Record<"quarto_principal" | "trabalho", string> = { quarto_principal: "Quarto principal", trabalho: "Ponto de trabalho" };
const MOTIVO: Record<NonNullable<DadosLaudoDocumento["motivoVersao"]>, string> = {
  correcao: "Nova versão: ressalvas corrigidas e reverificadas.",
  contestacao: "Nova versão: resultado da 2ª avaliação, feita por outro avaliador depois da contestação.",
  reverificacao: "Nova versão: reverificação do item.",
};

const dataBRT = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Próximo passo do dono, pelo resultado (o mesmo texto vai na notificação). */
export function proximoPasso(r: Resultado, prazoRessalvaAte: string | null): string {
  if (r === "aprovado") return "O anúncio passa a mostrar o nível com \"· vistoriado\" por 12 meses.";
  if (r === "com_ressalvas") return `Corrija os itens listados até ${prazoRessalvaAte ? dataBRT(prazoRessalvaAte) : "o prazo"}: uma reverificação está incluída.`;
  return "Vale o nível sustentado por este laudo, sem \"· vistoriado\". Uma nova avaliação em até 90 dias sai pela metade do preço.";
}

export function conteudoLaudo(d: DadosLaudoDocumento, cabecalho?: Omit<CabecalhoDocumento, "marca">): ConteudoDocumento {
  const r = d.resultado;
  return {
    ...(cabecalho ? { cabecalho: { marca: "plataforma" as const, ...cabecalho } } : {}),
    titulo: "Laudo de avaliação do imóvel",
    subtitulo: `Checklist da Viva · ${ROTULO_RESULTADO[r.resultado]}`,
    quadro: [
      ["Imóvel", `${d.imovel} · ${d.cidade}`],
      ["Visita", dataBRT(d.visitaEm)],
      ["Avaliador credenciado", `${d.avaliador.nomeCurto} · nº ${d.avaliador.numero}`],
      ["Resultado", ROTULO_RESULTADO[r.resultado]],
      ["Nível sustentado", ROTULO_NIVEL_LAUDO[d.nivel]],
    ],
    corpo: [
      ...(d.motivoVersao ? [MOTIVO[d.motivoVersao]] : []),
      "RESUMO POR GRUPO",
      ...d.resumo.map((g) => `${g.rotulo}: ${g.conformes} conforme${g.conformes === 1 ? "" : "s"}${g.naoConformes.length ? `; não conforme: ${g.naoConformes.join(", ")}` : ""}.`),
      "ITENS NÃO CONFORMES",
      ...(d.naoConformes.length
        ? d.naoConformes.map((n) => {
            const i = itemChecklist(n.chave);
            return `${i?.rotulo ?? n.chave} — ${ROTULO_VALOR[n.valor]}${n.observacao ? `: ${n.observacao}` : ""}${n.temFoto ? " (foto no registro)" : ""}.`;
          })
        : ["Nenhum."]),
      ...(r.graves.length
        ? ["SEGURANÇA", `Item grave não conforme: ${r.graves.map((g) => itemChecklist(g)?.rotulo ?? g).join(", ")}. O anúncio fica fora da busca até a correção comprovada.`]
        : []),
      "RUÍDO",
      d.ruido ? `Exposição ao ruído: ${ROTULO_RUIDO[d.ruido]} (pelas 4 perguntas, respondidas na visita).` : "Não classificado.",
      "INTERNET MEDIDA NA VISITA",
      ...(d.internet.length
        ? d.internet.map((m) => `${PONTO[m.ponto]}: ${m.downloadMbps} Mbps de download, ${m.uploadMbps} Mbps de upload${m.latenciaMs != null ? `, ${m.latenciaMs} ms` : ""}.`)
        : ["Sem medição."]),
      "PRÓXIMO PASSO",
      proximoPasso(r.resultado, d.prazoRessalvaAte),
      ...(r.ressalvas.length ? r.ressalvas.map((x) => `Corrigir: ${itemChecklist(x.chave)?.rotulo ?? x.chave} (reverificação por ${x.reverificacao === "foto" ? "foto" : "nova visita"}).`) : []),
    ],
    rodape: [DELIMITACAO_LAUDO, "Emitido pela plataforma Viva Nomads a partir do checklist preenchido na visita. A Viva não recebe o valor da avaliação."],
  };
}
