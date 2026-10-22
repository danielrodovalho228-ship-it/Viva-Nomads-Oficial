"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { codigoTotpValido, mensagemErroMfa, tentativasRestantes } from "@/lib/admin/mfa";
import { gravarPendente, lerPendente, limparPendente } from "@/lib/seguranca/fator-pendente";
import { safeInternalPath } from "@/lib/safe-redirect";
import { agruparChave, urlOtpauth } from "@/lib/seguranca/chave-totp";
import { contarCodigosRecuperacao, gerarCodigosRecuperacao, usarCodigoRecuperacao } from "@/lib/seguranca/recuperacao-actions";
import { CodigosGerados, CodigosRecuperacaoBloco } from "@/components/seguranca/codigos-recuperacao";
import { SkeletonLinhas } from "@/components/ui/skeleton";

const CHAVE_FALHAS = "vn:2fa-falhas";

function lerFalhas(): number {
  try {
    return Number(sessionStorage.getItem(CHAVE_FALHAS)) || 0;
  } catch {
    return 0;
  }
}
function gravarFalhas(n: number) {
  try {
    sessionStorage.setItem(CHAVE_FALHAS, String(n));
  } catch {
    /* sem armazenamento: o limite do Supabase continua valendo */
  }
}

function guardaDaAba(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function CampoCodigo({ valor, onChange, id }: { valor: string; onChange: (v: string) => void; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        Código de 6 dígitos do app autenticador
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^\d\s]/g, ""))}
        className="h-12 w-full rounded-xl border border-sage-300 bg-white px-4 text-center text-xl tracking-[0.4em] text-ink focus:border-forest focus:outline-none"
        placeholder="000000"
      />
    </div>
  );
}

/** Confere o código num fator, com limite de tentativas neste navegador. */
async function conferir(factorId: string, bruto: string, contexto: "ativar" | "entrar" = "entrar"): Promise<{ ok: true } | { ok: false; erro: string }> {
  const codigo = codigoTotpValido(bruto);
  if (!codigo) return { ok: false, erro: "Digite os 6 números que aparecem no app." };
  if (tentativasRestantes(lerFalhas()) === 0) {
    return { ok: false, erro: "Muitas tentativas seguidas. Espere um minuto, recarregue a página e tente de novo." };
  }
  const supabase = createClient();
  if (!supabase) return { ok: false, erro: "Indisponível agora." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) {
    gravarFalhas(lerFalhas() + 1);
    return { ok: false, erro: mensagemErroMfa(error.message, contexto) };
  }
  gravarFalhas(0);
  return { ok: true };
}

