"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarItemNivel } from "@/lib/data/nivel-actions";
import { abrirCapturaProva, pedirLinkCelular, provaDoItem } from "@/lib/data/prova-actions";
import {
  BOTAO_FOTOGRAFAR,
  BOTAO_FOTOGRAFAR_CELULAR,
  CONTINUAR_NO_CELULAR,
  DICA_CAMERA,
  ERRO_SEM_TOKEN,
  LINK_CELULAR_MINUTOS,
  PASSOS_PERMISSAO,
  PERMISSAO_CAMERA,
  ESPERA_MODO_MS,
  PREPARANDO_CAMERA,
  modoDaProva,
  modoSemListaDeAparelhos,
  textoFotoRecebida,
  type ModoProva,
} from "@/lib/niveis/prova-camera";

/**
 * FOTO-NA-HORA-B — a prova de um item de nível é a foto feita NA HORA. Este é o único caminho de foto de prova:
 * • celular (toque + câmera): CameraProva — câmera traseira por padrão, botão para trocar, imagem ao vivo,
 *   "Fotografar", prévia com "Usar esta foto" / "Fotografar de novo"; o quadro da câmera vai direto ao envio, com o
 *   token de captura emitido ao abrir. Sem campo de arquivo, sem galeria; arquivo arrastado é ignorado.
 * • computador (ou aparelho sem câmera): "Fotografar pelo celular" → QR + link "Continuar no celular" (também por
 *   e-mail); o item se atualiza sozinho quando a foto chega. A webcam não é oferecida.
 */
export function ProvaNaHora({
  propertyId,
  chave,
  rotulo,
  onRecebida,
  autoAbrir = false,
  testid,
  rotuloBotao,
  onAbrir,
}: {
  propertyId: string;
  chave: string;
  rotulo: string;
  onRecebida: (mensagem: string) => void;
  /** Abre na hora (link do celular, sugestão confirmada). */
  autoAbrir?: boolean;
  testid?: string;
  /** Texto do botão no celular quando não é o padrão (ex.: "Fotografar de novo"). */
  rotuloBotao?: string;
  /** Ao abrir (ex.: a sugestão das fotos vira "Confirmada, falta a foto"). */
  onAbrir?: () => void;
}) {
  const modo = useModoProva();
  const [aberto, setAberto] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
  const pediuAuto = useRef(false);
  const celular = modo === "celular" && !semCamera;

  useEffect(() => {
    if (autoAbrir && modo && !pediuAuto.current) {
      pediuAuto.current = true;
      setAberto(true);
    }
  }, [autoAbrir, modo]);

  const id = testid ?? `prova-${chave}`;
  return (
    <>
      {/* E100: enquanto decide (no máximo 1 s), "Preparando…" — nunca um botão cinza sem explicação. */}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!modo}
        aria-busy={!modo}
        onClick={() => {
          setAberto(true);
          onAbrir?.();
        }}
        data-testid={`${id}-botao`}
        data-modo={modo ? (celular ? "celular" : "computador") : "preparando"}
      >
        <Camera className="h-4 w-4" aria-hidden />
        {!modo ? PREPARANDO_CAMERA : celular ? (rotuloBotao ?? BOTAO_FOTOGRAFAR) : BOTAO_FOTOGRAFAR_CELULAR}
      </Button>
      {aberto && celular && (
        <CameraProva
          propertyId={propertyId}
          chave={chave}
          rotulo={rotulo}
          onFechar={() => setAberto(false)}
          onSemCamera={() => setSemCamera(true)}
          onRecebida={(m) => {
            setAberto(false);
            onRecebida(m);
          }}
        />
      )}
      {aberto && !celular && modo && (
        <PeloCelular
          propertyId={propertyId}
          chave={chave}
          rotulo={rotulo}
          onFechar={() => setAberto(false)}
          onRecebida={(m) => {
            setAberto(false);
            onRecebida(m);
          }}
        />
      )}
    </>
  );
}

