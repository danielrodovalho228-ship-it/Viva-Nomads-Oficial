import { NumeroDaFonte } from "@/components/admin/numero-da-fonte";
import { filaAtendimento, listarMacros, metricasAtendimento } from "@/lib/data/atendimento-actions";
import { AtendimentoClient } from "./atendimento-client";
import { adminDaPagina } from "@/lib/data/admin-indicadores";
import { tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/atendimento") };

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
    fila: um("fila"),
    prioridade: um("prioridade"),
    tipo: um("tipo"),
    responsavel: um("responsavel"),
    busca: um("q"),
    fechados: um("fechados") === "1",
    semResposta: um("sem_resposta") === "1",
  };
  const admin = await adminDaPagina();
  const [fila, aprovacao, metricas, macros, ultimo] = await Promise.all([
    aba === "fila" ? filaAtendimento(filtros) : Promise.resolve([]),
    filaAtendimento({ aprovacao: true }),
    aba === "metricas" ? metricasAtendimento(Number(um("dias")) || 30) : Promise.resolve(null),
    aba === "respostas" ? listarMacros() : Promise.resolve([]),
    // Fila vazia (Prompt 48): a data do último chamado resolvido aparece no "Nada pendente".
    admin
      ? admin.from("chamados").select("resolvido_em").eq("simulacao", false).not("resolvido_em", "is", null).order("resolvido_em", { ascending: false }).limit(1).then((r) => r.data?.[0]?.resolvido_em ?? null, () => null)
      : Promise.resolve(null),
  ]);
  return (
    <>
      <NumeroDaFonte chave="chamados" />
      <AtendimentoClient
        aba={aba}
        fila={fila ?? []}
        aprovacao={aprovacao ?? []}
        metricas={metricas}
        macros={macros}
        filtros={filtros}
        semAcesso={fila === null}
        agoraISO={new Date().toISOString()}
        ultimaDecisao={(ultimo as string | null) ?? null}
      />
    </>
  );
}
