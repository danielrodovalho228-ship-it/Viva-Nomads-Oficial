import Link from "next/link";
import { notFound } from "next/navigation";
import { FileX2 } from "lucide-react";
import { EmptyState, PageTitle, Panel, FilaVazia } from "@/components/dashboard/primitives";
import { createClient } from "@/lib/supabase/server";
import { adminDaPagina, nomesCurtos } from "@/lib/data/admin-indicadores";
import { logModeracao } from "@/lib/data/moderacao-log";
import { refContratoVN } from "@/lib/fiscal/fila-falhas";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { ROTULO_STATUS_ENCERRAMENTO, rotuloMotivo } from "@/lib/estadia/encerramento";
import { AcoesEncerramento } from "./acoes";

export const metadata = { title: "Pedidos de encerramento — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Admin → Contratos → Pedidos de encerramento (Prompt 32, item 7). Com ENCERRAMENTO_REGRAS_ATIVO desligada, nenhum
 * valor é calculado: a equipe conduz com as partes. "Concluir" encerra o contrato (acerto de saída) e grava o evento
 * contrato_encerrado (o Prompt 38 cancela os pedidos automáticos). Entra no topo "decisões" do 46 quando ele existir.
 */
export default async function EncerramentosPage() {
  const admin = await adminDaPagina();
  if (!admin) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (supabase && user) await logModeracao(supabase, user.id, "ver_encerramentos", "fila", "encerramentos");

  const { data } = await admin
    .from("contrato_encerramento_pedidos")
    .select("id, contrato_id, pedido_por, papel, motivo, texto, status, criado_em, contratos(property_id, properties(title))")
    .order("status")
    .order("criado_em", { ascending: false })
    .limit(200);
  type Linha = {
    id: string;
    contrato_id: string;
    pedido_por: string;
    papel: string;
    motivo: string;
    texto: string | null;
    status: string;
    criado_em: string;
    contratos: { properties: { title: string | null } | null } | null;
  };
  const linhas = (data ?? []) as unknown as Linha[];
  const nomes = await nomesCurtos(admin, [...new Set(linhas.map((l) => l.pedido_por))]);
  const abertos = linhas.filter((l) => l.status !== "concluido");

  return (
    <>
      <PageTitle title="Pedidos de encerramento" subtitle={`${abertos.length} em aberto. As regras de encerramento estão desligadas: a equipe conduz com as partes, sem cálculo de multa ou devolução.`} />
      {linhas.length === 0 ? (
        <FilaVazia />
      ) : (
        <div className="space-y-3" data-testid="admin-encerramentos">
          {linhas.map((l) => (
            <Panel key={l.id} data-testid="admin-encerramento" data-status={l.status} data-contrato={l.contrato_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    <Link href={`/admin/contratos/${l.contrato_id}`} className="underline">
                      {refContratoVN(l.contrato_id)}
                    </Link>{" "}
                    · {l.contratos?.properties?.title ?? "Imóvel"}
                  </p>
                  <p className="text-sm text-ink">
                    {rotuloMotivo(l.motivo)}
                    {l.texto ? `: ${l.texto}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    Pedido por {nomes.get(l.pedido_por) ?? "—"} ({l.papel === "proprietario" ? "proprietário" : "morador"}) em {dataHoraBRT(l.criado_em)} · {ROTULO_STATUS_ENCERRAMENTO[l.status] ?? l.status}
                  </p>
                </div>
                {l.status !== "concluido" && <AcoesEncerramento pedidoId={l.id} status={l.status} />}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
