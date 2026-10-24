import { hojeBR } from "@/lib/utils";
import { resolverPeriodo } from "@/lib/admin/visao-geral";
import { getVisaoGeral, cidadesComAnuncio } from "@/lib/data/admin-visao-geral";
import { CartaoPush } from "@/components/admin/cartao-push";
import { PainelIaCadastro } from "@/components/admin/painel-ia-cadastro";
import { ContadorDeteccao } from "@/components/admin/contador-deteccao";
import { CartaoBackup } from "@/components/admin/cartao-backup";
import { CartaoMapas } from "@/components/admin/cartao-mapas";
import { CartaoEntradaEmail } from "@/components/admin/cartao-entrada-email";
import { VisaoGeralClient } from "./visao-geral-client";
import { AtalhosAdmin } from "./atalhos-admin";
import { AvisoAtendimentoAdmin } from "@/components/admin/aviso-atendimento";
import { DecisoesHoje } from "@/components/admin/numeros";
import { decisoesDoAdmin } from "@/lib/data/admin-decisoes";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { showDemoProperties } from "@/lib/data/properties";

/**
 * Início do /admin na anatomia "decisões primeiro" (Prompt 46, D5): "Hoje você tem N decisões" (cada fila com o botão
 * da decisão), depois UM número-herói e os números em listas com divisor fino — período (7/30/90 dias, ano,
 * personalizado) com variação contra o anterior, filtro de cidade, fórmula no "i", funil e CSV. Todo número abre a
 * lista que conta. O layout já exige admin; a leitura confere de novo (getVisaoGeral).
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : null;
  };
  const periodo = resolverPeriodo({ periodo: um("periodo"), de: um("de"), ate: um("ate") }, hojeBR());
  const cidade = (um("cidade") ?? "").trim().slice(0, 80) || null;

  const [resultado, cidades, decisoes] = await Promise.all([
    getVisaoGeral(periodo.inicio, periodo.fim, cidade),
    cidadesComAnuncio(),
    decisoesDoAdmin().catch(() => null),
  ]);

  const aviso = resultado.ok
    ? null
    : {
        demo: "Sem conexão com o banco (modo demonstração): nenhum número real para mostrar.",
        sem_permissao: "Sem permissão para ver os números da plataforma.",
        sem_chave: "Chave de serviço não configurada (SUPABASE_SERVICE_ROLE_KEY): os números não podem ser lidos.",
        sem_migracao: "A função da visão geral ainda não existe no banco (migração 0069 pendente).",
        erro: "Não foi possível ler os números agora.",
      }[resultado.motivo];

  return (
    <>
      <AvisoAtendimentoAdmin />
      <DecisoesHoje decisoes={decisoes} />
      <VisaoGeralClient
        dados={resultado.ok ? resultado.dados : null}
        aviso={aviso}
        periodo={periodo}
        cidade={cidade}
        cidades={cidades}
        demonstracao={{ total: SAMPLE_PROPERTIES.length, publicos: showDemoProperties() }}
      />
      <AtalhosAdmin />
      <div className="mt-6">
        <PainelIaCadastro />
      </div>
      <div className="mt-6">
        <ContadorDeteccao />
      </div>
      <div id="backup" className="mt-6 scroll-mt-24">
        <CartaoBackup />
      </div>
      <div id="entrada-email" className="mt-6 scroll-mt-24">
        <CartaoEntradaEmail />
      </div>
      <div className="mt-6">
        <CartaoMapas />
      </div>
      <div id="push" className="mt-6 scroll-mt-24">
        <CartaoPush />
      </div>
    </>
  );
}
