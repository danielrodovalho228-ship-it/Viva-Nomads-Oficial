"use client";

import { useCallback, useEffect, useState } from "react";
import { ROTULO_AREA, ROTULO_NIVEL, rotuloItem } from "@/config/niveis";
import { VERSAO_CONFORTO } from "@/config/conforto-minimo";
import { nivelAgoraEFalta, type ItemQueFalta } from "@/lib/niveis/exibicao";
import { entradaNivelDoCadastro, type EntradaNivelCadastro } from "@/lib/data/nivel-cadastro-actions";
import { faltaSemSugestao } from "@/lib/fotos/deteccao";
import { ProvaNaHora } from "@/components/niveis/camera-prova";
import { AVISO_PROVA_NA_HORA, MARCA_FOTO_ANTERIOR, pontoDoItemInternet, provaAntigaNoPrazo, textoRefazerFoto } from "@/lib/niveis/prova-camera";
import { MedirNoImovel } from "@/components/niveis/medir-no-imovel";
import { BlocoOpcional } from "@/components/anuncio/bloco-opcional";
import { Extras, Ruido } from "@/components/niveis/ruido-extras";
import { nivelDoMeuImovel, type NivelDoImovelTela } from "@/lib/data/nivel-actions";
import { ANCORA_NIVEL_CADASTRO } from "@/lib/niveis/destino-nivel";
import { criterioDoItemNoCadastro, TEXTO_ESSENCIAL_DECLARADO, TEXTO_SUBIR_NIVEL } from "@/lib/niveis/cadastro-passo5";

/**
 * Adendo 59.1, Parte A — no passo Comodidades do cadastro: o nível que o imóvel atinge AGORA (com o padrão mínimo que
 * o dono está marcando logo acima) e, item a item, o que falta para o próximo, com a foto de cada item FEITA NA HORA
 * (FOTO-NA-HORA-B: câmera no celular, QR para o celular no computador; nunca da galeria). Provas anteriores à regra
 * aparecem com a marca e o prazo para refazer. Ruído e internet medida têm caminho próprio.
 * E141: o Essencial é autodeclarado (o padrão mínimo acima) e publica sem foto; a foto na hora só sobe o nível, é
 * opcional e fica numa cobrança só, aqui. E143: ruído e extras ficam dentro do passo (toggles do padrão E56), sem
 * mandar o dono para a página antiga.
 */
