"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAVE_ULTIMA_BUSCA, serializarUltimaBusca } from "@/lib/marcas/regra";
import { ChevronDown, ArrowRight, Megaphone } from "lucide-react";
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
import { cn, distanceKm } from "@/lib/utils";
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
import { FolhaFiltros } from "@/components/busca/painel-filtros-celular";
import { medicoesDaBusca, secaoInternetVisivel } from "@/lib/busca/facetas";
import { cumpreGarantiaMinima } from "@/lib/busca/garantia-minima";
import { comodidadesDaUrl, comodidadesValidas, type ComodidadeFiltro } from "@/lib/busca/filtro-comodidades";
import { naoMedidosDoPainel, passaNoPainel, precoDeBusca, seguroDaUrlLegada, type FiltrosPainel } from "@/lib/busca/painel-filtros";
import { datasFlexiveisDaUrl } from "@/lib/busca/datas-flexiveis";
import { avisoNivelSemResultado, filtroNivelDaUrl, filtroNivelNaUrl } from "@/lib/busca/filtro-nivel";
import type { Nivel } from "@/config/niveis";
import { ROTULO_NAO_MEDIDA, filtroInternetDaUrl, filtroInternetNaUrl, textoMaisNaoMedidos } from "@/lib/busca/filtro-internet";
import { buttonClasses } from "@/components/ui/button";
import { SalvarBusca } from "@/components/busca/salvar-busca";
import { BarraPilulas } from "@/components/busca/barra-pilulas";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { contagemDaBusca } from "@/lib/busca/titulo-busca";
import { isExemplo } from "@/lib/demo-listing";
import { exemplosForcadosNaUrl, mostrarCartaoPedido, semExemplosQuandoHaReal, TEXTO_CARTAO_PEDIDO } from "@/lib/busca/exemplos-e-pedido";
import { DescricaoBusca } from "@/components/busca/descricao-busca";
import type { ChaveChip, FiltrosDescricao } from "@/lib/busca/descricao-filtros";
import { CampoDestino, type DestinoChip } from "@/components/busca/campo-destino";
import { useTempos } from "@/components/busca/use-tempos";
import { distanciaAte, ordenarPorDestino, pontoDoDestino, textoDoCartao } from "@/lib/busca/distancia-destino";
import { guardarDestinoDaBusca } from "@/lib/busca/destino-sessao";
import { destinoDaUrl, destinoNaUrl, type EstadoDestino } from "@/lib/busca/destino-busca";
import type { ModoRota } from "@/lib/rotas/tempo";

// Filtro de garantia exibido na busca pública: caução unificada + seguro-fiança
// (a modalidade parcelada fica fora da UI até o parecer — B1). Religa com a flag.
const GARANTIAS_FILTRO = CAUCAO_PARCELADA_UI ? GARANTIAS_FAIXA : GARANTIAS_PUBLICAS;

/** Raio (km) padrão ao redor de um endereço geocodificado. */
const DEFAULT_RADIUS_KM = 10;

// CTA do Pedido de Moradia no zero-resultado. Ligado por padrão (a rota
// /pedidos/novo já existe); desligue com NEXT_PUBLIC_PEDIDO_MORADIA=off.
const PEDIDO_MORADIA_ON = process.env.NEXT_PUBLIC_PEDIDO_MORADIA !== "off";