/** Tela /auth/verificar-codigo: admin com fator e sessão só com senha digita o código e volta ao destino completo. */
export function VerificarCodigoForm({ destino }: { destino: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const alvo = safeInternalPath(destino, "/admin");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const fator = data?.totp?.[0]; // só fatores verificados
      if (fator) setFactorId(fator.id);
      else window.location.href = `/dashboard/conta/seguranca?obrigatorio=admin&redirect=${encodeURIComponent(alvo)}`;
      setCarregando(false);
    });
  }, [alvo]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setErro(null);
    setEnviando(true);
    const r = await conferir(factorId, codigo);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    // Recarrega do servidor para o proxy enxergar a sessão já em aal2.
    window.location.assign(alvo);
    router.refresh();
  }

  async function enviarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await usarCodigoRecuperacao(codigo, alvo);
    setEnviando(false);
    if (!r.ok) return setErro(r.error);
    // O servidor desligou o app antigo: segue para cadastrar um novo (e receber códigos novos).
    window.location.assign(r.proximo);
  }

  if (modoRecuperacao) {
    return (
      <form onSubmit={enviarRecuperacao} className="mt-6 space-y-4 text-left">
        <label htmlFor="codigo-recuperacao" className="mb-1 block text-sm font-medium text-ink">Código de recuperação (10 letras e números)</label>
        <input
          id="codigo-recuperacao"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={12}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="h-12 w-full rounded-xl border border-sage-300 bg-white px-4 text-center text-lg text-ink focus:border-forest focus:outline-none"
          placeholder="XXXXX-XXXXX"
        />
        <p className="text-xs text-muted">Cada código vale uma vez. Ao usar, a verificação do app é desligada e você cadastra o app de novo.</p>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Usar código de recuperação
        </Button>
        <button type="button" className="min-h-11 text-sm text-forest underline" onClick={() => { setModoRecuperacao(false); setCodigo(""); setErro(null); }}>Voltar ao código do app</button>
      </form>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-4 text-left">
      {carregando ? (
        <SkeletonLinhas linhas={3} />
      ) : (
        <>
          <CampoCodigo id="codigo-2fa" valor={codigo} onChange={setCodigo} />
          {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" disabled={enviando || !factorId}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Confirmar e entrar
          </Button>
          <div className="flex flex-col items-start gap-1 text-sm">
            <button type="button" className="min-h-11 text-forest underline" onClick={() => { setModoRecuperacao(true); setCodigo(""); setErro(null); }}>Usar código de recuperação</button>
            <a href="/admin/2fa/refazer" className="inline-flex min-h-11 items-center text-forest underline">Perdi o acesso ao app (refazer)</a>
          </div>
        </>
      )}
    </form>
  );
}

type Estado =
  | { tipo: "carregando" }
  | { tipo: "sem-fator" }
  | { tipo: "configurando"; factorId: string; qr: string; segredo: string }
  | { tipo: "ativo"; factorId: string };

/** Conta → Segurança: ativar/remover a verificação em duas etapas (TOTP). */
export function DuasEtapasPanel({ obrigatorio, destino }: { obrigatorio: boolean; destino: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<null | "confirmar" | "codigo">(null);
  const [copiado, setCopiado] = useState(false);
  const [codigosNovos, setCodigosNovos] = useState<string[] | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);

  async function atualizarRestantes() {
    const r = await contarCodigosRecuperacao();
    if (r.ok) setRestantes(r.restantes);
  }

  async function copiarChave(segredo: string) {
    try {
      await navigator.clipboard.writeText(segredo.replace(/\s+/g, ""));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não deu para copiar automaticamente. Selecione a chave e copie manualmente.");
    }
  }

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      queueMicrotask(() => setEstado({ tipo: "sem-fator" }));
      return;
    }
    // Só LÊ: nunca cria nem apaga fator no carregamento (o QR não pode mudar a cada abertura).
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const ativo = data?.totp?.[0];
      if (ativo) {
        void atualizarRestantes();
        return setEstado({ tipo: "ativo", factorId: ativo.id });
      }
      const naoVerificados = (data?.all ?? []).filter((f) => f.factor_type === "totp" && f.status === "unverified").map((f) => f.id);
      const pendente = lerPendente(guardaDaAba(), naoVerificados);
      if (pendente) setEstado({ tipo: "configurando", ...pendente });
      else setEstado({ tipo: "sem-fator" });
    });
  }, []);

  /** Só roda a pedido da pessoa (botão): "Ativar" ou "Gerar novo QR". */
  async function comecar() {
    setErro(null);
    setSucesso(null);
    setOcupado(true);
    const supabase = createClient();
    if (!supabase) return setOcupado(false);
    // Fator antigo não concluído atrapalha um novo cadastro: limpa antes (e esquece o QR guardado).
    limparPendente(guardaDaAba());
    const { data: lista } = await supabase.auth.mfa.listFactors();
    for (const f of lista?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Viva Nomads ${new Date().toISOString().slice(0, 10)}` });
    setOcupado(false);
    if (error || !data) return setErro(mensagemErroMfa(error?.message ?? "enroll disabled"));
    const novo = { factorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
    gravarPendente(guardaDaAba(), novo);
    setCodigo("");
    setEstado({ tipo: "configurando", ...novo });
  }

  async function ativar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.tipo !== "configurando") return;
    setErro(null);
    setOcupado(true);
    const r = await conferir(estado.factorId, codigo, "ativar");
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    limparPendente(guardaDaAba());
    setCodigo("");
    setSucesso("Verificação em duas etapas ativada. A partir de agora o admin pede o código a cada login.");
    setEstado({ tipo: "ativo", factorId: estado.factorId });
    // Ao ativar, já entrega os 10 códigos de recuperação (mostrados uma vez).
    const g = await gerarCodigosRecuperacao();
    if (g.ok) {
      setCodigosNovos(g.codigos);
      setRestantes(g.codigos.length);
    } else {
      void atualizarRestantes();
    }
  }

  async function remover(e: React.FormEvent) {
    e.preventDefault();
    if (estado.tipo !== "ativo") return;
    setErro(null);
    setOcupado(true);
    // Só remove depois de provar o código ATUAL.
    const r = await conferir(estado.factorId, codigo);
    if (!r.ok) {
      setOcupado(false);
      return setErro(r.erro);
    }
    const supabase = createClient();
    const { error } = (await supabase?.auth.mfa.unenroll({ factorId: estado.factorId })) ?? { error: null };
    setOcupado(false);
    if (error) return setErro("Não foi possível remover agora. Tente de novo.");
    setCodigo("");
    setRemovendo(null);
    limparPendente(guardaDaAba());
    // Não cria fator novo sozinho: a pessoa decide se quer ativar de novo.
    setSucesso("Verificação em duas etapas removida.");
    setEstado({ tipo: "sem-fator" });
  }

  return (
    <Panel title="Verificação em duas etapas">
      {obrigatorio && estado.tipo !== "ativo" && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mt-1 h-4 w-4 shrink-0" /> Obrigatório para o admin. Ative abaixo para continuar.
        </p>
      )}
      {estado.tipo === "carregando" && (
        <SkeletonLinhas linhas={3} />
      )}
      {estado.tipo === "sem-fator" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Além da senha, você digita um código de 6 números do app autenticador (Google Authenticator, Authy…). Protege a conta mesmo se a senha vazar.
          </p>
          <Button onClick={comecar} disabled={ocupado}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Ativar duas etapas
          </Button>
        </div>
      )}
      {estado.tipo === "configurando" && (
        <form onSubmit={ativar} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted">
            <li>Abra o app autenticador e escolha “adicionar conta”.</li>
            <li>No computador, leia o QR code. No próprio celular, copie a chave ou toque em “Abrir no app autenticador”.</li>
            <li>Digite o código de 6 números que o app mostrar.</li>
          </ol>
          <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
            Apague a entrada antiga da Viva Nomads no seu app autenticador e escaneie este QR novo.
          </p>
          <div className="space-y-3 rounded-xl border border-sage-200 bg-sage-50 p-3">
            <p className="text-sm font-medium text-ink">Chave do autenticador</p>
            <code data-testid="chave-2fa" className="block break-all rounded-lg bg-white px-3 py-2 text-base tracking-wider text-ink">{agruparChave(estado.segredo)}</code>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => copiarChave(estado.segredo)}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado!" : "Copiar código"}
              </Button>
              {urlOtpauth(estado.segredo) && (
                <a href={urlOtpauth(estado.segredo) ?? undefined} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white px-4 text-sm font-medium text-forest sm:w-auto">
                  <Smartphone className="h-4 w-4" /> Abrir no app autenticador
                </a>
              )}
            </div>
          </div>
          <p className="text-sm text-muted">Está no computador? Leia o QR code:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG em data URL gerado pelo Supabase */}
          <img src={estado.qr} alt="QR code para o app autenticador" className="h-44 w-44 rounded-xl border border-sage-200 bg-white p-2" />
          <CampoCodigo id="codigo-ativar" valor={codigo} onChange={setCodigo} />
          <p className="text-xs text-muted">Se o código não confere, veja se o horário do celular está no automático.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar código e ativar
            </Button>
            <Button type="button" variant="ghost" onClick={comecar} disabled={ocupado}>Gerar novo QR</Button>
          </div>
        </form>
      )}
      {estado.tipo === "ativo" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-forest"><ShieldCheck className="h-4 w-4" /> Ativada neste usuário.</p>
          {sucesso && obrigatorio && (
            <a href={safeInternalPath(destino, "/admin")} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline">Continuar para o destino</a>
          )}
          {codigosNovos && <CodigosGerados codigos={codigosNovos} onFechar={() => setCodigosNovos(null)} />}
          <CodigosRecuperacaoBloco restantes={restantes} onNovos={(c) => { setCodigosNovos(c); setRestantes(c.length); }} />
          {!removendo ? (
            <Button variant="outline" className="min-h-11" onClick={() => { setRemovendo("confirmar"); setSucesso(null); setErro(null); }}>Remover verificação</Button>
          ) : removendo === "confirmar" ? (
            <div role="alertdialog" aria-label="Confirmar remoção" className="space-y-3 rounded-xl bg-amber-50 p-3">
              <p className="text-sm text-amber-900">Isso desliga a verificação em duas etapas. Continuar?</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setRemovendo("codigo")}>Continuar</Button>
                <Button type="button" variant="ghost" onClick={() => setRemovendo(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={remover} className="space-y-3">
              <p className="text-sm text-muted">Para remover, digite o código atual do app.</p>
              <CampoCodigo id="codigo-remover" valor={codigo} onChange={setCodigo} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="outline" disabled={ocupado}>
                  {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar remoção
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setRemovendo(null); setCodigo(""); setErro(null); }}>Cancelar</Button>
              </div>
            </form>
          )}
        </div>
      )}
      {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
      {sucesso && <p role="status" className="mt-3 text-sm text-forest">{sucesso}</p>}
    </Panel>
  );
}
