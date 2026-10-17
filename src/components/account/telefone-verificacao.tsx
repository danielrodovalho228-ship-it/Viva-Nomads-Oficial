"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Smartphone } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { confirmarCodigoTelefone, enviarCodigoTelefone, getTelefoneEstado, type EstadoTelefone } from "@/lib/data/telefone-actions";
import {
  CODIGO_SIMULADO,
  ERRO_CODIGO,
  limparCodigo,
  mascaraCelular,
  segundosParaReenviar,
  validarCelularBR,
} from "@/lib/telefone/telefone";

/**
 * Conta → Confiança: verificação OPCIONAL do celular (prompt 7). Nunca obrigatória e nunca trava nada.
 * Sem provedor de SMS configurado: "Verificação de telefone em breve", desativado, sem erro.
 * O número nunca aparece em perfil, cartão, log ou URL: só o selo "Telefone verificado".
 */
export function TelefoneVerificacao() {
  const [estado, setEstado] = useState<EstadoTelefone | null | undefined>(undefined);
  const [numero, setNumero] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviadoEm, setEnviadoEm] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [trocando, setTrocando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getTelefoneEstado()
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setEstado(null));
    return () => {
      vivo = false;
    };
  }, []);

  // Contagem do "Reenviar" (60 s).
  useEffect(() => {
    if (enviadoEm == null) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enviadoEm]);

  if (estado === undefined || estado === null) return null;

  const faltam = segundosParaReenviar(enviadoEm, agora);
  const codigoPedido = enviadoEm != null;
  const mostrarForm = estado.disponivel && (!estado.verificado || trocando);

  async function enviar() {
    setErro(null);
    setAviso(null);
    const v = validarCelularBR(numero);
    if (!v.ok) return setErro(v.erro);
    setOcupado(true);
    const r = await enviarCodigoTelefone(numero);
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    setEnviadoEm(Date.now());
    setAgora(Date.now());
    setCodigo("");
    setEstado((e) => (e ? { ...e, verificado: false, pendente: true } : e));
    setAviso("Código enviado por SMS. Ele vale por alguns minutos.");
  }

  async function confirmar() {
    setErro(null);
    setAviso(null);
    if (codigo.length !== 6) return setErro(ERRO_CODIGO);
    setOcupado(true);
    const r = await confirmarCodigoTelefone(numero, codigo);
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    setEstado((e) => (e ? { ...e, verificado: true, pendente: false } : e));
    setTrocando(false);
    setEnviadoEm(null);
    setNumero("");
    setCodigo("");
    setAviso("Celular verificado. O selo já aparece no seu perfil.");
  }

  return (
    <Panel title="Confiança" className="mt-6" data-testid="confianca-telefone">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">Verificação do celular</h3>
          <p className="mt-0.5 text-sm text-muted">
            Opcional. Verifique seu celular: perfis verificados passam mais confiança. O número nunca aparece no perfil;
            só o selo &quot;Telefone verificado&quot;.
          </p>

          {!estado.disponivel && (
            <div className="mt-4" data-testid="telefone-em-breve">
              <p className="text-sm font-medium text-ink">Verificação de telefone em breve</p>
              <div className="mt-2 flex max-w-sm items-center rounded-xl border border-sage-200 bg-surface-2 text-sm text-muted">
                <span className="border-r border-sage-200 px-3 py-2.5">+55</span>
                <input disabled aria-label="Celular (em breve)" placeholder="(34) 99999-0000" className="min-w-0 flex-1 bg-transparent px-3 py-2.5" />
              </div>
            </div>
          )}

          {estado.disponivel && estado.verificado && !trocando && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span data-testid="telefone-verificado" className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-forest">
                <BadgeCheck className="h-4 w-4" aria-hidden /> Telefone verificado
              </span>
              <button type="button" onClick={() => setTrocando(true)} className="text-sm font-semibold text-forest underline underline-offset-2">
                Trocar número
              </button>
            </div>
          )}

          {mostrarForm && (
            <div className="mt-4 grid gap-4">
              {trocando && <p className="text-sm text-muted">Ao pedir o código para o novo número, o selo some até você confirmar.</p>}
              <div>
                <label htmlFor="telefone-numero" className="mb-1.5 block text-sm font-medium text-ink">
                  Celular
                </label>
                <div className="flex max-w-sm items-center rounded-xl border border-sage-200 bg-white text-sm focus-within:border-sage">
                  <span className="border-r border-sage-200 px-3 py-2.5 text-muted" aria-hidden>
                    +55
                  </span>
                  <input
                    id="telefone-numero"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(34) 99999-0000"
                    value={numero}
                    onChange={(e) => setNumero(mascaraCelular(e.target.value))}
                    className="min-w-0 flex-1 rounded-r-xl px-3 py-2.5 outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!codigoPedido ? (
                  <Button type="button" variant="primary" onClick={enviar} disabled={ocupado}>
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Enviar código
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={enviar} disabled={ocupado || faltam > 0} data-testid="telefone-reenviar">
                    {faltam > 0 ? `Reenviar em ${faltam} s` : "Reenviar"}
                  </Button>
                )}
              </div>

              {codigoPedido && (
                <div>
                  <label htmlFor="telefone-codigo" className="mb-1.5 block text-sm font-medium text-ink">
                    Código de 6 dígitos
                  </label>
                  <div className="flex max-w-sm gap-2">
                    <input
                      id="telefone-codigo"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={codigo}
                      onChange={(e) => setCodigo(limparCodigo(e.target.value))}
                      className="w-36 rounded-xl border border-sage-200 px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-sage"
                    />
                    <Button type="button" variant="primary" onClick={confirmar} disabled={ocupado || codigo.length !== 6}>
                      Confirmar
                    </Button>
                  </div>
                  {estado.simulado && <p className="mt-1.5 text-xs text-muted">Laboratório: o código simulado é {CODIGO_SIMULADO}.</p>}
                </div>
              )}
            </div>
          )}

          {erro && (
            <p role="alert" data-testid="telefone-erro" className="mt-3 text-sm text-red-700">
              {erro}
            </p>
          )}
          {aviso && (
            <p role="status" className="mt-3 text-sm text-forest">
              {aviso}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
