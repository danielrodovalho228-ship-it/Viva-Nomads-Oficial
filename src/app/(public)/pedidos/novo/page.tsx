"use client";

import { Suspense, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, ShieldCheck, Info, Loader2, Minus, Plus, Check, PawPrint, Baby, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvisoAntigolpe } from "@/components/seguranca/aviso-antigolpe";
import { CampoData } from "@/components/ui/campo-data";
import { MOTIVOS, isMotivo, contemContato, CONTATO_AVISO, PRAZO_MAX_MESES } from "@/lib/pedidos/pedidos";
import { BAIRROS_MAX, NECESSIDADES, PORTES_PET_PEDIDO, QUALQUER_BAIRRO, QUARTOS_OPCOES, dataPedidoBR, expiraEmPedido, limparBairro } from "@/lib/pedidos/campos";
import { CHAVE_ULTIMA_BUSCA, CHAVE_ULTIMO_MOTIVO, ultimaBuscaParaPedido, ultimoMotivoParaPedido } from "@/lib/marcas/regra";
import { MUNICIPIOS } from "@/lib/municipios";
import { ConviteCidade } from "@/components/cidades/convite-cidade";
import {
  APRESENTACAO_MAX,
  buscarCidades,
  fraseContador,
  lerCidadeUf,
  mascararMilhar,
  rotuloCidade,
  soDigitos,
} from "@/lib/pedidos/formulario";
import { chaveSmsLigada, criarPedido, editarPedido, getMeuPedido } from "@/lib/data/pedidos-actions";
import { contarImoveisQueCombinam } from "@/lib/data/pedido-contador-actions";
import { avisoConfirmacao, ROTA_CONFIRMAR_CONTATO, tituloFaltaConfirmar } from "@/lib/pedidos/confirmacao";
import type { ResultadoContador } from "@/lib/pedidos/contador";
import type { ImovelCompativel } from "@/lib/pedidos/compatibilidade";
import { getMeusDados } from "@/lib/data/perfil-actions";
import { registrarEvento } from "@/lib/eventos/registrar";
import { useAuthStore } from "@/lib/store";
import { cn, formatBRL, hojeBR } from "@/lib/utils";
import { CampoDestino, type DestinoChip } from "@/components/busca/campo-destino";
import type { EstadoDestino } from "@/lib/busca/destino-busca";
import type { ModoRota } from "@/lib/rotas/tempo";

/** Um só estilo para todos os campos do formulário: 48 px de altura (prompt 12). */
const CAMPO =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15";

const PASSOS = [
  "Publique o que precisa",
  "Receba respostas com imóveis reais",
  "Converse e feche pela plataforma",
];

/**
 * /pedidos/novo — o inquilino publica o que precisa (housing request reverso).
 * Prompt 12: imagem fixa à esquerda (45%) com título, texto e os 3 passos; formulário à direita (55%), em fundo
 * branco, alinhado ao topo, sem cartão flutuante. No celular, uma faixa de 200 px com o título e o formulário logo
 * abaixo.
 */
