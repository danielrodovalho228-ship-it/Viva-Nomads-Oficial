import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { countDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contarContratosParaAssinar, getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { contarPropostasAguardando } from "@/lib/data/propostas-actions";
import { contarAprovacoesPendentes } from "@/lib/data/agentes-actions";
import { imoveisAtivosDoDono, temImovelAnunciado } from "@/lib/data/menu-actions";
import { temPapelParceiro } from "@/lib/parceiros/painel-actions";
import { CONTADORES_VAZIOS, contadoresVisiveis, type ContadoresPainel } from "@/lib/painel/contadores";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/**
 * Números do menu do painel (Prompt 42, item 5): UM GET no lugar das ~8 server actions que a casca chamava a cada troca
 * de rota. A sessão (cliente do servidor) decide quem é; as mesmas funções de antes contam (cada uma já filtra pelo
 * dono/inquilino e pela RLS); os números da equipe só para admin. Sem sessão: 401. Nunca em cache.
 */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json(CONTADORES_VAZIOS, { headers: SEM_CACHE });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers: SEM_CACHE });

  const admin = await ehAdmin(supabase, user.id).catch(() => false);
  const zero = () => Promise.resolve(0);
  const [contratosParaAssinar, propostasAguardando, documentosPendentes, aprovacoesPendentes, temImovel, imoveisAtivos, parceiro, locacoes] =
    await Promise.all([
      contarContratosParaAssinar().catch(() => 0),
      contarPropostasAguardando().catch(() => 0),
      admin ? countDocumentosPendentes().catch(() => 0) : zero(),
      admin ? contarAprovacoesPendentes().catch(() => 0) : zero(),
      temImovelAnunciado().catch(() => false),
      imoveisAtivosDoDono().catch(() => 0),
      temPapelParceiro().catch(() => false),
      getMinhasLocacoes().catch(() => []),
    ]);
  const c: ContadoresPainel = {
    contratosParaAssinar,
    propostasAguardando,
    documentosPendentes,
    aprovacoesPendentes,
    temImovel,
    imoveisAtivos,
    parceiro,
    estadiaAtiva: locacoes.some((l) => l.status === "ativo"),
  };
  return NextResponse.json(contadoresVisiveis(c, admin), { headers: SEM_CACHE });
}
