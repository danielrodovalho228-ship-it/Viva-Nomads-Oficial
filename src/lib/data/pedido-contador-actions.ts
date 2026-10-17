"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { dentroDoLimite, HORA } from "@/lib/limites";
import { cidadeOficial } from "@/lib/municipios";
import { chaveCidade } from "@/lib/cidades";
import { PRAZO_MAX_MESES } from "@/lib/pedidos/pedidos";
import {
  contarCompativeis,
  saidaDoPedido,
  type ImovelDaCidade,
  type ResultadoContador,
} from "@/lib/pedidos/contador";

export interface RascunhoContador {
  cidade: string;
  uf: string;
  dataInicio: string;
  prazoMeses: number;
  orcamentoMensal: number;
  qtdOcupantes: number;
  pets: boolean;
  criancas: boolean;
}

const CONTAGENS_POR_HORA = 240;

async function chaveDoVisitante(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || "desconhecido";
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads";
  return crypto.createHmac("sha256", segredo).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Quantos imóveis combinam com o pedido que a pessoa ainda está preenchendo
 * (ordem 8dca1437). Devolve só números e uma dica — nunca dados do imóvel nem
 * do dono. Vale para visitante (a página é pública); limitado por IP (hash).
 * null = ainda faltam campos, cidade inválida ou sem backend.
 */
export async function contarImoveisQueCombinam(r: RascunhoContador): Promise<ResultadoContador | null> {
  const oficial = cidadeOficial(r.cidade ?? "", r.uf ?? "");
  if (!oficial) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.dataInicio ?? "") || Number.isNaN(Date.parse(`${r.dataInicio}T00:00:00Z`))) return null;
  const meses = Math.round(Number(r.prazoMeses));
  if (!(meses >= 1 && meses <= PRAZO_MAX_MESES)) return null;
  const orcamento = Number(r.orcamentoMensal);
  if (!(orcamento > 0 && orcamento <= 1_000_000)) return null;
  const ocupantes = Math.round(Number(r.qtdOcupantes));
  if (!(ocupantes >= 1 && ocupantes <= 50)) return null;

  const admin = createAdminClient();
  if (!admin) return null;
  if (!(await dentroDoLimite(`pedido-contador:${await chaveDoVisitante()}`, CONTAGENS_POR_HORA, HORA))) return null;

  const { data, error } = await admin
    .from("properties")
    .select(
      "id, owner_id, city, state, monthly_price, condo_fee, utilities_mode, utilities_estimate, " +
        "min_period_days, max_period_days, max_guests, pets_allowed, children_allowed, faixas_aceitas, " +
        "available_from, available_until"
    )
    .eq("status", "active");
  if (error || !data) return null;
  type Linha = {
    id: string;
    owner_id: string;
    city: string | null;
    state: string | null;
    monthly_price: number | null;
    condo_fee: number | null;
    utilities_mode: string | null;
    utilities_estimate: number | null;
    min_period_days: number | null;
    max_period_days: number | null;
    max_guests: number | null;
    pets_allowed: boolean | null;
    children_allowed: boolean | null;
    faixas_aceitas: string[] | null;
    available_from: string | null;
    available_until: string | null;
  };
  const daCidade = (data as unknown as Linha[]).filter(
    (p) =>
      chaveCidade(p.city) === chaveCidade(oficial.cidade) &&
      (!p.state || p.state.toUpperCase() === oficial.uf.toUpperCase())
  );
  if (daCidade.length === 0) return { combinam: 0, naCidade: 0, dica: null };

  // Só entra imóvel com o documento DESTE imóvel aprovado (mesma regra do banco).
  const ids = daCidade.map((p) => p.id);
  const { data: checks } = await admin
    .from("qualification_checklists")
    .select("property_id, owner_id, document_status, created_at")
    .in("property_id", ids)
    .order("created_at", { ascending: false });
  const aprovado = new Set<string>();
  const visto = new Set<string>();
  for (const c of (checks ?? []) as { property_id: string; owner_id: string; document_status: string | null }[]) {
    if (visto.has(c.property_id)) continue;
    visto.add(c.property_id);
    const dono = daCidade.find((p) => p.id === c.property_id)?.owner_id;
    if (c.owner_id === dono && c.document_status === "approved") aprovado.add(c.property_id);
  }
  const elegiveis = daCidade.filter((p) => aprovado.has(p.id));
  if (elegiveis.length === 0) return { combinam: 0, naCidade: 0, dica: null };

  // Contrato ativo ou bloqueio que cruza o período pedido.
  const entrada = r.dataInicio;
  const saida = saidaDoPedido(r.dataInicio, meses);
  const idsElegiveis = elegiveis.map((p) => p.id);
  const ocupados = new Set<string>();
  const { data: bloqueios } = await admin
    .from("property_blocks")
    .select("property_id")
    .in("property_id", idsElegiveis)
    .lte("inicio", saida)
    .gte("fim", entrada);
  for (const b of (bloqueios ?? []) as { property_id: string }[]) ocupados.add(b.property_id);
  const { data: blocos } = await admin
    .from("contrato_blocos")
    .select("status, inicio, fim, contratos!inner(property_id, status)")
    .in("status", ["ativo", "agendado"])
    .lte("inicio", saida)
    .gte("fim", entrada)
    .eq("contratos.status", "ativo")
    .in("contratos.property_id", idsElegiveis);
  for (const b of (blocos ?? []) as unknown as { contratos: { property_id: string } | { property_id: string }[] }[]) {
    const c = Array.isArray(b.contratos) ? b.contratos[0] : b.contratos;
    if (c?.property_id) ocupados.add(c.property_id);
  }

  const lista: ImovelDaCidade[] = elegiveis.map((p) => ({
    total:
      Number(p.monthly_price ?? 0) +
      Number(p.condo_fee ?? 0) +
      (p.utilities_mode === "fixed" ? Number(p.utilities_estimate ?? 0) : 0),
    minDias: p.min_period_days ?? 30,
    maxDias: p.max_period_days ?? 180,
    maxHospedes: p.max_guests,
    aceitaPets: !!p.pets_allowed,
    aceitaCriancas: !!p.children_allowed,
    faixasAceitas: p.faixas_aceitas ?? [],
    disponivelDesde: p.available_from,
    disponivelAte: p.available_until,
    ocupadoNoPeriodo: ocupados.has(p.id),
  }));
  return contarCompativeis(
    { dataInicio: entrada, prazoMeses: meses, ocupantes, orcamento, pets: !!r.pets, criancas: !!r.criancas },
    lista
  );
}