export default function NovoPedidoPage() {
  return (
    <div className="bg-white lg:grid lg:grid-cols-[45%_55%]">
      <aside
        className="relative flex h-[200px] items-end overflow-hidden bg-forest text-white lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-4.5rem)] lg:items-center"
        data-testid="pedido-lateral"
      >
        <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/media/pedido-lateral.webp)" }} />
        <div
          aria-hidden
          className="absolute inset-0 bg-forest/80"
        />
        <div className="relative z-10 p-5 sm:p-8 lg:max-w-md lg:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
            <Megaphone className="h-3.5 w-3.5" aria-hidden /> Pedido de moradia
          </span>
          <h1 className="mt-3 font-title text-2xl font-semibold leading-tight lg:mt-4 lg:text-[28px]">Deixe os imóveis virem até você</h1>
          <div className="hidden lg:block">
            <p className="mt-3 text-lg text-white/85">
              Em vez de procurar um a um, diga o que você precisa. Os proprietários da cidade veem seu pedido e respondem
              com os imóveis que combinam — de graça, pela plataforma.
            </p>
            <ol className="mt-8 space-y-3 border-t border-white/15 pt-6" data-testid="pedido-passos">
              {PASSOS.map((p, i) => (
                <li key={p} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-champagne text-xs font-semibold text-night">
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      <div className="min-w-0 px-4 pb-10 pt-6 sm:px-8 lg:pb-16 lg:pl-16 lg:pr-10 lg:pt-10">
        <div className="w-full max-w-[600px]">
          <Suspense fallback={<div className="min-h-[40rem]" aria-busy="true" />}>
            <PedidoForm />
          </Suspense>

          <footer className="mt-10 border-t border-line pt-5 text-xs text-muted" data-testid="pedido-rodape-legal">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sage" aria-hidden />
              <span>
                Toda a conversa acontece pela plataforma — é o que fica registrado. A Viva Nomads conecta e documenta; não
                é locadora, fiadora nem intermediária de pagamento.{" "}
                <Link href="/como-funciona" className="font-medium text-forest underline underline-offset-2">
                  Como a Viva funciona
                </Link>
              </span>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

/** Título pequeno de cada grupo do formulário (ONDE E QUANDO, QUEM VAI MORAR, O IMÓVEL, VALOR E MOTIVO). */

/** Pedido salvo guarda o id do destino; os chips usam o slug. */
function slugDoDestinoEstado(slugOuId: string, destinos: { id: string; slug: string }[]): string {
  return slugOuId.startsWith("id:") ? (destinos.find((d) => d.id === slugOuId.slice(3))?.slug ?? slugOuId) : slugOuId;
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-3 text-xs font-semibold text-muted">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Rotulo({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink">
      {children}
    </label>
  );
}

/** Rótulo inicial do campo de cidade a partir da URL (?cidade=…&uf=…). */
function textoInicialCidade(cidade: string, uf: string): string {
  if (!cidade) return "";
  const r = lerCidadeUf(MUNICIPIOS, uf ? `${cidade} – ${uf}` : cidade);
  return r ? rotuloCidade(r.cidade, r.uf) : cidade;
}

function PedidoForm() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // Pré-preenche com os parâmetros vindos da busca (Fase 4 — zero resultado →
  // pedido de moradia). URL como fonte da verdade; sem effect (evita re-render).
  const sp = useSearchParams();
  const inicioQ = sp.get("inicio") ?? "";
  const mesesQ = Number(sp.get("meses"));
  const ocupQ = Number(sp.get("adultos") || 0) + Number(sp.get("criancas") || 0);
  const orcQ = sp.get("orcamento") ?? "";

  // Cidade: um campo só, com sugestões de todo o Brasil; escolher grava cidade + UF.
  const [textoCidade, setTextoCidade] = useState(() =>
    textoInicialCidade(sp.get("cidade") ?? "", (sp.get("uf") ?? "").toUpperCase().slice(0, 2)),
  );
  const [cidadeUf, setCidadeUf] = useState(() => lerCidadeUf(MUNICIPIOS, textoCidade));
  const cidade = cidadeUf?.cidade ?? "";
  const uf = cidadeUf?.uf ?? "";
  const [dataInicio, setDataInicio] = useState(/^\d{4}-\d{2}-\d{2}$/.test(inicioQ) ? inicioQ : "");
  const [prazoMeses, setPrazoMeses] = useState(mesesQ >= 1 && mesesQ <= PRAZO_MAX_MESES ? mesesQ : PRAZO_MAX_MESES);
  const [orcamento, setOrcamento] = useState(/^\d+$/.test(orcQ) ? soDigitos(orcQ) : "");
  const [ocupantes, setOcupantes] = useState(ocupQ >= 1 ? ocupQ : 1);
  const [motivo, setMotivo] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [pets, setPets] = useState(false);
  const [criancas, setCriancas] = useState(Number(sp.get("criancas") || 0) > 0);
  // Prompt 37: onde vai trabalhar ou estudar (padrão: ?destino= da busca, senão o local de trabalho salvo na conta).
  const destinoQ = sp.get("destino");
  const [destinoEstado, setDestinoEstado] = useState<EstadoDestino>({
    destino: destinoQ && /^[a-z0-9-]{2,60}$/.test(destinoQ) ? { slug: destinoQ } : null,
    modo: "carro",
    ate: 0,
  });
  const [destinosChips, setDestinosChips] = useState<(DestinoChip & { id: string })[]>([]);
  const [modosRota, setModosRota] = useState<ModoRota[]>(["carro", "a_pe", "bicicleta"]);
  // Prompt 30: bairros (até 3; nenhum = qualquer bairro), quartos mínimos, faixa de valor, necessidades e porte do pet.
  const [bairros, setBairros] = useState<string[]>([]);
  const [textoBairro, setTextoBairro] = useState("");
  const [quartosMin, setQuartosMin] = useState<number | null>(null);
  const [orcamentoMin, setOrcamentoMin] = useState("");
  const [necessidades, setNecessidades] = useState<string[]>([]);
  const [portePet, setPortePet] = useState<string>("");
  // Editar (Prompt 30, item 4): /pedidos/novo?editar=<id> carrega o pedido e salva com editarPedido.
  const editarId = sp.get("editar");
  const [carregando, setCarregando] = useState(Boolean(editarId));
  // Os textos acompanham a chave SMS_ATIVO (desligada: nunca pedimos o telefone para os donos verem).
  const [smsLigado, setSmsLigado] = useState(false);
  // Depois de publicar: quantos imóveis combinam AGORA (regra do banco).
  const [resultado, setResultado] = useState<{
    compativeis: number;
    sugestao: string | null;
    imoveis: ImovelCompativel[];
    chegaAosDonos: boolean;
    falta: ("e-mail" | "telefone")[];
  } | null>(null);
  // Contador ao vivo (ordem 8dca1437): a resposta guarda a chave dos campos que a geraram,
  // então só vale enquanto os campos não mudam (sem precisar zerar estado dentro do effect).
  const [contagem, setContagem] = useState<{ chave: string; r: ResultadoContador } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Pré-preenchimento (ordem 8302024d): o que a última busca e o último pedido deixaram no aparelho.
  // Só entra no que a pessoa ainda não preencheu e que a URL não trouxe; tudo segue editável.
  useEffect(() => {
    try {
      const b = ultimaBuscaParaPedido(window.localStorage.getItem(CHAVE_ULTIMA_BUSCA), hojeBR());
      /* eslint-disable react-hooks/set-state-in-effect -- lê o localStorage só no navegador (SSR não tem) */
      if (b.pessoas && !ocupQ) setOcupantes(b.pessoas);
      const m = ultimoMotivoParaPedido(window.localStorage.getItem(CHAVE_ULTIMO_MOTIVO), isMotivo);
      if (m) setMotivo((atual) => atual || m);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* localStorage bloqueado: segue sem pré-preencher */
    }
  }, [ocupQ]);

  useEffect(() => {
    let vivo = true;
    chaveSmsLigada()
      .then((l) => {
        if (vivo) setSmsLigado(l);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!editarId) return;
    let vivo = true;
    getMeuPedido(editarId)
      .then((p) => {
        if (!vivo) return;
        setCarregando(false);
        if (!p) {
          setErro("Este pedido não pode mais ser editado.");
          return;
        }
        const c = String(p.cidade ?? "");
        const u = String(p.uf ?? "");
        setTextoCidade(rotuloCidade(c, u));
        setCidadeUf(c && u ? { cidade: c, uf: u } : null);
        setDataInicio(String(p.data_inicio ?? ""));
        setPrazoMeses(Number(p.prazo_meses) || 1);
        setOrcamento(soDigitos(String(Math.round(Number(p.orcamento_mensal) || 0))));
        setOrcamentoMin(p.orcamento_min == null ? "" : soDigitos(String(Math.round(Number(p.orcamento_min)))));
        setOcupantes(Number(p.qtd_ocupantes) || 1);
        setMotivo(String(p.motivo ?? ""));
        setApresentacao(String(p.apresentacao ?? ""));
        setPets(p.pets === true);
        setCriancas(p.criancas === true);
        setPortePet(String(p.porte_pet ?? ""));
        setBairros(((p.bairros as string[] | null) ?? []).slice(0, BAIRROS_MAX));
        setQuartosMin(p.quartos_min == null ? null : Number(p.quartos_min));
        setNecessidades((p.necessidades as string[] | null) ?? []);
        const d = p.destino as { destino_id?: string; rotulo: string; lat: number; lng: number; modo_preferido?: ModoRota; ate?: number } | null;
        if (d) setDestinoEstado({ destino: d.destino_id ? { slug: `id:${d.destino_id}` } : { lat: d.lat, lng: d.lng, rot: d.rotulo }, modo: d.modo_preferido ?? "carro", ate: d.ate ?? 0 });
      })
      .catch(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [editarId]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/destinos")
      .then((r) => r.json())
      .then((j: { destinos?: (DestinoChip & { id: string })[]; modos?: ModoRota[] }) => {
        if (!vivo) return;
        setDestinosChips(j.destinos ?? []);
        if (j.modos?.length) setModosRota(j.modos);
      })
      .catch(() => undefined);
    if (!editarId && !destinoQ)
      fetch("/api/conta/local-trabalho")
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((j: { estado?: EstadoDestino | null } | null) => {
          if (vivo && j?.estado?.destino) setDestinoEstado(j.estado);
        })
        .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [editarId, destinoQ]);

  function adicionarBairro() {
    const b = limparBairro(textoBairro);
    if (!b) return;
    setBairros((atual) => (atual.length >= BAIRROS_MAX || atual.some((x) => x.toLowerCase() === b.toLowerCase()) ? atual : [...atual, b]));
    setTextoBairro("");
  }

  // Motivo salvo no perfil (Conta): entra só se nada preencheu o campo (URL, último pedido ou escolha da pessoa).
  const logado = Boolean(user);
  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    getMeusDados()
      .then((d) => {
        if (vivo && d && isMotivo(d.motivoEstadia)) setMotivo((atual) => atual || d.motivoEstadia);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [logado]);

  const orcamentoNum = Number(orcamento) || 0;
  const chaveContagem = [cidade, uf, dataInicio, prazoMeses, orcamentoNum, ocupantes, pets, criancas].join("|");
  const contagemPronta = Boolean(cidade && uf && dataInicio && orcamentoNum > 0);
  useEffect(() => {
    if (!contagemPronta) return;
    let vivo = true;
    const t = setTimeout(() => {
      contarImoveisQueCombinam({
        cidade,
        uf,
        dataInicio,
        prazoMeses,
        orcamentoMensal: orcamentoNum,
        qtdOcupantes: ocupantes,
        pets,
        criancas,
      })
        .then((r) => {
          if (vivo && r) setContagem({ chave: chaveContagem, r });
        })
        .catch(() => {});
    }, 600);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [contagemPronta, chaveContagem, cidade, uf, dataInicio, prazoMeses, orcamentoNum, ocupantes, pets, criancas]);
  const contagemAtual = contagem && contagem.chave === chaveContagem ? contagem.r : null;

  // Eco do filtro anti-contato no cliente (o servidor é a fonte da verdade).
  const contatoNoTexto = apresentacao.length > 0 && contemContato(apresentacao);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (contatoNoTexto) {
      setErro(CONTATO_AVISO);
      return;
    }
    if (!cidade || !uf) {
      setErro("Escolha a cidade na lista de sugestões.");
      return;
    }
    // Deslogado: entra com o código por e-mail e volta para cá com o que já preencheu.
    if (!user) {
      const volta = `/pedidos/novo?${new URLSearchParams({
        cidade,
        uf,
        ...(dataInicio ? { inicio: dataInicio } : {}),
        meses: String(prazoMeses),
        ...(orcamento ? { orcamento } : {}),
        adultos: String(ocupantes),
      }).toString()}`;
      router.push(`/auth?codigo=1&redirect=${encodeURIComponent(volta)}`);
      return;
    }
    const dados = {
      cidade,
      uf: uf || undefined,
      dataInicio,
      prazoMeses,
      orcamentoMensal: Number(orcamento) || 0,
      orcamentoMin: Number(orcamentoMin) || null,
      qtdOcupantes: ocupantes,
      motivo,
      apresentacao: apresentacao || undefined,
      pets,
      criancas,
      portePet: pets && portePet ? portePet : null,
      bairros: [...bairros, ...(limparBairro(textoBairro) && bairros.length < BAIRROS_MAX ? [limparBairro(textoBairro)] : [])],
      quartosMin,
      necessidades,
      destino: !destinoEstado.destino
        ? null
        : "slug" in destinoEstado.destino
          ? { destinoSlug: slugDoDestinoEstado(destinoEstado.destino.slug, destinosChips), modo: destinoEstado.modo, ate: destinoEstado.ate || undefined }
          : { lat: destinoEstado.destino.lat, lng: destinoEstado.destino.lng, rotulo: destinoEstado.destino.rot, modo: destinoEstado.modo, ate: destinoEstado.ate || undefined },
    };
    setEnviando(true);
    if (editarId) {
      const r = await editarPedido(editarId, dados);
      setEnviando(false);
      if (r.ok) router.push("/dashboard/pedidos?editado=1");
      else setErro(r.error ?? "Não foi possível salvar o pedido.");
      return;
    }
    const res = await criarPedido(dados);
    setEnviando(false);
    if (res.ok) {
      registrarEvento("publicar_pedido", { cidade });
      try {
        window.localStorage.setItem(CHAVE_ULTIMO_MOTIVO, motivo);
      } catch {
        /* localStorage bloqueado: segue sem guardar */
      }
      setResultado({
        compativeis: res.compativeis ?? 0,
        sugestao: res.sugestao ?? null,
        imoveis: res.imoveis ?? [],
        chegaAosDonos: res.chegaAosDonos ?? false,
        falta: res.falta ?? [],
      });
      if (typeof res.smsLigado === "boolean") setSmsLigado(res.smsLigado);
    } else {
      setErro(res.error ?? "Não foi possível publicar o pedido.");
    }
  }

  if (resultado) {
    const n = resultado.compativeis;
    return (
      <div role="status" aria-live="polite">
        <h2 className="font-title text-2xl font-semibold text-ink">Pedido publicado</h2>
        {!resultado.chegaAosDonos && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="pedido-falta-confirmar">
            <strong>{tituloFaltaConfirmar(resultado.falta.length ? resultado.falta : ["e-mail"])}</strong> {avisoConfirmacao(smsLigado)}{" "}
            <Link href={ROTA_CONFIRMAR_CONTATO} className="font-medium underline">
              Confirmar agora
            </Link>
          </p>
        )}
        {n > 0 ? (
          <p className="mt-3 rounded-xl bg-sage-100 px-4 py-3 text-sm text-forest">
            <strong>
              {n} {n === 1 ? "imóvel compatível" : "imóveis compatíveis"} agora
            </strong>{" "}
            {resultado.chegaAosDonos
              ? `— ${n === 1 ? "o proprietário foi avisado" : "os proprietários foram avisados"}. Quando alguém responder, você recebe um aviso; a conversa é pela plataforma.`
              : `— os proprietários só são avisados depois que você confirmar ${smsLigado ? "e-mail e telefone" : "o seu e-mail"}.`}
          </p>
        ) : (
          <div className="mt-3 space-y-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
              <strong>Nenhum imóvel combina com tudo agora.</strong> Avisaremos você quando surgir um.
            </p>
            {resultado.sugestao && <p>{resultado.sugestao}</p>}
            <p>
              Para ajustar o valor, a data ou o prazo, edite o pedido em{" "}
              <Link href="/dashboard/pedidos" className="font-medium underline">
                Meus pedidos
              </Link>
              .
            </p>
          </div>
        )}
        {resultado.imoveis.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line" data-testid="pedido-compativeis">
            {resultado.imoveis.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/imoveis/${i.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate font-medium text-ink">{i.titulo}</span>
                  <span className="shrink-0 text-muted">{formatBRL(i.total)}/mês</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <Link
            href={`/buscar?${new URLSearchParams({ local: cidade }).toString()}`}
            className="text-sm font-medium text-forest underline"
            data-testid="pedido-ver-mapa"
          >
            Ver {cidade} no mapa
          </Link>
          <Button onClick={() => router.push("/dashboard/pedidos")}>Ver meus pedidos</Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="pedido-formulario">
      <h2 className="font-title text-2xl font-semibold text-ink md:text-[1.75rem]">{editarId ? "Editar seu pedido" : "Publique seu pedido"}</h2>
      <p className="mt-1 text-sm text-muted">
        {editarId ? "As mudanças valem na hora para os proprietários da cidade." : "Os proprietários da cidade veem seu pedido e respondem pela plataforma."}
      </p>
      {carregando && <p className="mt-4 text-sm text-muted" aria-busy="true">Carregando o pedido…</p>}

      <form onSubmit={submit} className="mt-6 space-y-8" noValidate>
        <Grupo titulo="Onde e quando">
          <CampoCidade
            texto={textoCidade}
            onTexto={(t) => {
              setTextoCidade(t);
              setCidadeUf(lerCidadeUf(MUNICIPIOS, t));
            }}
            onEscolher={(c) => {
              setTextoCidade(c.rotulo);
              setCidadeUf({ cidade: c.cidade, uf: c.uf });
            }}
            escolhida={Boolean(cidadeUf)}
          />
          <ConviteCidade texto={textoCidade} />
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div>
              <Rotulo htmlFor="pedido-data">Data de entrada</Rotulo>
              {/* Um seletor só, o calendário nativo, com o conserto do iPhone (Q3/Q8). */}
              <CampoData
                id="pedido-data"
                required
                value={dataInicio}
                min={hojeBR()}
                onChange={(e) => setDataInicio(e.target.value)}
                className={CAMPO}
                data-testid="pedido-data"
              />
            </div>
            <div>
              <Rotulo htmlFor="pedido-prazo">Por quanto tempo</Rotulo>
              <select id="pedido-prazo" value={prazoMeses} onChange={(e) => setPrazoMeses(Number(e.target.value))} className={CAMPO}>
                {Array.from({ length: PRAZO_MAX_MESES }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? "mês" : "meses"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {dataInicio && (
            <p className="text-[13px] text-muted" data-testid="pedido-validade">
              Seu pedido fica no ar até <strong className="text-ink">{dataPedidoBR(expiraEmPedido(dataInicio, new Date().toISOString()))}</strong>{" "}
              (30 dias depois de publicar e nunca antes da data de entrada). Você renova com um clique.
            </p>
          )}
          <div>
            <Rotulo htmlFor="pedido-bairro">Bairros preferidos (até {BAIRROS_MAX})</Rotulo>
            <div className="flex gap-2">
              <input
                id="pedido-bairro"
                value={textoBairro}
                onChange={(e) => setTextoBairro(e.target.value.slice(0, 60))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarBairro();
                  }
                }}
                placeholder={bairros.length >= BAIRROS_MAX ? "Limite de 3 bairros" : "Ex.: Santa Mônica"}
                disabled={bairros.length >= BAIRROS_MAX}
                className={cn(CAMPO, "min-w-0 flex-1")}
                data-testid="pedido-bairro"
              />
              <Button type="button" variant="ghost" className="h-12 shrink-0" onClick={adicionarBairro} disabled={!textoBairro.trim() || bairros.length >= BAIRROS_MAX} data-testid="pedido-bairro-adicionar">
                Adicionar
              </Button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2" data-testid="pedido-bairros">
              {bairros.length === 0 ? (
                <li className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">{QUALQUER_BAIRRO}</li>
              ) : (
                bairros.map((b) => (
                  <li key={b} className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-3 py-1 text-xs font-medium text-forest">
                    {b}
                    <button type="button" aria-label={`Tirar ${b}`} onClick={() => setBairros((a) => a.filter((x) => x !== b))} className="rounded-full p-1 hover:bg-white">
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Grupo>

        <Grupo titulo="Trabalho ou estudo">
          <CampoDestino
            destinos={destinosChips.filter((d) => !cidade || d.cidade.toLowerCase() === cidade.toLowerCase())}
            modos={modosRota}
            valor={{ ...destinoEstado, destino: destinoEstado.destino && "slug" in destinoEstado.destino ? { slug: slugDoDestinoEstado(destinoEstado.destino.slug, destinosChips) } : destinoEstado.destino }}
            onChange={setDestinoEstado}
          />
          <p className="mt-2 text-xs text-muted">Opcional. O proprietário vê só “perto do …” e quantos minutos o imóvel dele fica — nunca o endereço que você digitar.</p>
        </Grupo>

        <Grupo titulo="Quem vai morar">
          <div>
            <Rotulo htmlFor="pedido-pessoas">Pessoas</Rotulo>
            <div className="flex h-12 w-full max-w-[220px] items-stretch overflow-hidden rounded-xl border border-line bg-white" data-testid="pedido-pessoas">
              <button
                type="button"
                onClick={() => setOcupantes((n) => Math.max(1, n - 1))}
                disabled={ocupantes <= 1}
                aria-label="Menos uma pessoa"
                className="grid w-12 shrink-0 place-items-center text-forest transition hover:bg-surface-2 disabled:text-muted disabled:opacity-50"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <input
                id="pedido-pessoas"
                type="number"
                min={1}
                inputMode="numeric"
                value={ocupantes}
                onChange={(e) => setOcupantes(Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))))}
                className="h-12 w-full min-w-0 border-x border-line bg-white text-center text-sm font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Quantas pessoas vão morar"
              />
              <button
                type="button"
                onClick={() => setOcupantes((n) => Math.min(20, n + 1))}
                aria-label="Mais uma pessoa"
                className="grid w-12 shrink-0 place-items-center text-forest transition hover:bg-surface-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          {/* Só imóveis que aceitam entram como compatíveis. */}
          <div className="grid grid-cols-2 gap-3">
            <BotaoMarca ativo={pets} onClick={() => setPets((v) => !v)} icone={PawPrint} testid="pedido-pet">
              Vou com pet
            </BotaoMarca>
            <BotaoMarca ativo={criancas} onClick={() => setCriancas((v) => !v)} icone={Baby} testid="pedido-criancas">
              Vou com crianças
            </BotaoMarca>
          </div>
          {pets && (
            <div>
              <Rotulo htmlFor="pedido-porte-pet">Porte do pet</Rotulo>
              <select id="pedido-porte-pet" value={portePet} onChange={(e) => setPortePet(e.target.value)} className={cn(CAMPO, !portePet && "text-muted")} data-testid="pedido-porte-pet">
                <option value="">Selecione</option>
                {PORTES_PET_PEDIDO.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Grupo>

        <Grupo titulo="O imóvel">
          <div>
            <span className="mb-2 block text-sm font-medium text-ink" id="pedido-quartos-rotulo">Quartos (no mínimo)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby="pedido-quartos-rotulo" data-testid="pedido-quartos">
              {QUARTOS_OPCOES.map((q) => (
                <BotaoMarca key={q.valor} ativo={quartosMin === q.valor} onClick={() => setQuartosMin((a) => (a === q.valor ? null : q.valor))} icone={Plus} testid={`pedido-quartos-${q.valor}`}>
                  {q.rotulo}
                </BotaoMarca>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-ink">Precisa de</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="pedido-necessidades">
              {NECESSIDADES.map((n) => (
                <BotaoMarca
                  key={n.valor}
                  ativo={necessidades.includes(n.valor)}
                  onClick={() => setNecessidades((a) => (a.includes(n.valor) ? a.filter((x) => x !== n.valor) : [...a, n.valor]))}
                  icone={Plus}
                  testid={`pedido-nec-${n.valor}`}
                >
                  {n.rotulo}
                </BotaoMarca>
              ))}
            </div>
          </div>
        </Grupo>

        <Grupo titulo="Valor e motivo">
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div>
              <Rotulo htmlFor="pedido-orcamento-min">Valor mensal mínimo (opcional)</Rotulo>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted" aria-hidden>
                  R$
                </span>
                <input
                  id="pedido-orcamento-min"
                  inputMode="numeric"
                  autoComplete="off"
                  value={mascararMilhar(orcamentoMin)}
                  onChange={(e) => setOrcamentoMin(soDigitos(e.target.value))}
                  placeholder="2.000"
                  className={cn(CAMPO, "pl-10")}
                  data-testid="pedido-orcamento-min"
                />
              </div>
            </div>
            <div>
              <Rotulo htmlFor="pedido-orcamento">Valor mensal máximo</Rotulo>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted" aria-hidden>
                  R$
                </span>
                <input
                  id="pedido-orcamento"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={mascararMilhar(orcamento)}
                  onChange={(e) => setOrcamento(soDigitos(e.target.value))}
                  placeholder="3.500"
                  className={cn(CAMPO, "pl-10")}
                  data-testid="pedido-orcamento"
                />
              </div>
              <span className="mt-1 block text-[13px] text-muted">Valor mensal total que cabe no seu bolso.</span>
            </div>
            <div className="sm:col-span-2">
              <Rotulo htmlFor="pedido-motivo">Motivo da estadia</Rotulo>
              <select
                id="pedido-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={cn(CAMPO, !motivo && "text-muted")}
                data-testid="pedido-motivo"
              >
                <option value="">Selecione</option>
                {MOTIVOS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Rotulo htmlFor="pedido-apresentacao">Apresentação (opcional)</Rotulo>
            <textarea
              id="pedido-apresentacao"
              rows={4}
              maxLength={APRESENTACAO_MAX}
              value={apresentacao}
              onChange={(e) => setApresentacao(e.target.value.slice(0, APRESENTACAO_MAX))}
              placeholder="Conte um pouco do seu perfil e do que procura. Não inclua telefone, e-mail ou apps de mensagem."
              className={cn(
                "w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15",
                contatoNoTexto ? "border-red-300" : "border-line",
              )}
            />
            <div className="mt-1 flex items-start justify-between gap-3 text-[13px]">
              <span className="min-w-0 text-red-600">
                {contatoNoTexto && (
                  <span className="flex items-start gap-2">
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden /> {CONTATO_AVISO}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted" data-testid="pedido-apresentacao-contador">
                {apresentacao.length}/{APRESENTACAO_MAX}
              </span>
            </div>
          </div>
        </Grupo>

        <div className="space-y-3">
          <p
            role="status"
            aria-live="polite"
            data-testid="pedido-contador"
            data-combinam={contagemAtual ? contagemAtual.combinam : undefined}
            className={cn("min-h-5 text-sm", contagemAtual && contagemAtual.combinam > 0 ? "text-forest" : "text-muted")}
          >
            {contagemAtual ? fraseContador(contagemAtual.combinam) : null}
          </p>

          {erro && (
            <p className="text-[13px] text-red-600" role="alert" data-testid="pedido-erro">
              {erro}{" "}
              {erro.startsWith("Entre") && (
                <Link href="/auth" className="font-medium underline">
                  Entrar
                </Link>
              )}
            </p>
          )}

          <Button type="submit" variant="gold" size="lg" className="h-[52px] w-full" disabled={enviando || contatoNoTexto}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
              </>
            ) : editarId ? (
              "Salvar alterações"
            ) : (
              "Publicar pedido"
            )}
          </Button>

          <p className="text-[13px] text-muted" data-testid="pedido-aviso-confirmacao">
            {avisoConfirmacao(smsLigado)}
          </p>

          <AvisoAntigolpe variante="linha" antes={user ? null : "Ao publicar, você entra com um código enviado por e-mail."} />
          {user && (
            <p className="text-[13px]">
              <Link href="/dashboard/pedidos" className="text-muted underline-offset-2 hover:text-ink hover:underline">
                Ver meus pedidos
              </Link>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

/** Botão liga/desliga (pet, crianças) com a mesma altura dos campos. */
function BotaoMarca({
  ativo,
  onClick,
  icone: Icone,
  testid,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ComponentType<{ className?: string }>;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      data-testid={testid}
      className={cn(
        "flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
        ativo ? "border-forest bg-sage-100 text-forest" : "border-line bg-white text-ink hover:border-sage",
      )}
    >
      {ativo ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <Icone className="h-4 w-4 shrink-0 text-muted" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/**
 * Cidade com autocomplete (prompt 12): um campo só, sugestões "Cidade – UF" de todo o Brasil (lista do IBGE).
 * Escolher na lista grava cidade + UF; o servidor confere de novo.
 */
function CampoCidade({
  texto,
  onTexto,
  onEscolher,
  escolhida,
}: {
  texto: string;
  onTexto: (t: string) => void;
  onEscolher: (c: { cidade: string; uf: string; rotulo: string }) => void;
  escolhida: boolean;
}) {
  const id = useId();
  const listaId = `${id}-lista`;
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const sugestoes = aberto && !escolhida ? buscarCidades(MUNICIPIOS, texto, 8) : [];
  const mostrar = sugestoes.length > 0;

  function escolher(i: number) {
    const c = sugestoes[i];
    if (!c) return;
    onEscolher(c);
    setAberto(false);
  }

  return (
    <div className="relative">
      <Rotulo htmlFor={`${id}-campo`}>Cidade</Rotulo>
      <input
        id={`${id}-campo`}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={mostrar ? `${id}-op-${ativo}` : undefined}
        autoComplete="off"
        required
        value={texto}
        placeholder="Comece a digitar a cidade"
        onChange={(e) => {
          onTexto(e.target.value);
          setAberto(true);
          setAtivo(0);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={(e) => {
          if (!mostrar) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((a) => Math.min(sugestoes.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            escolher(ativo);
          } else if (e.key === "Escape") {
            setAberto(false);
          }
        }}
        className={cn(CAMPO, escolhida && "pr-10")}
        data-testid="pedido-cidade"
        data-cidade-escolhida={escolhida ? "1" : undefined}
      />
      {escolhida && <Check className="pointer-events-none absolute bottom-4 right-3.5 h-4 w-4 text-forest" aria-hidden />}
      {mostrar && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Cidades"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-white py-1 shadow-flutuante"
        >
          {sugestoes.map((c, i) => (
            <li
              key={`${c.uf}-${c.cidade}`}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === ativo}
              // mousedown antes do blur do campo: a escolha não se perde.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(i)}
              onMouseEnter={() => setAtivo(i)}
              className={cn("cursor-pointer px-4 py-3 text-sm text-ink", i === ativo && "bg-sage-100")}
            >
              {c.cidade} <span className="text-muted">– {c.uf}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
