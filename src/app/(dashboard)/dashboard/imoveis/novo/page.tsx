"use client";

import { AVISO_TEXTO_MUDOU, aceiteParaRascunho, aceiteRestaurado, impressaoDoTexto } from "@/lib/anuncio/aceite-ia-rascunho";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { linkQualificacao } from "@/lib/qualificar-link";
import {
  ClipboardCheck,
  Check,
  ArrowRight,
  XCircle,
} from "lucide-react";
import {
  createProperty,
  updateProperty,
  loadPropertyForEdit,
  getMyDocumentStatus,
  carregarQualificacao,
  saveDraftData,
  loadDraftData,
  enderecoGravadoDoImovel,
  getLatestDraft,
  carregarLimitesNegociacao,
  salvarLimitesNegociacao,
  type DocumentStatus,
} from "@/lib/data/actions";
import { precoDaRegiao } from "@/lib/data/cadastro-actions";
import { ANCORA_VIDEO_ASSISTENTE, prontidaoAnuncio } from "@/lib/anuncio/prontidao";
import { videoDoAnuncio } from "@/lib/video-anuncio";
import { ERRO_CAMPO_ENDERECO, TESTID_CAMPO_ENDERECO, type EnderecoDoc } from "@/lib/documento/endereco-documento";
import { itensFaltantes } from "@/lib/conforto/regras";
import { ChecklistConforto } from "@/components/conforto/checklist-conforto";
import { NivelNoCadastro } from "@/components/niveis/nivel-cadastro";
import { AlertaFaltaFoto, SugestoesDasFotos } from "@/components/niveis/sugestoes-fotos";
import { CamposChacara, type ValorChacara } from "@/components/anuncio/campos-chacara";
import { ehChacara, faltaChacara, normalizarChacara } from "@/lib/anuncio/chacara";
import { temInternet, tipoInternetDoAnuncio } from "@/lib/anuncio/internet-imovel";
import { VERSAO_CONFORTO } from "@/config/conforto-minimo";
import { useConfortoSalvo } from "@/components/conforto/use-conforto-salvo";
import { linhaEnderecoExato } from "@/lib/visitas/endereco-visita";
import { UBERLANDIA_CENTER, geocodeForSave } from "@/lib/integrations/geocoding";
import { Button } from "@/components/ui/button";
import { type PhotoItem } from "@/components/photo-uploader";
import { PRIVACIDADE_VAZIA, type Privacidade } from "@/lib/anuncio/privacidade";
import { DOC_AUTORIZACAO, operacaoValida, type Operacao, exigeAutorizacao, tipoDocValido } from "@/lib/anuncio/operacao";
import { MIN_PHOTOS } from "@/lib/listing";
import { PROPERTY_TYPES, propertyTypeLabel, amenityKeysFromLabels } from "@/lib/amenities";
import type { AnuncioOrganizado } from "@/lib/anuncio/importar-anuncio";
import type { CuratedPlace } from "@/components/property/places-picker";
import type { Property, Proximity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { qualificadoDoServidor } from "@/lib/anuncio/qualificacao-rascunho";
import { draftKey, DRAFT_KEY_LEGADO } from "@/lib/local-keys";
import { registrarEvento, registrarEventoUmaVez } from "@/lib/eventos/registrar";
import { TERMO_IA_VERSAO, camposDaIa, precisaAceitarTermo } from "@/lib/anuncio/termo-ia";
import { meuAceiteTermoIa } from "@/lib/data/termo-ia-actions";
import { miniaturaBase64 } from "@/lib/fotos/miniatura";
import {
  FOTOS_LADO_MAX_PX,
  FOTOS_MAX_MINIATURAS,
  iaFotosLiberada,
  precisaReanalisar,
  type SugestaoFotos,
} from "@/lib/ai/fotos-prompt";
import {
  etapaDaUrl,
  etapaMaisAvancada,
  etapaDoRascunho,
  posMaxDoRascunho,
  ORDEM_ETAPAS,
  ULTIMA_ETAPA,
  VERSAO_ORDEM_ETAPAS,
} from "@/lib/etapas-anuncio";
import { ETAPA } from "@/lib/anuncio/etapas-ids";
import { capacidadeSugerida, consumoSugerido, mbpsValido } from "@/lib/anuncio/sugestoes-cadastro";
import { NEGOCIACAO_PADRAO, normalizarNegociacao, type LimitesPrivados, type Negociacao } from "@/lib/anuncio/negociacao";
import { cepValido, chaveBuscaPerto, paraProximity, type LugarProximo } from "@/lib/proximidades/osm";
import { reportarProximidade } from "@/lib/data/proximidades-actions";
import { manualSemEndereco } from "@/lib/anuncio/proximidades";
import { estadoDoStatus, type EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import type { InfoMatricula } from "@/components/anuncio/matricula-resultado";
import type { PreenchimentoMatricula } from "@/lib/documento/conferencia-matricula";
import { chaveLugar } from "@/components/anuncio/blocos-cadastro";
import type { CampoSugerido, EstadoIaFotos, FalhaIaFotos } from "./tipos";
import { ChegadaEPedidoCampos, formDeChegada, formDeRascunho, payloadDaChegada, type ChegadaEPedidoForm } from "@/components/anuncio/chegada-e-pedido-campos";
import { tipoEntradaValido } from "@/lib/anuncio/chegada-e-pedido";
import { PainelQualificacao } from "./painel-qualificacao";
import type { ItemProntidao } from "@/lib/anuncio/prontidao";
import { MENSAGEM_FALHA_IA, motivoDoStatusFotos, type MotivoFalhaIa } from "@/lib/ai/falha-ia";
import { AntesDePublicar, AtalhosCadastro, EtapaOndeFica } from "./etapa-onde-fica";
import { buscarCep, formatarCep, type OpcaoEndereco, type ResultadoCep } from "@/lib/cep/buscar";
import { aplicarResultadoCep, type CampoEndereco } from "@/lib/cep/aplicar";
import { EtapaFotos, FOTOS_REORGANIZAR } from "./etapa-fotos";
import { EtapaEncontramos } from "./etapa-encontramos";
import { EtapaPreco } from "./etapa-preco";
import { EtapaRevisar } from "./etapa-revisar";
import { EtapaTipo } from "./etapa-tipo";
import { PreviaAnuncio } from "./previa-anuncio";
import { RodapeAssistente } from "./rodape-assistente";
import { TELAS_ASSISTENTE } from "@/lib/anuncio/assistente-telas";
import { TITULO_PASSO_CADASTRO } from "@/lib/conta/visual-mockup";

/**
 * Anunciar em 6 passos (Prompt 43, sobre o cadastro de 5 etapas do prompt 10):
 *   1 Endereço e dados (CEP primeiro, quem opera, documento do imóvel) · 2 Tipo e quartos · 3 Fotos (a IA analisa ao
 *   terminar) · 4 Comodidades e segurança (com câmeras, título e descrição) · 5 Regras, valores e disponibilidade ·
 *   6 Revisar e publicar.
 * A IA só SUGERE: nada sugerido vai ao anúncio sem o proprietário confirmar (termo de aceite na revisão). Mantém
 * as regras que já funcionavam: rascunho salvo a cada passo, mínimo de 8 fotos, preço sugerido, importar anúncio,
 * faixas de prazo e o portão de publicação (documento aprovado — 0120). "Publicar com o que tem" quando os mínimos
 * existem, com a nota do que melhora.
 */
/** Rótulo, título (H1) e subtítulo de cada passo — mockups cadastro-imovel-01..10 (assistente-telas.ts). */
const STEP_META = TELAS_ASSISTENTE.map((t) => ({ label: t.rotulo, title: t.titulo, subtitle: t.subtitulo }));


/** Tira o erro de um campo (o mesmo objeto quando ele não tem erro: não redesenha à toa). */
function semErro(e: Record<string, string>, campo: string): Record<string, string> {
  if (!(campo in e)) return e;
  const resto = { ...e };
  delete resto[campo];
  return resto;
}

export default function NewPropertyPage() {
  // T1: o rascunho local é POR USUÁRIO — nunca abre o de outra conta.
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [approved, setApproved] = useState<boolean | null>(null);
  // Qualificação "Antes de anunciar": só BARRA A PUBLICAÇÃO (rascunho sempre pode).
  const [qualificado, setQualificado] = useState(true);
  // Prompt 22: a qualificação abre num painel lateral, sem sair do cadastro.
  const [painelQualificacao, setPainelQualificacao] = useState(false);
  // Documento do imóvel (prompt 11): conferido na etapa 1. Só "approved" libera Publicar (0120).
  const [docStatus, setDocStatus] = useState<DocumentStatus>("approved");
  const [docEstado, setDocEstado] = useState<EstadoDocumentoTela>("nenhum");
  const [docMotivos, setDocMotivos] = useState<string[]>([]);
  // Prompt 19: campos preenchidos pela matrícula (etiqueta "veio da matrícula") e o endereço dela, quando ≠ do CEP.
  const [daMatricula, setDaMatricula] = useState<Set<string>>(() => new Set());
  const [enderecoMatricula, setEnderecoMatricula] = useState<PreenchimentoMatricula["endereco"] | null>(null);
  const [step, setStep] = useState<number>(ORDEM_ETAPAS[0]);
  const pos = step;
  // Etapa mais avançada já visitada (bug 13 da L2): guardada no rascunho.
  const [etapaMax, setEtapaMax] = useState(0);
  function irPara(i: number) {
    setEtapaMax((m) => etapaMaisAvancada(m, step, i));
    setStep(i);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // IA das fotos (prompt 10): roda sozinha ao terminar o envio; uma vez por rascunho.
  const [iaEstado, setIaEstado] = useState<EstadoIaFotos>("parada");
  // Prompt 22: o motivo real quando a IA das fotos falha (nunca o silencioso "sem sugestões") e o "Tentar de novo".
  const [iaFalha, setIaFalha] = useState<FalhaIaFotos | null>(null);
  const [iaTentativa, setIaTentativa] = useState(0);
  // A IA do cadastro está ligada neste servidor? (null = ainda não sabemos: a frase do topo espera.)
  const [iaLigada, setIaLigada] = useState<boolean | null>(null);
  const [iaAnalisadas, setIaAnalisadas] = useState<string[]>([]);
  const [sugeridos, setSugeridos] = useState<CampoSugerido[]>([]);
  const [comodidadesSugeridas, setComodidadesSugeridas] = useState<string[]>([]);
  // Detecção-A (Entrega 3): chave ligada, comodidades achadas nas fotos e ainda não confirmadas, e o que falta foto.
  const [deteccaoLigada, setDeteccaoLigada] = useState(false);
  const [comodidadesDetectadas, setComodidadesDetectadas] = useState<string[]>([]);
  const [faltaFoto, setFaltaFoto] = useState<{ chave: string; rotulo: string }[]>([]);
  const [descricaoGeradaPorIa, setDescricaoGeradaPorIa] = useState(false);
  const [aceitouIa, setAceitouIa] = useState(false);
  // L2-B item 23: aceite do termo gravado por dono no servidor (versão atual). Já aceitou: a caixa não aparece.
  const [termoJaAceito, setTermoJaAceito] = useState<{ aceitoEm: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    meuAceiteTermoIa()
      .then((a) => {
        if (vivo && a && !precisaAceitarTermo(a)) setTermoJaAceito({ aceitoEm: a.aceitoEm });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  // 64-B: o aceite vale para o texto do momento em que foi dado (impressão do título + descrição); mudou → cai.
  const [aceiteTexto, setAceiteTexto] = useState<string | null>(null);
  const [avisoAceite, setAvisoAceite] = useState<string | null>(null);
  const [textoIaOriginal, setTextoIaOriginal] = useState<{ titulo: string; descricao: string } | null>(null);
  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("apartamento");
  // TIPO-CHACARA-B: acesso, tipo de internet e o ponto marcado pelo dono (só do tipo chácara/sítio).
  const [chacara, setChacara] = useState<ValorChacara>({});
  const [chacaraPontoGravado, setChacaraPontoGravado] = useState(false);
  const semInternet = !temInternet(tipoInternetDoAnuncio(propertyType, { chacara }));
  const [description, setDescription] = useState("");
  // Mudou o título ou a descrição depois do aceite: o aceite deixa de valer (caixa desmarcada) e o aviso aparece.
  const textoMudouDepoisDoAceite = aceitouIa && aceiteTexto !== null && impressaoDoTexto(title, description) !== aceiteTexto;
  const aceiteValido = !!termoJaAceito || (aceitouIa && !textoMudouDepoisDoAceite);
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [parkingSpots, setParkingSpots] = useState("");
  // Capacidade (quantas pessoas podem morar) — valida contra o nº de ocupantes no fechamento.
  const [maxGuests, setMaxGuests] = useState("");
  const [minPeriod, setMinPeriod] = useState("30");
  const [maxPeriod, setMaxPeriod] = useState("180");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [furnished, setFurnished] = useState(true);
  const [petsOk, setPetsOk] = useState(false);
  const [privacidade, setPrivacidade] = useState<Privacidade>(PRIVACIDADE_VAZIA);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [childrenAllowed, setChildrenAllowed] = useState(true);
  // 61-B: tipo de entrada (obrigatório para publicar anúncio novo), mensagem a quem pede e o que considerar.
  const [chegada, setChegada] = useState<ChegadaEPedidoForm>(() => formDeChegada());
  const [amenityKeys, setAmenityKeys] = useState<Record<string, boolean>>({});
  // DETECTA-B: itens de nível sugeridos pelas fotos (saem do "o que falta") e releitura do nível após confirmar.
  const [sugeridasFotos, setSugeridasFotos] = useState<string[]>([]);
  const [nivelVersao, setNivelVersao] = useState(0);
  const [internetMbps, setInternetMbps] = useState("");
  // Proximidades: as do OSM (todas marcadas; o dono desmarca) + as manuais ("Adicionar outro").
  const [proxOsm, setProxOsm] = useState<LugarProximo[] | null>(null);
  const [proxCarregando, setProxCarregando] = useState(false);
  const [proxDesmarcados, setProxDesmarcados] = useState<string[]>([]);
  // PERTO-B: a busca já rodou para o endereço atual (uma mensagem só na tela: lista, "não achamos" ou "complete o endereço").
  const [proxBuscou, setProxBuscou] = useState(false);
  const proxBuscadoRef = useRef<string | null>(null);
  const [googlePlaces, setGooglePlaces] = useState<CuratedPlace[]>([]);
  const [manualProximities, setManualProximities] = useState<Proximity[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [airbnbMensal, setAirbnbMensal] = useState("");
  const [precoRegiao, setPrecoRegiao] = useState<{ valor: number; base: "bairro" | "cidade"; n: number } | null>(null);
  const [condoFee, setCondoFee] = useState("");
  const [street, setStreet] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [uf, setUf] = useState("MG");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Uberlândia");
  const [cep, setCep] = useState("");
  // L1-1: endereço já gravado do imóvel (rascunho retomado), para o "Enviar documento" não travar.
  const [enderecoSalvo, setEnderecoSalvo] = useState<EnderecoDoc | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  // Prompt 20: toda busca de CEP vira uma mensagem (achou, só a cidade, não achou, sem rede).
  const [cepResultado, setCepResultado] = useState<ResultadoCep | null>(null);
  // Envio de fotos pelo cartão da IA (passo 1) e pela barra do celular — o mesmo envio da galeria do passo 2.
  const [bairroDoCep, setBairroDoCep] = useState<string | null>(null);
  // Prompt 22: campos de endereço que a PESSOA digitou (o autofill do navegador não entra aqui).
  const digitadosRef = useRef(new Set<CampoEndereco>());
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoArquivo, setVideoArquivo] = useState("");
  const [utilitiesMode, setUtilitiesMode] = useState<"fixed" | "real">("fixed");
  const [utilitiesEstimate, setUtilitiesEstimate] = useState(0);
  const [issuesInvoice, setIssuesInvoice] = useState(false);
  const [faixas, setFaixas] = useState<Record<string, boolean>>({ temporada: true, media_estadia: true });
  const [garantias, setGarantias] = useState<Record<string, boolean>>({ caucao_avista: true, caucao_parcelada: false, seguro_fianca: false });
  const [prepFee, setPrepFee] = useState(450);
  const [negociacao, setNegociacao] = useState<Negociacao>(NEGOCIACAO_PADRAO);
  const [limites, setLimites] = useState<LimitesPrivados>({ valorMinimo: null, limpezasMax: null });
  const [ownershipType, setOwnershipType] = useState<Operacao>("own");
  const [subleaseAuthorized, setSubleaseAuthorized] = useState(false);
  const [subleaseDoc, setSubleaseDoc] = useState<PhotoItem[]>([]);
  const [docOperacaoAnexado, setDocOperacaoAnexado] = useState(false);
  const [subleaseDocTipo, setSubleaseDocTipo] = useState("");
  const [qual, setQual] = useState({ baseBadge: false, tHome: false, tWork: false });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // 59-C1: a causa da recusa do servidor no autosave (null = falha de rede).
  const [saveErro, setSaveErro] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>("");
  const [draftServerId, setDraftServerId] = useState<string | null>(null);
  const [existingDraft, setExistingDraft] = useState<{ id: string; pct: number } | null>(null);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [publishError, setPublishError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const draftParam = searchParams.get("draft");
  // Prompt 59 / 59-C1: o padrão mínimo de conforto. Com id, cada item marcado grava na hora; sem id, grava assim que o
  // primeiro autosave criar o rascunho. Só depois de carregar o que já estava salvo (nunca desmarca por omissão).
  const conf = useConfortoSalvo(editId ?? draftParam ?? draftServerId);
  const conforto = conf.marcados;
  const etapaParam = etapaDaUrl(searchParams.get("etapa"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();

  const tirarSugestao = (c: CampoSugerido) => setSugeridos((s) => s.filter((x) => x !== c));
  const sugerido = (c: CampoSugerido) => sugeridos.includes(c);

  const docOperacaoOk = docOperacaoAnexado || subleaseDoc.some((d) => !!d.path && !d.demo);
  const subleaseBlocked = exigeAutorizacao(ownershipType) && (!subleaseAuthorized || !docOperacaoOk || !tipoDocValido(ownershipType, subleaseDocTipo));
  // E104: o que falta na operação, dito na hora no "Antes de publicar" da Revisão (antes, só ao tentar sair do Passo 3).
  const faltaOperacao = !exigeAutorizacao(ownershipType)
    ? ""
    : !subleaseAuthorized
      ? "Marque a declaração para publicar."
      : !tipoDocValido(ownershipType, subleaseDocTipo)
        ? "Escolha o que você está anexando: contrato de administração ou procuração."
        : !docOperacaoOk
          ? `Anexe: ${DOC_AUTORIZACAO[ownershipType as "subleased" | "managed"].titulo.toLowerCase()}.`
          : "";
  const photosMissing = Math.max(0, MIN_PHOTOS - photos.length);
  const photoBlocked = photos.length < MIN_PHOTOS;
  const enderecoCompleto = [street.trim(), numero.trim()].filter(Boolean).join(", ");

  const garantiaOk = Object.values(garantias).some(Boolean);
  const prontidao = prontidaoAnuncio({
    enderecoOk: !!(street.trim() && neighborhood.trim() && city.trim()),
    detalhesOk: (Number(bathrooms) || 0) >= 1 && (Number(areaM2) || 0) > 0,
    periodoOk: (Number(minPeriod) || 0) > 0,
    fotos: photos.length,
    titulo: title,
    preco: Number(monthlyPrice) || 0,
    garantiaOk,
    sublocacaoOk: !subleaseBlocked,
    privacidadeOk: privacidade.semCamerasInterior,
    operacao: ownershipType,
    documento: docStatus,
    limitePlanoOk: null,
    descricao: description,
    selo: qual.baseBadge,
    // 65-B: uma fonte só (arquivo, ou link permitido do YouTube/Vimeo).
    video: videoDoAnuncio({ videoArquivo, videoUrl }).tipo !== null,
    // Prompt 22: a qualificação é item da MESMA lista, desde o passo 1 (no editor de anúncio publicado não se aplica).
    qualificacaoOk: editingId ? undefined : qualificado,
    // 61-B: o tipo de entrada só é exigido do anúncio NOVO (o publicado sem ele ganha só o aviso no painel).
    tipoEntradaOk: editingId ? undefined : tipoEntradaValido(chegada.tipoEntrada),
    // FILTROS-1 (E39): a velocidade da internet é o dado que o chip "Wi-Fi" da busca lê — anúncio novo só publica com ela.
    internetOk: editingId ? undefined : (mbpsValido(internetMbps) ?? 0) > 0,
    // Prompt 59: publicar exige o padrão mínimo (anúncio já publicado segue o prazo de adequação, não trava a edição).
    confortoFaltam: editingId ? undefined : itensFaltantes(conforto.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO }))).length,
    // PERTO-B: lugar manual antigo, sem o endereço do lugar, fica fora da página até o dono informar onde fica.
    proximidadesSemEndereco: manualProximities.filter(manualSemEndereco).length,
    // TIPO-CHACARA-B: chácara/sítio só publica com acesso, tipo de internet e o ponto no mapa.
    chacaraFaltam: ehChacara(propertyType) ? faltaChacara({ acesso: chacara.acesso, internet: chacara.internet, pontoMarcado: !!chacara.ponto || chacaraPontoGravado }) : undefined,
    // E102-B: "Não tem internet" barra pelo padrão mínimo (e a velocidade nem é pedida).
    semInternet: semInternet || undefined,
  });
  /** "Resolver" de um item do portão: vai à etapa; a qualificação abre ali mesmo. */
  function resolverItem(item: ItemProntidao) {
    if (item.key === "qualificacao") setPainelQualificacao(true);
    else irPara(item.etapa);
    if (item.key === "conforto") setTimeout(() => document.querySelector('[data-testid="conforto-checklist"]')?.scrollIntoView({ block: "center" }), 50);
    // 65-B: "Para melhorar: Vídeo do imóvel" leva ao bloco de vídeo do passo Fotos.
    if (item.key === "video") setTimeout(() => document.getElementById(ANCORA_VIDEO_ASSISTENTE)?.scrollIntoView({ block: "start" }), 400);
  }
  // "Importar anúncio" (t115): preenche o que veio do texto colado e leva direto à etapa 3, com tudo preenchido.
  function aplicarImportado(a: AnuncioOrganizado) {
    if (a.titulo) setTitle(a.titulo);
    if (a.descricao) setDescription(a.descricao);
    if (a.tipo && PROPERTY_TYPES.some((t) => t.value === a.tipo)) setPropertyType(a.tipo);
    if (a.quartos != null) setBedrooms(String(a.quartos));
    if (a.banheiros != null) setBathrooms(String(a.banheiros));
    if (a.areaM2 != null) setAreaM2(String(a.areaM2));
    if (a.vagas != null) setParkingSpots(String(a.vagas));
    if (a.comodidades.length) setAmenityKeys((s) => ({ ...s, ...Object.fromEntries(a.comodidades.map((k) => [k, true])) }));
    if (a.aceitaPet != null) setPetsOk(a.aceitaPet);
    if (a.permiteFumar != null) setSmokingAllowed(a.permiteFumar);
    irPara(ETAPA.detalhes);
  }

  const completude = prontidao.obrigatorios;
  const podePublicar = prontidao.podePublicar && qualificado && aceiteValido;

  /** Campos obrigatórios da etapa atual (chave → mensagem). Só barra o AVANÇO; a Revisão é o portão final. */
  function validarEtapa(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === ETAPA.endereco) {
      // E104: quem opera e o documento da operação ficaram na Revisão; a prontidão ("sublocacao") segura a publicação.
      if (!street.trim()) e.rua = "Informe a rua.";
      if (!numero.trim()) e.numero = "Informe o número (ou s/n).";
      if (!neighborhood.trim()) e.bairro = "Informe o bairro.";
      if (!city.trim()) e.cidade = "Informe a cidade.";
    }
    if (s === ETAPA.fotos && photos.length === 0)
      e.fotos = "Adicione ao menos 1 foto para continuar (o mínimo para publicar é " + MIN_PHOTOS + ").";
    if (s === ETAPA.detalhes) {
      if ((Number(bathrooms) || 0) < 1) e.banheiros = "Informe ao menos 1 banheiro.";
      if ((Number(areaM2) || 0) <= 0) e.area = "Informe a área do imóvel (m²).";
      if ((Number(maxGuests) || 0) < 1) e.capacidade = "Informe quantas pessoas podem morar no imóvel.";
    }
    if (s === ETAPA.descricao && title.trim().length < 3) e.titulo = "Dê um título ao anúncio (mín. 3 caracteres).";
    if (s === ETAPA.preco) {
      if (!(Number(monthlyPrice) > 0)) e.preco = "Informe o valor mensal.";
      if (!garantiaOk) e.garantia = "Escolha ao menos uma garantia.";
    }
    return e;
  }

  function avancarEtapa() {
    const e = validarEtapa(step);
    setErros(e);
    if (Object.keys(e).length === 0) irPara(Math.min(ULTIMA_ETAPA, step + 1));
  }

  function voltarEtapa() {
    setErros({});
    irPara(Math.max(0, step - 1));
  }

  useEffect(() => {
    if (!editId) registrarEventoUmaVez("iniciar_anuncio");
  }, [editId]);

  const imovelId = editId ?? draftParam ?? draftServerId;
  useEffect(() => {
    let alive = true;
    getMyDocumentStatus(imovelId)
      .then((r) => {
        if (!alive) return;
        setDocStatus(r.status);
        setDocEstado(estadoDoStatus(r.status));
        setDocMotivos(r.reason ? r.reason.split(" · ") : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [imovelId]);

  useEffect(() => {
    if (!draftParam || editId) return;
    let alive = true;
    carregarQualificacao(draftParam)
      .then((q) => {
        if (alive) setQualificado(qualificadoDoServidor(q));
      })
      .catch(() => {
        if (alive) setQualificado(false);
      });
    return () => {
      alive = false;
    };
  }, [draftParam, editId]);


  // PERTO-B: os do OSM vão TODOS, com "não mostrar" (oculto) nos desmarcados; o servidor confere e calcula a distância.
  const proximidadesFinais: Proximity[] = [
    ...(proxOsm ?? []).map((l) => ({ ...paraProximity(l), oculto: proxDesmarcados.includes(chaveLugar(l)) })),
    ...manualProximities,
  ];

  const previewProperty = {
    id: "preview",
    title: title.trim() || "Sem título ainda",
    propertyType: propertyTypeLabel(propertyType),
    city: city || "Uberlândia",
    state: uf || "MG",
    neighborhood: neighborhood || "Bairro",
    bedrooms: Number(bedrooms) || 0,
    bathrooms: Number(bathrooms) || 0,
    areaM2: Number(areaM2) || 0,
    monthlyPrice: Number(monthlyPrice) || 0,
    // Cadastro 10: o "R$ X/mês no total" da revisão é o mesmo total mensal do anúncio (calcularTotalMensal).
    condoFee: Number(condoFee) || 0,
    utilitiesMode,
    utilitiesEstimate,
    photos: photos.map((p) => p.url),
    readyToLiveBadge: qual.baseBadge,
    tagHomeOffice: qual.tHome,
    tagWorkLocated: qual.tWork,
    tagCondoApproved: false,
  } as Property;

  async function publish(asDraft = false, irParaQualificacao = false) {
    if (!asDraft && !editingId && docStatus !== "approved") {
      setPublishError(
        docStatus === "rejected"
          ? "O documento precisa ser corrigido: reenvie na etapa Onde fica para publicar."
          : docStatus === "pending"
            ? "Documentação em revisão. Você pode salvar como rascunho; a publicação libera depois da conferência."
            : "Envie o documento do imóvel na etapa Onde fica para publicar."
      );
      return;
    }
    if (!asDraft && !editingId && !qualificado) {
      setPublishError("Falta a qualificação (checklist \"Antes de anunciar\"). Você pode salvar como rascunho e concluí-la para publicar.");
      return;
    }
    if (!asDraft) {
      const falta = completude.find((c) => !c.ok);
      if (falta) {
        setPublishError(`Falta para publicar: ${prontidao.faltam.join("; ")}.`);
        irPara(falta.etapa);
        return;
      }
    }
    if (!asDraft && photoBlocked) {
      setPublishError(`Adicione pelo menos ${MIN_PHOTOS} fotos para publicar. Faltam ${photosMissing}.`);
      return;
    }
    if (!asDraft && subleaseBlocked) {
      setPublishError(
        ownershipType === "managed"
          ? "Para publicar, anexe o contrato de administração ou a procuração e marque a declaração."
          : "Para publicar, anexe a autorização escrita do proprietário para sublocar e marque a declaração."
      );
      return;
    }
    const minDays = Number(minPeriod) || 30;
    const maxDays = Number(maxPeriod) || 0;
    if (maxDays && maxDays < minDays) {
      setPublishError("A duração máxima não pode ser menor que a mínima. Ajuste os prazos.");
      return;
    }
    if (!asDraft && !aceiteValido) {
      setPublishError("Marque a confirmação de que você revisou o anúncio para publicar.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    let q = { score: 0, tHome: false, tWork: false, tCondo: false };
    try {
      const raw = sessionStorage.getItem("vivanomads-qualification");
      if (raw) q = { ...q, ...JSON.parse(raw) };
    } catch {}

    // Geocodifica para gravar lat/lng (o ponto exato nunca é público: vale o círculo do bairro).
    const coords = await geocodeForSave({ street: enderecoCompleto, neighborhood, city });

    const payload = {
      title: title || "Imóvel mobiliado",
      description,
      propertyType,
      city: city || "Uberlândia",
      neighborhood,
      // Rua, número e complemento vão para a coluna restrita (o rascunho é apagado ao publicar).
      enderecoExato: linhaEnderecoExato(street, numero, complemento),
      // PERTO-B: para o servidor calcular a distância dos lugares (e guardar o CEP para a busca da edição).
      enderecoProximidades: { cep, rua: street, numero, cidade: city, uf },
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      areaM2: Number(areaM2) || 0,
      minPeriodDays: Number(minPeriod) || 30,
      monthlyPrice: Number(monthlyPrice) || 0,
      airbnbMonthlyPrice: Number(airbnbMensal) || 0,
      readyToLiveScore: q.score,
      tagHomeOffice: q.tHome,
      tagWorkLocated: q.tWork,
      tagCondoApproved: q.tCondo,
      ownershipType,
      subleaseAuthorized,
      subleaseDocUrl: subleaseDoc[0]?.path ?? subleaseDoc[0]?.url,
      subleaseDocTipo: subleaseDocTipo || undefined,
      condoFee: Number(condoFee) || 0,
      descricaoGeradaPorIa,
      utilitiesMode,
      utilitiesEstimate,
      issuesInvoice,
      acceptsInsurance: !!garantias.seguro_fianca,
      faixasAceitas: Object.keys(faixas).filter((k) => faixas[k]),
      garantiasAceitas: Object.keys(garantias).filter((k) => garantias[k]),
      prepFee,
      parkingSpots: Number(parkingSpots) || 0,
      maxGuests: Number(maxGuests) || undefined,
      availableFrom: availableFrom || undefined,
      availableUntil: availableUntil || undefined,
      maxPeriodDays: Number(maxPeriod) || undefined,
      furnished,
      petsAllowed: petsOk,
      semCamerasInterior: privacidade.semCamerasInterior,
      camerasExternas: privacidade.camerasExternas,
      tipoAcesso: privacidade.tipoAcesso,
      senhaTrocadaEstadia: privacidade.senhaTrocadaEstadia,
      smokingAllowed,
      childrenAllowed,
      ...payloadDaChegada(chegada),
      amenityKeys: Object.keys(amenityKeys).filter((k) => amenityKeys[k]),
      googlePlaces,
      proximities: proximidadesFinais,
      negociacao,
      limitesNegociacao: limites,
      internetMbps: mbpsValido(internetMbps),
      // TIPO-CHACARA-B: o servidor usa o ponto marcado no lugar da geocodificação e calcula a distância até a cidade.
      chacara: ehChacara(propertyType) ? { acesso: chacara.acesso, internet: chacara.internet, ponto: chacara.ponto ?? null } : undefined,
      lat: coords.lat,
      lng: coords.lng,
      photoUrls: photos.map((p) => p.url).filter((u) => u && !u.startsWith("blob:")),
      videoUrl: videoUrl.trim() || undefined,
      videoArquivo,
      asDraft,
      // 59-C1: a lista só vai quando o dono mexeu no checklist nesta sessão (já salva item a item); ausente = não mexe.
      ...(conf.mexido ? { confortoConfirmados: conforto, confortoMexido: true } : {}),
      aceiteIa: asDraft
        ? undefined
        : {
            versao: TERMO_IA_VERSAO,
            ...camposDaIa({ geradoPorIa: descricaoGeradaPorIa, titulo: title, descricao: description, original: textoIaOriginal ?? undefined }),
          },
    };

    const targetId = editingId || draftServerId;
    const res = targetId ? await updateProperty(targetId, payload) : await createProperty(payload);

    setPublishing(false);
    if (!res.ok) {
      setPublishError(res.error ?? "Não foi possível salvar.");
      return;
    }
    if (!asDraft && !editingId) registrarEvento("publicar_anuncio", { imovelId: targetId, cidade: city });
    if (!editingId) {
      try {
        localStorage.removeItem(DRAFT_KEY_LEGADO);
        if (userId) localStorage.removeItem(draftKey(userId));
      } catch {}
    }
    const destinoQual = irParaQualificacao ? linkQualificacao(res.id ?? targetId) : null;
    router.push(destinoQual ?? "/dashboard/imoveis");
  }

  // Aplica um snapshot de rascunho (localStorage OU servidor) ao formulário — fonte única da restauração.
  function aplicarDraft(d: Record<string, unknown>) {
    const s = (v: unknown) => (typeof v === "string" ? v : undefined);
    if (s(d.title)) setTitle(d.title as string);
    if (s(d.propertyType)) setPropertyType(d.propertyType as string);
    if (s(d.description)) setDescription(d.description as string);
    // 64-B: o aceite do termo de IA volta com o rascunho (só com a versão atual e o mesmo texto).
    const aceite = aceiteRestaurado(d.aceiteIa, s(d.title) ?? "", s(d.description) ?? "");
    setAceitouIa(aceite.marcado);
    setAceiteTexto(aceite.marcado ? impressaoDoTexto(s(d.title) ?? "", s(d.description) ?? "") : null);
    setAvisoAceite(aceite.aviso);
    if (s(d.bedrooms)) setBedrooms(d.bedrooms as string);
    if (s(d.bathrooms)) setBathrooms(d.bathrooms as string);
    if (s(d.areaM2)) setAreaM2(d.areaM2 as string);
    if (s(d.parkingSpots)) setParkingSpots(d.parkingSpots as string);
    if (s(d.maxGuests)) setMaxGuests(d.maxGuests as string);
    if (s(d.minPeriod)) setMinPeriod(d.minPeriod as string);
    if (s(d.maxPeriod)) setMaxPeriod(d.maxPeriod as string);
    if (s(d.availableFrom)) setAvailableFrom(d.availableFrom as string);
    if (s(d.availableUntil)) setAvailableUntil(d.availableUntil as string);
    if (s(d.monthlyPrice)) setMonthlyPrice(d.monthlyPrice as string);
    if (s(d.airbnbMensal)) setAirbnbMensal(d.airbnbMensal as string);
    if (s(d.condoFee)) setCondoFee(d.condoFee as string);
    if (typeof d.descricaoGeradaPorIa === "boolean") setDescricaoGeradaPorIa(d.descricaoGeradaPorIa);
    if (s(d.street)) setStreet(d.street as string);
    if (s(d.numero)) setNumero(d.numero as string);
    if (s(d.complemento)) setComplemento(d.complemento as string);
    if (s(d.uf)) setUf(d.uf as string);
    if (s(d.neighborhood)) setNeighborhood(d.neighborhood as string);
    if (s(d.city)) setCity(d.city as string);
    if (s(d.cep)) setCep(d.cep as string);
    if (s(d.videoUrl)) setVideoUrl(d.videoUrl as string);
    if (s(d.videoArquivo)) setVideoArquivo(d.videoArquivo as string);
    if (s(d.internetMbps)) setInternetMbps(d.internetMbps as string);
    if (d.chacara && typeof d.chacara === "object") setChacara(d.chacara as ValorChacara);
    if (typeof d.furnished === "boolean") setFurnished(d.furnished);
    if (typeof d.petsOk === "boolean") setPetsOk(d.petsOk);
    if (d.privacidade && typeof d.privacidade === "object") setPrivacidade({ ...PRIVACIDADE_VAZIA, ...(d.privacidade as Partial<Privacidade>) });
    if (typeof d.smokingAllowed === "boolean") setSmokingAllowed(d.smokingAllowed);
    if (typeof d.childrenAllowed === "boolean") setChildrenAllowed(d.childrenAllowed);
    setChegada((atual) => formDeRascunho(d, atual));
    if (typeof d.issuesInvoice === "boolean") setIssuesInvoice(d.issuesInvoice);
    if (d.amenityKeys && typeof d.amenityKeys === "object") setAmenityKeys(d.amenityKeys as Record<string, boolean>);
    if (Array.isArray(d.googlePlaces)) setGooglePlaces(d.googlePlaces as CuratedPlace[]);
    if (Array.isArray(d.manualProximities)) setManualProximities(d.manualProximities as Proximity[]);
    if (Array.isArray(d.proxOsm)) {
      setProxOsm(d.proxOsm as LugarProximo[]);
      setProxBuscou(true);
      proxBuscadoRef.current = chaveBuscaPerto(d.cep, d.street, d.numero);
    }
    if (Array.isArray(d.proxDesmarcados)) setProxDesmarcados((d.proxDesmarcados as unknown[]).filter((x): x is string => typeof x === "string"));
    if (Array.isArray(d.iaAnalisadas)) setIaAnalisadas((d.iaAnalisadas as unknown[]).filter((x): x is string => typeof x === "string"));
    if (Array.isArray(d.sugeridos)) setSugeridos(d.sugeridos as CampoSugerido[]);
    if (Array.isArray(d.comodidadesSugeridas)) setComodidadesSugeridas(d.comodidadesSugeridas as string[]);
    if (d.utilitiesMode === "fixed" || d.utilitiesMode === "real") setUtilitiesMode(d.utilitiesMode);
    if (typeof d.utilitiesEstimate === "number") setUtilitiesEstimate(d.utilitiesEstimate);
    if (d.faixas && typeof d.faixas === "object") setFaixas(d.faixas as Record<string, boolean>);
    if (d.garantias && typeof d.garantias === "object") setGarantias(d.garantias as Record<string, boolean>);
    if (typeof d.prepFee === "number") setPrepFee(d.prepFee);
    if (d.negociacao && typeof d.negociacao === "object") setNegociacao(normalizarNegociacao(d.negociacao));
    if (operacaoValida(d.ownershipType)) setOwnershipType(d.ownershipType);
    if (typeof d.subleaseAuthorized === "boolean") setSubleaseAuthorized(d.subleaseAuthorized);
    if (Array.isArray(d.photos)) setPhotos(d.photos as PhotoItem[]);
    if (Array.isArray(d.subleaseDoc)) setSubleaseDoc(d.subleaseDoc as PhotoItem[]);
    if (typeof d.subleaseDocTipo === "string") setSubleaseDocTipo(d.subleaseDocTipo);
    if (d.qual && typeof d.qual === "object") {
      const q = d.qual as Record<string, unknown>;
      setQual({ baseBadge: !!q.baseBadge, tHome: !!q.tHome, tWork: !!q.tWork });
    }
    // Rascunho das ordens antigas (7 etapas) abre na primeira etapa ainda incompleta.
    setStep(etapaDoRascunho(d));
    setEtapaMax(posMaxDoRascunho(d));
  }

  const draftIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draftParam || draftParam === draftIdRef.current) return;
    let alive = true;
    (async () => {
      const d = await loadDraftData(draftParam);
      if (!alive) return;
      draftIdRef.current = draftParam;
      setDraftServerId(draftParam);
      setApproved(true);
      if (d && typeof d === "object") aplicarDraft(d as Record<string, unknown>);
      enderecoGravadoDoImovel(draftParam).then((e) => alive && setEnderecoSalvo(e)).catch(() => {});
      carregarLimitesNegociacao(draftParam).then((l) => alive && setLimites(l)).catch(() => {});
      if (etapaParam !== null) {
        setStep(etapaParam);
        setEtapaMax((m) => Math.max(m, etapaParam));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);

  useEffect(() => {
    if (editId || draftParam) return;
    const raw = sessionStorage.getItem("vivanomads-qualification");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApproved(true);
    setQualificado(raw ? JSON.parse(raw).eligible === true : false);
    try {
      if (raw) {
        const q = JSON.parse(raw);
        setQual({ baseBadge: !!q.baseBadge, tHome: !!q.tHome, tWork: !!q.tWork });
      }
      localStorage.removeItem(DRAFT_KEY_LEGADO);
    } catch {}
    // Bug 12 (L2): com rascunho no servidor, oferece retomar (banner); sem, usa a cópia local.
    let alive = true;
    const local = (() => {
      try {
        return userId ? localStorage.getItem(draftKey(userId)) : null;
      } catch {
        return null;
      }
    })();
    const aplicarLocal = () => {
      try {
        if (alive && local) aplicarDraft(JSON.parse(local));
      } catch {}
      // `?etapa=` na URL de um anúncio novo vence a etapa guardada no rascunho local.
      if (alive && etapaParam !== null) {
        setStep(etapaParam);
        setEtapaMax((m) => Math.max(m, etapaParam));
      }
    };
    getLatestDraft()
      .then((d) => {
        if (!alive) return;
        if (d) setExistingDraft({ id: d.id, pct: d.prontidao?.pct ?? 0 });
        else aplicarLocal();
      })
      .catch(aplicarLocal);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, draftParam, userId]);

  // Edição: carrega o imóvel do dono e preenche o formulário.
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    (async () => {
      const p = await loadPropertyForEdit(editId);
      if (!alive) return;
      if (!p) {
        setPublishError("Não foi possível carregar este imóvel para edição. Tente novamente.");
        setApproved(true);
        return;
      }
      setEditingId(editId);
      setApproved(true);
      enderecoGravadoDoImovel(editId).then((e) => alive && setEnderecoSalvo(e)).catch(() => {});
      setTitle(p.title || "");
      setPropertyType(p.propertyType || "apartamento");
      setDescription(p.description || "");
      setBedrooms(p.bedrooms ? String(p.bedrooms) : "");
      setBathrooms(p.bathrooms ? String(p.bathrooms) : "");
      setAreaM2(p.areaM2 ? String(p.areaM2) : "");
      setParkingSpots(p.parkingSpots ? String(p.parkingSpots) : "");
      setMaxGuests(p.maxGuests ? String(p.maxGuests) : "");
      setMinPeriod(String(p.minPeriodDays || 30));
      setMaxPeriod(p.maxPeriodDays ? String(p.maxPeriodDays) : "180");
      setAvailableFrom(p.availableFrom ? p.availableFrom.slice(0, 10) : "");
      setAvailableUntil(p.availableUntil ? p.availableUntil.slice(0, 10) : "");
      setMonthlyPrice(p.monthlyPrice ? String(p.monthlyPrice) : "");
      setAirbnbMensal(p.airbnbMonthlyPrice ? String(p.airbnbMonthlyPrice) : "");
      setNeighborhood(p.neighborhood || "");
      setCity(p.city || "Uberlândia");
      setFurnished(p.furnished ?? true);
      setPetsOk(p.petsAllowed ?? false);
      setSmokingAllowed(p.smokingAllowed ?? false);
      setChildrenAllowed(p.childrenAllowed ?? true);
      setChegada(formDeChegada(p.chegadaEPedido));
      {
        const ch = normalizarChacara((p.detalhesAnuncio as { chacara?: unknown } | null | undefined)?.chacara);
        if (ch) setChacara({ acesso: ch.acesso, internet: ch.internet });
        setChacaraPontoGravado(!!ch?.pontoMarcado);
      }
      if (p.privacidade) setPrivacidade(p.privacidade);
      setUtilitiesMode(p.utilitiesMode === "real" ? "real" : "fixed");
      setUtilitiesEstimate(p.utilitiesEstimate ?? 200);
      setCondoFee(p.condoFee ? String(p.condoFee) : "");
      setDescricaoGeradaPorIa(!!p.descricaoGeradaPorIa);
      setIssuesInvoice(!!p.issuesInvoice);
      setPrepFee(p.prepFee ?? 450);
      setOwnershipType(operacaoValida(p.ownershipType) ? p.ownershipType : "own");
      setSubleaseAuthorized(!!p.subleaseAuthorized);
      setDocOperacaoAnexado(!!p.autorizacaoAnexada);
      setSubleaseDocTipo(p.subleaseDocTipo ?? "");
      setVideoUrl(p.videoUrl || "");
      setVideoArquivo(p.videoArquivo || "");
      setInternetMbps(p.internetMbps ? String(p.internetMbps) : "");
      if (p.negociacao) setNegociacao(p.negociacao);
      setAmenityKeys(Object.fromEntries(amenityKeysFromLabels(p.amenities || []).map((k) => [k, true])));
      setGooglePlaces((p.googlePlaces || []).map((g) => ({ placeId: g.placeId, categoria: g.categoria, rotulo: g.rotulo })));
      // PERTO-B: os do OSM salvos voltam como lista (com "não mostrar" nos ocultos) até a busca nova chegar; manuais à parte.
      const salvas = p.proximities || [];
      const doOsm = salvas.filter((x) => x.origem === "osm");
      setManualProximities(salvas.filter((x) => x.origem !== "osm"));
      if (doOsm.length) {
        setProxOsm(doOsm.map((x) => ({ tipo: (x.tipo ?? "onibus") as LugarProximo["tipo"], categoria: x.category, nome: x.name, distanciaM: x.distanciaM ?? 0 })));
        setProxDesmarcados(doOsm.filter((x) => x.oculto).map((x) => chaveLugar({ tipo: x.tipo, nome: x.name })));
      }
      if (p.faixasAceitas?.length) setFaixas(Object.fromEntries(p.faixasAceitas.map((k) => [k, true])));
      if (p.garantiasAceitas?.length) setGarantias(Object.fromEntries(p.garantiasAceitas.map((k) => [k, true])));
      setPhotos((p.photos || []).map((url, i) => ({ id: `edit-${i}`, url, name: "", path: null, demo: false })));
      // Edição: as fotos atuais já foram "analisadas" (não chama a IA só por abrir).
      setIaAnalisadas(p.photos || []);
      carregarLimitesNegociacao(editId).then((l) => alive && setLimites(l)).catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, [editId]);

  // 64-B: marcar/desmarcar o aceite guarda a impressão do texto daquele momento.
  function marcarAceite(v: boolean) {
    setAceitouIa(v);
    setAceiteTexto(v ? impressaoDoTexto(title, description) : null);
    setAvisoAceite(null);
  }

  // Auto-save do rascunho + "Salvo ✓". Os limites PRIVADOS da negociação NÃO vão no JSON (salvos à parte).
  const draftJson = JSON.stringify({
    title, propertyType, description, bedrooms, bathrooms, areaM2, parkingSpots, maxGuests,
    minPeriod, maxPeriod, availableFrom, availableUntil, monthlyPrice, airbnbMensal,
    street, numero, complemento, uf, neighborhood, city, cep, videoUrl, videoArquivo, internetMbps,
    privacidade, furnished, petsOk, smokingAllowed, childrenAllowed, issuesInvoice, ...payloadDaChegada(chegada),
    amenityKeys, googlePlaces, manualProximities, proxOsm, proxDesmarcados, chacara,
    condoFee, descricaoGeradaPorIa, utilitiesMode, utilitiesEstimate, faixas, garantias, prepFee, negociacao,
    ownershipType, subleaseAuthorized, step, ordemEtapas: VERSAO_ORDEM_ETAPAS, etapaMax: Math.max(etapaMax, pos),
    iaAnalisadas, sugeridos, comodidadesSugeridas,
    qual,
    aceiteIa: aceiteParaRascunho(aceiteValido, title, description),
    photos: photos.filter((p) => p.url && !p.url.startsWith("blob:")),
    subleaseDoc: subleaseDoc.filter((p) => p.url && !p.url.startsWith("blob:")),
    subleaseDocTipo,
  });
  useEffect(() => {
    if (approved !== true || editId) return;
    try {
      if (userId) localStorage.setItem(draftKey(userId), draftJson);
    } catch {
      /* cota do navegador cheia — o rascunho ainda tenta o servidor */
    }
    const vazio =
      !title.trim() && !description.trim() && !street.trim() && !neighborhood.trim() && !cep.trim() &&
      photos.length === 0 && !(Number(monthlyPrice) > 0) && !bedrooms && !bathrooms && !areaM2;
    if (vazio) return;

    let on = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      if (!on) return;
      // 59-C1: rede (o fetch nem chegou) ≠ recusa do servidor (chegou e o banco disse não, com a causa).
      let res: Awaited<ReturnType<typeof saveDraftData>>;
      try {
        res = await saveDraftData({
          id: draftIdRef.current,
          title,
          city,
          monthlyPrice: Number(monthlyPrice) || 0,
          neighborhood,
          bathrooms: Number(bathrooms) || 0,
          areaM2: Number(areaM2) || 0,
          description,
          data: JSON.parse(draftJson),
        });
      } catch {
        if (on) {
          setSaveErro(null);
          setSaveStatus("error");
        }
        return;
      }
      if (!on) return;
      if (res.ok) {
        if (res.id) {
          const novo = draftIdRef.current !== res.id;
          draftIdRef.current = res.id;
          setDraftServerId(res.id);
          if (novo && !editId) window.history.replaceState(null, "", `/dashboard/imoveis/novo?draft=${res.id}`);
        }
        setSaveStatus("saved");
        setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      } else {
        setSaveErro(res.error ?? "o servidor recusou a gravação.");
        setSaveStatus(res.demo ? "saved" : "error");
      }
    }, 2000);
    return () => {
      on = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, draftJson, editId, userId]);

  // Limites privados do rascunho: gravados à parte (tabela só do dono), nunca no JSON do rascunho.
  const limitesJson = JSON.stringify(limites);
  useEffect(() => {
    const id = editingId ?? draftServerId;
    if (!id || editingId) return;
    const t = setTimeout(() => void salvarLimitesNegociacao(id, JSON.parse(limitesJson)).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [limitesJson, draftServerId, editingId]);

  const unsavedRef = useRef(false);
  useEffect(() => {
    unsavedRef.current = !editId && (saveStatus === "saving" || saveStatus === "error");
  }, [editId, saveStatus]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // CEP primeiro (prompt 10) que sempre responde (prompt 20): ViaCEP → BrasilAPI, e cada resultado vira mensagem.
  async function lookupCep(value: string) {
    if (value.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    setCepResultado(null);
    const r = await buscarCep(value, (url) => fetch(url));
    // Prompt 22: o CEP substitui o que a pessoa NÃO digitou (autofill do navegador e valor antigo não contam).
    aplicarNoFormulario(aplicarResultadoCep(r, { rua: street, bairro: neighborhood, cidade: city }, digitadosRef.current));
    setCepResultado(r);
    setCepLoading(false);
    // Achou a rua: o próximo campo é o Número.
    if (r.tipo === "rua") setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="cadastro-numero"]')?.focus(), 0);
  }

  function aplicarNoFormulario(a: ReturnType<typeof aplicarResultadoCep>) {
    if (a.rua !== undefined) setStreet(a.rua);
    if (a.bairro !== undefined) setNeighborhood(a.bairro);
    if (a.cidade !== undefined) setCity(a.cidade);
    if (a.uf) setUf(a.uf);
    if (a.perguntarBairro) setBairroDoCep(a.perguntarBairro);
  }

  /** "Buscar pelo endereço" (prompt 20): a opção escolhida preenche o CEP certo (e substitui o que não foi digitado). */
  function escolherEndereco(o: OpcaoEndereco) {
    setCep(formatarCep(o.cep));
    const r: ResultadoCep = { tipo: "rua", rua: o.rua, bairro: o.bairro, cidade: o.cidade, uf: o.uf };
    aplicarNoFormulario(aplicarResultadoCep(r, { rua: street, bairro: neighborhood, cidade: city }, digitadosRef.current));
    setCepResultado(r);
    setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="cadastro-numero"]')?.focus(), 0);
  }

  /**
   * Matrícula conferida (prompt 19): preenche o que estiver vazio — unidade (complemento), área e vagas — com a
   * etiqueta "veio da matrícula" (tudo editável). Endereço diferente do CEP: só avisa e deixa o dono escolher.
   */
  function aplicarMatricula(m: InfoMatricula) {
    const p = m.preenchimento;
    if (!p) return;
    const marcados = new Set(daMatricula);
    if (p.unidade && !complemento.trim()) {
      setComplemento(p.unidade.slice(0, 60));
      marcados.add("complemento");
    }
    if (p.areaM2 && !((Number(areaM2) || 0) > 0)) {
      setAreaM2(String(p.areaM2));
      marcados.add("area");
    }
    if (p.vagas != null && !parkingSpots) {
      setParkingSpots(String(p.vagas));
      marcados.add("vagas");
    }
    setDaMatricula(marcados);
    setEnderecoMatricula(m.avisos.some((a) => a.codigo === "endereco_diferente") ? p.endereco : null);
  }

  function usarEnderecoMatricula(usar: boolean) {
    const e = enderecoMatricula;
    setEnderecoMatricula(null);
    if (!usar || !e) return;
    if (e.cep) setCep(formatarCep(e.cep));
    if (e.rua) setStreet(e.rua);
    if (e.numero) setNumero(e.numero.slice(0, 20));
    if (e.bairro) setNeighborhood(e.bairro);
    if (e.cidade) setCity(e.cidade);
    if (e.uf) setUf(e.uf.slice(0, 2));
    setDaMatricula((atual) => new Set(atual).add("endereco"));
  }

  // PERTO-B: a busca do "O que tem por perto" roda no cadastro novo E na edição, e de novo sempre que o endereço muda
  // (CEP, rua ou número). O servidor usa o cache por CEP; "não mostrar" (desmarcados) é mantido entre buscas.
  async function buscarPerto(corpo: Record<string, unknown>) {
    setProxCarregando(true);
    try {
      const res = await fetch("/api/proximidades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const data = (await res.json().catch(() => ({}))) as { itens?: LugarProximo[] };
      if (Array.isArray(data.itens) && (data.itens.length > 0 || !proxOsm?.length)) setProxOsm(data.itens);
    } catch {
      /* sem rede: fica o que já havia */
    } finally {
      setProxBuscou(true);
      setProxCarregando(false);
    }
  }
  useEffect(() => {
    const c = cepValido(cep);
    const chave = chaveBuscaPerto(cep, street, numero);
    if (!c || !street.trim() || proxBuscadoRef.current === chave) return;
    const t = setTimeout(() => {
      proxBuscadoRef.current = chave;
      void buscarPerto({ cep: c, rua: street, numero, bairro: neighborhood, cidade: city, uf });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, street, numero, neighborhood, city, uf]);
  // Edição (rascunho ou publicado sem o endereço no formulário): ao abrir, busca pelo endereço guardado no servidor.
  useEffect(() => {
    if (!editingId || cepValido(cep) || proxBuscadoRef.current) return;
    proxBuscadoRef.current = `anuncio:${editingId}`;
    void buscarPerto({ propertyId: editingId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, cep]);

  /** Distância do endereço de um lugar adicionado à mão até o do anúncio (calculada no servidor). */
  async function medirLugar(endereco: string): Promise<number | null> {
    const c = cepValido(cep);
    const corpo = c ? { acao: "lugar", endereco, cep: c, rua: street, numero, cidade: city, uf } : editingId ? { acao: "lugar", endereco, propertyId: editingId } : null;
    if (!corpo) return null;
    const res = await fetch("/api/proximidades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const data = (await res.json().catch(() => ({}))) as { distanciaM?: number | null };
    return typeof data.distanciaM === "number" ? data.distanciaM : null;
  }

  // Preço sugerido para imóveis parecidos na região (mediana de anúncios reais; sem dados, nada). Pede nos Detalhes e
  // de novo no Preço: quem avança antes de a resposta chegar não perde a sugestão (corrida vista no laboratório do E104).
  useEffect(() => {
    if ((step !== ETAPA.detalhes && step !== ETAPA.preco) || !city.trim()) return;
    let alive = true;
    precoDaRegiao({ cidade: city, bairro: neighborhood, quartos: Number(bedrooms) || 0 })
      .then((r) => {
        if (!alive) return;
        setPrecoRegiao(r);
        if (r && !(Number(monthlyPrice) > 0)) {
          setMonthlyPrice(String(r.valor));
          setSugeridos((s) => (s.includes("preco") ? s : [...s, "preco"]));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, city, neighborhood, bedrooms]);

  // Consumo pré-preenchido por quartos (estimativa simples e editável) ao chegar na etapa de preço.
  useEffect(() => {
    if (step !== 3 || utilitiesEstimate > 0 || editingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUtilitiesEstimate(consumoSugerido(Number(bedrooms) || 1));
    setSugeridos((s) => (s.includes("consumo") ? s : [...s, "consumo"]));
  }, [step, utilitiesEstimate, bedrooms, editingId]);

  function comecarOutro() {
    setDraftBannerDismissed(true);
    try {
      localStorage.removeItem(DRAFT_KEY_LEGADO);
      if (userId) localStorage.removeItem(draftKey(userId));
    } catch {}
    draftIdRef.current = null;
    setDraftServerId(null);
    setSaveStatus("idle");
    setStep(ORDEM_ETAPAS[0]);
    setEtapaMax(0);
    setTitle("");
    setDescription("");
    setPropertyType("apartamento");
    setBedrooms("");
    setBathrooms("");
    setAreaM2("");
    setParkingSpots("");
    setMaxGuests("");
    setMonthlyPrice("");
    setStreet("");
    setNumero("");
    setComplemento("");
    setNeighborhood("");
    setCep("");
    digitadosRef.current.clear();
    setVideoUrl("");
    setPhotos([]);
    setSubleaseDoc([]);
    setAmenityKeys({});
    setGooglePlaces([]);
    setManualProximities([]);
    setProxOsm(null);
    setProxDesmarcados([]);
    setProxBuscou(false);
    proxBuscadoRef.current = null;
    setIaAnalisadas([]);
    setSugeridos([]);
    setComodidadesSugeridas([]);
    // O botão "Começar outro" some com o aviso: o foco volta para o CEP, primeiro campo da etapa 1.
    setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="cadastro-cep"]')?.focus(), 0);
  }

  function aplicarSugestao(d: SugestaoFotos, analisadas: string[]) {
    const marcados: CampoSugerido[] = [];
    if (d.tipo && PROPERTY_TYPES.some((t) => t.value === d.tipo) && propertyType === "apartamento" && d.tipo !== propertyType) {
      setPropertyType(d.tipo);
      marcados.push("tipo");
    }
    if (d.quartos !== undefined && !bedrooms) {
      setBedrooms(String(d.quartos));
      marcados.push("quartos");
      if (!maxGuests) {
        setMaxGuests(String(capacidadeSugerida(d.quartos)));
        marcados.push("capacidade");
      }
    }
    if (d.banheiros !== undefined && !bathrooms) {
      setBathrooms(String(d.banheiros));
      marcados.push("banheiros");
    }
    if (d.mobiliado !== undefined && d.mobiliado !== furnished) {
      setFurnished(d.mobiliado);
      marcados.push("mobiliado");
    }
    if (d.comodidades?.length) {
      const novas = d.comodidades.filter((k) => !amenityKeys[k]);
      setAmenityKeys((a) => ({ ...a, ...Object.fromEntries(d.comodidades.map((k) => [k, true])) }));
      setComodidadesSugeridas(novas);
    }
    if (d.titulo && !title.trim()) {
      setTitle(d.titulo);
      marcados.push("titulo");
    }
    if (d.descricao && !description.trim()) {
      setDescription(d.descricao);
      setDescricaoGeradaPorIa(true);
      marcados.push("descricao");
    }
    if (d.titulo || d.descricao) setTextoIaOriginal({ titulo: d.titulo ?? "", descricao: d.descricao ?? "" });
    // Capa sugerida (a sala ou a foto mais clara) vai para a 1ª posição, se o dono ainda não escolheu outra.
    if (typeof d.capa === "number" && analisadas[d.capa]) {
      const url = analisadas[d.capa];
      setPhotos((ps) => {
        const i = ps.findIndex((p) => p.url === url);
        if (i <= 0) return ps;
        const next = [...ps];
        const [capa] = next.splice(i, 1);
        return [capa, ...next];
      });
    }
    setSugeridos((s) => [...new Set([...s, ...marcados])]);
  }

  /*
    Análise das fotos pela IA (prompt 10): roda SOZINHA quando o envio termina e há o mínimo de fotos. Uma chamada
    por rascunho; refaz só se o dono trocar mais de 3 fotos. Falhou ou desligada (prompt 22): a tela diz o motivo e
    oferece "Tentar de novo"; com a IA desligada no servidor, nem chama a rota.
    Nunca sobrescreve o que o dono já escreveu: só campos vazios, e cada sugestão fica marcada "Sugerido · confira".
  */
  const fotosUrls = photos.map((p) => p.url).filter((u) => u && !u.startsWith("blob:"));
  const fotosKey = fotosUrls.join("|");
  useEffect(() => {
    if (editingId || !iaFotosLiberada(fotosUrls.length) || iaEstado === "analisando") return;
    if (!precisaReanalisar(iaAnalisadas, fotosUrls)) return;
    let alive = true;
    const t = setTimeout(async () => {
      const falhou = (motivo: MotivoFalhaIa, texto?: string) => {
        // Falhou: o rascunho não guarda estas fotos como "analisadas" — ao reabrir (ou em "Tentar de novo") analisa de novo.
        setIaAnalisadas([]);
        setIaFalha({ motivo, texto: texto || MENSAGEM_FALHA_IA[motivo] });
        setIaEstado("erro");
      };
      if (iaLigada === false) return falhou("desligada");
      setIaEstado("analisando");
      try {
        const passo = Math.max(1, Math.floor(fotosUrls.length / FOTOS_MAX_MINIATURAS));
        const escolhidas = fotosUrls.filter((_, i) => i % passo === 0).slice(0, FOTOS_MAX_MINIATURAS);
        const minis = (await Promise.all(escolhidas.map((u) => miniaturaBase64(u, FOTOS_LADO_MAX_PX)))).filter((m): m is string => !!m);
        if (!alive) return;
        setIaAnalisadas(fotosUrls);
        if (minis.length === 0) return falhou("ilegivel", "Não conseguimos preparar as fotos para a análise. Tente de novo.");
        const res = await fetch("/api/ai/fotos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ miniaturas: minis }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<SugestaoFotos> & { error?: string; motivo?: MotivoFalhaIa };
        if (!alive) return;
        if (!res.ok) return falhou(data.motivo ?? motivoDoStatusFotos(res.status, false), data.error);
        setIaFalha(null);
        aplicarSugestao(data as SugestaoFotos, escolhidas);
        setIaEstado("feita");
      } catch {
        if (alive) falhou("indisponivel", "Sem conexão com a análise das fotos agora. Confira a internet e tente de novo.");
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotosKey, editingId, iaTentativa, iaLigada]);

  /** "Tentar de novo" (prompt 22): esquece a análise que falhou e chama a IA outra vez. */
  function tentarIaDeNovo() {
    setIaFalha(null);
    setIaAnalisadas([]);
    setIaEstado("parada");
    setIaTentativa((n) => n + 1);
  }

  // A frase "A IA preenche o resto pelas fotos" só aparece com a IA ligada (prompt 22).
  useEffect(() => {
    let alive = true;
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { fotos?: boolean } | null) => alive && setIaLigada(j?.fotos === true))
      .catch(() => alive && setIaLigada(false));
    return () => {
      alive = false;
    };
  }, []);

  if (approved === null) return null;

  // Campos do imóvel, repartidos pelos passos 2, 4 e 5 (Prompt 43).
  const camposImovel = {
    propertyType,
    setPropertyType: (v: string) => {
      setPropertyType(v);
      tirarSugestao("tipo");
    },
    tipoSugerido: sugerido("tipo"),
    neighborhood,
    iaEstado,
    sugerido,
    tirarSugestao,
    bedrooms,
    setBedrooms,
    bathrooms,
    setBathrooms,
    maxGuests,
    setMaxGuests,
    areaM2,
    daMatricula,
    setAreaM2,
    parkingSpots,
    setParkingSpots,
    amenityKeys,
    setAmenityKeys,
    comodidadesSugeridas,
    internetMbps,
    setInternetMbps,
    semInternet,
    imovelId: draftServerId ?? editingId,
    proxOsm,
    proxCarregando,
    proxBuscou,
    medirLugar,
    reportarLugar: imovelId ? (l: LugarProximo, motivo: string) => reportarProximidade(imovelId, l.nome, l.tipo, motivo) : null,
    proxDesmarcados,
    setProxDesmarcados,
    manualProximities,
    setManualProximities,
    title,
    setTitle,
    description,
    setDescription: (v: string) => {
      setDescription(v);
      setDescricaoGeradaPorIa(false);
    },
    furnished,
    setFurnished,
    petsOk,
    setPetsOk,
    childrenAllowed,
    setChildrenAllowed,
    smokingAllowed,
    setSmokingAllowed,
    privacidade,
    setPrivacidade,
    qualTHome: qual.tHome,
    erros,
  };
  const meta = STEP_META[step];

  return (
    <div className="w-full">
      {saveStatus !== "idle" && (
        <div className="mb-2 flex justify-end">
          <span
            data-testid="estado-salvamento"
            data-estado={saveStatus}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium",
              saveStatus === "saved" ? "bg-sage-100 text-forest" : saveStatus === "error" ? "bg-red-50 text-red-700" : "bg-surface-2 text-muted"
            )}
          >
            {saveStatus === "saved" ? (
              <>
                <Check className="h-3.5 w-3.5" /> Salvo{savedAt ? ` às ${savedAt}` : ""}
              </>
            ) : saveStatus === "error" ? (
              <>
                <XCircle className="h-3.5 w-3.5" /> {saveErro ? `Não foi possível salvar: ${saveErro}` : "Sem conexão — não salvo"}
              </>
            ) : (
              "Salvando…"
            )}
          </span>
        </div>
      )}
      {!editingId && !draftParam && existingDraft && !draftServerId && !draftBannerDismissed && (
        <div data-testid="rascunho-aviso" className="mb-4 flex flex-col gap-3 rounded-xl border border-champagne bg-champagne/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-champagne/40 text-forest">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-title text-sm font-semibold text-ink">
                Você tem um anúncio em andamento
                {existingDraft.pct > 0 ? ` (${existingDraft.pct}% completo)` : ""}
              </p>
              <p className="text-xs text-muted">Retome de onde parou — seus dados foram salvos automaticamente.</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={comecarOutro}>
              Começar outro
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="rascunho-continuar"
              onClick={() => {
                setDraftBannerDismissed(true);
                router.push(`/dashboard/imoveis/novo?draft=${existingDraft.id}`);
              }}
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Mockups cadastro-imovel-01..10: à esquerda, o título do passo (o H1 da tela) e o formulário; à direita
          (computador), a prévia do anúncio montando ao vivo. CADASTRO-MOLDURA: "Passo X de 10", a barra de progresso,
          Voltar e o primário moram no rodapé do fluxo (RodapeAssistente). */}

      <div className={cn("grid gap-8 lg:items-start", step !== ETAPA.revisao && "lg:grid-cols-[minmax(0,1fr)_22rem]")} data-testid="novo-duas-colunas">
        {/* E104 (mockup cadastro-imovel-03): o Passo 3 é um cartão branco sobre o fundo areia da moldura. */}
        <div className={cn("min-w-0", step === ETAPA.endereco && "rounded-xl border border-line bg-white p-4 sm:p-8")} data-testid="novo-coluna-form">
          <span className="inline-flex items-center gap-2 rounded-full border border-forest px-3 py-1 text-sm font-medium text-forest" data-testid="cadastro-modo">
            {editingId ? "Editar anúncio" : "Anunciar imóvel"} <span className="h-2 w-2 rounded-full bg-forest" aria-hidden />
          </span>
          <h1 className={cn(TITULO_PASSO_CADASTRO, "mt-3")} data-testid="passo-titulo">
            {meta.title}
          </h1>
          <p className="mt-2 text-base text-muted" data-testid="passo-subtitulo">
            {meta.subtitle}
          </p>
          {painelQualificacao && (
            <PainelQualificacao
              imovelId={imovelId}
              onFechar={() => setPainelQualificacao(false)}
              onSalva={(r) => {
                setQualificado(r.elegivel);
                setQual({ baseBadge: r.selo, tHome: r.tHome, tWork: r.tWork });
              }}
            />
          )}
          <div className="mt-6">
            {step === ETAPA.tipo && (
              <div className="space-y-6">
                <EtapaTipo tipo={propertyType} onTipo={camposImovel.setPropertyType} sugerido={camposImovel.tipoSugerido} />
                {/* "Antes de anunciar" (qualificação do imóvel), quando pendente, entra neste passo (mapa da Pista B). */}
                {completude
                  .filter((i) => i.key === "qualificacao" && !i.ok)
                  .map((i) => (
                    <div key={i.key} className="flex flex-col gap-3 rounded-xl border border-champagne bg-champagne/10 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="tipo-qualificacao">
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{i.label}</span>
                        {i.detalhe ? ` · ${i.detalhe}` : ""}
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => resolverItem(i)}>
                        Responder agora
                      </Button>
                    </div>
                  ))}
                {/* E104: importar de outro site / pedir ajuda — no começo do cadastro (saíram do Passo 3). */}
                {!editingId && <AtalhosCadastro aplicarImportado={aplicarImportado} />}
              </div>
            )}

            {step === ETAPA.endereco && (
              <EtapaOndeFica
                cepResultado={cepResultado}
                onEscolherEndereco={escolherEndereco}
                cep={cep}
                setCep={(v) => {
                  setCep(v);
                  setErros((e) => semErro(e, "cep"));
                  if (v.replace(/\D/g, "").length === 8) void lookupCep(v);
                  else setCepResultado(null);
                }}
                cepLoading={cepLoading}
                street={street}
                setStreet={(v) => {
                  setStreet(v);
                  setErros((e) => semErro(e, "rua"));
                }}
                marcarDigitado={(c) => digitadosRef.current.add(c)}
                numero={numero}
                setNumero={(v) => {
                  setNumero(v);
                  setErros((e) => semErro(e, "numero"));
                }}
                complemento={complemento}
                setComplemento={setComplemento}
                neighborhood={neighborhood}
                setNeighborhood={setNeighborhood}
                bairroDoCep={bairroDoCep}
                setBairroDoCep={setBairroDoCep}
                city={city}
                setCity={setCity}
                uf={uf}
                daMatricula={daMatricula}
                enderecoMatricula={enderecoMatricula}
                onEnderecoMatricula={usarEnderecoMatricula}
                erros={erros}
              />
            )}

            {step === ETAPA.fotos && (
              <EtapaFotos photos={photos} setPhotos={setPhotos} cep={cep} videoUrl={videoUrl} setVideoUrl={setVideoUrl} videoArquivo={videoArquivo} setVideoArquivo={setVideoArquivo} iaEstado={iaEstado} iaFalha={iaFalha} onTentarDeNovo={tentarIaDeNovo} erroFotos={erros.fotos} imovelId={editingId ?? draftServerId} />
            )}

            {step === ETAPA.detalhes && (
              <div className="space-y-6">
                <EtapaEncontramos parte="espaco" {...camposImovel} />
                {/* TIPO-CHACARA-B: acesso, tipo de internet e o ponto no mapa (obrigatórios para publicar este tipo). */}
                {ehChacara(propertyType) && (
                  <CamposChacara valor={chacara} onChange={setChacara} centro={UBERLANDIA_CENTER} pontoGravado={chacaraPontoGravado} />
                )}
              </div>
            )}

            {step === ETAPA.comodidades && (
              <div className="space-y-6">
                {/* Detecção-A: no topo, o que ainda falta foto (só com a chave da detecção ligada). */}
                {deteccaoLigada && <AlertaFaltaFoto itens={faltaFoto} />}
                <EtapaEncontramos parte="comodidades" {...camposImovel} comodidadesDetectadas={comodidadesDetectadas} />
                {/* Prompt 59-A: o padrão mínimo da Viva é confirmado junto das comodidades. */}
                <ChecklistConforto
                  marcados={conforto}
                  onChange={conf.alterar}
                  desabilitado={publishing || !conf.carregado}
                  salvamento={conf.salvamento}
                  onTentarDeNovo={conf.tentarDeNovo}
                />
                {/* DETECTA-B: o que as fotos da galeria mostram, como sugestão (só conta depois de confirmar). */}
                <SugestoesDasFotos
                  propertyId={imovelId}
                  comodidadesMarcadas={Object.keys(amenityKeys).filter((k) => amenityKeys[k])}
                  onComodidade={(k) => setAmenityKeys((a) => ({ ...a, [k]: true }))}
                  onSugeridas={setSugeridasFotos}
                  onComodidadesSugeridas={setComodidadesDetectadas}
                  onLigada={setDeteccaoLigada}
                  onNivelMudou={() => setNivelVersao((v) => v + 1)}
                />
                {/* Adendo 59.1: o nível que o imóvel atinge agora e o que falta para o próximo, item a item, com foto. */}
                <NivelNoCadastro propertyId={imovelId} conforto={conforto} sugeridas={sugeridasFotos} recarregar={nivelVersao} onFaltaFoto={setFaltaFoto} />
              </div>
            )}

            {step === ETAPA.regras && (
              <div>
                <EtapaEncontramos parte="regras" {...camposImovel} />
                <ChegadaEPedidoCampos value={chegada} onChange={setChegada} />
              </div>
            )}

            {step === ETAPA.descricao && <EtapaEncontramos parte="descricao" {...camposImovel} />}

            {(step === ETAPA.preco || step === ETAPA.disponibilidade) && (
              <EtapaPreco
                parte={step === ETAPA.preco ? "preco" : "disponibilidade"}
                imovelId={imovelId}
                sugerido={sugerido}
                tirarSugestao={tirarSugestao}
                monthlyPrice={monthlyPrice}
                setMonthlyPrice={setMonthlyPrice}
                precoRegiao={precoRegiao}
                setAirbnbMensal={setAirbnbMensal}
                condoFee={condoFee}
                setCondoFee={setCondoFee}
                utilitiesMode={utilitiesMode}
                setUtilitiesMode={setUtilitiesMode}
                utilitiesEstimate={utilitiesEstimate}
                setUtilitiesEstimate={setUtilitiesEstimate}
                availableFrom={availableFrom}
                setAvailableFrom={setAvailableFrom}
                availableUntil={availableUntil}
                setAvailableUntil={setAvailableUntil}
                minPeriod={minPeriod}
                setMinPeriod={setMinPeriod}
                maxPeriod={maxPeriod}
                setMaxPeriod={setMaxPeriod}
                faixas={faixas}
                setFaixas={setFaixas}
                garantias={garantias}
                setGarantias={setGarantias}
                prepFee={prepFee}
                setPrepFee={setPrepFee}
                issuesInvoice={issuesInvoice}
                setIssuesInvoice={setIssuesInvoice}
                negociacao={negociacao}
                setNegociacao={setNegociacao}
                limites={limites}
                setLimites={setLimites}
                erros={erros}
              />
            )}

            {/* E104: quem opera, identidade e documento do imóvel saem do Passo 3 (só endereço) e ficam aqui, antes de
                publicar — a prontidão continua barrando a publicação sem eles. */}
            {step === ETAPA.revisao && (
              <div className="mb-6">
                <AntesDePublicar
                  ownershipType={ownershipType}
                  setOwnershipType={setOwnershipType}
                  subleaseAuthorized={subleaseAuthorized}
                  setSubleaseAuthorized={setSubleaseAuthorized}
                  subleaseDoc={subleaseDoc}
                  setSubleaseDoc={(d) => {
                    setSubleaseDoc(d);
                    if (d.length) setErros(({ sublocacao: _resolvido, ...resto }) => resto);
                  }}
                  docOperacaoAnexado={docOperacaoAnexado}
                  subleaseDocTipo={subleaseDocTipo}
                  setSubleaseDocTipo={(t) => {
                    setSubleaseDocTipo(t);
                    setErros(({ sublocacao: _resolvido, ...resto }) => resto);
                  }}
                  imovelId={imovelId}
                  docEstado={docEstado}
                  docMotivos={docMotivos}
                  onDocumento={(e, m) => {
                    setDocEstado(e);
                    setDocMotivos(m);
                    setDocStatus(e === "aprovado" ? "approved" : e === "corrija" ? "rejected" : e === "revisao" ? "pending" : "none");
                  }}
                  onMatricula={aplicarMatricula}
                  enderecoSalvo={enderecoSalvo}
                  onFaltaDocumento={(campos) => {
                    setErros((e) => ({ ...e, ...Object.fromEntries(campos.map((c) => [c, ERRO_CAMPO_ENDERECO[c]])) }));
                    // E104: os campos do endereço moram no Passo 3 — leva até lá e põe o foco no primeiro que falta.
                    if (!campos.length) return;
                    irPara(ETAPA.endereco);
                    setTimeout(() => {
                      const campo = document.querySelector<HTMLInputElement>(`[data-testid="${TESTID_CAMPO_ENDERECO[campos[0]]}"]`);
                      campo?.scrollIntoView({ block: "center" });
                      campo?.focus({ preventScroll: true });
                    }, 400);
                  }}
                  cep={cep}
                  street={street}
                  numero={numero}
                  neighborhood={neighborhood}
                  city={city}
                  faltaOperacao={faltaOperacao}
                />
              </div>
            )}
            {step === ETAPA.revisao && (
              <EtapaRevisar
                previewProperty={previewProperty}
                titulo={title}
                tipo={propertyType}
                bairro={neighborhood}
                fotos={photos.map((p) => p.url)}
                negociacao={negociacao}
                prontidao={prontidao}
                completude={completude}
                onResolver={resolverItem}
                melhorar={prontidao.opcionais.filter((o) => !o.ok)}
                docEstado={docEstado}
                docMotivos={docMotivos}
                editingId={editingId}
                publishing={publishing}
                publish={publish}
                irPara={irPara}
                aceitouIa={aceiteValido}
                setAceitouIa={marcarAceite}
                avisoAceite={termoJaAceito ? null : textoMudouDepoisDoAceite ? AVISO_TEXTO_MUDOU : avisoAceite}
                termoJaAceito={termoJaAceito}
                conforto={conforto}
                publishError={publishError}
                podePublicar={podePublicar}
                chacara={ehChacara(propertyType) ? { acesso: chacara.acesso, internet: chacara.internet, pontoMarcado: !!chacara.ponto || chacaraPontoGravado } : null}
              />
            )}

            {step === ETAPA.fotos && (
              <p className="mt-6 text-center text-sm text-muted" data-testid="fotos-reorganizar">
                {FOTOS_REORGANIZAR}
              </p>
            )}
          </div>
        </div>

        {/* Passo 10 (mockup cadastro-imovel-10): o cartão do anúncio fica dentro da revisão; a prévia lateral sai. */}
        {step !== ETAPA.revisao && (
        <aside className="hidden lg:sticky lg:top-4 lg:block" data-testid="novo-resumo" aria-label="Visualização do anúncio">
          <PreviaAnuncio
            foto={photos[0]?.url ?? null}
            titulo={title}
            tipo={propertyType}
            quartos={Number(bedrooms) || 0}
            areaM2={Number(areaM2) || 0}
            mobiliado={furnished}
            pets={petsOk}
            bairro={neighborhood}
            cidade={city}
            uf={uf}
            publicado={!!editingId}
          />
        </aside>
        )}
      </div>

      {/* E107: a faixa fixa "Fotos: N de 8" do celular saiu. As fotos moram só no Passo 2, com o contador e o envio da
          própria página (antes a faixa vazava para os outros passos e, no Passo 2, repetia o contador). */}
      {/* CADASTRO-MOLDURA: o rodapé do fluxo, igual nos passos 1 a 10 — "Passo N de 10" com a barra, "Voltar" (passos
          2–10) e um só primário: "Continuar"; no Passo 10, "Publicar anúncio" (o mesmo publish da revisão). */}
      <RodapeAssistente
        pos={pos}
        total={ORDEM_ETAPAS.length}
        onVoltar={pos > 0 ? voltarEtapa : null}
        primario={
          pos < ULTIMA_ETAPA
            ? { rotulo: "Continuar", onClick: avancarEtapa, testid: "cadastro-continuar", seta: true }
            : {
                rotulo: publishing ? "Salvando..." : editingId ? "Salvar alterações" : "Publicar anúncio",
                onClick: () => publish(false),
                disabled: publishing || !podePublicar,
                title: podePublicar ? undefined : "Resolva os itens pendentes da lista",
                testid: "publicar-anuncio",
              }
        }
      />
      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-sage)}`}</style>
    </div>
  );
}
