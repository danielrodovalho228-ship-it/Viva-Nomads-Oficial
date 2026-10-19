"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHAVE_ULTIMA_BUSCA, serializarUltimaBusca } from "@/lib/marcas/regra";
import { SlidersHorizontal, ChevronDown, MapPin, ArrowRight, Users, Search, Megaphone } from "lucide-react";
import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/property-card";
import { BarraComparar } from "@/components/busca/barra-comparar";
import { alternarSelecao } from "@/lib/busca/comparar";
// O mapa (Mapbox com chave; senão Leaflet + CARTO) só carrega no navegador e
// só no computador (ordem ca0e7dad: no celular a busca segue sem mapa).
const SearchMap = dynamic(
  () => import("@/components/search-map").then((m) => m.SearchMap),
  { ssr: false }
);
import { EmptySearchIllustration } from "@/components/illustrations";
import { cn, distanceKm, formatBRL } from "@/lib/utils";
import { tierFromPhotoCount, searchPriority } from "@/lib/listing";
import { comTotalMes } from "@/lib/precos";
import { prioridadeNaBusca } from "@/lib/preco-justo";
import { LocationSearch } from "@/components/location-search";
import type { GeoSuggestion } from "@/lib/integrations/geocoding";
import { PROPERTY_TYPES } from "@/lib/amenities";
import { registrarEvento } from "@/lib/eventos/registrar";
import { ConviteCidade } from "@/components/cidades/convite-cidade";
import { chaveCidade } from "@/lib/cidades";
import { FAIXAS, GARANTIAS_FAIXA, GARANTIAS_PUBLICAS, CAUCAO_PARCELADA_UI } from "@/lib/faixas";
import { SELO_NF_UI } from "@/lib/flags";
import { PainelFiltrosCelular } from "@/components/busca/painel-filtros-celular";
import { COMODIDADES_FILTRO, ROTULO_COMODIDADE, comodidadesDaUrl, type ComodidadeFiltro } from "@/lib/busca/filtro-comodidades";
import { OPCOES_PORTE_PET, ROTULO_PORTE_CURTO, contarFiltrosPainel, passaNoPainel, precoDeBusca, resumoFiltros, type FiltrosPainel } from "@/lib/busca/painel-filtros";
import { TituloBuscaContexto } from "@/components/busca/titulo-busca";
import { buttonClasses } from "@/components/ui/button";
import { SalvarBusca } from "@/components/busca/salvar-busca";
import { isExemplo } from "@/lib/demo-listing";
import { mostrarCartaoPedido, semExemplosQuandoHaReal, TEXTO_CARTAO_PEDIDO, TEXTO_PUBLICAR_PEDIDO } from "@/lib/busca/exemplos-e-pedido";
import { DescricaoBusca } from "@/components/busca/descricao-busca";
import type { ChaveChip, FiltrosDescricao } from "@/lib/busca/descricao-filtros";

// Filtro de garantia exibido na busca pública: caução unificada + seguro-fiança
// (a modalidade parcelada fica fora da UI até o parecer — B1). Religa com a flag.
const GARANTIAS_FILTRO = CAUCAO_PARCELADA_UI ? GARANTIAS_FAIXA : GARANTIAS_PUBLICAS;

/** Raio (km) padrão ao redor de um endereço geocodificado. */
const DEFAULT_RADIUS_KM = 10;

/** Normaliza o tipo do imóvel (chave canônica ou rótulo legado) p/ a chave. */
function typeValue(pt: string): string {
  const low = pt.toLowerCase();
  if (PROPERTY_TYPES.some((t) => t.value === low)) return low;
  const m = PROPERTY_TYPES.find(
    (t) => t.label.toLowerCase() === low || t.label.toLowerCase().startsWith(low)
  );
  return m?.value ?? low;
}

// CTA do Pedido de Moradia no zero-resultado. Ligado por padrão (a rota
// /pedidos/novo já existe); desligue com NEXT_PUBLIC_PEDIDO_MORADIA=off.
const PEDIDO_MORADIA_ON = process.env.NEXT_PUBLIC_PEDIDO_MORADIA !== "off";

/** ISO (yyyy-mm-dd) → dd/mm/aaaa (pt-BR), sem depender do locale do navegador. */
function formatDatePtBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Rótulo do "Período da estadia" (dias → faixa de meses) para os chips ativos. */
const PERIODO_LABEL: Record<number, string> = {
  60: "1–2 meses",
  120: "3–4 meses",
  180: "5–6 meses",
};

function aceitaGarantia(p: Property, g: string): boolean {
  if (!g) return true;
  const arr = p.garantiasAceitas ?? [];
  if (g === "seguro_fianca") return arr.includes("seguro_fianca") || !!p.acceptsInsurance;
  // "caucao" (filtro público unificado) casa qualquer modalidade de caução.
  if (g === "caucao")
    return arr.some((x) => x === "caucao" || x.startsWith("caucao_"));
  return arr.includes(g); // caucao_avista | caucao_parcelada | titulo
}

