"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { LimpezaEstadiaCampos, formDeLimpeza, type LimpezaEstadiaForm } from "@/components/anuncio/limpeza-estadia-campos";
import { RegrasCasaCampos, estadosConvivencia, formDeRegrasCasa, payloadDeRegrasCasa, type RegrasCasaForm } from "@/components/anuncio/regras-casa-campos";
import { OPCOES_FUMO } from "@/lib/anuncio/regras-casa";
import { DetalhesAnuncioCampos, estadosDetalhes, formDeDetalhes, payloadDeDetalhes, type DetalhesForm } from "@/components/anuncio/detalhes-anuncio-campos";
import { CamposChacara, type ValorChacara } from "@/components/anuncio/campos-chacara";
import { ehChacara, faltaChacara, normalizarChacara } from "@/lib/anuncio/chacara";
import { UBERLANDIA_CENTER } from "@/lib/integrations/geocoding";
import { completudeBlocos, textoCompletude } from "@/lib/anuncio/bloco-opcional";
import { PetsRegrasCampos, formDeRegras, type RegrasPetsForm } from "@/components/anuncio/pets-regras-campos";
import { ChegadaEPedidoCampos, formDeChegada, payloadDaChegada, type ChegadaEPedidoForm } from "@/components/anuncio/chegada-e-pedido-campos";
import { avisoTipoEntradaNoPainel, tipoEntradaValido } from "@/lib/anuncio/chegada-e-pedido";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DateFieldBR } from "@/components/ui/date-field-br";
import {
  Camera,
  CalendarRange,
  FileText,
  Briefcase,
  ScrollText,
  ListChecks,
  Ruler,
  Check,
  ChevronDown,
  Share2,
  ExternalLink,
  Info,
  Loader2,
  Dog,
  Baby,
  Handshake,
  MapPin,
  Video,
} from "lucide-react";
import { BlocoNegociacao } from "@/components/anuncio/blocos-cadastro";
import { NEGOCIACAO_PADRAO, ITENS_NEGOCIAVEIS, type LimitesPrivados, type Negociacao } from "@/lib/anuncio/negociacao";
import { PageTitle } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { VideoUploader } from "@/components/video-uploader";
import { payloadDoVideo, resumoDoVideo, videoDoAnuncio } from "@/lib/video-anuncio";
import { BlockCalendar } from "@/components/property/block-calendar";
import { AMENITY_GROUPS, amenityKeysFromLabels } from "@/lib/amenities";
import { PrivacidadeCampos } from "@/components/anuncio/privacidade-campos";
import { PRIVACIDADE_VAZIA, type Privacidade } from "@/lib/anuncio/privacidade";
import { ANCORA_VIDEO_EDITOR, MIN_FOTOS, hrefParaMelhorar, prontidaoAnuncio, type FatosAnuncio } from "@/lib/anuncio/prontidao";
import { TERMO_IA_TEXTO, aceiteDoEditor } from "@/lib/anuncio/termo-ia";
import { carregarLimitesNegociacao, gravarVideoArquivo, salvarLimitesNegociacao, updateProperty, type PropertyInput } from "@/lib/data/actions";
import type { Property } from "@/lib/types";
import { MSG_DISPONIVEL_ATE_ANTES, periodoDisponivelValido } from "@/lib/anuncio/periodo-disponivel";
import { avisoTituloBairro } from "@/lib/anuncio/titulo-bairro";
import { formatBRL, cn } from "@/lib/utils";
import { calcularTudoIncluido } from "@/lib/precos";
import { normalizarLimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";
import { MedirInternet } from "@/components/anuncio/medir-internet";
import { SugestoesDasFotos } from "@/components/niveis/sugestoes-fotos";

const MIN_DESC = 60;

/** Só entradas que são URL de verdade viram foto (ignora rótulos/placeholder). */
const isPhotoUrl = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/** Micro-texto por categoria de comodidade (por que preencher). */
const AMENITY_HINT: Record<string, string> = {
  trabalho: "O que faz o nômade digital escolher o seu imóvel — aparece nos filtros de trabalho.",
  conforto: "Itens do dia a dia que o inquilino procura e filtra na busca.",
  predio: "Comodidades do prédio/condomínio contam pontos e passam confiança.",
};

/** Sugestões para uma descrição que converte (descrição guiada). */
const DESC_PROMPTS = [
  "Para quem é ideal (profissional em transição, família, intercâmbio…)",
  "O diferencial do imóvel (vista, silêncio, home office, localização)",
  "O que já vem pronto (mobília, enxoval, internet, utensílios)",
  "O bairro: o que há por perto (mercado, farmácia, parque, transporte)",
];

export function EditarImovelClient({
  property,
  demo,
  fatos,
  enderecoExatoInicial = "",
}: {
  property: Property;
  demo: boolean;
  /** Rua, número e complemento gravados (coluna restrita; só o dono lê). */
  enderecoExatoInicial?: string;
  /** Fatos do banco (documento, plano, garantia, selo…). null = sem backend. */
  fatos: FatosAnuncio | null;
}) {
  // ── Estado editável (prefill do imóvel carregado) ──────────────────────────
  const [title, setTitle] = useState(property.title ?? "");
  const [description, setDescription] = useState(property.description ?? "");
  const [photos, setPhotos] = useState<PhotoItem[]>(
    (property.photos ?? []).filter(isPhotoUrl).map((url, i) => ({
      id: `p-${i}`,
      url,
      name: "",
      path: null,
      demo: false,
    }))
  );
  const [availableFrom, setAvailableFrom] = useState(property.availableFrom?.slice(0, 10) ?? "");
  const [availableUntil, setAvailableUntil] = useState(property.availableUntil?.slice(0, 10) ?? "");
  const [minPeriod, setMinPeriod] = useState(String(property.minPeriodDays || 30));
  const [maxPeriod, setMaxPeriod] = useState(String(property.maxPeriodDays || 180));
  const [amenityKeys, setAmenityKeys] = useState<Record<string, boolean>>(
    Object.fromEntries(amenityKeysFromLabels(property.amenities ?? []).map((k) => [k, true]))
  );
  const [privacidade, setPrivacidade] = useState<Privacidade>(property.privacidade ?? PRIVACIDADE_VAZIA);
  const [petsAllowed, setPetsAllowed] = useState(property.petsAllowed ?? false);
  const [petsRegras, setPetsRegras] = useState<RegrasPetsForm>(formDeRegras(property.petsRegras));
  const [limpeza, setLimpeza] = useState<LimpezaEstadiaForm>(formDeLimpeza(property.limpezaEstadia));
  const smokingAllowed = property.smokingAllowed ?? false;
  // CAMPOS-1: regras estruturadas (o fumo daqui substitui o sim/não antigo quando definido).
  const [regrasCasa, setRegrasCasa] = useState<RegrasCasaForm>(formDeRegrasCasa(property.regrasCasa));
  // E56 + tela 06 dos mockups: cada regra da Convivência tem o seu toggle (o estado mora em regrasCasa.ligados).
  // CAMPOS-2: os 5 grupos opcionais do anúncio, cada um atrás do seu toggle (E56).
  const [detalhes, setDetalhes] = useState<DetalhesForm>(formDeDetalhes(property.detalhesAnuncio));
  // TIPO-CHACARA-B: os campos do tipo (o ponto exato não volta ao navegador; vale o "já marcado").
  const chacaraGravada = normalizarChacara((property.detalhesAnuncio as { chacara?: unknown } | null | undefined)?.chacara);
  const [chacara, setChacara] = useState<ValorChacara>({ acesso: chacaraGravada?.acesso, internet: chacaraGravada?.internet });
  // Medidor dos opcionais: desligado = não se aplica (fora da conta).
  const completudeOpcionais = completudeBlocos([...estadosConvivencia(regrasCasa), ...estadosDetalhes(detalhes)]);
  const [childrenAllowed, setChildrenAllowed] = useState(property.childrenAllowed ?? true);
  // 61-B: indefinido = banco sem a 0225 (o bloco some e nada é gravado).
  const [chegada, setChegada] = useState<ChegadaEPedidoForm>(formDeChegada(property.chegadaEPedido));
  const [bedrooms, setBedrooms] = useState(String(property.bedrooms || ""));
  const [bathrooms, setBathrooms] = useState(String(property.bathrooms || ""));
  const [areaM2, setAreaM2] = useState(String(property.areaM2 || ""));
  const [maxGuests, setMaxGuests] = useState(String(property.maxGuests || ""));
  const [monthlyPrice, setMonthlyPrice] = useState(String(property.monthlyPrice || ""));
  const [condoFee, setCondoFee] = useState(String(property.condoFee || ""));
  // Negociação (prompt 27, item 5): o anúncio publicado abre ESTE editor, que não tinha o bloco do passo 4.
  const [negociacao, setNegociacao] = useState<Negociacao>(property.negociacao ?? NEGOCIACAO_PADRAO);
  const [limites, setLimites] = useState<LimitesPrivados>({ valorMinimo: null, limpezasMax: null });
  useEffect(() => {
    if (demo) return;
    let vivo = true;
    carregarLimitesNegociacao(property.id)
      .then((l) => vivo && setLimites(l))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [demo, property.id]);
  const [enderecoExato, setEnderecoExato] = useState(enderecoExatoInicial);
  // 65-B: a seção Vídeo (arquivo enviado OU link do YouTube/Vimeo; o arquivo vence).
  const [videoArquivo, setVideoArquivo] = useState(property.videoArquivo ?? "");
  const [videoUrl, setVideoUrl] = useState(property.videoUrl ?? "");

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Prontidão ao vivo (fonte única: lib/anuncio/prontidao). Base = fatos do
  // banco; por cima, o que a pessoa está editando agora.
  const comp = useMemo(
    () =>
      prontidaoAnuncio({
        enderecoOk: fatos?.enderecoOk ?? !!(property.neighborhood && property.city),
        detalhesOk: (Number(bathrooms) || 0) >= 1 && (Number(areaM2) || 0) > 0,
        periodoOk: (Number(minPeriod) || 0) > 0,
        fotos: photos.length,
        titulo: title.trim() || property.title,
        preco: Number(monthlyPrice) || 0,
        garantiaOk: fatos?.garantiaOk ?? (property.garantiasAceitas ?? []).length > 0,
        sublocacaoOk: fatos?.sublocacaoOk ?? true,
        // Sem a coluna (property.privacidade indefinida) a declaração não barra.
        privacidadeOk: property.privacidade === undefined ? true : privacidade.semCamerasInterior,
        documento: fatos?.documento ?? "approved",
        limitePlanoOk: fatos?.limitePlanoOk ?? null,
        limiteAnuncios: fatos?.limiteAnuncios,
        // 64-B: com os publicados, o texto diz quantos pausar (a mesma conta do servidor).
        ativosAnuncios: fatos?.ativosAnuncios,
        descricao: description,
        selo: fatos?.selo ?? !!property.readyToLiveBadge,
        // 65-B: o que está na seção Vídeo agora (arquivo ou link permitido), não o que estava no banco.
        video: videoDoAnuncio({ videoArquivo, videoUrl }).tipo !== null,
        // 61-B: rascunho aberto no editor só publica com o tipo de entrada (a mesma regra do servidor).
        tipoEntradaOk: property.status === "draft" && property.chegadaEPedido ? tipoEntradaValido(chegada.tipoEntrada) : undefined,
        // FILTROS-1 (E39): a mesma regra do servidor (rascunho só publica com a velocidade da internet).
        internetOk: property.status === "draft" ? fatos?.internetOk : undefined,
        // TIPO-CHACARA-B: a mesma regra do servidor (chácara/sítio fora do ar só publica com os 3 campos).
        chacaraFaltam:
          ehChacara(property.propertyType) && property.status !== "active"
            ? faltaChacara({ acesso: chacara.acesso, internet: chacara.internet, pontoMarcado: !!chacara.ponto || !!chacaraGravada?.pontoMarcado })
            : undefined,
      }),
    [fatos, property, privacidade, bathrooms, areaM2, minPeriod, photos, title, monthlyPrice, description, videoArquivo, videoUrl, chegada.tipoEntrada, chacara, chacaraGravada?.pontoMarcado]
  );
  const [aceitouIa, setAceitouIa] = useState(false);
  const [publicadoAgora, setPublicadoAgora] = useState(false);
  const publicado = publicadoAgora || property.status === "active";

  /** Monta o PropertyInput COMPLETO a partir do estado atual + pass-through. */
  function buildInput(asDraft?: boolean): PropertyInput {
    return {
      title: title.trim() || property.title,
      description,
      propertyType: property.propertyType,
      city: property.city,
      neighborhood: property.neighborhood,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      areaM2: Number(areaM2) || 0,
      minPeriodDays: Number(minPeriod) || 30,
      monthlyPrice: Number(monthlyPrice) || 0,
      readyToLiveScore: property.readyToLiveScore ?? (property.readyToLiveBadge ? 70 : 0),
      tagHomeOffice: property.tagHomeOffice,
      tagWorkLocated: property.tagWorkLocated,
      tagCondoApproved: property.tagCondoApproved,
      ownershipType: property.ownershipType,
      subleaseAuthorized: property.subleaseAuthorized,
      utilitiesMode: property.utilitiesMode,
      utilitiesEstimate: property.utilitiesEstimate,
      issuesInvoice: property.issuesInvoice,
      acceptsInsurance: property.acceptsInsurance,
      faixasAceitas: property.faixasAceitas ?? [],
      garantiasAceitas: property.garantiasAceitas ?? [],
      prepFee: property.prepFee,
      lat: property.lat,
      lng: property.lng,
      photoUrls: photos.map((p) => p.url).filter((u) => u && !u.startsWith("blob:")),
      // 65-B: o estado da seção Vídeo (antes só repetia o valor antigo).
      ...payloadDoVideo({ videoArquivo, videoUrl }),
      asDraft,
      descricaoGeradaPorIa: property.descricaoGeradaPorIa,
      aceiteIa:
        asDraft === false
          ? aceiteDoEditor(aceitouIa, {
              descricaoGeradaPorIa: property.descricaoGeradaPorIa,
              descricao: description,
              descricaoOriginal: property.description ?? "",
            })
          : undefined,
      parkingSpots: property.parkingSpots,
      condoFee: Number(condoFee) || 0,
      availableFrom: availableFrom || undefined,
      availableUntil: availableUntil || undefined,
      maxPeriodDays: Number(maxPeriod) || undefined,
      furnished: property.furnished,
      petsAllowed,
      petsRegras: petsAllowed ? petsRegras : undefined,
      limpezaEstadia: limpeza,
      // Regra desligada = não definida (só as ligadas vão; nada ligado, o servidor grava null).
      regrasCasa: payloadDeRegrasCasa(regrasCasa),
      smokingAllowed: regrasCasa.ligados.fumo && regrasCasa.fumo ? regrasCasa.fumo === "permitido" : smokingAllowed,
      detalhesAnuncio: payloadDeDetalhes(detalhes),
      // TIPO-CHACARA-B: o servidor grava o grupo do tipo (e usa o ponto novo, se marcado, no lugar do endereço).
      chacara: ehChacara(property.propertyType) ? { acesso: chacara.acesso, internet: chacara.internet, ponto: chacara.ponto ?? null } : undefined,
      childrenAllowed,
      ...(property.chegadaEPedido ? payloadDaChegada(chegada) : {}),
      // Só manda quando a coluna existe (property.privacidade definida): senão não grava nada.
      ...(property.privacidade
        ? {
            semCamerasInterior: privacidade.semCamerasInterior,
            camerasExternas: privacidade.camerasExternas,
            tipoAcesso: privacidade.tipoAcesso,
            senhaTrocadaEstadia: privacidade.senhaTrocadaEstadia,
          }
        : {}),
      maxGuests: Number(maxGuests) || undefined,
      negociacao,
      enderecoExato,
      amenityKeys: Object.keys(amenityKeys).filter((k) => amenityKeys[k]),
      googlePlaces: property.googlePlaces ?? [],
      // PERTO-B: a lista inteira (origem, "não mostrar", endereço); o servidor recalcula a distância e o tempo.
      proximities: property.proximities ?? [],
    };
  }

  async function saveSection(key: string, asDraft?: boolean): Promise<boolean> {
    setSavingSection(key);
    setErro(null);
    setSavedSection(null);
    if (!periodoDisponivelValido(availableFrom, availableUntil)) {
      setErro(MSG_DISPONIVEL_ATE_ANTES);
      setSavingSection(null);
      return false;
    }
    const res = await updateProperty(property.id, buildInput(asDraft));
    // O limite PRIVADO vai à parte (tabela só do dono), nunca no anúncio.
    if (res.ok && key === "negociacao") {
      const l = await salvarLimitesNegociacao(property.id, negociacao.aceita ? limites : { valorMinimo: null, limpezasMax: null });
      if (!l.ok) {
        setSavingSection(null);
        setErro(l.error ?? "Não foi possível salvar o seu limite.");
        return false;
      }
    }
    setSavingSection(null);
    if (res.ok) {
      setSavedSection(key);
      setTimeout(() => setSavedSection((s) => (s === key ? null : s)), 2500);
    } else {
      setErro(res.error ?? "Não foi possível salvar.");
    }
    return res.ok;
  }

  // 65-B: enviar, trocar ou remover o arquivo grava NA HORA (o enviador já apagou o anterior do bucket).
  async function mudarVideoArquivo(novo: string) {
    setVideoArquivo(novo);
    if (demo) return;
    setSavingSection("video");
    setErro(null);
    const r = await gravarVideoArquivo(property.id, novo);
    setSavingSection(null);
    if (r.ok) {
      setSavedSection("video");
      setTimeout(() => setSavedSection((s) => (s === "video" ? null : s)), 2500);
    } else setErro(r.error ?? "Não foi possível gravar o vídeo.");
  }

  async function publish() {
    if (!comp.podePublicar || !aceitouIa) return;
    setPublishing(true);
    if (await saveSection("publicar", false)) setPublicadoAgora(true);
    setPublishing(false);
  }

  function toggleAmenity(k: string) {
    setAmenityKeys((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function share() {
    const url = `${window.location.origin}/imoveis/${property.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard bloqueado — ignora */
    }
  }

  const publicUrl = `/imoveis/${property.id}`;

  return (
    <div>
      <PageTitle
        title="Editar anúncio"
        subtitle={property.title}
        action={
          <ButtonLink href="/dashboard/imoveis" variant="outline" size="sm">
            Voltar aos imóveis
          </ButtonLink>
        }
      />

      {demo && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" /> Pré-visualização (sem backend): as edições não são
          gravadas neste ambiente.
        </p>
      )}

      {/* ── Barra de completude + publicar/compartilhar ─────────────────────── */}
      <div className="mb-6 rounded-xl border border-sage-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-title text-lg font-semibold text-ink" data-testid="prontidao">
              {publicado ? "Anúncio publicado" : comp.podePublicar ? "100% · Pronto para publicar" : `Anúncio ${comp.pct}% completo`}
            </p>
            {/* L2-A item 9 (D-V5): só o rascunho tem "Falta para publicar". Publicado, o que estiver em aberto é melhoria. */}
            {!comp.podePublicar && !publicado && (
              <p className="mt-1 text-sm text-muted">Falta para publicar: {comp.faltam.join(" · ")}</p>
            )}
            {publicado && comp.faltam.length > 0 && (
              <p className="mt-1 text-sm text-muted" data-testid="para-melhorar-publicado">
                Para melhorar o anúncio: {comp.faltam.join(" · ")}
              </p>
            )}
            {/* E56: medidor dos detalhes opcionais — bloco desligado entra como "não se aplica". */}
            <p className="mt-1 text-xs text-muted" data-testid="completude-opcionais">
              Detalhes opcionais: {textoCompletude(completudeOpcionais)}
            </p>
            {comp.melhorar.length > 0 && (
              <p className="mt-1 text-xs text-muted" data-testid="para-melhorar">
                {publicado ? "Para melhorar o anúncio (opcional): " : "Para melhorar (opcional): "}
                {comp.opcionais
                  .filter((o) => !o.ok)
                  .map((o, i) => {
                    const href = hrefParaMelhorar(o.key, property.id, false);
                    return (
                      <span key={o.key}>
                        {i > 0 && " · "}
                        {href ? (
                          <a href={`#${ANCORA_VIDEO_EDITOR}`} className="font-medium text-forest underline" data-testid={`melhorar-${o.key}`}>
                            {o.label}
                          </a>
                        ) : (
                          o.label
                        )}
                      </span>
                    );
                  })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {publicado && (
              <Button variant="outline" size="sm" onClick={share}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Link copiado
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" /> Compartilhar
                  </>
                )}
              </Button>
            )}
            {!publicado && (
              <Button variant="gold" size="sm" onClick={publish} disabled={!comp.podePublicar || !aceitouIa || publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Publicar
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${comp.pct}%` }}
          />
        </div>
        {!publicado && (
          <label className="mt-3 flex items-start gap-3 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-ink" data-testid="aceite-ia">
            <input
              type="checkbox"
              checked={aceitouIa}
              onChange={(e) => setAceitouIa(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-forest"
            />
            <span>{TERMO_IA_TEXTO}</span>
          </label>
        )}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>

      {/* ── Seções editáveis ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Fotos */}
        <Section
          icon={Camera}
          title="Fotos"
          summary={`${photos.length} foto(s) · capa: ${photos[0]?.name || "1ª foto"}`}
          saving={savingSection === "fotos"}
          saved={savedSection === "fotos"}
          onSave={() => saveSection("fotos")}
        >
          <p className="mb-3 text-sm text-muted">
            A <strong>primeira foto é a capa</strong>. Arraste para reordenar ou use a estrela para
            definir a capa. Mínimo de {MIN_FOTOS} para publicar.
          </p>
          <PhotoUploader photos={photos} onChange={setPhotos} max={20} />
        </Section>

        {/* 65-B: Vídeo, logo depois das Fotos. O arquivo grava na hora; o link grava no "Salvar seção". */}
        <Section
          icon={Video}
          title="Vídeo"
          ancora={ANCORA_VIDEO_EDITOR}
          testid="secao-video"
          summary={resumoDoVideo({ videoArquivo, videoUrl })}
          saving={savingSection === "video"}
          saved={savedSection === "video"}
          onSave={() => saveSection("video")}
        >
          <VideoUploader path={videoArquivo} onChange={(p) => void mudarVideoArquivo(p)} videoUrl={videoUrl} onVideoUrlChange={setVideoUrl} />
        </Section>

        {/* Endereço exato (complemento do prompt 23): sem ele, a visita presencial confirmada não mostra rua e número. */}
        <Section
          icon={MapPin}
          title="Endereço exato"
          summary={enderecoExato.trim() ? "Preenchido · só aparece para visita confirmada e inquilino aceito" : "Falta a rua e o número"}
          saving={savingSection === "endereco"}
          saved={savedSection === "endereco"}
          onSave={() => saveSection("endereco")}
        >
          <label className="block text-sm font-medium text-ink">
            Rua, número e complemento
            <input
              value={enderecoExato}
              onChange={(e) => setEnderecoExato(e.target.value)}
              maxLength={300}
              placeholder="Ex.: Rua Modesta Maria, 120, apto 302"
              className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
              data-testid="editar-endereco-exato"
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Não aparece no anúncio. Só quem tem a visita presencial confirmada (até o horário da visita) ou a candidatura aceita vê.
          </p>
        </Section>

        {/* Disponibilidade — 2 inputs claros */}
        <Section
          icon={CalendarRange}
          title="Disponibilidade"
          ancora="calendario"
          summary={
            availableFrom
              ? `A partir de ${br(availableFrom)}${availableUntil ? ` até ${br(availableUntil)}` : ""}`
              : "Sem data definida"
          }
          saving={savingSection === "disp"}
          saved={savedSection === "disp"}
          onSave={() => saveSection("disp")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Disponível a partir de</span>
              <DateFieldBR value={availableFrom} onChange={setAvailableFrom} ariaLabel="Disponível a partir de" className="h-11 min-w-0 w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Disponível até (opcional)</span>
              <DateFieldBR value={availableUntil} onChange={setAvailableUntil} ariaLabel="Disponível até (opcional)" className="h-11 min-w-0 w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage" />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Estadia mínima (dias)</span>
              <input
                type="number"
                min={1}
                value={minPeriod}
                onChange={(e) => setMinPeriod(e.target.value)}
                className="w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Estadia máxima (dias)</span>
              <input
                type="number"
                min={Number(minPeriod) || 1}
                value={maxPeriod}
                onChange={(e) => setMaxPeriod(e.target.value)}
                className="w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage"
              />
            </label>
          </div>

          {/* Datas bloqueadas (o dono fecha períodos) — salva sozinho. */}
          <div className="mt-6 border-t border-sage-200 pt-4">
            <p className="mb-1 font-medium text-ink">Fechar datas</p>
            <BlockCalendar propertyId={property.id} />
          </div>
        </Section>

        {/* Título & descrição — guiada */}
        <Section
          icon={FileText}
          title="Título & descrição"
          summary={`${description.trim().length} caractere(s)`}
          saving={savingSection === "desc"}
          saved={savedSection === "desc"}
          onSave={() => saveSection("desc")}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Título do anúncio</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Studio mobiliado com home office no Centro"
              className="w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage"
            />
            {avisoTituloBairro(title, property.neighborhood ?? "") && (
              <span role="status" className="mt-1 block text-xs text-amber-700" data-testid="aviso-titulo-bairro">
                {avisoTituloBairro(title, property.neighborhood ?? "")}
              </span>
            )}
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-ink">Descrição</span>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o imóvel para quem vai morar aqui…"
              className={cn(
                "w-full rounded-xl border px-3 py-3 outline-none focus:border-sage",
                description.trim().length > 0 && description.trim().length < MIN_DESC
                  ? "border-amber-300"
                  : "border-sage-200"
              )}
            />
          </label>
          <p className="mt-1 text-xs text-muted">
            {description.trim().length}/{MIN_DESC}+ caracteres
            {description.trim().length < MIN_DESC && " — capriche para converter mais."}
          </p>
          <div className="mt-3 rounded-xl bg-surface-2 p-3">
            <p className="text-xs font-medium text-ink">O que incluir:</p>
            <ul className="mt-2 grid gap-1">
              {DESC_PROMPTS.map((p) => (
                <li key={p} className="flex items-start gap-2 text-xs text-muted">
                  <span className="text-sage">•</span> {p}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Comodidades — micro-texto por grupo */}
        <Section
          icon={Briefcase}
          title="Comodidades"
          summary={`${Object.values(amenityKeys).filter(Boolean).length} selecionada(s)`}
          saving={savingSection === "amen"}
          saved={savedSection === "amen"}
          onSave={() => saveSection("amen")}
        >
          <div className="space-y-4">
            {AMENITY_GROUPS.map((g) => (
              <div key={g.category}>
                <p className="font-medium text-ink">{g.label}</p>
                <p className="mb-2 text-xs text-muted">{AMENITY_HINT[g.category] ?? ""}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => {
                    const on = !!amenityKeys[it.key];
                    return (
                      <button
                        key={it.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleAmenity(it.key)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                          on
                            ? "border-forest bg-sage-100 text-forest"
                            : "border-sage-200 text-muted hover:border-sage"
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* DETECTA-B: o que as fotos da galeria mostram, como sugestão (marca aqui; grava no salvar da seção). */}
            {!demo && (
              <SugestoesDasFotos
                propertyId={property.id}
                comodidadesMarcadas={Object.keys(amenityKeys).filter((k) => amenityKeys[k])}
                onComodidade={(k) => setAmenityKeys((a) => ({ ...a, [k]: true }))}
              />
            )}
            {/* Prompt 57: a velocidade medida no imóvel (o informado continua no cadastro). */}
            {!demo && <MedirInternet imovelId={property.id} origem="edicao" />}
          </div>
        </Section>

        {/* Regras da casa */}
        <Section
          icon={ScrollText}
          title="Regras da casa"
          testid="secao-regras"
          summary={[
            petsAllowed ? "aceita pets" : "sem pets",
            regrasCasa.ligados.fumo && regrasCasa.fumo
              ? `fumar: ${OPCOES_FUMO.find((o) => o.valor === regrasCasa.fumo)?.rotulo.toLowerCase()}`
              : smokingAllowed
                ? "fumar ok"
                : "não fumantes",
            childrenAllowed ? "aceita crianças" : "sem crianças",
          ].join(" · ")}
          saving={savingSection === "regras"}
          saved={savedSection === "regras"}
          onSave={() => saveSection("regras")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <RuleCard
              icon={Dog}
              label="Aceita animais de estimação?"
              value={petsAllowed}
              onChange={setPetsAllowed}
            />
            <RuleCard
              icon={Baby}
              label="Adequado para crianças?"
              value={childrenAllowed}
              onChange={setChildrenAllowed}
            />
          </div>
          {petsAllowed && <PetsRegrasCampos value={petsRegras} onChange={setPetsRegras} />}
          {property.chegadaEPedido && (
            <ChegadaEPedidoCampos
              value={chegada}
              onChange={setChegada}
              erroTipoEntrada={avisoTipoEntradaNoPainel({ tipoEntrada: chegada.tipoEntrada, status: property.status }) ?? undefined}
            />
          )}
          <div className="mt-4">
            <RegrasCasaCampos value={regrasCasa} onChange={setRegrasCasa} />
          </div>
          <div className="mt-4">
            <LimpezaEstadiaCampos value={limpeza} onChange={setLimpeza} />
          </div>
          {property.privacidade && (
            <div className="mt-4">
              <PrivacidadeCampos valor={privacidade} onChange={setPrivacidade} />
            </div>
          )}
        </Section>

        {/* CAMPOS-2: detalhes opcionais do anúncio — cada grupo atrás do seu toggle (padrão E56). */}
        <Section
          icon={ListChecks}
          title="Detalhes do imóvel"
          testid="secao-detalhes-anuncio"
          summary={textoCompletude(completudeOpcionais)}
          saving={savingSection === "detalhes-anuncio"}
          saved={savedSection === "detalhes-anuncio"}
          onSave={() => saveSection("detalhes-anuncio")}
        >
          <p className="text-sm text-muted">Ligue só o que se aplica ao seu imóvel. O que ficar desligado não aparece no anúncio e não conta como pendência.</p>
          {ehChacara(property.propertyType) && (
            <CamposChacara
              valor={chacara}
              onChange={setChacara}
              centro={property.lat && property.lng ? { lat: property.lat, lng: property.lng } : UBERLANDIA_CENTER}
              pontoGravado={!!chacaraGravada?.pontoMarcado}
            />
          )}
          <DetalhesAnuncioCampos value={detalhes} onChange={setDetalhes} tipo={property.propertyType} />
        </Section>

        {/* Detalhes & preço */}
        <Section
          icon={Ruler}
          title="Detalhes & preço"
          summary={`${bedrooms || 0}q · ${areaM2 || 0}m² · ${formatBRL(Number(monthlyPrice) || 0)}/mês`}
          saving={savingSection === "detalhes"}
          saved={savedSection === "detalhes"}
          onSave={() => saveSection("detalhes")}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumField label="Quartos" value={bedrooms} onChange={setBedrooms} />
            <NumField label="Banheiros" value={bathrooms} onChange={setBathrooms} />
            <NumField label="Área (m²)" value={areaM2} onChange={setAreaM2} />
            <NumField label="Capacidade (pessoas)" value={maxGuests} onChange={setMaxGuests} />
            {/* L2-A item 24: o campo é só o valor mensal (sem condomínio e contas); o anúncio mostra o total do mês. */}
            <ReaisField label="Valor mensal (sem condomínio e contas)" value={monthlyPrice} onChange={setMonthlyPrice} testid="editar-preco" />
            <ReaisField label="Condomínio (R$/mês)" value={condoFee} onChange={setCondoFee} centavos />
          </div>
          {Number(monthlyPrice) > 0 && (
            <p className="mt-3 text-sm text-ink" data-testid="editar-tudo-incluido">
              No anúncio:{" "}
              <strong className="font-semibold">
                {formatBRL(
                  calcularTudoIncluido({
                    monthlyPrice: Number(monthlyPrice) || 0,
                    condoFee: Number(condoFee) || 0,
                    utilitiesMode: property.utilitiesMode,
                    utilitiesEstimate: property.utilitiesEstimate,
                    limpezaEstadia: normalizarLimpezaEstadia(limpeza) ?? undefined,
                  }).total
                )}
                /mês tudo incluído
              </strong>
            </p>
          )}
        </Section>

        {/* Negociação: o mesmo bloco do passo 4 do cadastro (Preço e disponibilidade). */}
        <Section
          icon={Handshake}
          title="Negociação"
          testid="editar-negociacao"
          summary={
            negociacao.aceita
              ? `Aceito negociar: Sim · ${negociacao.itens.length ? negociacao.itens.map((i) => ITENS_NEGOCIAVEIS.find((x) => x.chave === i)?.rotulo).join(", ") : "nenhum item marcado"}`
              : "Aceito negociar: Não (valor fixo)"
          }
          saving={savingSection === "negociacao"}
          saved={savedSection === "negociacao"}
          onSave={() => saveSection("negociacao")}
        >
          <BlocoNegociacao valor={negociacao} onValor={setNegociacao} limites={limites} onLimites={setLimites} valorMensal={Number(monthlyPrice) || 0} />
        </Section>
      </div>

      {/* Ver anúncio público */}
      <div className="mt-6">
        <Link
          href={publicUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-forest hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> Ver como aparece na busca
        </Link>
      </div>
    </div>
  );
}

/** Bloco colapsável de seção com resumo + salvar. */
function Section({
  icon: Icon,
  title,
  summary,
  children,
  saving,
  saved,
  onSave,
  testid,
  ancora,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  testid?: string;
  /** Id da seção: abre sozinha quando o endereço chega com #ancora (ex.: "Para melhorar: Vídeo do imóvel"). */
  ancora?: string;
  summary: string;
  children: React.ReactNode;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const [aberta, setAberta] = useState<boolean | null>(null);
  const hash = useSyncExternalStore(assinarHash, () => window.location.hash, () => "");
  const open = aberta ?? (!!ancora && hash === `#${ancora}`);
  return (
    <section id={ancora} className="scroll-mt-24 overflow-hidden rounded-xl border border-sage-200 bg-white" data-testid={testid} data-aberta={open}>
      <button
        type="button"
        onClick={() => setAberta(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-surface-2"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-title font-semibold text-ink">{title}</span>
          <span className="block truncate text-sm text-muted">{summary}</span>
        </span>
        {saved && <span className="text-sm font-medium text-forest">Salvo</span>}
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-sage-200 px-4 py-4">
          {children}
          <div className="mt-4 flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-forest">Alterações salvas.</span>}
            <Button variant="gold" size="sm" onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar seção"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function assinarHash(avisar: () => void) {
  window.addEventListener("hashchange", avisar);
  return () => window.removeEventListener("hashchange", avisar);
}

function RuleCard({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-sage-200 p-4">
      <div className="flex items-center gap-2 text-ink">
        <Icon className="h-4 w-4 text-sage" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-3 flex rounded-full bg-surface-2 p-1 text-sm">
        {[
          { v: true, l: "Sim" },
          { v: false, l: "Não" },
        ].map((o) => (
          <button
            key={o.l}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 font-medium transition-colors",
              value === o.v ? "bg-forest text-white" : "text-muted"
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage"
      />
    </label>
  );
}

/** Dinheiro no formato brasileiro ("3.300"), pela fonte única lerReais (complemento do prompt 27, parte B). */
function ReaisField({ label, value, onChange, centavos, testid }: { label: string; value: string; onChange: (v: string) => void; centavos?: boolean; testid?: string }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <CampoReais
        semPrefixo
        centavos={centavos}
        value={value === "" ? null : Number(value)}
        onChange={(v) => onChange(v == null ? "" : String(v))}
        className="w-full rounded-xl border border-sage-200 px-3 py-3 outline-none focus:border-sage"
        testid={testid}
      />
    </label>
  );
}

/** Data ISO → dd/mm/aa. */
function br(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}