/**
 * Celular = toque como ponteiro principal e uma câmera; o resto (computador, aparelho sem câmera) vai pelo QR.
 * E100: decidido na MONTAGEM, sem pedir permissão de câmera (a permissão só ao fotografar). Sem toque, é computador na
 * hora. Com toque, a lista de aparelhos (enumerateDevices) responde em até 1 s — o navegador pode segurar essa resposta
 * (aba em segundo plano, sem foco) e, antes, o botão ficava cinza para sempre. Passado 1 s, vale o que já se sabe:
 * toque sem resposta = celular (sem câmera de verdade, o getUserMedia cai no QR). Qualquer falha: computador (QR).
 */
export function useModoProva(): ModoProva | null {
  const [modo, setModo] = useState<ModoProva | null>(null);
  useEffect(() => {
    let vivo = true;
    const fim = (m: ModoProva) => vivo && setModo((atual) => atual ?? m);
    let ambiente: { ponteiroGrosso: boolean; toque: boolean; getUserMedia: boolean };
    try {
      ambiente = {
        ponteiroGrosso: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
        toque: "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0,
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      };
    } catch {
      void Promise.resolve().then(() => fim("computador"));
      return () => {
        vivo = false;
      };
    }
    const semCamera = modoSemListaDeAparelhos(ambiente);
    if (semCamera) {
      void Promise.resolve().then(() => fim(semCamera));
      return () => {
        vivo = false;
      };
    }
    const teto = window.setTimeout(() => fim(modoDaProva({ ...ambiente, temCamera: null })), ESPERA_MODO_MS);
    Promise.resolve()
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then((d) => fim(modoDaProva({ ...ambiente, temCamera: d.some((x) => x.kind === "videoinput") })))
      .catch(() => fim(modoDaProva({ ...ambiente, temCamera: null })));
    return () => {
      vivo = false;
      window.clearTimeout(teto);
    };
  }, []);
  return modo;
}

/** Arquivo arrastado para a tela enquanto a câmera está aberta: ignorado (nem abre no navegador, nem é enviado). */
function useIgnorarArrastar() {
  useEffect(() => {
    const parar = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", parar, true);
    window.addEventListener("drop", parar, true);
    return () => {
      window.removeEventListener("dragover", parar, true);
      window.removeEventListener("drop", parar, true);
    };
  }, []);
}

type Etapa = "abrindo" | "ao_vivo" | "previa" | "enviando" | "permissao" | "erro";

