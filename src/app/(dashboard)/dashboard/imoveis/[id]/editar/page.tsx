import { EstadoDoAnuncio } from "@/components/anuncio/estado-anuncio";
import Link from "next/link";
import { emCadastro, hrefPassoDoRascunho } from "@/lib/anuncio/destino-pendencia";
import { loadPropertyForEdit } from "@/lib/data/actions";
import { instrucaoSaidaParaEditar } from "@/lib/data/estadia";
import { createClient } from "@/lib/supabase/server";
import { fatosDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import type { FatosAnuncio } from "@/lib/anuncio/prontidao";
import { EditarImovelClient } from "./editar-client";

/**
 * Editor de anúncio POR SEÇÕES (Fase 3). Diferente do wizard linear de criação:
 * aqui o proprietário abre o imóvel e edita cada seção (fotos, disponibilidade,
 * descrição, comodidades, regras, detalhes) de forma independente, com barra de
 * completude no topo. O servidor carrega o imóvel do dono; sem backend
 * configurado (preview), o loader cai no imóvel de exemplo — `demo` sinaliza que
 * as edições não gravam.
 */
export default async function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await loadPropertyForEdit(id);
  const demo = !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!property) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-12 text-center">
        <h1 className="font-title text-lg font-semibold text-ink">Imóvel não encontrado</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Este anúncio não existe ou não pertence à sua conta.
        </p>
        <Link
          href="/dashboard/imoveis"
          className="mt-6 inline-block text-sm font-medium text-forest hover:underline"
        >
          Voltar aos meus imóveis
        </Link>
      </div>
    );
  }

  // Fatos do banco para a prontidão (documento, limite do plano, garantia, selo…);
  // o editor sobrepõe ao vivo os campos que a pessoa está mexendo.
  let fatos: FatosAnuncio | null = null;
  // Rua, número e complemento (coluna restrita): o dono lê pela RPC de detalhes privados (complemento do prompt 23).
  let enderecoExato = "";
  // 64-B: o motivo da pausa (o selo do topo vira o menu de pausa do anúncio publicado ou pausado).
  let pausaMotivo: string | null = null;
  // E662: a instrução única de saída já cadastrada (tabela privada das instruções; só o dono lê, pela RLS).
  let instrucaoSaida = "";
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // E567: a mesma fonte do Início e de Meus imóveis (com a qualificação do rascunho) — um percentual por anúncio.
      fatos = (await fatosDosImoveis(supabase, user.id, [id], { qualificacaoDoRascunho: true })).get(id) ?? null;
      if (property.status === "paused") {
        const { data: m } = await supabase.from("properties").select("pausa_motivo").eq("id", id).maybeSingle();
        pausaMotivo = (m as { pausa_motivo?: string | null } | null)?.pausa_motivo ?? null;
      }
      // Achado 130: sem o endereço exato, o editor não abre com a rua vazia (a falha cai no error.tsx: "Tente de novo").
      instrucaoSaida = await instrucaoSaidaParaEditar(supabase, id);
      const { data: priv, error: erroPriv } = await supabase.rpc("property_private_details", { prop_id: id });
      if (erroPriv) throw new Error("Não foi possível ler o endereço do anúncio agora.");
      const linha = (Array.isArray(priv) ? priv[0] : priv) as { exact_address?: string | null } | null;
      enderecoExato = linha?.exact_address ?? "";
    }
  }

  return (
    <>
      {/* Prompt 38: o parceiro fixo do imóvel (limpeza, manutenção, lavanderia, fotografia). */}
      {!demo && property.status !== "draft" && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" data-testid="editor-estado">
          <span className="text-muted">Estado do anúncio:</span>
          <EstadoDoAnuncio id={id} status={property.status} motivo={pausaMotivo} />
        </div>
      )}
      {/* P0 (30/10): rascunho que caiu aqui por um link antigo volta ao passo a passo (fotos no Passo 2). */}
      {!demo && emCadastro(property.status) && (
        <p className="mb-3 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink" role="status" data-testid="editor-rascunho-assistente">
          Este anúncio ainda está em cadastro.{" "}
          <Link href={hrefPassoDoRascunho(id)} className="font-medium text-forest underline underline-offset-4">
            Continuar no passo a passo
          </Link>
        </p>
      )}
      {!demo && (
        <p className="mb-3 text-sm">
          <Link href={`/dashboard/imoveis/${id}/parceiros`} className="text-ink underline underline-offset-4" data-testid="parceiros-imovel-editor">
            Parceiros do imóvel
          </Link>
        </p>
      )}
      <EditarImovelClient property={property} demo={demo} fatos={fatos} enderecoExatoInicial={enderecoExato} instrucaoSaidaInicial={instrucaoSaida} />
    </>
  );
}