export function SearchClient({ properties: imoveis, topo }: { properties: Property[]; /** Título (e banner do tablet) vindo da página. */ topo?: React.ReactNode }) {
  // Filtro, ordem e pino usam o total do mês do cartão (ordem 826719b1, D1).
  const properties = useMemo(() => imoveis.map((p) => comTotalMes(p)), [imoveis]);
  const [locationQuery, setLocationQuery] = useState("");
  // Coordenadas de um endereço escolhido no autocomplete (filtra por raio).
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Raio (km) ao redor do endereço buscado — ajustável quando há endereço.
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBedrooms, setMinBedrooms] = useState(0);
  // Hóspedes (Onda 1): adultos + crianças → filtra pela capacidade do imóvel.
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [maxPeriod, setMaxPeriod] = useState(0); // período mínimo aceito <= X
  const [typeFilter, setTypeFilter] = useState(""); // tipo de imóvel ("" = todos)
  const [faixa, setFaixa] = useState(""); // faixa de prazo ("" = todas)
  const [dataEntrada, setDataEntrada] = useState(""); // disponível até esta data de entrada
  const [garantia, setGarantia] = useState(""); // "" | caucao_avista | caucao_parcelada | titulo | seguro_fianca
  const [petsOnly, setPetsOnly] = useState(false);
  const [petPorte, setPetPorte] = useState<FiltrosPainel["petPorte"]>("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [readyToLiveOnly, setReadyToLiveOnly] = useState(false);
  const [homeOfficeOnly, setHomeOfficeOnly] = useState(false);
  const [comodidades, setComodidades] = useState<ComodidadeFiltro[]>([]); // Wi-Fi, cozinha, garagem, lavar (ordem 583d2e71)
  const [workLocatedOnly, setWorkLocatedOnly] = useState(false);
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const [insuranceOnly, setInsuranceOnly] = useState(false);
  const [operatedOnly, setOperatedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); // acordeão de filtros (legado, sm+)
  const [painelAberto, setPainelAberto] = useState(false); // painel de filtros do celular (ordem 314f764e)
  const [drawerOpen, setDrawerOpen] = useState(false); // painel "Mais filtros" (Fase 2)
  const [activeId, setActiveId] = useState<string | null>(null); // hover: card ↔ pin (só destaque)
  const [comparar, setComparar] = useState<string[]>([]); // ordem fdd61de0: até 3 imóveis marcados
  const [avisoComparar, setAvisoComparar] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null); // pin clicado: card aberto no mapa
  // Mapa só a partir de 1024 px (lg): no celular/tablet nem carrega o componente.
  const [comMapa, setComMapa] = useState(false);
  // Ordem eac7e3a1 (computador): a busca compacta fica no cabeçalho; os filtros abrem num painel logo abaixo.
  const [slotHeader, setSlotHeader] = useState<HTMLElement | null>(null);
  const [painelFiltros, setPainelFiltros] = useState(false);
  // Borda de baixo do cabeçalho: o aviso de testes acima dele some ao rolar.
  const [topoPainel, setTopoPainel] = useState(72);
  const painelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // O slot é do cabeçalho (fora desta árvore): só existe no DOM depois de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlotHeader(document.getElementById("slot-busca-header"));
  }, []);
  useEffect(() => {
    if (!painelFiltros) return;
    const medir = () => {
      const fim = slotHeader?.closest("header")?.getBoundingClientRect().bottom;
      if (fim !== undefined) setTopoPainel(Math.max(0, Math.round(fim)));
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      // Alvo que saiu do DOM no próprio clique (ex.: o Limpar do painel some ao zerar) não conta como "fora".
      if (!alvo.isConnected || painelRef.current?.contains(alvo) || slotHeader?.contains(alvo)) return;
      // Popovers dos filtros (hóspedes, endereço) moram dentro do painel; o resto fecha.
      setPainelFiltros(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPainelFiltros(false);
    // "click" (não "mousedown"): o botão clicado fora (ex.: Limpar filtros) age antes do
    // painel fechar — fechar no mousedown mudava o layout e o clique caía em outro lugar.
    document.addEventListener("click", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [painelFiltros, slotHeader]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const aplicar = () => setComMapa(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  const [sort, setSort] = useState<"relevance" | "recent" | "price-asc" | "price-desc">("relevance");

  // Pula a 1ª execução do efeito de sync (no mount, com estado ainda vazio):
  // como os setState da restauração são assíncronos, deixar o sync rodar no
  // mount apagaria os parâmetros da URL antes do estado restaurado committar.
  const skipNextSync = useRef(true);

  // Restaura a busca da URL: endereço/raio + todos os filtros, para links
  // compartilhados e reloads mostrarem exatamente os filtros ativos (M7).
  const restaurarFiltrosDaURL = useCallback(() => {
    const sp = new URLSearchParams(window.location.search);
    const local = sp.get("local");
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const r = Number(sp.get("r"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (local) setLocationQuery(local);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      setGeoCenter({ lat, lng });
      if ([5, 10, 20].includes(r)) setRadiusKm(r);
    }
    const num = (k: string) => Number(sp.get(k)) || 0;
    // Preço: aceita `orcamento` (busca do hero) OU `preco` (sync interno) — A3.
    const orc = num("orcamento") || num("preco");
    if (orc >= 300 && orc <= 50000) setMaxPrice(orc);
    if ([1, 2, 3].includes(num("quartos"))) setMinBedrooms(num("quartos"));
    if (num("adultos") >= 1) setAdults(Math.min(16, num("adultos")));
    if (num("criancas") >= 1) setChildren(Math.min(10, num("criancas")));
    // Período: novos valores (60/120/180 = 1–2/3–4/5–6 meses) + legado do hero
    // (30/90 → mapeados) — A3: a URL reflete no controle "Período da estadia".
    const per = num("periodo");
    const perMap: Record<number, number> = { 30: 60, 60: 60, 90: 120, 120: 120, 180: 180 };
    if (perMap[per]) setMaxPeriod(perMap[per]);
    const ordem = sp.get("ordem");
    if (ordem === "recent" || ordem === "price-asc" || ordem === "price-desc") setSort(ordem);
    const tipo = sp.get("tipo");
    if (tipo && PROPERTY_TYPES.some((t) => t.value === tipo)) setTypeFilter(tipo);
    const fx = sp.get("faixa");
    if (fx && FAIXAS.some((f) => f.key === fx)) setFaixa(fx);
    const ent = sp.get("entrada");
    if (ent && /^\d{4}-\d{2}-\d{2}$/.test(ent)) setDataEntrada(ent);
    const gar = sp.get("garantia");
    if (gar && GARANTIAS_FILTRO.some((g) => g.key === gar)) setGarantia(gar);
    const on = (k: string) => sp.get(k) === "1";
    if (on("pet")) setPetsOnly(true);
    const porte = sp.get("porte");
    if (on("pet") && (porte === "P" || porte === "M" || porte === "G")) setPetPorte(porte);
    if (on("mobiliado")) setFurnishedOnly(true);
    if (on("pronto")) setReadyToLiveOnly(true);
    if (on("homeoffice")) setHomeOfficeOnly(true);
    if (on("localizado")) setWorkLocatedOnly(true);
    // "Com Nota Fiscal" só existe com a chave do selo ligada (aluguel de PF é recibo, não NF).
    if (SELO_NF_UI && on("nota")) setInvoiceOnly(true);
    if (on("seguro")) setInsuranceOnly(true);
    if (on("gestor")) setOperatedOnly(true);
    setComodidades(comodidadesDaUrl(sp.get("comod")));
  }, []);

  // Restaura no mount (link compartilhado / reload) e re-aplica a cada
  // voltar/avançar do navegador (popstate) — sem o listener, navegar no
  // histórico deixaria os controles dessincronizados da URL. Ao re-aplicar por
  // popstate, marca skipNextSync para não reescrever a URL que o histórico
  // acabou de restaurar.
  useEffect(() => {
    // Lê a URL (sistema externo) e aplica nos controles; só roda no navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restaurarFiltrosDaURL();
  }, [restaurarFiltrosDaURL]);

  useEffect(() => {
    const onPop = () => {
      skipNextSync.current = true;
      restaurarFiltrosDaURL();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [restaurarFiltrosDaURL]);

  // Reflete a busca atual na URL (replaceState — sem recarregar nem rolar),
  // para o endereço e o raio serem compartilháveis / sobreviverem a um reload.
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const label = locationQuery.trim();
    if (label) params.set("local", label);
    else params.delete("local");
    if (geoCenter) {
      params.set("lat", geoCenter.lat.toFixed(6));
      params.set("lng", geoCenter.lng.toFixed(6));
      params.set("r", String(radiusKm));
    } else {
      params.delete("lat");
      params.delete("lng");
      params.delete("r");
    }
    const put = (k: string, on: boolean, v: string) => (on ? params.set(k, v) : params.delete(k));
    put("preco", maxPrice > 0, String(maxPrice));
    put("quartos", minBedrooms > 0, String(minBedrooms));
    put("adultos", adults > 1, String(adults));
    put("criancas", children > 0, String(children));
    put("periodo", maxPeriod > 0, String(maxPeriod));
    put("tipo", !!typeFilter, typeFilter);
    put("faixa", !!faixa, faixa);
    put("entrada", !!dataEntrada, dataEntrada);
    put("garantia", !!garantia, garantia);
    put("ordem", sort !== "relevance", sort);
    put("pet", petsOnly, "1");
    put("porte", petsOnly && !!petPorte, petPorte);
    put("mobiliado", furnishedOnly, "1");
    put("pronto", readyToLiveOnly, "1");
    put("homeoffice", homeOfficeOnly, "1");
    put("localizado", workLocatedOnly, "1");
    put("nota", invoiceOnly, "1");
    put("seguro", insuranceOnly, "1");
    put("gestor", operatedOnly, "1");
    put("comod", comodidades.length > 0, comodidades.join(","));
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, [
    locationQuery, geoCenter, radiusKm, maxPrice, minBedrooms, adults, children, maxPeriod, sort,
    typeFilter, faixa, dataEntrada, garantia, petsOnly, petPorte, furnishedOnly,
    readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly, comodidades,
  ]);

  // Pedido pré-preenchido (ordem 8302024d): guarda no aparelho a data de entrada e o período da última
  // busca; a página do imóvel usa para sugerir a data (editável). Nada de dado pessoal, nada vai ao servidor.
  useEffect(() => {
    try {
      if (dataEntrada || maxPeriod > 0 || adults + children > 1) {
        window.localStorage.setItem(
          CHAVE_ULTIMA_BUSCA,
          serializarUltimaBusca({ inicio: dataEntrada, meses: maxPeriod > 0 ? Math.round(maxPeriod / 30) : 0, pessoas: adults + children })
        );
      }
    } catch {
      /* localStorage bloqueado: segue sem guardar */
    }
  }, [dataEntrada, maxPeriod, adults, children]);

  // Evento anônimo "busca" (0067): 1 por local pesquisado, depois que a pessoa
  // para de digitar. Só a CIDADE vai (e só se for de um anúncio da lista) —
  // nunca o texto digitado, que pode ser um endereço.
  const ultimaBusca = useRef<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = chaveCidade(locationQuery);
      const cidade = q ? (properties.find((p) => p.city && q.includes(chaveCidade(p.city)))?.city ?? null) : null;
      const chave = cidade ? chaveCidade(cidade) : q ? "?" : "";
      if (ultimaBusca.current === chave) return;
      ultimaBusca.current = chave;
      registrarEvento("busca", { cidade });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [locationQuery, properties]);

  // Muda a cada "Limpar filtros": remonta a busca por descrição (campo e chips) — ordem 826719b1, D5.
  const [reinicioDescricao, setReinicioDescricao] = useState(0);
  // Zera todos os filtros (usado no estado vazio para o usuário recomeçar).
  function clearFilters() {
    setReinicioDescricao((n) => n + 1);
    setLocationQuery("");
    setGeoCenter(null);
    setRadiusKm(DEFAULT_RADIUS_KM);
    setMaxPrice(0);
    setMinBedrooms(0);
    setAdults(1);
    setChildren(0);
    setMaxPeriod(0);
    setTypeFilter("");
    setFaixa("");
    setDataEntrada("");
    setGarantia("");
    setPetsOnly(false); setPetPorte("");
    setFurnishedOnly(false);
    setReadyToLiveOnly(false);
    setHomeOfficeOnly(false);
    setWorkLocatedOnly(false);
    setInvoiceOnly(false);
    setInsuranceOnly(false);
    setOperatedOnly(false);
    setComodidades([]);
    setSort("relevance");
  }

  // Filtros do painel do celular (preço, quartos, pets, home office, selo): a
  // MESMA regra para a lista e para a contagem "Mostrar N imóveis" do painel.
  const filtrosPainel: FiltrosPainel = useMemo(
    () => ({ maxPrice, minBedrooms, petsOnly, petPorte, homeOfficeOnly, readyToLiveOnly, comodidades }),
    [maxPrice, minBedrooms, petsOnly, petPorte, homeOfficeOnly, readyToLiveOnly, comodidades]
  );

  const { base, dist } = useMemo(() => {
    const loc = locationQuery.trim().toLowerCase();
    // Distância calculada UMA vez por imóvel quando há endereço — reusada no
    // filtro por raio e na ordenação por proximidade (evita recomputar o
    // haversine N + ~2·N·log N vezes a cada digitação).
    const dist = geoCenter
      ? new Map(
          properties.map((p) => [p.id, distanceKm(geoCenter.lat, geoCenter.lng, p.lat, p.lng)])
        )
      : null;
    const list = properties.filter((p) => {
      // Com endereço geocodificado, filtra por raio; senão, por nome (bairro/cidade).
      if (dist) {
        if (dist.get(p.id)! > radiusKm) return false;
      } else if (loc && !`${p.neighborhood} ${p.city}`.toLowerCase().includes(loc)) {
        return false;
      }
      // Hóspedes: só exclui quando a capacidade É conhecida e menor que o total
      // (imóveis sem capacidade cadastrada continuam aparecendo — não some estoque).
      if (p.maxGuests != null && p.maxGuests < adults + children) return false;
      if (maxPeriod && p.minPeriodDays > maxPeriod) return false;
      if (typeFilter && typeValue(p.propertyType) !== typeFilter) return false;
      if (faixa && !(p.faixasAceitas ?? []).includes(faixa)) return false;
      if (dataEntrada && p.availableFrom && p.availableFrom > dataEntrada) return false;
      if (garantia && !aceitaGarantia(p, garantia)) return false;
      if (furnishedOnly && !p.furnished) return false;
      if (workLocatedOnly && !p.tagWorkLocated) return false;
      if (invoiceOnly && !p.issuesInvoice) return false;
      if (insuranceOnly && !p.acceptsInsurance) return false;
      if (operatedOnly && !(p.ownershipType !== "own" && p.subleaseAuthorized)) return false;
      return true;
    });
    return { base: list, dist };
  }, [properties, locationQuery, geoCenter, radiusKm, adults, children, maxPeriod, typeFilter, faixa, dataEntrada, garantia, furnishedOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly]);

  const contarComPainel = useCallback(
    (f: FiltrosPainel) => semExemplosQuandoHaReal(base.filter((p) => passaNoPainel(p, f)), (p) => isExemplo(p.id)).length,
    [base]
  );

  const results = useMemo(() => {
    let list = base.filter((p) => passaNoPainel(p, filtrosPainel));
    // Prompt 30, item 6: com imóvel real no resultado, os exemplos saem; só exemplos → aparecem marcados "exemplo".
    list = semExemplosQuandoHaReal(list, (p) => isExemplo(p.id));
    if (sort === "price-asc") list = [...list].sort((a, b) => precoDeBusca(a) - precoDeBusca(b));
    else if (sort === "price-desc") list = [...list].sort((a, b) => precoDeBusca(b) - precoDeBusca(a));
    // Adicionados recentemente: mais novos (data de cadastro) primeiro.
    else if (sort === "recent")
      list = [...list].sort(
        (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    // Relevância com endereço: mais perto primeiro; senão, anúncios mais completos.
    else if (dist)
      list = [...list].sort((a, b) => dist.get(a.id)! - dist.get(b.id)!);
    else
      list = [...list].sort(
        (a, b) =>
          prioridadeNaBusca(searchPriority(tierFromPhotoCount(b.photos.length)), b.precoJusto) -
          prioridadeNaBusca(searchPriority(tierFromPhotoCount(a.photos.length)), a.precoJusto)
      );
    return list;
  }, [base, dist, filtrosPainel, sort]);

  const activeCount =
    (maxPrice ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    (adults > 1 || children > 0 ? 1 : 0) +
    (maxPeriod ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (faixa ? 1 : 0) +
    (dataEntrada ? 1 : 0) +
    (garantia ? 1 : 0) +
    [petsOnly, furnishedOnly, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly].filter(
      Boolean
    ).length +
    comodidades.length;

  // Filtros que vivem no painel "Mais filtros" (para o contador do botão).
  const secundariosAtivos =
    (typeFilter ? 1 : 0) +
    (garantia ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    [homeOfficeOnly, petsOnly, invoiceOnly, insuranceOnly, operatedOnly].filter(Boolean).length +
    comodidades.length;

  // Link do Pedido de Moradia com os parâmetros da busca já preenchidos (Fase 4).
  const pedidoHref = useMemo(() => {
    const q = new URLSearchParams();
    if (locationQuery.trim()) q.set("cidade", locationQuery.trim());
    if (dataEntrada) q.set("inicio", dataEntrada);
    if (maxPeriod > 0) q.set("meses", String(Math.round(maxPeriod / 30)));
    if (adults > 1) q.set("adultos", String(adults));
    if (children > 0) q.set("criancas", String(children));
    if (maxPrice > 0) q.set("orcamento", String(maxPrice));
    const s = q.toString();
    return `/pedidos/novo${s ? `?${s}` : ""}`;
  }, [locationQuery, dataEntrada, maxPeriod, adults, children, maxPrice]);

  // "Ampliar a busca": afrouxa os filtros secundários, mantém a cidade e a data.
  function ampliarBusca() {
    setMaxPrice(0);
    setMinBedrooms(0);
    setAdults(1);
    setChildren(0);
    setMaxPeriod(0);
    setTypeFilter("");
    setGarantia("");
    setFaixa("");
    setPetsOnly(false); setPetPorte("");
    setReadyToLiveOnly(false);
    setHomeOfficeOnly(false);
    setWorkLocatedOnly(false);
    setInvoiceOnly(false);
    setInsuranceOnly(false);
    setOperatedOnly(false);
    setComodidades([]);
    setFurnishedOnly(false);
  }

  // Busca por descrição (ordem c470bb63): cidades e bairros que existem no catálogo.
  const locaisDoCatalogo = useMemo(
    () => [...new Set(properties.flatMap((p) => [p.city, p.neighborhood]).filter(Boolean))],
    [properties]
  );
  // Só mexe no que a descrição citou; o resto dos filtros fica como a pessoa deixou.
  function aplicarDescricao(f: FiltrosDescricao) {
    if (f.maxPrice) setMaxPrice(f.maxPrice);
    if (f.minBedrooms) setMinBedrooms(f.minBedrooms);
    if (f.petsOnly) {
      setPetsOnly(true);
      setPetPorte(f.petPorte);
    }
    if (f.homeOfficeOnly) setHomeOfficeOnly(true);
    if (f.readyToLiveOnly) setReadyToLiveOnly(true);
    if (f.furnishedOnly) setFurnishedOnly(true);
    if (f.comodidades.length) setComodidades((l) => [...new Set([...l, ...f.comodidades])]);
    if (f.local) {
      setLocationQuery(f.local);
      setGeoCenter(null);
    }
  }
  function removerDescricao(chave: ChaveChip) {
    if (chave === "local") {
      setLocationQuery("");
      setGeoCenter(null);
    } else if (chave === "maxPrice") setMaxPrice(0);
    else if (chave === "minBedrooms") setMinBedrooms(0);
    else if (chave === "petsOnly") {
      setPetsOnly(false);
      setPetPorte("");
    } else if (chave === "homeOfficeOnly") setHomeOfficeOnly(false);
    else if (chave === "readyToLiveOnly") setReadyToLiveOnly(false);
    else if (chave === "furnishedOnly") setFurnishedOnly(false);
    else setComodidades((l) => l.filter((c) => c !== chave));
  }

  const nPainel = contarFiltrosPainel(filtrosPainel);
  // Muda sempre que um filtro muda: o "Salvar busca" reconsulta se a busca atual já está salva.
  const versaoBusca = [
    locationQuery, geoCenter?.lat, geoCenter?.lng, radiusKm, maxPrice, minBedrooms, adults, children, maxPeriod, sort, typeFilter,
    faixa, dataEntrada, garantia, petsOnly, petPorte, furnishedOnly, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly, comodidades.join(","),
  ].join("|");
  function aplicarPainel(f: FiltrosPainel) {
    setMaxPrice(f.maxPrice);
    setMinBedrooms(f.minBedrooms);
    setPetsOnly(f.petsOnly);
    setPetPorte(f.petsOnly ? f.petPorte : "");
    setHomeOfficeOnly(f.homeOfficeOnly);
    setReadyToLiveOnly(f.readyToLiveOnly);
    setComodidades(f.comodidades);
    setPainelAberto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // h1 dinâmico (ordem 6a98c68e): local + contagem + filtros, nos dois layouts.
  const tituloBusca = useMemo(
    () => ({ n: results.length, local: locationQuery, pronto: readyToLiveOnly, pet: petsOnly }),
    [results.length, locationQuery, readyToLiveOnly, petsOnly]
  );

  return (
    // Computador (lg+, ordens ca0e7dad e d15ef6bf): largura total; no topo a barra de
    // filtros centralizada e em destaque (fixa sob o cabeçalho), depois o título, a
    // contagem "N imóveis em <cidade>" com "Salvar busca", e a lista (~58%, 3 cards
    // por linha) + mapa fixo (~42%). A ordem visual no computador vem de `lg:order-*`.
    <TituloBuscaContexto.Provider value={tituloBusca}>
    <div className="flex flex-col py-4 sm:py-6 lg:px-6 lg:py-0" data-testid="busca">
      {topo && <div className="-mt-4 sm:-mt-6 lg:order-2 lg:mt-0">{topo}</div>}
      <DescricaoBusca key={reinicioDescricao} locais={locaisDoCatalogo} onAplicar={aplicarDescricao} onRemover={removerDescricao} />
      {slotHeader &&
        createPortal(
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <BuscaCompacta
              local={locationQuery.trim()}
              periodo={PERIODO_LABEL[maxPeriod] ?? (dataEntrada ? `Entrada ${formatDatePtBR(dataEntrada)}` : "")}
              hospedes={adults + children}
              nFiltros={activeCount}
              aberto={painelFiltros}
              onAlternar={() => setPainelFiltros((v) => !v)}
            />
            {/* Prompt 30, item 6: "Publicar pedido" sempre visível, também na barra condensada. */}
            {PEDIDO_MORADIA_ON && (
              <Link
                href={pedidoHref}
                data-testid="busca-publicar-pedido-topo"
                className="hidden h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-semibold text-forest transition hover:border-forest lg:inline-flex"
              >
                <Megaphone className="h-4 w-4" aria-hidden /> {TEXTO_PUBLICAR_PEDIDO}
              </Link>
            )}
          </div>,
          slotHeader
        )}

      {/* ── CELULAR (ordem 314f764e): busca + botão de filtros + total ── */}
      <div className="container-page mt-4 sm:hidden" data-testid="busca-celular">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-2 shadow-[0_8px_24px_-16px_rgba(11,42,102,0.35)]">
          <div className="min-w-0 flex-1">
            <LocationSearch
              placeholder="Cidade, bairro ou endereço"
              value={locationQuery}
              onChange={(text) => {
                setLocationQuery(text);
                setGeoCenter(null);
              }}
              onSelect={(s: GeoSuggestion) => {
                setLocationQuery(s.label);
                setGeoCenter({ lat: s.lat, lng: s.lng });
              }}
            />
            <p className="truncate px-3.5 pt-1 text-xs text-muted" data-testid="resumo-filtros">
              {resumoFiltros(filtrosPainel)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPainelAberto(true)}
            aria-label={nPainel ? `Filtros (${nPainel} ativos)` : "Filtros"}
            aria-haspopup="dialog"
            data-testid="abrir-filtros"
            className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line text-forest transition-colors hover:border-forest"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {nPainel > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-[11px] font-bold text-white">
                {nPainel}
              </span>
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <SalvarBusca versao={versaoBusca} />
            {PEDIDO_MORADIA_ON && (
              <Link href={pedidoHref} data-testid="busca-publicar-pedido" className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-forest underline">
                <Megaphone className="h-4 w-4" aria-hidden /> {TEXTO_PUBLICAR_PEDIDO}
              </Link>
            )}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                data-testid="limpar-filtros-celular"
                className="ml-2 whitespace-nowrap text-sm font-medium text-forest underline hover:text-blue-700"
              >
                Limpar filtros ({activeCount})
              </button>
            )}
          </div>
          <Select
            label="Ordenar resultados"
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            options={[
              ["relevance", "Relevância"],
              ["recent", "Mais recentes"],
              ["price-asc", "Menor preço"],
              ["price-desc", "Maior preço"],
            ]}
          />
        </div>
      </div>
      {painelAberto && (
        <PainelFiltrosCelular
          inicial={filtrosPainel}
          contar={contarComPainel}
          onAplicar={aplicarPainel}
          onFechar={() => setPainelAberto(false)}
        />
      )}

      {/* Filtros do tablet (caixa) e do computador: no computador, aberto pela busca
          compacta do cabeçalho, uma faixa presa sob o cabeçalho com a barra CENTRALIZADA.
          Ordem 65116a07: a faixa ocupa espaço (sticky, não fixed) — empurra o título e a
          linha com "Limpar filtros" em vez de cobri-los. Os mesmos controles nos dois. */}
      <div
        ref={painelRef}
        data-testid="filtros-barra"
        data-aberto={painelFiltros ? "1" : "0"}
        style={painelFiltros ? ({ "--topo-painel": `${topoPainel}px` } as React.CSSProperties) : undefined}
        className={cn(
          "container-page hidden sm:block lg:order-1",
          painelFiltros
            ? "lg:sticky lg:top-(--topo-painel) lg:z-30 lg:-mx-6 lg:flex lg:w-auto lg:max-w-none lg:justify-center lg:border-b lg:border-line lg:bg-white lg:px-6 lg:py-4 lg:shadow-[0_18px_30px_-20px_rgba(10,10,10,0.35)]"
            : "lg:hidden"
        )}
      >
      <div
        data-testid="filtros-caixa"
        className="rounded-2xl border border-sage-200 bg-white p-4 lg:relative lg:max-w-full lg:rounded-full lg:border-line lg:px-2.5 lg:py-2 lg:shadow-[0_10px_30px_-14px_rgba(10,10,10,0.35)]"
      >
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex items-center gap-2 text-sm font-medium text-forest sm:pointer-events-none"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {activeCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform sm:hidden",
                filtersOpen && "rotate-180"
              )}
            />
          </button>
          <Select
            label="Ordenar resultados"
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            options={[
              ["relevance", "Relevância"],
              ["recent", "Adicionados recentemente"],
              ["price-asc", "Menor preço"],
              ["price-desc", "Maior preço"],
            ]}
          />
        </div>

        <div
          className={cn(
            "mt-3 flex-wrap items-center gap-2.5 sm:flex lg:mt-0 lg:flex-nowrap lg:gap-2",
            filtersOpen ? "flex" : "hidden"
          )}
        >
          {/* Localização: geocoding de endereço (Mapbox) ou bairros por nome */}
          <LocationSearch
            value={locationQuery}
            onChange={(text) => {
              setLocationQuery(text);
              setGeoCenter(null);
            }}
            onSelect={(s: GeoSuggestion) => {
              setLocationQuery(s.label);
              setGeoCenter({ lat: s.lat, lng: s.lng });
            }}
          />
          {geoCenter && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-surface-2 py-1 pl-3 pr-1.5 text-sm text-ink">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="text-muted">Raio</span>
              <select
                value={String(radiusKm)}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                aria-label="Raio de busca"
                className="rounded-full bg-transparent py-1 pl-1 pr-0.5 font-medium text-ink outline-none focus:text-forest"
              >
                {[5, 10, 20].map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setLocationQuery("");
                  setGeoCenter(null);
                  setRadiusKm(DEFAULT_RADIUS_KM);
                }}
                className="rounded-full px-2 py-1 font-medium text-forest hover:bg-white"
                title="Limpar endereço"
              >
                limpar
              </button>
            </div>
          )}
          <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-sage-200 bg-white px-4 py-2 text-sm text-ink lg:px-3 xl:px-4">
            <span className="text-muted lg:hidden xl:inline">
              Entrada<span className="lg:hidden"> a partir de</span>
            </span>
            <input
              type="date"
              lang="pt-BR"
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
              aria-label="Data de entrada desejada (a partir de)"
              className="bg-transparent text-ink outline-none focus:text-forest"
            />
          </label>
          <Select
            label="Preço máximo"
            value={String(maxPrice)}
            onChange={(v) => setMaxPrice(Number(v))}
            options={[
              ["0", "Qualquer preço"],
              ["2500", "Até R$ 2.500"],
              ["3500", "Até R$ 3.500"],
              ["5000", "Até R$ 5.000"],
              // Teto vindo da busca por descrição (ex.: 2.000): aparece como opção para o select não ficar em branco.
              ...(maxPrice > 0 && ![2500, 3500, 5000].includes(maxPrice) ? ([[String(maxPrice), `Até ${formatBRL(maxPrice)}`]] as [string, string][]) : []),
            ]}
          />
          <GuestsPicker
            adults={adults}
            childrenCount={children}
            onAdults={setAdults}
            onChildren={setChildren}
          />
          <Select
            label="Período da estadia"
            value={String(maxPeriod)}
            onChange={(v) => setMaxPeriod(Number(v))}
            options={[
              ["0", "Período da estadia"],
              ["60", "1–2 meses"],
              ["120", "3–4 meses"],
              ["180", "5–6 meses"],
            ]}
          />

          {/* Selo proprietário — único elemento de marca na barra primária. */}
          <Chip on={readyToLiveOnly} onClick={() => setReadyToLiveOnly((v) => !v)} accent="gold" rotulo="Pronto para Morar">
            🏅 Pronto<span className="lg:hidden xl:inline"> para Morar</span>
          </Chip>

          {/* Botão que abre/fecha os filtros secundários (2 níveis — Fase 2). No
              tablet abrem na própria caixa; no computador, num painel abaixo da faixa. */}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? "Menos filtros" : "Mais filtros"}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-medium text-forest hover:border-sage lg:px-3 xl:px-4"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="lg:hidden xl:inline">{drawerOpen ? "Menos filtros" : "Mais filtros"}</span>
            <span className="hidden lg:inline xl:hidden">Filtros</span>
            {secundariosAtivos > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-xs font-semibold text-white">
                {secundariosAtivos}
              </span>
            )}
          </button>

          {/* 'Mobiliado' removido: todo imóvel da plataforma é mobiliado (promessa
              da marca, não filtro). 'Bem localizado' removido: subjetivo, não
              filtra nada objetivo. Dados no banco preservados. */}

          {/* Ordem 65116a07: com o painel aberto, "Limpar filtros" fica dentro dele
              (sempre visível e clicável, mesmo com a página rolada). */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              data-testid="limpar-filtros-painel"
              className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium text-forest underline underline-offset-2 hover:bg-surface-2 lg:inline-flex"
            >
              Limpar filtros ({activeCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setPainelFiltros(false)}
            data-testid="fechar-painel-filtros"
            className={buttonClasses({ size: "sm", className: "hidden shrink-0 whitespace-nowrap lg:inline-flex" })}
          >
            Ver {results.length} {results.length === 1 ? "imóvel" : "imóveis"}
          </button>

          {drawerOpen && (
            <div
              data-testid="mais-filtros-painel"
              className="contents lg:absolute lg:right-0 lg:top-full lg:z-40 lg:mt-2 lg:flex lg:w-[32rem] lg:flex-wrap lg:gap-2 lg:rounded-2xl lg:border lg:border-sage-200 lg:bg-white lg:p-4 lg:shadow-xl"
            >
              <Select
                label="Tipo de imóvel"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[["", "Tipo de imóvel"], ...PROPERTY_TYPES.map((t) => [t.value, t.label] as [string, string])]}
              />
              <Select
                label="Garantia aceita"
                value={garantia}
                onChange={setGarantia}
                options={[["", "Garantia aceita"], ...GARANTIAS_FILTRO.map((g) => [g.key, g.label] as [string, string])]}
              />
              <Select
                label="Quartos (mínimo)"
                value={String(minBedrooms)}
                onChange={(v) => setMinBedrooms(Number(v))}
                options={[
                  ["0", "Quartos"],
                  ["1", "1+ quarto"],
                  ["2", "2+ quartos"],
                  ["3", "3+ quartos"],
                ]}
              />
              <Chip on={homeOfficeOnly} onClick={() => setHomeOfficeOnly((v) => !v)}>
                💻 Para trabalhar de casa
              </Chip>
              <Chip on={petsOnly} onClick={() => { setPetsOnly((v) => !v); setPetPorte(""); }}>
                🐾 Aceita pets
              </Chip>
              {petsOnly && (
                <div data-testid="filtro-porte-pet" className="contents">
                  <Select
                    label="Porte do pet"
                    value={petPorte}
                    onChange={(v) => setPetPorte(v === "P" || v === "M" || v === "G" ? v : "")}
                    options={OPCOES_PORTE_PET.map((o) => [o.valor, o.rotulo === "Qualquer porte" ? "Porte do pet" : o.rotulo] as [string, string])}
                  />
                </div>
              )}
              {SELO_NF_UI && (
                <Chip on={invoiceOnly} onClick={() => setInvoiceOnly((v) => !v)}>
                  📄 Com Nota Fiscal
                </Chip>
              )}
              <Chip on={insuranceOnly} onClick={() => setInsuranceOnly((v) => !v)}>
                🛡️ Seguro-Fiança
              </Chip>
              <Chip on={operatedOnly} onClick={() => setOperatedOnly((v) => !v)}>
                🤝 Gestor profissional
              </Chip>
              {COMODIDADES_FILTRO.map((c) => (
                <Chip
                  key={c.chave}
                  on={comodidades.includes(c.chave)}
                  onClick={() => setComodidades((l) => (l.includes(c.chave) ? l.filter((x) => x !== c.chave) : [...l, c.chave]))}
                >
                  {c.rotulo}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* Filtros ativos (chips removíveis) + Limpar filtros (Fase 2). */}
        {activeCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 lg:hidden">
            {maxPrice > 0 && (
              <ActiveChip label={`Até ${formatBRL(maxPrice)}`} onClear={() => setMaxPrice(0)} />
            )}
            {minBedrooms > 0 && (
              <ActiveChip label={`${minBedrooms}+ quartos`} onClear={() => setMinBedrooms(0)} />
            )}
            {(adults > 1 || children > 0) && (
              <ActiveChip
                label={`${adults + children} ${adults + children === 1 ? "morador" : "moradores"}`}
                onClear={() => {
                  setAdults(1);
                  setChildren(0);
                }}
              />
            )}
            {maxPeriod > 0 && (
              <ActiveChip label={PERIODO_LABEL[maxPeriod] ?? "Período"} onClear={() => setMaxPeriod(0)} />
            )}
            {typeFilter && (
              <ActiveChip
                label={PROPERTY_TYPES.find((t) => t.value === typeFilter)?.label ?? "Tipo"}
                onClear={() => setTypeFilter("")}
              />
            )}
            {dataEntrada && (
              <ActiveChip
                label={`Entrada ${formatDatePtBR(dataEntrada)}`}
                onClear={() => setDataEntrada("")}
              />
            )}
            {garantia && (
              <ActiveChip
                label={GARANTIAS_FILTRO.find((g) => g.key === garantia)?.label ?? "Garantia"}
                onClear={() => setGarantia("")}
              />
            )}
            {readyToLiveOnly && (
              <ActiveChip label="Pronto para Morar" onClear={() => setReadyToLiveOnly(false)} />
            )}
            {homeOfficeOnly && (
              <ActiveChip label="Trabalhar de casa" onClear={() => setHomeOfficeOnly(false)} />
            )}
            {petsOnly && <ActiveChip label={petPorte ? `Aceita pets ${ROTULO_PORTE_CURTO[petPorte]}` : "Aceita pets"} onClear={() => { setPetsOnly(false); setPetPorte(""); }} />}
            {SELO_NF_UI && invoiceOnly && <ActiveChip label="Nota Fiscal" onClear={() => setInvoiceOnly(false)} />}
            {insuranceOnly && (
              <ActiveChip label="Seguro-Fiança" onClear={() => setInsuranceOnly(false)} />
            )}
            {operatedOnly && (
              <ActiveChip label="Gestor profissional" onClear={() => setOperatedOnly(false)} />
            )}
            {comodidades.map((c) => (
              <ActiveChip key={c} label={ROTULO_COMODIDADE[c]} onClear={() => setComodidades((l) => l.filter((x) => x !== c))} />
            ))}
            <button
              type="button"
              onClick={clearFilters}
              data-testid="limpar-filtros-chips"
              className="ml-1 text-sm font-medium text-forest underline hover:text-blue-700"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      </div>

      {/* Contagem estilo Airbnb ("15 imóveis em Uberlândia") + Salvar busca, logo
          abaixo do título (tablet e computador). */}
      <div className="container-page mt-4 hidden flex-wrap items-center justify-between gap-3 sm:flex lg:order-3 lg:mt-0 lg:max-w-none lg:px-0 lg:pb-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {/* A contagem e o local estão no título (ordem 6a98c68e); aqui só o complemento. */}
          <p className="text-base text-muted" data-testid="complemento-busca">
            {dataEntrada && <>Entrada a partir de {formatDatePtBR(dataEntrada)} · </>}
            R$ 0 de taxa para você
          </p>
          <SalvarBusca versao={versaoBusca} />
          {PEDIDO_MORADIA_ON && (
            <Link href={pedidoHref} data-testid="busca-publicar-pedido" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-forest underline lg:hidden">
              <Megaphone className="h-4 w-4" aria-hidden /> {TEXTO_PUBLICAR_PEDIDO}
            </Link>
          )}
        </div>
            <div className="hidden shrink-0 items-center gap-3 lg:flex">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  data-testid="limpar-filtros"
                  className="whitespace-nowrap text-sm font-medium text-forest underline hover:text-blue-700"
                >
                  Limpar filtros ({activeCount})
                </button>
              )}
              <Select
                label="Ordenar resultados"
                value={sort}
                onChange={(v) => setSort(v as typeof sort)}
                options={[
                  ["relevance", "Relevância"],
                  ["recent", "Mais recentes"],
                  ["price-asc", "Menor preço"],
                  ["price-desc", "Maior preço"],
                ]}
              />
            </div>
      </div>

      <div className="container-page mt-4 lg:order-4 lg:mt-0 lg:flex lg:max-w-none lg:items-start lg:gap-6 lg:px-0">
        <div data-testid="busca-lista" className="min-w-0 lg:w-[58%] lg:py-5">
          {results.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line p-12 text-center">
              <EmptySearchIllustration />
              <p className="mt-4 font-title text-lg font-bold text-ink">
                {locationQuery.trim()
                  ? `Ainda não temos imóvel para essa busca em ${locationQuery.trim()}.`
                  : "Ainda não há imóveis para esta busca"}
              </p>
              <ConviteCidade texto={locationQuery} />
              {/* Zero resultado vira PORTA do Pedido de Moradia (Fase 4). */}
              {PEDIDO_MORADIA_ON ? (
                <>
                  <p className="mt-1 max-w-md text-sm text-muted">
                    Diga o que você precisa e deixe os proprietários da cidade encontrarem você — a
                    conversa acontece pela plataforma.
                  </p>
                  <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
                    <Link
                      href={pedidoHref}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-forest transition-colors hover:brightness-105"
                    >
                      📣 Publicar um Pedido de Moradia
                    </Link>
                    <button
                      type="button"
                      onClick={ampliarBusca}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-sage hover:bg-surface-2"
                    >
                      Ampliar a busca
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 max-w-sm text-sm text-muted">
                    Ajuste os filtros ou volte em breve — novos imóveis entram toda semana.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-sage hover:bg-surface-2"
                  >
                    Limpar filtros
                  </button>
                </>
              )}
              <Link
                href="/dashboard/imoveis/novo"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:text-blue-700"
              >
                É proprietário? Anuncie seu imóvel <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            // EXCEÇÃO da regra de grade par (ordem 86dcb4db, B2; decidido pela coordenação):
            // ao lado do mapa a /buscar mantém 3 cards por linha em telas largas (aprovado na ordem ca0e7dad).
            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 sm:gap-6 lg:gap-4 xl:grid-cols-3" data-testid="grade-resultados">
              {/* h2 (invisível) entre o h1 do topo e os h3 dos cards — sem pular nível. */}
              <h2 className="sr-only">Imóveis encontrados</h2>
              {results.map((p) => (
                <div
                  key={p.id}
                  data-testid="card-resultado"
                  data-id={p.id}
                  data-destaque={activeId === p.id || selecionadoId === p.id ? "1" : "0"}
                  onMouseEnter={() => setActiveId(p.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={cn(
                    "flex h-full flex-col rounded-2xl transition-all",
                    (activeId === p.id || selecionadoId === p.id) && "ring-2 ring-forest ring-offset-2"
                  )}
                >
                  <div className="min-h-0 flex-1">
                    <PropertyCard
                      property={p}
                      periodMonths={maxPeriod > 0 ? Math.round(maxPeriod / 30) : undefined}
                    />
                  </div>
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2 px-1 py-1 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-forest"
                      data-testid="marcar-comparar"
                      checked={comparar.includes(p.id)}
                      onChange={() => {
                        const r = alternarSelecao(comparar, p.id);
                        setComparar(r.ids);
                        setAvisoComparar(r.aviso);
                      }}
                    />
                    Comparar
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Menos de 3 imóveis REAIS (Prompt 30, item 6): a porta do pedido, já com cidade, datas e valor. */}
          {PEDIDO_MORADIA_ON && results.length > 0 && mostrarCartaoPedido(results, (p) => isExemplo(p.id)) && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-champagne/40 bg-champagne/10 px-5 py-4" data-testid="busca-cartao-pedido">
              <p className="min-w-0 text-sm font-medium text-ink">{TEXTO_CARTAO_PEDIDO}</p>
              <Link
                href={pedidoHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-forest transition-colors hover:brightness-105"
              >
                📣 Publicar pedido
              </Link>
            </div>
          )}

          {/* Respiro: a barra fixa não cobre as caixinhas dos últimos cartões. */}
          {comparar.length > 0 && <div aria-hidden="true" data-testid="comparar-respiro" className="h-32" />}
          <BarraComparar ids={comparar} aviso={avisoComparar} onLimpar={() => { setComparar([]); setAvisoComparar(null); }} />

          {/* O botão flutuante "Fale com a Viva" não aparece aqui (cobria "Mais filtros"). */}
          <p className="mt-6 text-center text-sm text-muted" data-testid="buscar-ajuda">
            Precisa de ajuda?{" "}
            <Link href="/ajuda" className="font-semibold text-forest underline underline-offset-2">
              Fale com a Viva
            </Link>
          </p>
        </div>

        {/* Mapa (só lg+): fixo sob a faixa de filtros, ocupa a altura visível e
            encosta na borda direita da tela. */}
        <div
          data-testid="busca-mapa"
          className="hidden lg:sticky lg:top-18 lg:-mr-6 lg:block lg:h-[calc(100vh-4.5rem)] lg:w-[42%] lg:shrink-0"
        >
          {comMapa && (
            <SearchMap
              properties={results}
              activeId={activeId}
              onHover={setActiveId}
              selectedId={selecionadoId}
              onSelect={setSelecionadoId}
              focus={geoCenter}
              radiusKm={radiusKm}
              className="h-full w-full rounded-none border-0 border-l border-line"
            />
          )}
        </div>
      </div>
    </div>
    </TituloBuscaContexto.Provider>
  );
}

/** Chip de filtro ATIVO — mostra o filtro aplicado com um × para remover. */
function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 py-1 pl-3 pr-1.5 text-xs font-medium text-forest">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro ${label}`}
        className="grid h-4 w-4 place-items-center rounded-full text-forest hover:bg-white"
      >
        ×
      </button>
    </span>
  );
}

function Chip({
  on,
  onClick,
  accent,
  rotulo,
  children,
}: {
  on: boolean;
  onClick: () => void;
  accent?: "gold";
  /** Nome acessível quando o texto visível é encurtado (faixa do computador). */
  rotulo?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={on}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors lg:px-3 xl:px-4",
        on
          ? accent === "gold"
            ? "border-champagne bg-champagne text-night"
            : "border-forest bg-forest text-white"
          : "border-sage-200 bg-white text-ink hover:border-sage"
      )}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="min-w-0 rounded-full border border-sage-200 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-sage lg:px-3 xl:px-4"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

/**
 * Seletor de hóspedes estilo Airbnb (adultos + crianças). O total filtra pela
 * capacidade do imóvel (max_guests). Imóveis sem capacidade cadastrada não são
 * escondidos (ver filtro em `results`).
 */
function GuestsPicker({
  adults,
  childrenCount,
  onAdults,
  onChildren,
}: {
  adults: number;
  childrenCount: number;
  onAdults: (n: number) => void;
  onChildren: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = adults + childrenCount;
  const ativo = adults > 1 || childrenCount > 0;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Moradores"
        className={cn(
          "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border bg-white px-4 py-2 text-sm outline-none lg:px-3 xl:px-4",
          ativo ? "border-sage text-forest" : "border-sage-200 text-ink focus:border-sage"
        )}
      >
        <Users className="h-4 w-4 text-sage" />
        {ativo ? (total === 1 ? "1 morador" : `${total} moradores`) : "Moradores"}
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <>
          {/* Backdrop invisível: clicar fora fecha. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 z-40 mt-2 w-64 rounded-2xl border border-sage-200 bg-white p-4 shadow-lg">
            <Stepper label="Adultos" hint="13 anos ou mais" value={adults} min={1} max={16} onChange={onAdults} />
            <div className="my-3 h-px bg-sage-200" />
            <Stepper label="Crianças" hint="até 12 anos" value={childrenCount} min={0} max={10} onChange={onChildren} />
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-sage-200 text-lg leading-none text-forest transition-colors hover:border-sage disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Mais ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-sage-200 text-lg leading-none text-forest transition-colors hover:border-sage disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Busca compacta no cabeçalho (ordem eac7e3a1, estilo Airbnb): resumo da busca
 * numa pílula na mesma linha do logo; clicar abre o painel completo de filtros
 * logo abaixo do cabeçalho. Sem faixa extra entre o cabeçalho e o conteúdo.
 */
function BuscaCompacta({
  local,
  periodo,
  hospedes,
  nFiltros,
  aberto,
  onAlternar,
}: {
  local: string;
  periodo: string;
  hospedes: number;
  nFiltros: number;
  aberto: boolean;
  onAlternar: () => void;
}) {
  const partes = [
    { rotulo: local || "Qualquer cidade", forte: true },
    { rotulo: periodo || "Qualquer período", forte: false },
    { rotulo: hospedes > 1 ? `${hospedes} moradores` : "Moradores", forte: false },
  ];
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={aberto}
      aria-label={aberto ? "Fechar filtros da busca" : "Abrir filtros da busca"}
      data-testid="busca-compacta"
      className={cn(
        "flex h-12 min-w-0 max-w-full items-center rounded-full border bg-white pl-5 pr-1.5 text-sm text-ink shadow-[0_6px_20px_-10px_rgba(10,10,10,0.35)] transition hover:shadow-[0_8px_24px_-10px_rgba(10,10,10,0.45)]",
        aberto ? "border-forest ring-2 ring-forest/15" : "border-line"
      )}
    >
      {partes.map((p, i) => (
        <span key={i} className={cn("flex min-w-0 items-center", i > 0 && "border-l border-line pl-4", i < partes.length - 1 && "pr-4")}>
          <span className={cn("truncate whitespace-nowrap", p.forte ? "max-w-[11rem] font-semibold" : "text-muted")}>{p.rotulo}</span>
        </span>
      ))}
      <span className="flex items-center gap-2 border-l border-line pl-4">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-forest">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtros
          {nFiltros > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-xs font-semibold text-white">{nFiltros}</span>
          )}
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-white" aria-hidden>
          <Search className="h-4 w-4" />
        </span>
      </span>
    </button>
  );
}
