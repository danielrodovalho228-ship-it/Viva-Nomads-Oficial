import { filaAtendimento, listarMacros, metricasAtendimento } from "@/lib/data/atendimento-actions";
import { AtendimentoClient } from "./atendimento-client";

export const metadata = { title: "Atendimento — Admin" };

/** Admin → Atendimento: fila com relógio de prazo, aprovação, métricas e respostas prontas. */
export default async function AdminAtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const aba = (["fila", "aprovacao", "metricas", "respostas"].includes(um("aba") ?? "") ? um("aba") : "fila") as
    | "fila"
    | "aprovacao"
    | "metricas"
    | "respostas";
  const filtros = {
    prioridade: um("prioridade"),
    tipo: um("tipo"),
    responsavel: um("responsavel"),
    busca: um("q"),
    fechados: um("fechados") === "1",
  };
  const [fila, aprovacao, metricas, macros] = await Promise.all([
    aba === "fila" ? filaAtendimento(filtros) : Promise.resolve([]),
    filaAtendimento({ aprovacao: true }),
    aba === "metricas" ? metricasAtendimento(Number(um("dias")) || 30) : Promise.resolve(null),
    aba === "respostas" ? listarMacros() : Promise.resolve([]),
  ]);
  return (
    <AtendimentoClient
      aba={aba}
      fila={fila ?? []}
      aprovacao={aprovacao ?? []}
      metricas={metricas}
      macros={macros}
      filtros={filtros}
      semAcesso={fila === null}
      agoraISO={new Date().toISOString()}
    />
  );
}