/** ISO (yyyy-mm-dd) → dd/mm/aaaa (pt-BR), sem depender do locale do navegador. */
export function SearchClient({
  properties: imoveis,
  destinos = [],
  modos = ["carro", "a_pe", "bicicleta"],
}: {
  properties: Property[];
  /** Prompt 37: destinos cadastrados (chips) e meios com dado (ônibus só com a chave). */
  destinos?: DestinoChip[];
  modos?: ModoRota[];
}) {
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
  const [exemplosForcados, setExemplosForcados] = useState(false); // ?exemplos=1: laboratório/QA

  const [petPorte, setPetPorte] = useState<FiltrosPainel["petPorte"]>("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [readyToLiveOnly, setReadyToLiveOnly] = useState(false);
  const [homeOfficeOnly, setHomeOfficeOnly] = useState(false);
  // Prompt 57, fase 2: internet MEDIDA (download mínimo) e "só com internet medida".
  const [internetMin, setInternetMin] = useState(0);
  // Adendo 59.1: nível "a partir de" (`?nivel=`), escolhido na folha de filtros.
  const [nivelMin, setNivelMin] = useState<Nivel | "">("");
  const [soInternetMedida, setSoInternetMedida] = useState(false);
  // Prompt 55 B2: datas flexíveis (só vale com data de entrada).
  const [datasFlexiveis, setDatasFlexiveis] = useState(false);
  const [verNaoMedidos, setVerNaoMedidos] = useState(false);
  const [comodidades, setComodidades] = useState<ComodidadeFiltro[]>([]); // garagem, lavar (ordem 583d2e71; Wi-Fi saiu no Adendo 3)
  const [workLocatedOnly, setWorkLocatedOnly] = useState(false);
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const [operatedOnly, setOperatedOnly] = useState(false);
  // Folha de filtros (ordem 314f764e; Prompt 40): de baixo no celular, lateral no computador.
  const [painelAberto, setPainelAberto] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null); // hover: card ↔ pin (só destaque)
  const [comparar, setComparar] = useState<string[]>([]); // ordem fdd61de0: até 3 imóveis marcados
  const [avisoComparar, setAvisoComparar] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null); // pin clicado: card aberto no mapa
  // Mapa só a partir de 1024 px (lg): no celular/tablet nem carrega o componente.
  const [comMapa, setComMapa] = useState(false);
  // E82-A: a pílula "Mapa" alterna lista e mapa — no computador mostra/esconde a coluna do mapa; no celular troca a
  // lista pelo mapa.
  const [verMapa, setVerMapa] = useState(true);
  const [mapaNoCelular, setMapaNoCelular] = useState(false);
  // E82-A: "Descrever o que procuro" abre a descrição numa folha (fora da página).
  const [descreverAberto, setDescreverAberto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const aplicar = () => setComMapa(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  const [sort, setSort] = useState<"relevance" | "trabalho" | "recent" | "price-asc" | "price-desc">("relevance");
  // Prompt 37: onde a pessoa vai trabalhar ou estudar (destino cadastrado ou endereço), meio e "até N min".
  const [estadoDestino, setEstadoDestino] = useState<EstadoDestino>({ destino: null, modo: "carro", ate: 0 });
  const escolherDestino = (e: EstadoDestino) => {
    setEstadoDestino(e);
    // Com destino, a ordem padrão vira "Mais perto do trabalho"; sem, volta à relevância.
    if (e.destino && sort === "relevance") setSort("trabalho");
    if (!e.destino && sort === "trabalho") setSort("relevance");
  };

  // Pula a 1ª execução do efeito de sync (no mount, com estado ainda vazio):
  // como os setState da restauração são assíncronos, deixar o sync rodar no
  // mount apagaria os parâmetros da URL antes do estado restaurado committar.
  const skipNextSync = useRef(true);

  // Restaura a busca da URL: endereço/raio + todos os filtros, para links
  // compartilhados e reloads mostrarem exatamente os filtros ativos (M7).
  const restaurarFiltrosDaURL = useCallback(() => {
    const sp = new URLSearchParams(window.location.search);
    if (exemplosForcadosNaUrl(window.location.search)) setExemplosForcados(true);
    const local = sp.get("local");
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const r = Number(sp.get("r"));
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
    const ed = destinoDaUrl(sp);
    setEstadoDestino(ed);
    if (ordem === "recent" || ordem === "price-asc" || ordem === "price-desc") setSort(ordem);
    else if (ed.destino) setSort("trabalho");
    const tipo = sp.get("tipo");
    if (tipo && PROPERTY_TYPES.some((t) => t.value === tipo)) setTypeFilter(tipo);
    const fx = sp.get("faixa");
    if (fx && FAIXAS.some((f) => f.key === fx)) setFaixa(fx);
    const ent = sp.get("entrada");
    if (ent && /^\d{4}-\d{2}-\d{2}$/.test(ent)) setDataEntrada(ent);
    if (datasFlexiveisDaUrl(sp)) setDatasFlexiveis(true);
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
    // E43 (Adendo 3): o atalho antigo `?seguro=1` vira a garantia "Seguro-fiança" — a mesma migração das buscas salvas.
    if (!gar && seguroDaUrlLegada(gar, sp.get("seguro"))) setGarantia("seguro_fianca");
    if (on("gestor")) setOperatedOnly(true);
    setComodidades(comodidadesDaUrl(sp.get("comod")));
    const fi = filtroInternetDaUrl(sp);
    setInternetMin(fi.internetMin);
    setSoInternetMedida(fi.soInternetMedida);
    setNivelMin(filtroNivelDaUrl(sp));
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
    put("flex", !!dataEntrada && datasFlexiveis, "1");
    put("garantia", !!garantia, garantia);
    put("ordem", sort !== "relevance", sort);
    put("pet", petsOnly, "1");
    put("porte", petsOnly && !!petPorte, petPorte);
    put("mobiliado", furnishedOnly, "1");
    put("pronto", readyToLiveOnly, "1");
    put("homeoffice", homeOfficeOnly, "1");
    put("localizado", workLocatedOnly, "1");
    put("nota", invoiceOnly, "1");
    params.delete("seguro"); // Adendo 3 (E43): o atalho antigo não volta para a URL (virou garantia=seguro_fianca).
    put("gestor", operatedOnly, "1");
    put("comod", comodidades.length > 0, comodidades.join(","));
    filtroInternetNaUrl(params, { internetMin, soInternetMedida });
    filtroNivelNaUrl(params, nivelMin);
    destinoNaUrl(params, estadoDestino);
    if (sort === "trabalho") params.delete("ordem");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, [
    locationQuery, geoCenter, radiusKm, maxPrice, minBedrooms, adults, children, maxPeriod, sort,
    typeFilter, faixa, dataEntrada, garantia, petsOnly, petPorte, furnishedOnly,
    readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, operatedOnly, comodidades, estadoDestino,
    internetMin, soInternetMedida, datasFlexiveis, nivelMin,
  ]);

  // Prompt 37: sem destino na URL, o "Meu local de trabalho" salvo na conta vira o padrão (só para quem está logado;
  // a resposta vem só para a própria pessoa).
  useEffect(() => {
    if (destinoDaUrl(new URLSearchParams(window.location.search)).destino) return;
    let vivo = true;
    fetch("/api/conta/local-trabalho")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { estado?: EstadoDestino } | null) => {
        if (vivo && j?.estado?.destino) {
          setEstadoDestino(j.estado);
          setSort((s) => (s === "relevance" ? "trabalho" : s));
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

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
    setOperatedOnly(false);
    setComodidades([]);
    setInternetMin(0);
    setSoInternetMedida(false);
    setNivelMin("");
    setDatasFlexiveis(false);
    setEstadoDestino({ destino: null, modo: "carro", ate: 0 });
    setSort("relevance");
  }

  // Filtros da folha (preço, quartos, estadia, tipo, pets, home office, selo, garantia,
  // comodidades): a MESMA regra para a lista e para a contagem "Mostrar N imóveis".
  const filtrosPainel: FiltrosPainel = useMemo(
    () => ({
      maxPrice, minBedrooms, petsOnly, petPorte, homeOfficeOnly, readyToLiveOnly, comodidades,
      periodo: maxPeriod, tipo: typeFilter, garantia, notaOnly: SELO_NF_UI && invoiceOnly, gestorOnly: operatedOnly,
      internetMin, soInternetMedida,
      entrada: dataEntrada, datasFlexiveis, nivelMin,
    }),
    [maxPrice, minBedrooms, petsOnly, petPorte, homeOfficeOnly, readyToLiveOnly, comodidades, maxPeriod, typeFilter, garantia, invoiceOnly, operatedOnly, internetMin, soInternetMedida, dataEntrada, datasFlexiveis, nivelMin]
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
      // FILTROS-2: anúncio em adequação (abaixo do padrão mínimo) nunca entra nos resultados — antes de qualquer filtro.
      if (!cumpreGarantiaMinima(p)) return false;
      // Estadia, tipo, garantia, nota, seguro e gestor: na folha (passaNoPainel), para a contagem ao vivo bater.
      if (faixa && !(p.faixasAceitas ?? []).includes(faixa)) return false;
      if (furnishedOnly && !p.furnished) return false;
      if (workLocatedOnly && !p.tagWorkLocated) return false;
      return true;
    });
    return { base: list, dist };
  }, [properties, locationQuery, geoCenter, radiusKm, adults, children, faixa, furnishedOnly, workLocatedOnly]);

  const contarComPainel = useCallback(
    (f: FiltrosPainel) => semExemplosQuandoHaReal(base.filter((p) => passaNoPainel(p, f)), (p) => isExemplo(p.id), exemplosForcados).length,
    [base, exemplosForcados]
  );
  // Prompt 57, fase 2: os de internet informada, mas não medida (só com o filtro de internet ligado). Exemplo não entra.
  const contarNaoMedidos = useCallback((f: FiltrosPainel) => naoMedidosDoPainel(base, f).filter((p) => !isExemplo(p.id)).length, [base]);
  // FILTROS-1 (E40): medições válidas da busca atual — sem nenhuma, a seção "Internet medida" some da folha.
  const medicoes = useMemo(() => medicoesDaBusca(semExemplosQuandoHaReal(base, (p) => isExemplo(p.id), exemplosForcados)), [base, exemplosForcados]);
  // Adendo 3 (E40): sem nenhuma medição válida na busca atual, o filtro de internet (vindo da URL ou de antes) é
  // ignorado — o chip ativo sai e a URL perde ?internet/?medida. Ajuste de estado no render (padrão do React para
  // estado derivado), sem efeito: a lista nunca chega a zerar por um filtro que ninguém pode cumprir.
  if (!secaoInternetVisivel(medicoes) && (internetMin > 0 || soInternetMedida)) {
    setInternetMin(0);
    setSoInternetMedida(false);
  }
  const naoMedidos = useMemo(() => naoMedidosDoPainel(base, filtrosPainel).filter((p) => !isExemplo(p.id)), [base, filtrosPainel]);

  const semTempo = useMemo(() => {
    let list = base.filter((p) => passaNoPainel(p, filtrosPainel));
    // Prompt 30, item 6: com imóvel real no resultado, os exemplos saem; só exemplos → aparecem marcados "exemplo".
    list = semExemplosQuandoHaReal(list, (p) => isExemplo(p.id), exemplosForcados);
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
  }, [base, dist, exemplosForcados, filtrosPainel, sort]);

  // Prompt 37: tempos até o destino (do servidor, arredondados). O filtro "até N min" só vale com tempo de rota — sem
  // provedor, tudo fica "em linha reta" e ninguém some; a ordem "Mais perto do trabalho" usa as faixas de minutos.
  const idsSemTempo = useMemo(() => semTempo.map((p) => p.id), [semTempo]);
  const { tempos, carregando: calculandoTempos, reta: tempoEmLinhaReta } = useTempos(estadoDestino.destino, estadoDestino.modo, idsSemTempo);
  // E79: ponto do destino ativo (local pessoal ou âncora) para a linha reta no cartão que o servidor não traz.
  const alvoDestino = useMemo(() => pontoDoDestino(estadoDestino.destino, destinos), [estadoDestino.destino, destinos]);
  useEffect(() => {
    guardarDestinoDaBusca(estadoDestino.destino, estadoDestino.modo, alvoDestino);
  }, [estadoDestino.destino, estadoDestino.modo, alvoDestino]);
  const results = useMemo(() => {
    if (!estadoDestino.destino) return semTempo;
    let list = semTempo;
    if (estadoDestino.ate && !tempoEmLinhaReta && tempos.size > 0) list = list.filter((p) => {
      const t = tempos.get(p.id);
      return t?.min != null && t.min <= estadoDestino.ate;
    });
    // A mesma conta que o cartão mostra: posição do servidor primeiro; o resto pela distância em linha reta.
    if (sort === "trabalho") list = ordenarPorDestino(list, (id) => tempos.get(id)?.pos, (p) => distanciaAte(p, alvoDestino)?.metros ?? null);
    return list;
  }, [semTempo, estadoDestino, tempos, tempoEmLinhaReta, sort, alvoDestino]);
  const opcoesOrdem = (recentes: string): [string, string][] => [
    ...(estadoDestino.destino ? ([["trabalho", "Mais perto do trabalho"]] as [string, string][]) : []),
    ["relevance", "Relevância"],
    ["recent", recentes],
    ["price-asc", "Menor preço"],
    ["price-desc", "Maior preço"],
  ];

  const activeCount =
    (maxPrice ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    (adults > 1 || children > 0 ? 1 : 0) +
    (maxPeriod ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (faixa ? 1 : 0) +
    (dataEntrada ? 1 : 0) +
    (dataEntrada && datasFlexiveis ? 1 : 0) +
    (garantia ? 1 : 0) +
    (internetMin || soInternetMedida ? 1 : 0) +
    [petsOnly, furnishedOnly, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, operatedOnly].filter(
      Boolean
    ).length +
    comodidades.length;

  // Filtros que vivem só na folha (fora da faixa do computador), para o contador do botão "Mais filtros". E82-A: sem a
  // fileira de chips ativos, Estadia e Pronto para Morar (só na folha) também acendem a pílula.
  const secundariosAtivos =
    (typeFilter ? 1 : 0) +
    (garantia ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    (maxPeriod ? 1 : 0) +
    (internetMin || soInternetMedida ? 1 : 0) +
    [readyToLiveOnly, homeOfficeOnly, petsOnly, SELO_NF_UI && invoiceOnly, operatedOnly].filter(Boolean).length +
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
    if (internetMin > 0) q.set("internet", String(internetMin));
    const s = q.toString();
    return `/pedidos/novo${s ? `?${s}` : ""}`;
  }, [locationQuery, dataEntrada, maxPeriod, adults, children, maxPrice, internetMin]);

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
    setOperatedOnly(false);
    setComodidades([]);
    setInternetMin(0);
    setSoInternetMedida(false);
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
    } else if (chave === "homeOfficeOnly") {
      setHomeOfficeOnly(false);
      setSoInternetMedida(false);
    }
    else if (chave === "readyToLiveOnly") setReadyToLiveOnly(false);
    else if (chave === "furnishedOnly") setFurnishedOnly(false);
    else setComodidades((l) => l.filter((c) => c !== chave));
  }

  // Muda sempre que um filtro muda: o "Salvar busca" reconsulta se a busca atual já está salva.
  const versaoBusca = [
    locationQuery, geoCenter?.lat, geoCenter?.lng, radiusKm, maxPrice, minBedrooms, adults, children, maxPeriod, sort, typeFilter,
    faixa, dataEntrada, garantia, petsOnly, petPorte, furnishedOnly, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, operatedOnly, comodidades.join(","),
    internetMin, soInternetMedida, datasFlexiveis, nivelMin,
  ].join("|");
  function aplicarPainel(f: FiltrosPainel) {
    setMaxPrice(f.maxPrice);
    setMinBedrooms(f.minBedrooms);
    setPetsOnly(f.petsOnly);
    setPetPorte(f.petsOnly ? f.petPorte : "");
    setHomeOfficeOnly(f.homeOfficeOnly);
    setReadyToLiveOnly(f.readyToLiveOnly);
    setComodidades(comodidadesValidas(f.comodidades));
    setInternetMin(f.internetMin);
    setNivelMin(f.nivelMin ?? "");
    setSoInternetMedida(f.homeOfficeOnly && f.soInternetMedida);
    // Só sobraram os de internet não medida: o botão da folha já abre essa lista.
    setVerNaoMedidos(contarComPainel(f) === 0 && contarNaoMedidos(f) > 0);
    // A folha não edita a data; "Limpar tudo" a apaga junto com os outros filtros (a contagem já contava sem ela).
    setDataEntrada(f.entrada);
    setDatasFlexiveis(!!f.entrada && f.datasFlexiveis);
    setMaxPeriod(f.periodo);
    setTypeFilter(f.tipo);
    setGarantia(f.garantia);
    setInvoiceOnly(f.notaOnly);
    setOperatedOnly(f.gestorOnly);
    setPainelAberto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // E82-A: o nome do destino na pílula Local ("Perto de HC-UFU") e a cidade da linha da contagem.
  const dest = estadoDestino.destino;
  const nomeDoDestino = !dest ? null : "slug" in dest ? (destinos.find((d) => d.slug === dest.slug)?.nome ?? null) : dest.rot;
  const cidadesDaLista = [...new Set(properties.map((p) => p.city).filter(Boolean))];
  const cidadeDaLista = cidadesDaLista.length === 1 ? cidadesDaLista[0] : "";

  return (
    // Computador (lg+, ordem ca0e7dad): largura total; a linha de pílulas, a contagem e a lista (~58%, 3 cards por
    // linha) + mapa fixo (~42%).
    <div className="flex flex-col py-4 sm:py-6 lg:px-6 lg:py-0" data-testid="busca">
      {/* E82-A + E91 + E95 (mockup BUSCA-CARD): UMA linha de controles e, acima da lista, SÓ a linha da contagem com
          "Salvar busca" e "Descrever o que procuro". Nada de título grande, banner, caixa de destino ou de descrição na
          página: o destino vive no painel da pílula Local; a descrição, numa folha. */}
      <div className="container-page mt-2 lg:max-w-none lg:px-0 lg:pt-4">
        <BarraPilulas
          filtros={filtrosPainel}
          contar={contarComPainel}
          aplicar={aplicarPainel}
          local={locationQuery}
          perto={nomeDoDestino}
          painelLocal={
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Cidade ou bairro</p>
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
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-ink">
                    Raio
                    <select value={String(radiusKm)} onChange={(e) => setRadiusKm(Number(e.target.value))} aria-label="Raio de busca" className="h-11 rounded-lg border border-line bg-white px-3 text-sm text-ink">
                      {[5, 10, 20].map((km) => (
                        <option key={km} value={km}>
                          {km} km
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {/* DESTINO-PESSOAL-B: o "Outro local" é achado pelo servidor, então o campo aparece sempre. */}
              <CampoDestino
                destinos={destinos}
                modos={modos}
                valor={estadoDestino}
                onChange={escolherDestino}
                cidade={chaveCidade(locationQuery) ? (properties.find((p) => p.city && chaveCidade(locationQuery).includes(chaveCidade(p.city)))?.city ?? null) : null}
              />
              {estadoDestino.destino && tempoEmLinhaReta && (
                <p className="text-sm text-muted" data-testid="tempo-indisponivel">
                  Tempo de deslocamento indisponível agora: mostramos a distância em linha reta.
                </p>
              )}
            </>
          }
          painelMoradores={
            <fieldset data-testid="pilula-datas-moradores">
              <legend className="mb-2 text-sm font-semibold text-ink">{"Moradores"}</legend>
              <Stepper label="Adultos" hint="13 anos ou mais" value={adults} min={1} max={16} onChange={setAdults} />
              <div className="my-3 h-px bg-divisor" />
              <Stepper label="Crianças" hint="até 12 anos" value={children} min={0} max={10} onChange={setChildren} />
            </fieldset>
          }
          nMaisFiltros={secundariosAtivos}
          onMaisFiltros={() => setPainelAberto(true)}
          ordem={sort}
          opcoesOrdem={opcoesOrdem("Mais recentes")}
          onOrdem={(v) => setSort(v as typeof sort)}
          mapa={comMapa ? verMapa : mapaNoCelular}
          onMapa={() => (comMapa ? setVerMapa((v) => !v) : setMapaNoCelular((v) => !v))}
        />

        {/* A linha da contagem (E91): "15 imóveis em Uberlândia · R$ 0 de taxa para você" + Salvar busca + Descrever. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="linha-contagem">
          <h1 className="text-base font-semibold tabular-nums text-ink" data-testid="titulo-busca">
            {contagemDaBusca({ n: results.length, local: locationQuery.trim() || cidadeDaLista })}
          </h1>
          {results.length > 0 && <span className="text-sm text-muted" data-testid="complemento-busca">· R$ 0 de taxa para você</span>}
          {/* As duas ações ficam juntas (no celular, uma linha só abaixo da contagem). */}
          <div className="flex flex-wrap items-center gap-x-4">
            {results.length > 0 && <SalvarBusca versao={versaoBusca} />}
            <button type="button" onClick={() => setDescreverAberto(true)} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest" data-testid="abrir-descrever">
              Descrever o que procuro
            </button>
          </div>
        </div>
      </div>

      {descreverAberto && (
        <BottomSheet open onClose={() => setDescreverAberto(false)} title="Descrever o que procuro" lateral testId="folha-descrever">
          <DescricaoBusca key={reinicioDescricao}
            locais={locaisDoCatalogo}
            onAplicar={(f) => {
              aplicarDescricao(f);
              setDescreverAberto(false);
            }}
            onRemover={removerDescricao}
          />
        </BottomSheet>
      )}
      {painelAberto && (
        // E82-A: "Mais filtros" já está na linha desde o 1º desenho; tocado antes de a URL ser lida (link com
        // ?garantia=…), a folha recomeça com os filtros que valem — nunca abre vazia por cima de uma busca filtrada.
        <FolhaFiltros
          key={JSON.stringify(filtrosPainel)}
          inicial={filtrosPainel}
          contar={contarComPainel}
          contarNaoMedidos={contarNaoMedidos}
          onAplicar={aplicarPainel}
          onFechar={() => setPainelAberto(false)}
          garantias={GARANTIAS_FILTRO}
          comNotaFiscal={SELO_NF_UI}
          medicoes={medicoes}
          topo={
            // E82-A: o 1º bloco da folha é a descrição, recolhida numa linha (tocar abre o campo).
            <button
              type="button"
              onClick={() => {
                setPainelAberto(false);
                setDescreverAberto(true);
              }}
              className="flex min-h-11 w-full items-center justify-between rounded-lg border border-line px-4 text-left text-sm font-semibold text-ink hover:border-ink"
              data-testid="folha-descreva"
            >
              Descreva com suas palavras <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          }
        />
      )}

      <div className="container-page mt-4 lg:flex lg:max-w-none lg:items-start lg:gap-6 lg:px-0">
        <div data-testid="busca-lista" className={cn("min-w-0 lg:py-4", comMapa && verMapa ? "lg:w-[58%]" : "lg:w-full", mapaNoCelular && "hidden lg:block")}>
          {results.length === 0 && nivelMin && contarComPainel({ ...filtrosPainel, nivelMin: "" }) > 0 ? (
            // NIVEL-BUSCA-A: o `?nivel=` zerou a busca — o aviso diz isso e "Ver todos" tira só o filtro de nível.
            <div className="flex flex-col items-start rounded-xl border border-line bg-white p-6 sm:p-8" data-testid="busca-vazia-nivel">
              <p className="font-title text-lg font-semibold text-ink">{avisoNivelSemResultado(nivelMin)}</p>
              <button type="button" onClick={() => setNivelMin("")} className={buttonClasses({ className: "mt-4" })} data-testid="busca-vazia-nivel-ver-todos">
                Ver todos
              </button>
            </div>
          ) : results.length === 0 ? (
            // Prompt 48: busca sem resultado diz o que aconteceu e dá os três próximos passos — pedido de moradia,
            // limpar filtros (ou ampliar a busca) e criar alerta. Sem ilustração genérica.
            <div className="flex flex-col items-start rounded-xl border border-line bg-white p-6 sm:p-8" data-testid="busca-vazia">
              <p className="font-title text-lg font-semibold text-ink">
                {locationQuery.trim()
                  ? `Ainda não temos imóvel para essa busca em ${locationQuery.trim()}.`
                  : "Ainda não há imóveis para esta busca"}
              </p>
              <ConviteCidade texto={locationQuery} />
              <p className="mt-1 max-w-md text-sm text-muted">
                {PEDIDO_MORADIA_ON
                  ? "Publique um pedido de moradia e os proprietários da cidade encontram você, ou crie um alerta para saber quando entrar um imóvel assim."
                  : "Crie um alerta para saber quando entrar um imóvel assim. Novos imóveis entram toda semana."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {PEDIDO_MORADIA_ON && (
                  <Link href={pedidoHref} className={buttonClasses()} data-testid="busca-vazia-pedido">
                    <Megaphone className="h-4 w-4" aria-hidden /> Publicar um pedido de moradia
                  </Link>
                )}
                {activeCount > 0 ? (
                  <button type="button" onClick={clearFilters} className={buttonClasses({ variant: "secondary" })} data-testid="busca-vazia-limpar">
                    Limpar filtros
                  </button>
                ) : (
                  <button type="button" onClick={ampliarBusca} className={buttonClasses({ variant: "secondary" })} data-testid="busca-vazia-ampliar">
                    Ampliar a busca
                  </button>
                )}
                <SalvarBusca versao={versaoBusca} rotulo="Criar alerta desta busca" rotuloSalva="Alerta criado" />
              </div>
              <Link
                href="/dashboard/imoveis/novo"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest"
              >
                É proprietário? Anuncie seu imóvel <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            // EXCEÇÃO da regra de grade par (ordem 86dcb4db, B2; decidido pela coordenação):
            // ao lado do mapa a /buscar mantém 3 cards por linha em telas largas (aprovado na ordem ca0e7dad).
            <div className="grid auto-rows-fr gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 lg:gap-x-4 xl:grid-cols-3" data-testid="grade-resultados">
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
                    "flex h-full flex-col rounded-xl transition-all",
                    (activeId === p.id || selecionadoId === p.id) && "ring-2 ring-forest ring-offset-4"
                  )}
                >
                  <div className="min-h-0 flex-1">
                    <PropertyCard
                      property={p}
                      periodMonths={maxPeriod > 0 ? Math.round(maxPeriod / 30) : undefined}
                    />
                  </div>
                  {/* Imóvel sem ponto (ou sem tempo depois do cálculo): sem dado, sem linha. */}
                  {(() => {
                    // E79: o km (linha reta enquanto não houver rota) fica sempre visível com destino ativo; nunca some.
                    const texto = estadoDestino.destino ? textoDoCartao(tempos.get(p.id)?.texto, distanciaAte(p, alvoDestino), calculandoTempos) : null;
                    return texto ? (
                      <p className="mt-2 text-sm font-medium text-ink" data-testid="tempo-cartao">
                        {texto}
                      </p>
                    ) : null;
                  })()}
                  <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
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

          {/* Prompt 57, fase 2: nenhum imóvel some por não ter testado a internet — os de internet informada, mas não
              medida, ficam no fim da lista, com o rótulo "não medida". */}
          {naoMedidos.length > 0 && (
            <section className="mt-8" data-testid="nao-medidos">
              <button
                type="button"
                onClick={() => setVerNaoMedidos((v) => !v)}
                aria-expanded={verNaoMedidos}
                data-testid="mais-nao-medidos"
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left text-sm font-medium text-ink hover:border-ink"
              >
                {textoMaisNaoMedidos(naoMedidos.length)}
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", verNaoMedidos && "rotate-180")} aria-hidden />
              </button>
              {verNaoMedidos && (
                <div className="mt-6 grid auto-rows-fr gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 lg:gap-x-4 xl:grid-cols-3" data-testid="grade-nao-medidos">
                  {naoMedidos.map((p) => (
                    <div key={p.id} data-testid="card-nao-medido" data-id={p.id} className="flex h-full flex-col">
                      <div className="min-h-0 flex-1">
                        <PropertyCard property={p} periodMonths={maxPeriod > 0 ? Math.round(maxPeriod / 30) : undefined} />
                      </div>
                      <p className="mt-2 text-sm text-muted" data-testid="rotulo-nao-medida">
                        {ROTULO_NAO_MEDIDA}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Menos de 3 imóveis REAIS (Prompt 30, item 6): a porta do pedido, já com cidade, datas e valor. */}
          {PEDIDO_MORADIA_ON && results.length > 0 && mostrarCartaoPedido(results, (p) => isExemplo(p.id)) && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-4" data-testid="busca-cartao-pedido">
              <p className="min-w-0 text-sm font-medium text-ink">{TEXTO_CARTAO_PEDIDO}</p>
              <Link href={pedidoHref} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <Megaphone className="h-4 w-4" aria-hidden /> Publicar pedido
              </Link>
            </div>
          )}

          {/* Respiro: a barra fixa não cobre as caixinhas dos últimos cartões. */}
          {comparar.length > 0 && <div aria-hidden="true" data-testid="comparar-respiro" className="h-32" />}
          <BarraComparar ids={comparar} aviso={avisoComparar} onLimpar={() => { setComparar([]); setAvisoComparar(null); }} />

          {/* O botão flutuante "Fale com a Viva" não aparece aqui (cobria "Mais filtros"). */}
          <p className="mt-6 text-center text-sm text-muted" data-testid="buscar-ajuda">
            Precisa de ajuda?{" "}
            <Link href="/ajuda" className="font-semibold text-ink underline underline-offset-4">
              Fale com a Viva
            </Link>
          </p>
        </div>

        {/* Mapa (só lg+): fixo sob a faixa de filtros, ocupa a altura visível e
            encosta na borda direita da tela. */}
        <div
          data-testid="busca-mapa"
          className={cn(
            "lg:sticky lg:top-18 lg:-mr-6 lg:h-[calc(100vh-4.5rem)] lg:w-[42%] lg:shrink-0",
            mapaNoCelular ? "block h-[70vh] w-full lg:hidden" : comMapa && verMapa ? "hidden lg:block" : "hidden",
          )}
        >
          {((comMapa && verMapa) || mapaNoCelular) && (
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
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-lg leading-none text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Mais ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-lg leading-none text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

