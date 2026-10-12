"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { codigoTotpValido, mensagemErroMfa, tentativasRestantes } from "@/lib/admin/mfa";
import { safeInternalPath } from "@/lib/safe-redirect";

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
async function conferir(factorId: string, bruto: string): Promise<{ ok: true } | { ok: false; erro: string }> {
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
    return { ok: false, erro: mensagemErroMfa(error.message) };
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

  return (
    <form onSubmit={enviar} className="mt-6 space-y-4 text-left">
      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : (
        <>
          <CampoCodigo id="codigo-2fa" valor={codigo} onChange={setCodigo} />
          {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" disabled={enviando || !factorId}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Confirmar e entrar
          </Button>
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
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      queueMicrotask(() => setEstado({ tipo: "sem-fator" }));
      return;
    }
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const ativo = data?.totp?.[0];
      setEstado(ativo ? { tipo: "ativo", factorId: ativo.id } : { tipo: "sem-fator" });
    });
  }, []);

  async function comecar() {
    setErro(null);
    setSucesso(null);
    setOcupado(true);
    const supabase = createClient();
    if (!supabase) return setOcupado(false);
    // Fatores antigos não concluídos atrapalham um novo cadastro: limpa antes.
    const { data: lista } = await supabase.auth.mfa.listFactors();
    for (const f of lista?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Viva Nomads ${new Date().toISOString().slice(0, 10)}` });
    setOcupado(false);
    if (error || !data) return setErro(mensagemErroMfa(error?.message ?? "enroll disabled"));
    setEstado({ tipo: "configurando", factorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }

  async function ativar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.tipo !== "configurando") return;
    setErro(null);
    setOcupado(true);
    const r = await conferir(estado.factorId, codigo);
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    setCodigo("");
    setSucesso("Verificação em duas etapas ativada. A partir de agora o admin pede o código a cada login.");
    setEstado({ tipo: "ativo", factorId: estado.factorId });
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
    setRemovendo(false);
    setSucesso("Verificação em duas etapas removida.");
    setEstado({ tipo: "sem-fator" });
  }

  return (
    <Panel title="Verificação em duas etapas">
      {obrigatorio && estado.tipo !== "ativo" && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> Obrigatório para o admin. Ative abaixo para continuar.
        </p>
      )}
      {estado.tipo === "carregando" && (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      )}
      {estado.tipo === "sem-fator" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Além da senha, você digita um código de 6 números do app autenticador (Google Authenticator, Authy…). Protege a conta mesmo se a senha vazar.
          </p>
          <Button onClick={comecar} disabled={ocupado}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Ativar verificação em duas etapas
          </Button>
        </div>
      )}
      {estado.tipo === "configurando" && (
        <form onSubmit={ativar} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Abra o app autenticador e escolha “adicionar conta”.</li>
            <li>Leia o QR code abaixo (ou digite a chave manual).</li>
            <li>Digite o código de 6 números que o app mostrar.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG em data URL gerado pelo Supabase */}
          <img src={estado.qr} alt="QR code para o app autenticador" className="h-44 w-44 rounded-xl border border-sage-200 bg-white p-2" />
          <p className="text-sm text-muted">
            Chave manual: <code className="break-all rounded bg-sage-50 px-1.5 py-0.5 text-ink">{estado.segredo}</code>
          </p>
          <CampoCodigo id="codigo-ativar" valor={codigo} onChange={setCodigo} />
          <Button type="submit" disabled={ocupado}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar código e ativar
          </Button>
        </form>
      )}
      {estado.tipo === "ativo" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-forest"><ShieldCheck className="h-4 w-4" /> Ativada neste usuário.</p>
          {sucesso && obrigatorio && (
            <a href={safeInternalPath(destino, "/admin")} className="inline-block text-sm font-medium text-forest underline">Continuar para o destino</a>
          )}
          {!removendo ? (
            <Button variant="outline" onClick={() => { setRemovendo(true); setSucesso(null); }}>Remover verificação</Button>
          ) : (
            <form onSubmit={remover} className="space-y-3">
              <p className="text-sm text-muted">Para remover, digite o código atual do app.</p>
              <CampoCodigo id="codigo-remover" valor={codigo} onChange={setCodigo} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="outline" disabled={ocupado}>
                  {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar remoção
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setRemovendo(false); setCodigo(""); setErro(null); }}>Cancelar</Button>
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
