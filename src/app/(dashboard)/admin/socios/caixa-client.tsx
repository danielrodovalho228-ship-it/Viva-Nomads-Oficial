"use client";

import { dataHoraBRT } from "@/lib/datas-brasilia";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Inbox, Loader2, Mic, Paperclip, RotateCw, Send, Square, X } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_CAIXA, LIMITE_BYTES, LIMITE_TEXTO, ROTULO_EXTRACAO, ROTULO_STATUS, mimeAceito, nomeSeguro } from "@/lib/socios/caixa";
import { enviarParaCaixa, relerArquivo, type ItemCaixa } from "@/lib/socios/caixa-actions";

const COR_STATUS: Record<ItemCaixa["status"], string> = {
  novo: "bg-sky-100 text-sky-800",
  em_andamento: "bg-amber-100 text-amber-800",
  feito: "bg-lime-100 text-forest",
  precisa_daniel: "bg-red-100 text-red-800",
};
const ACEITA = "audio/*,image/*,.pdf,.docx,.xlsx,.txt,.m4a,.opus,.ogg";

const quando = (iso: string) =>
  dataHoraBRT(iso, { tabela: true });

function IconeTipo({ tipo }: { tipo: ItemCaixa["tipo"] }) {
  const cls = "h-4 w-4 shrink-0 text-sage";
  if (tipo === "audio") return <Mic className={cls} />;
  if (tipo === "imagem") return <ImageIcon className={cls} />;
  if (tipo === "documento") return <FileText className={cls} />;
  return null;
}

/**
 * Caixa dos Sócios: o sócio manda texto, áudio (arquivo ou gravado aqui), documento ou print.
 * O arquivo sobe direto do navegador para o bucket privado (pasta do próprio usuário) e a ação do servidor registra,
 * transcreve/lê e devolve. O Moacir lê de hora em hora e responde no próprio item.
 */