export function NivelNoCadastro({
  propertyId,
  conforto,
  sugeridas = [],
  recarregar = 0,
}: {
  propertyId: string | null;
  conforto: string[];
  /** DETECTA-B: itens com sugestão das fotos esperando confirmação — aparecem lá, não no "o que falta". */
  sugeridas?: readonly string[];
  /** Muda quando outro bloco grava um item (ex.: sugestão confirmada) para reler o nível. */
  recarregar?: number;
}) {
  const [entrada, setEntrada] = useState<EntradaNivelCadastro | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [tela, setTela] = useState<NivelDoImovelTela | null>(null);
  const [abertos, setAbertos] = useState<{ ruido?: boolean; extras?: boolean }>({});

  const carregar = useCallback(async () => {
    if (!propertyId) return;
    const [e, t] = await Promise.all([entradaNivelDoCadastro(propertyId).catch(() => null), nivelDoMeuImovel(propertyId).catch(() => null)]);
    setEntrada(e);
    setTela(t);
    setCarregou(true);
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    let vivo = true;
    Promise.all([entradaNivelDoCadastro(propertyId).catch(() => null), nivelDoMeuImovel(propertyId).catch(() => null)]).then(([e, t]) => {
      if (!vivo) return;
      setEntrada(e);
      setTela(t);
      setCarregou(true);
    });
    return () => {
      vivo = false;
    };
  }, [propertyId, recarregar]);

  // E143: quem chega por um aviso ou pelo painel (…#nivel-cadastro) vê o bloco assim que ele carrega.
  useEffect(() => {
    if (carregou && window.location.hash === `#${ANCORA_NIVEL_CADASTRO}`) document.getElementById(ANCORA_NIVEL_CADASTRO)?.scrollIntoView({ block: "start" });
  }, [carregou]);

  if (!propertyId) {
    return (
      <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted" data-testid="nivel-cadastro-sem-rascunho">
        O nível do imóvel aparece aqui assim que o rascunho for salvo.
      </p>
    );
  }
  if (!carregou) return null;

  const base = entrada ?? { itens: [], medidas: [], ruido: null, bloqueadas: [], fotos: [] };
  const { nivel, proximo, falta: faltaTudo } = nivelAgoraEFalta({
    declaracoesConforto: conforto.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
    itens: base.itens,
    medidas: base.medidas,
    ruido: base.ruido,
    bloqueadas: base.bloqueadas,
    agora: new Date(),
  });
  const falta = faltaSemSugestao(faltaTudo, new Set(sugeridas));
  const recusa = new Map(base.fotos.filter((f) => f.status === "recusada").map((f) => [f.chave, f.motivo]));

  const recebida = (m: string) => {
    setMsg({ ok: true, t: m });
    void carregar().catch(() => undefined);
  };
  const abrirRuido = () => {
    setAbertos((a) => ({ ...a, ruido: true }));
    setTimeout(() => document.getElementById("nivel-cadastro-ruido")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
  };
  const agora = new Date();
  const anteriores = base.itens.filter((i) => i.declarado && provaAntigaNoPrazo(i, agora) && i.refazerAte);

  return (
    <section id={ANCORA_NIVEL_CADASTRO} className="scroll-mt-24 rounded-xl border border-sage-200 p-4" data-testid="nivel-cadastro" data-nivel={nivel}>
      <h3 className="text-base font-semibold text-ink">Nível do anúncio</h3>
      <p className="mt-1 text-sm text-ink" data-testid="nivel-cadastro-agora" data-nivel={nivel}>
        {nivel === "em_adequacao" ? (
          "Abaixo do Essencial: confirme os itens do padrão mínimo acima."
        ) : (
          <>
            Agora: <strong>{ROTULO_NIVEL[nivel]}</strong>
            {proximo ? "" : ". É o nível mais alto."}
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-muted" data-testid="nivel-cadastro-declarado">
        {TEXTO_ESSENCIAL_DECLARADO}
      </p>
      {proximo && proximo !== "essencial" && falta.length > 0 && (
        <div id="nivel-cadastro-falta" className="mt-3 scroll-mt-24" data-testid="nivel-cadastro-falta" data-proximo={proximo}>
          <p className="text-sm font-semibold text-ink" data-testid="nivel-cadastro-subir">
            Subir para {ROTULO_NIVEL[proximo]} <span className="font-normal text-muted">· opcional</span>
          </p>
          <p className="mt-1 text-sm text-ink">{TEXTO_SUBIR_NIVEL}</p>
          <p className="mt-1 text-xs text-muted" data-testid="nivel-cadastro-aviso-camera">
            {AVISO_PROVA_NA_HORA}
          </p>
          <p className="text-xs text-muted">Uma foto por item, sem pessoas. O nível é o da área mais fraca.</p>
          {falta.map((g) => (
            <div key={g.area} className="mt-3">
              <p className="text-xs font-semibold text-muted">{ROTULO_AREA[g.area]}</p>
              <ul className="mt-1 divide-y divide-line rounded-lg border border-line bg-white">
                {g.itens.map((i) => (
                  <li key={i.chave} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid={`nivel-cadastro-item-${i.chave}`}>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{i.rotulo}</span>
                      {criterioDoItemNoCadastro(i) && <span className="block text-xs text-muted">{criterioDoItemNoCadastro(i)}</span>}
                      {recusa.has(i.chave) && (
                        <span className="block text-xs text-red-700" data-testid={`nivel-cadastro-recusada-${i.chave}`}>
                          Foto recusada{recusa.get(i.chave) ? `: ${recusa.get(i.chave)}` : ""}. Fotografe de novo.
                        </span>
                      )}
                    </span>
                    <AcaoItem item={i} propertyId={propertyId} onRecebida={recebida} onRuido={() => abrirRuido()} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {anteriores.length > 0 && (
        <div className="mt-3" data-testid="nivel-cadastro-anteriores">
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {anteriores.map((i) => (
              <li key={i.chave} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid={`nivel-cadastro-anterior-${i.chave}`}>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{rotuloItem(i.chave)}</span>
                  <span className="block text-xs text-amber-800">
                    {MARCA_FOTO_ANTERIOR} · {textoRefazerFoto(rotuloItem(i.chave), i.refazerAte!)}
                  </span>
                </span>
                <ProvaNaHora propertyId={propertyId} chave={i.chave} rotulo={rotuloItem(i.chave)} onRecebida={recebida} testid={`nivel-cadastro-foto-${i.chave}`} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-3 text-sm text-ink" : "mt-3 text-sm text-red-700"} data-testid="nivel-cadastro-msg">
          {msg.t}
        </p>
      )}
      {/* E143: ruído e extras dentro do passo, cada um atrás do seu toggle (padrão E56). */}
      {tela && (
        <div className="mt-4 grid gap-3" data-testid="nivel-cadastro-opcionais">
          <div id="nivel-cadastro-ruido" className="scroll-mt-24">
            <BlocoOpcional
              id="nivel-ruido"
              titulo="Ruído"
              descricao="Quatro perguntas de sim ou não sobre o barulho em volta. Contam para o nível."
              ligado={abertos.ruido ?? !!tela.ruido}
              temDados={false}
              onLigar={() => setAbertos((a) => ({ ...a, ruido: true }))}
              onDesligar={() => setAbertos((a) => ({ ...a, ruido: false }))}
            >
              <Ruido propertyId={propertyId} inicial={tela.ruido} onSalvo={() => void carregar().catch(() => undefined)} />
            </BlocoOpcional>
          </div>
          <BlocoOpcional
            id="nivel-extras"
            titulo="Extras"
            descricao="Aparecem no anúncio como fato. Não mudam o nível."
            ligado={abertos.extras ?? tela.extras.length > 0}
            temDados={false}
            onLigar={() => setAbertos((a) => ({ ...a, extras: true }))}
            onDesligar={() => setAbertos((a) => ({ ...a, extras: false }))}
          >
            <Extras propertyId={propertyId} inicial={tela.extras} onSalvo={() => void carregar().catch(() => undefined)} />
          </BlocoOpcional>
        </div>
      )}
    </section>
  );
}

function AcaoItem({ item, propertyId, onRecebida, onRuido }: { item: ItemQueFalta; propertyId: string; onRecebida: (m: string) => void; onRuido: () => void }) {
  // NIVEIS-MEDIR-B (E25b): mede-se já no rascunho ("Meça agora, no imóvel"); a medição vale ao publicar. A videochamada
  // não tem foto: é a medição do ponto de trabalho que passa a regra.
  const ponto = item.prova === "medida" ? pontoDoItemInternet(item.chave) : null;
  if (ponto)
    return (
      <MedirNoImovel propertyId={propertyId} ponto={ponto} origem="cadastro" onMedida={() => onRecebida("Medição validada. O nível já foi recalculado.")} testid={`nivel-cadastro-medir-${item.chave}`} />
    );
  if (item.prova === "ruido")
    return (
      <button type="button" onClick={onRuido} className="min-h-11 shrink-0 text-xs font-semibold text-forest underline underline-offset-2" data-testid={`nivel-cadastro-ruido-${item.chave}`}>
        Responder sobre o ruído
      </button>
    );
  return <ProvaNaHora propertyId={propertyId} chave={item.chave} rotulo={item.rotulo} onRecebida={onRecebida} testid={`nivel-cadastro-foto-${item.chave}`} />;
}
