import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { countDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contarContratosParaAssinar, getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { contarPropostasAguardando } from "@/lib/data/propostas-actions";
import { contarAprovacoesPendentes } from "@/lib/data/agentes-actions";
import { imoveisAtivosDoDono, temImovelAnunciado } from "@/lib/data/menu-actions";
import { temPapelParceiro } from "@/lib/parceiros/painel-actions";
import { CONTADORES_VAZIOS, contadoresVisiveis, type ContadoresPainel } from "@/lib/painel/contadores";

/**
 * Números e contexto do menu do painel — FONTE ÚNICA no servidor (PROP-0). A rota /api/painel/contadores (releituras da
 * casca) e o layout do painel (1ª pintura, sem piscar) chamam esta mesma função. A sessão decide quem é; cada contagem
 * já filtra pelo dono/inquilino e pela RLS; os números da equipe só para admin.
 * "sem-sessao": ninguém logado (a rota responde 401; o layout não passa valor inicial).
 */
export async function contadoresDoPainel(): Promise<ContadoresPainel | "sem-sessao"> {
  const supabase = await createClient();
  if (!supabase) return CONTADORES_VAZIOS;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "sem-sessao";

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
  return contadoresVisiveis(c, admin);
}

/** Para o layout: o valor inicial do menu, ou null (sem sessão ou falha — a casca segue com a leitura pela rota). */
export async function contadoresIniciaisDoPainel(): Promise<ContadoresPainel | null> {
  const r = await contadoresDoPainel().catch(() => null);
  return r && r !== "sem-sessao" ? r : null;
}