export function CaixaSociosClient({ itens, aviso, transcricaoLigada }: { itens: ItemCaixa[]; aviso: string | null; transcricaoLigada: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [relendo, setRelendo] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const inputArquivo = useRef<HTMLInputElement>(null);

  // Gravar pelo navegador só onde houver MediaRecorder + microfone (no servidor: false, sem quebrar a hidratação).
  const podeGravar = useSyncExternalStore(
    () => () => {},
    () => "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );

  // Enquanto houver arquivo sendo lido ou item sem resposta recente, atualiza a lista a cada 30 s.
  useEffect(() => {
    if (!itens.some((i) => i.extracao_status === "pendente" || i.status === "novo")) return;
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [itens, router]);

  function escolher(f: File | null) {
    setErro(null);
    setOk(null);
    if (!f) return setArquivo(null);
    if (!mimeAceito(f.type, f.name)) return setErro("Tipo de arquivo não aceito. Envie áudio, PDF, Word, Excel ou imagem.");
    if (f.size > LIMITE_BYTES) return setErro("Arquivo acima de 25 MB.");
    setArquivo(f);
  }

  async function gravar() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      pedacos.current = [];
      mr.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (mr.mimeType || "audio/webm").split(";")[0];
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        escolher(new File(pedacos.current, `audio-${Date.now()}.${ext}`, { type: mime }));
      };
      mr.start();
      gravador.current = mr;
      setGravando(true);
    } catch {
      setErro("Não foi possível usar o microfone. Libere o acesso ou anexe um arquivo de áudio.");
    }
  }

  function parar() {
    gravador.current?.stop();
    gravador.current = null;
    setGravando(false);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || gravando) return;
    setErro(null);
    setOk(null);
    if (!texto.trim() && !arquivo) return setErro("Escreva uma mensagem ou anexe um arquivo.");
    setEnviando(true);
    try {
      let path: string | null = null;
      if (arquivo) {
        const sb = createClient();
        if (!sb) throw new Error("Sem conexão com o banco.");
        const { data: u } = await sb.auth.getUser();
        if (!u.user) throw new Error("Sessão expirada. Entre de novo.");
        const mime = mimeAceito(arquivo.type, arquivo.name)!;
        path = `${u.user.id}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
        const { error } = await sb.storage.from(BUCKET_CAIXA).upload(path, arquivo, { contentType: mime, upsert: false });
        if (error) throw new Error("Não foi possível enviar o arquivo. Tente de novo.");
      }
      const r = await enviarParaCaixa({
        texto,
        path,
        nome: arquivo?.name ?? null,
        mime: arquivo ? mimeAceito(arquivo.type, arquivo.name) : null,
        tamanho: arquivo?.size ?? null,
      });
      if (!r.ok) throw new Error(r.erro ?? "Não foi possível enviar.");
      setTexto("");
      setArquivo(null);
      if (inputArquivo.current) inputArquivo.current.value = "";
      setOk("Enviado. A equipe lê e responde aqui mesmo.");
      router.refresh();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function reler(id: string) {
    setRelendo(id);
    const r = await relerArquivo(id);
    setRelendo(null);
    if (!r.ok) setErro(r.erro ?? "Não foi possível ler.");
    router.refresh();
  }

  return (
    <>
      <PageTitle title="Caixa dos Sócios" subtitle="Mande texto, áudio, documento ou print. A equipe lê, distribui e responde aqui." />

      {aviso && <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel title="Novo envio" className="lg:col-span-1 lg:self-start">
          <form onSubmit={enviar} className="space-y-3">
            <label htmlFor="caixa-texto" className="sr-only">Mensagem</label>
            <textarea
              id="caixa-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={LIMITE_TEXTO}
              rows={5}
              placeholder="Escreva o que viu, o que precisa ou a sua ideia…"
              className="w-full resize-y rounded-xl border border-sage-200 p-3 text-base"
            />

            {arquivo && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-sage-100 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink">{arquivo.name}</span>
                <button type="button" onClick={() => escolher(null)} aria-label="Remover anexo" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <input ref={inputArquivo} id="caixa-arquivo" type="file" accept={ACEITA} className="sr-only" onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
              <label htmlFor="caixa-arquivo" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 text-sm font-medium text-ink hover:border-sage">
                <Paperclip className="h-4 w-4" /> Anexar
              </label>
              {podeGravar &&
                (gravando ? (
                  <button type="button" onClick={parar} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white">
                    <Square className="h-4 w-4" /> Parar gravação
                  </button>
                ) : (
                  <button type="button" onClick={gravar} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 text-sm font-medium text-ink hover:border-sage">
                    <Mic className="h-4 w-4" /> Gravar áudio
                  </button>
                ))}
            </div>

            <Button type="submit" disabled={enviando || gravando} className="w-full">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {enviando ? (arquivo ? "Enviando e lendo o arquivo…" : "Enviando…") : "Enviar"}
            </Button>
            {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
            {ok && <p role="status" className="text-sm text-forest">{ok}</p>}
            <p className="text-xs text-muted">
              Áudio, PDF, Word, Excel ou imagem, até 25 MB.{" "}
              {transcricaoLigada ? "Áudios viram texto automaticamente." : "Transcrição de áudio ainda desligada (falta a chave no Vercel)."} O que envolver
              dinheiro, contrato, jurídico ou acessos passa pelo Daniel.
            </p>
          </form>
        </Panel>

        <Panel title={`Conversa (${itens.length})`} className="lg:col-span-2">
          {itens.length === 0 ? (
            <EmptyState icon={Inbox} title="Nada enviado ainda" text="O primeiro envio aparece aqui, com a leitura do arquivo e a resposta da equipe." />
          ) : (
            <ul className="space-y-4">
              {itens.map((i) => (
                <li key={i.id} className="rounded-xl border border-sage-200 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <IconeTipo tipo={i.tipo} />
                      <strong className="text-ink">{i.autor_nome}</strong> · {quando(i.criado_em)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${COR_STATUS[i.status]}`}>{ROTULO_STATUS[i.status]}</span>
                  </div>

                  {i.texto && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{i.texto}</p>}

                  {i.arquivo_nome && (
                    <div className="mt-2 space-y-2">
                      {i.tipo === "audio" && i.arquivo_url && <audio controls preload="none" src={i.arquivo_url} className="w-full" />}
                      {i.tipo === "imagem" && i.arquivo_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do bucket privado
                        <img src={i.arquivo_url} alt={`Anexo: ${i.arquivo_nome}`} className="max-h-72 rounded-lg border border-sage-200 object-contain" />
                      )}
                      {i.arquivo_url ? (
                        <a href={i.arquivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-forest underline">
                          <Paperclip className="h-3.5 w-3.5" /> {i.arquivo_nome}
                        </a>
                      ) : (
                        <span className="text-sm text-muted">{i.arquivo_nome}</span>
                      )}
                      {i.extracao_status === "ok" && i.texto_extraido && (
                        <details className="rounded-lg bg-surface-2 p-2 text-sm">
                          <summary className="cursor-pointer font-medium text-ink">{i.tipo === "audio" ? "Transcrição" : "Leitura do arquivo"}</summary>
                          <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-ink">{i.texto_extraido}</p>
                        </details>
                      )}
                      {ROTULO_EXTRACAO[i.extracao_status] && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{ROTULO_EXTRACAO[i.extracao_status]}</span>
                          {(i.extracao_status === "falhou" || i.extracao_status === "desligada") && (
                            <button type="button" onClick={() => reler(i.id)} disabled={relendo === i.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-sage-200 px-2 font-medium text-ink">
                              <RotateCw className={`h-3.5 w-3.5 ${relendo === i.id ? "animate-spin" : ""}`} /> Tentar ler de novo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {i.resposta && (
                    <div className="mt-3 rounded-lg border-l-4 border-forest bg-sage-100 p-3 text-sm">
                      <p className="text-xs font-semibold text-forest">Moacir (gerente) · {i.respondido_em ? quando(i.respondido_em) : ""}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-ink">{i.resposta}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
