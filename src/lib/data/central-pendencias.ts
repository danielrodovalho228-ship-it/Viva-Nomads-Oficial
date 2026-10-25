import "server-only";
/*
  Adendo 59.1, item 6 — dados da CENTRAL DE PENDÊNCIAS. Uma consulta por fila; a montagem (contagem, ordem, contas de
  teste à parte) é a função pura de src/lib/admin/central-pendencias.ts. O topo de decisões do /admin conta pelas
  MESMAS linhas (contagensDaCentral), então os números batem. Só leitura, cliente de serviço (o layout exige admin).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { rotuloItem } from "@/config/niveis";
import { CONFIRMACAO_PENDENCIA_H, itensFaltantes } from "@/lib/conforto/regras";
import { CONFIRMACAO_MORADOR_H } from "@/lib/manutencao-solucao";
import { gravidadePeloPrazo, montarCentral, type Central, type FiltroCentral, type LinhaCentral } from "@/lib/admin/central-pendencias";
import { contasTeste, ordensForaDoPrazo, prazoVencidoEm } from "@/lib/data/admin-prazos-59";
import { filaDocumentos } from "@/lib/data/admin-indicadores";
import { MOTIVOS_REVISAO, ehMotivoRevisao } from "@/lib/avaliacoes-resposta";

type Admin = SupabaseClient;
const H = 3_600_000;
const DIA = 86_400_000;

type Prop = { title: string | null; owner_id: string };
const titulo = (p: Prop | null | undefined) => p?.title ?? "Imóvel";

/** Todas as linhas da Central (inclusive contas de teste, marcadas). Uma fila que falhar fica de fora, sem derrubar as outras. */
export async function linhasDaCentral(admin: Admin, agora = new Date()): Promise<LinhaCentral[]> {
  const teste = await contasTeste(admin).catch(() => new Set<string>());
  const ehTeste = (dono: string | undefined) => !!dono && teste.has(dono);
  const ler = async <T,>(f: () => Promise<T[]>): Promise<T[]> => f().catch((e) => (console.error("[central]", e), [] as T[]));

  const [pend, ordensFora, ordensConfirmar, adequ, fotos, docs, revisoes] = await Promise.all([
    ler(async () => {
      const { data, error } = await admin
        .from("conforto_pendencias")
        .select("id, chave, status, contrato_id, aberta_em, prazo_ate, corrigida_em, confirmada_em, contestada_em, texto_morador, motivo_contestacao, properties!inner(title, owner_id)")
        .in("status", ["aberta", "contestada", "corrigida"])
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string; chave: string; status: string; contrato_id: string | null; aberta_em: string; prazo_ate: string; corrigida_em: string | null;
        confirmada_em: string | null; contestada_em: string | null; texto_morador: string | null; motivo_contestacao: string | null; properties: Prop;
      }[];
    }),
    ler(() => ordensForaDoPrazo(admin, agora)),
    ler(async () => {
      const { data, error } = await admin
        .from("service_orders")
        .select("id, description, solucao_marcada_em, simulacao, properties!inner(title, owner_id)")
        .eq("status", "resolvido")
        .is("solucao_confirmada_em", null)
        .not("solucao_marcada_em", "is", null)
        .limit(2000);
      if (error) throw error;
      return ((data ?? []) as unknown as { id: string; description: string; solucao_marcada_em: string; simulacao: boolean | null; properties: Prop }[]).filter((o) => !o.simulacao);
    }),
    ler(async () => {
      const { data, error } = await admin
        .from("conforto_adequacao")
        .select("property_id, prazo_ate, pausado_em, criado_em, properties!inner(title, owner_id, status)")
        .lte("prazo_ate", new Date(agora.getTime() + 3 * DIA).toISOString())
        .limit(2000);
      if (error) throw error;
      const linhas = (data ?? []) as unknown as { property_id: string; prazo_ate: string; pausado_em: string | null; criado_em: string; properties: Prop & { status: string } }[];
      if (!linhas.length) return [];
      const { data: decl } = await admin.from("conforto_declaracoes").select("property_id, chave, confirmado, versao_lista").in("property_id", linhas.map((l) => l.property_id));
      const porImovel = new Map<string, { chave: string; confirmado: boolean; versao_lista: number | null }[]>();
      for (const d of (decl ?? []) as { property_id: string; chave: string; confirmado: boolean; versao_lista: number | null }[]) porImovel.set(d.property_id, [...(porImovel.get(d.property_id) ?? []), d]);
      // Só quem ainda não confirmou (completo = resolvido).
      return linhas.filter((l) => itensFaltantes(porImovel.get(l.property_id) ?? []).length > 0);
    }),
    ler(async () => {
      const { data, error } = await admin
        .from("nivel_itens")
        .select("property_id, chave, foto_path, declarado_em, properties!inner(title, owner_id)")
        .eq("declarado", true)
        .eq("foto_status", "pendente")
        .not("foto_path", "is", null)
        .order("declarado_em", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as { property_id: string; chave: string; foto_path: string; declarado_em: string | null; properties: Prop }[];
    }),
    ler(async () => [await filaDocumentos(admin)]),
    ler(async () => {
      const { data, error } = await admin
        .from("avaliacao_contestacoes")
        .select("id, autor_id, motivo, detalhe, criada_em, avaliacoes(nota_geral, comentario_publico)")
        .eq("status", "aberta")
        .order("criada_em", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string; autor_id: string; motivo: string; detalhe: string; criada_em: string;
        avaliacoes: { nota_geral: number; comentario_publico: string | null } | { nota_geral: number; comentario_publico: string | null }[] | null;
      }[];
    }),
  ]);

  const out: LinhaCentral[] = [];
  const add = (filtro: FiltroCentral, l: Omit<LinhaCentral, "filtro">) => out.push({ filtro, ...l });

  for (const p of pend) {
    const dono = p.properties.owner_id;
    if (p.status === "contestada") {
      add("conforto_contestacoes", {
        id: p.id,
        titulo: `${rotuloItem(p.chave)} · ${titulo(p.properties)}`,
        detalhe: [p.texto_morador && `Morador: ${p.texto_morador}`, p.motivo_contestacao && `Proprietário: ${p.motivo_contestacao}`].filter(Boolean).join(" · ") || null,
        desde: p.contestada_em ?? p.aberta_em,
        prazoAte: null,
        gravidade: "alta",
        acao: { rotulo: "Decidir", href: p.contrato_id ? `/admin/contratos/${p.contrato_id}` : "/admin/pendencias?filtro=conforto_contestacoes" },
        teste: ehTeste(dono),
        ref: { pendencia: p.id },
      });
    } else if (p.status === "aberta") {
      add("conforto_abertas", {
        id: p.id,
        titulo: `${rotuloItem(p.chave)} · ${titulo(p.properties)}`,
        detalhe: p.texto_morador ? `Morador: ${p.texto_morador}` : null,
        desde: p.aberta_em,
        prazoAte: p.prazo_ate,
        gravidade: gravidadePeloPrazo(p.prazo_ate, agora, "media"),
        acao: { rotulo: "Ver o contrato", href: p.contrato_id ? `/admin/contratos/${p.contrato_id}` : "/admin/contratos" },
        teste: ehTeste(dono),
      });
    } else if (p.status === "corrigida" && !p.confirmada_em && p.corrigida_em) {
      const ate = new Date(new Date(p.corrigida_em).getTime() + CONFIRMACAO_PENDENCIA_H * H).toISOString();
      add("confirmacoes_48h", {
        id: p.id,
        titulo: `Morador confirma a correção: ${rotuloItem(p.chave)} · ${titulo(p.properties)}`,
        detalhe: "Sem resposta no prazo, conta como corrigida.",
        desde: p.corrigida_em,
        prazoAte: ate,
        gravidade: "baixa",
        acao: { rotulo: "Ver o contrato", href: p.contrato_id ? `/admin/contratos/${p.contrato_id}` : "/admin/contratos" },
        teste: ehTeste(dono),
      });
    }
  }
  for (const o of ordensFora) {
    add("manutencao_fora_prazo", {
      id: o.id,
      titulo: `${o.properties.title ?? "Imóvel"} · ${o.category ?? "manutenção"} · prioridade ${o.priority}`,
      detalhe: o.description?.slice(0, 140) ?? null,
      desde: o.opened_at,
      prazoAte: prazoVencidoEm(o, agora),
      gravidade: "alta",
      acao: { rotulo: "Acompanhar", href: "/admin/solicitacoes?fora_prazo=1" },
      teste: ehTeste(o.properties.owner_id),
    });
  }
  for (const o of ordensConfirmar) {
    add("confirmacoes_48h", {
      id: o.id,
      titulo: `Morador confirma a solução · ${titulo(o.properties)}`,
      detalhe: o.description?.slice(0, 140) ?? null,
      desde: o.solucao_marcada_em,
      prazoAte: new Date(new Date(o.solucao_marcada_em).getTime() + CONFIRMACAO_MORADOR_H * H).toISOString(),
      gravidade: "baixa",
      acao: { rotulo: "Ver a solicitação", href: "/admin/solicitacoes" },
      teste: ehTeste(o.properties.owner_id),
    });
  }
  for (const a of adequ) {
    add("adequacoes", {
      id: a.property_id,
      titulo: `${titulo(a.properties)} · ${a.pausado_em ? "fora da busca" : "padrão mínimo vencendo"}`,
      detalhe: a.pausado_em ? "Saiu da busca: volta quando o dono confirmar o padrão mínimo." : null,
      desde: a.criado_em,
      prazoAte: a.prazo_ate,
      gravidade: gravidadePeloPrazo(a.prazo_ate, agora, "media"),
      acao: { rotulo: "Ver os anúncios", href: "/admin/imoveis" },
      teste: ehTeste(a.properties.owner_id),
    });
  }
  for (const f of fotos) {
    add("fotos_nivel", {
      id: `${f.property_id}:${f.chave}`,
      titulo: `${rotuloItem(f.chave)} · ${titulo(f.properties)}`,
      detalhe: null,
      desde: f.declarado_em ?? agora.toISOString(),
      prazoAte: null,
      gravidade: "baixa",
      acao: { rotulo: "Analisar", href: "/admin/pendencias?filtro=fotos_nivel" },
      teste: ehTeste(f.properties.owner_id),
      ref: { imovel: f.property_id, chave: f.chave, foto: admin.storage.from("property-photos").getPublicUrl(f.foto_path).data.publicUrl },
    });
  }
  for (const r of revisoes) {
    const av = Array.isArray(r.avaliacoes) ? r.avaliacoes[0] : r.avaliacoes;
    add("avaliacoes_contestadas", {
      id: r.id,
      titulo: `Pedido de revisão · ${ehMotivoRevisao(r.motivo) ? MOTIVOS_REVISAO[r.motivo] : r.motivo}`,
      detalhe: [av ? `Avaliação (${av.nota_geral}/5): ${av.comentario_publico ? `“${av.comentario_publico}”` : "sem comentário"}` : null, `Explicação: ${r.detalhe}`].filter(Boolean).join(" · "),
      desde: r.criada_em,
      prazoAte: null,
      gravidade: "media",
      acao: { rotulo: "Decidir", href: "/admin/pendencias?filtro=avaliacoes_contestadas" },
      teste: ehTeste(r.autor_id),
      ref: { revisao: r.id },
    });
  }
  const d = docs[0];
  if (d && d.total > 0) {
    add("documentos_pendentes", {
      id: "documentos",
      titulo: `${d.total} ${d.total === 1 ? "documento na fila" : "documentos na fila"} para conferir`,
      detalhe: [d.documentos ? `${d.documentos} de imóvel` : null, d.matriculas ? `${d.matriculas} de matrícula` : null].filter(Boolean).join(" · ") || null,
      desde: d.maisAntigoEm ?? agora.toISOString(),
      prazoAte: null,
      gravidade: "media",
      acao: { rotulo: "Conferir", href: "/admin/documentos" },
      teste: false,
      quantidade: d.total,
    });
  }
  return out;
}

export async function centralDePendencias(admin: Admin, agora = new Date(), filtro?: FiltroCentral | null): Promise<Central> {
  return montarCentral(await linhasDaCentral(admin, agora), agora, filtro);
}
