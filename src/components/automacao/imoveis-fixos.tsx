import { Building2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/dashboard/primitives";
import { meusImoveisFixos } from "@/lib/automacao/acoes";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { RespostaConvite } from "./resposta-convite";

/**
 * "Imóveis fixos" do parceiro (Prompt 38): convites para ser o parceiro fixo de um imóvel (aceitar ou recusar) e os
 * vínculos ativos. Só bairro e cidade: o endereço aparece no pedido, depois do aceite, como no 31b.
 */
export async function ImoveisFixos() {
  const lista = await meusImoveisFixos();
  return (
    <Panel id="imoveis-fixos" title="Imóveis fixos" className="mb-6 scroll-mt-24" data-testid="imoveis-fixos">
      {lista.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhum imóvel fixo" text="Quando um proprietário convidar você como parceiro fixo de um imóvel, o convite aparece aqui." action={<ButtonLink href="/dashboard/parceiro" variant="secondary" size="sm">Abrir minha página</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line">
          {lista.map((v) => (
            <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-testid="imovel-fixo" data-status={v.status}>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink">
                  {rotuloCategoria(v.categoria)} · {[v.imovel.bairro, v.imovel.cidade].filter(Boolean).join(", ") || "Imóvel"}
                </p>
                <p className="text-muted">
                  {v.status === "ativo" ? "Ativo" : "Convite"}
                  {v.servico ? ` · ${v.servico}` : ""}
                  {v.modo === "automatico" ? " · pedidos automáticos" : " · o dono confirma cada pedido"}
                </p>
                {v.instrucoes && <p className="break-words text-muted">Instruções: {v.instrucoes}</p>}
              </div>
              <RespostaConvite vinculoId={v.id} status={v.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