function CameraProva({
  propertyId,
  chave,
  rotulo,
  onFechar,
  onSemCamera,
  onRecebida,
}: {
  propertyId: string;
  chave: string;
  rotulo: string;
  onFechar: () => void;
  onSemCamera: () => void;
  onRecebida: (mensagem: string) => void;
}) {
  useIgnorarArrastar();
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const token = useRef<string | null>(null);
  const [frente, setFrente] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("abrindo");
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const novoToken = useCallback(async () => {
    const r = await abrirCapturaProva(propertyId, chave).catch(() => null);
    token.current = r?.ok ? r.token : null;
    if (!r?.ok) {
      setErro(r && !r.ok ? r.erro : "Não foi possível abrir a câmera agora.");
      setEtapa("erro");
    }
    return !!r?.ok;
  }, [propertyId, chave]);

  const parar = () => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
  };

  // Abrir a câmera = pedir o token ao servidor e ligar o vídeo (traseira por padrão; o botão troca).
  useEffect(() => {
    let vivo = true;
    (async () => {
      setEtapa("abrindo");
      if (!token.current && !(await novoToken())) return;
      try {
        parar();
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: frente ? "user" : "environment" } }, audio: false });
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        fluxo.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setEtapa("ao_vivo");
      } catch (e) {
        if (!vivo) return;
        const nome = (e as { name?: string })?.name ?? "";
        if (nome === "NotAllowedError" || nome === "SecurityError") return setEtapa("permissao");
        if (nome === "NotFoundError" || nome === "OverconstrainedError" || nome === "NotReadableError") return onSemCamera();
        setErro("Não foi possível abrir a câmera agora.");
        setEtapa("erro");
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frente]);

  useEffect(() => () => parar(), []);
  useEffect(() => () => (foto ? URL.revokeObjectURL(foto.url) : undefined), [foto]);

  function fotografar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const lado = Math.max(v.videoWidth, v.videoHeight);
    const escala = lado > 2560 ? 2560 / lado : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * escala);
    c.height = Math.round(v.videoHeight * escala);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (b) => {
        if (!b) return;
        setFoto({ blob: b, url: URL.createObjectURL(b) });
        setEtapa("previa");
      },
      "image/jpeg",
      0.9,
    );
  }

  async function usar() {
    if (!foto || !token.current) return;
    setEtapa("enviando");
    setErro(null);
    try {
      const corpo = new FormData();
      corpo.append("token", token.current);
      corpo.append("file", new File([foto.blob], "prova.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/upload/prova", { method: "POST", body: corpo });
      const j = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !j.path) {
        // Token vencido/usado: o próximo envio leva um token novo. Foto repetida: o mesmo token serve.
        if (res.status === 403) await novoToken();
        setErro(j.error ?? "Não foi possível enviar a foto. Fotografe de novo.");
        setFoto(null);
        return setEtapa("ao_vivo");
      }
      const r = await salvarItemNivel(propertyId, chave, true, j.path, token.current);
      if (!r.ok) {
        await novoToken();
        setErro(r.erro);
        setFoto(null);
        return setEtapa("ao_vivo");
      }
      parar();
      onRecebida(r.mensagem ?? textoFotoRecebida(rotulo));
    } catch {
      setErro("Não foi possível enviar a foto. Confira a conexão e toque em Usar esta foto de novo.");
      setEtapa("previa");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Fotografar: ${rotulo}`} className="fixed inset-0 z-50 flex flex-col bg-night text-white" data-testid="camera-prova" data-etapa={etapa} data-chave={chave}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold">{rotulo}</p>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-label="Fechar a câmera" onClick={onFechar} data-testid="camera-fechar">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        <video ref={video} playsInline muted autoPlay className={etapa === "ao_vivo" || etapa === "abrindo" ? "h-full w-full object-contain" : "hidden"} data-testid="camera-video" />
        {foto && (etapa === "previa" || etapa === "enviando") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt={`Prévia: ${rotulo}`} className="h-full w-full object-contain" data-testid="camera-previa" />
        )}
        {etapa === "permissao" && (
          <div className="absolute inset-0 overflow-y-auto bg-night p-4" data-testid="camera-permissao">
            <p className="text-base font-semibold">{PERMISSAO_CAMERA}</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm">
              {PASSOS_PERMISSAO.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
        )}
        {etapa === "erro" && (
          <p className="absolute inset-x-0 top-1/3 px-4 text-center text-sm" role="alert" data-testid="camera-erro">
            {erro ?? ERRO_SEM_TOKEN}
          </p>
        )}
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="text-center text-sm" data-testid="camera-dica">
          {DICA_CAMERA}
        </p>
        {erro && etapa !== "erro" && (
          <p className="text-center text-sm text-red-200" role="alert" data-testid="camera-msg">
            {erro}
          </p>
        )}
        {etapa === "ao_vivo" && (
          <div className="flex items-center justify-center gap-3">
            <Button type="button" variant="inverseSecondary" size="sm" onClick={() => setFrente((f) => !f)} data-testid="camera-trocar" aria-label="Trocar de câmera">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Trocar câmera
            </Button>
            <Button type="button" variant="inverse" onClick={fotografar} data-testid="camera-fotografar">
              <Camera className="h-4 w-4" aria-hidden />
              Fotografar
            </Button>
          </div>
        )}
        {(etapa === "previa" || etapa === "enviando") && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="inverseSecondary"
              size="sm"
              disabled={etapa === "enviando"}
              onClick={() => {
                setFoto(null);
                setEtapa("ao_vivo");
              }}
              data-testid="camera-refazer"
            >
              Fotografar de novo
            </Button>
            <Button type="button" variant="inverse" disabled={etapa === "enviando"} onClick={usar} data-testid="camera-usar">
              {etapa === "enviando" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {etapa === "enviando" ? "Enviando…" : "Usar esta foto"}
            </Button>
          </div>
        )}
        {etapa === "permissao" && (
          <div className="flex justify-center">
            <Button type="button" variant="inverse" onClick={onFechar} data-testid="camera-tentar">
              Fechar e tentar de novo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PeloCelular({ propertyId, chave, rotulo, onFechar, onRecebida }: { propertyId: string; chave: string; rotulo: string; onFechar: () => void; onRecebida: (mensagem: string) => void }) {
  const [link, setLink] = useState<{ url: string; qr: string; expiraEm: string; emailEnviado: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vencido, setVencido] = useState(false);
  const antes = useRef<string | null | undefined>(undefined);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof pedirLinkCelular>> | null) => {
    setVencido(false);
    if (!r?.ok) return setErro(r && !r.ok ? r.erro : "Não foi possível gerar o link agora.");
    setErro(null);
    setLink({ url: r.url, qr: r.qr, expiraEm: r.expiraEm, emailEnviado: r.emailEnviado });
  }, []);
  const gerar = async () => aplicar(await pedirLinkCelular(propertyId, chave).catch(() => null));

  useEffect(() => {
    let vivo = true;
    provaDoItem(propertyId, chave)
      .catch(() => null)
      .then((p) => {
        if (vivo) antes.current = p?.capturadaEm ?? null;
      });
    pedirLinkCelular(propertyId, chave)
      .catch(() => null)
      .then((r) => {
        if (vivo) aplicar(r);
      });
    return () => {
      vivo = false;
    };
  }, [propertyId, chave, aplicar]);

  // O item se atualiza sozinho: a cada 3 s, pergunta se chegou uma foto da câmera nova; o link vence em 30 min.
  useEffect(() => {
    if (!link) return;
    const t = setInterval(async () => {
      if (Date.now() >= Date.parse(link.expiraEm)) {
        setVencido(true);
        return clearInterval(t);
      }
      const p = await provaDoItem(propertyId, chave).catch(() => null);
      if (p?.origem === "camera" && p.capturadaEm && antes.current !== undefined && p.capturadaEm !== antes.current) {
        clearInterval(t);
        onRecebida(textoFotoRecebida(rotulo));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [link, propertyId, chave, rotulo, onRecebida]);

  return (
    <div className="mt-3 w-full rounded-lg border border-line bg-white p-4 text-sm text-ink" data-testid={`prova-celular-${chave}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Fotografe {rotulo} pelo celular</p>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted" aria-label="Fechar" onClick={onFechar} data-testid="prova-celular-fechar">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {erro && (
        <p className="mt-2 text-red-700" role="alert" data-testid="prova-celular-erro">
          {erro}
        </p>
      )}
      {link && !vencido && (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={link.qr} alt="QR para abrir no celular" width={168} height={168} className="h-42 w-42 shrink-0" data-testid="prova-celular-qr" />
          <div className="space-y-2">
            <p>Aponte a câmera do celular para o código. O link vale por {LINK_CELULAR_MINUTOS} minutos e uma vez só.</p>
            <a href={link.url} className="inline-block font-semibold text-forest underline underline-offset-2" data-testid="prova-celular-link">
              {CONTINUAR_NO_CELULAR}
            </a>
            {link.emailEnviado && <p className="text-xs text-muted" data-testid="prova-celular-email">Enviamos o mesmo link para o seu e-mail.</p>}
            <p className="text-xs text-muted" data-testid="prova-celular-esperando">
              Esta tela se atualiza sozinha quando a foto chegar.
            </p>
          </div>
        </div>
      )}
      {vencido && (
        <p className="mt-2" data-testid="prova-celular-vencido">
          O link venceu.{" "}
          <button type="button" className="min-h-11 font-semibold text-forest underline underline-offset-2" onClick={() => void gerar()}>
            Gerar outro
          </button>
        </p>
      )}
    </div>
  );
}
