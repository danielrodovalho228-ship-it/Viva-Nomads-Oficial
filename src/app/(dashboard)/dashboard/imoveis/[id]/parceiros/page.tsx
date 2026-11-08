import { parceirosDoImovel } from "@/lib/automacao/acoes";
import { ParceirosDoImovelTela } from "@/components/automacao/parceiros-do-imovel";

export const dynamic = "force-dynamic";

/**
 * Parceiros do imóvel (Prompt 38): o parceiro fixo de limpeza, manutenção, lavanderia e fotografia. Cada pedido é um
 * pedido normal de serviço: o parceiro aceita ou recusa, e o pagamento é direto entre vocês. Só o dono.
 */
export default async function ParceirosDoImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await parceirosDoImovel(id);
  return (
    <div>
      {/* E738: o voltar é o do cabeçalho padrão do painel ("← Voltar"); a tela não repete um segundo. */}
      <h1 className="mt-3 font-title text-2xl font-semibold text-ink">Parceiros do imóvel</h1>
      {dados ? (
        <>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {dados.imovel.titulo}. Escolha quem cuida do imóvel entre uma estadia e outra. A Viva só conecta: o parceiro aceita cada pedido e o pagamento é direto com ele.
          </p>
          <div className="mt-6">
            <ParceirosDoImovelTela dados={dados} />
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-white p-4 text-sm text-ink" data-testid="parceiros-indisponivel">
          Imóvel não encontrado.
        </p>
      )}
    </div>
  );
}
