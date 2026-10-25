"use client";

import { useEffect, useState } from "react";
import { BlocoOpcional } from "@/components/ui/bloco-opcional";
import { textosToggle, toggleInicial } from "@/lib/ui/bloco-opcional";
import { Button } from "@/components/ui/button";
import { REDES_USUARIO_ATIVO } from "@/lib/flags";
import { minhasRedes, salvarMinhasRedes, type MinhasRedes } from "@/lib/linkedin/actions";

/**
 * 63-B (decisão do Daniel, 23/10): Instagram, Facebook e TikTok da própria pessoa, opcionais e PRIVADOS — só a pessoa e
 * a equipe veem; nunca aparecem para outro usuário (nem depois do contrato). Com REDES_USUARIO_ATIVO desligada, nada aparece.
 */
export function RedesPrivadas() {
  const [redes, setRedes] = useState<MinhasRedes | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  // C9/E56: atrás do toggle; com alguma rede salva nasce ligado.
  const [ligado, setLigado] = useState(false);
  const [temSalvo, setTemSalvo] = useState(false);
  useEffect(() => {
    if (!REDES_USUARIO_ATIVO) return;
    let vivo = true;
    minhasRedes()
      .then((r) => {
        if (!vivo) return;
        setRedes(r);
        const tem = !!r && Object.values(r).some((v) => String(v ?? "").trim());
        setTemSalvo(tem);
        setLigado(toggleInicial(tem));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  if (!REDES_USUARIO_ATIVO || !redes) return null;
  const campo = (chave: keyof MinhasRedes, rotulo: string, exemplo: string) => (
    <label className="block text-sm font-medium text-ink">
      {rotulo}
      <input
        value={redes[chave]}
        onChange={(e) => setRedes({ ...redes, [chave]: e.target.value })}
        placeholder={exemplo}
        inputMode="url"
        className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-white px-3 text-base font-normal text-ink"
        data-testid={`rede-${chave}`}
      />
    </label>
  );
  const t = textosToggle("redes");
  return (
    <div className="mt-4" data-testid="redes-privadas">
      <BlocoOpcional
        pergunta={t.pergunta}
        ligado={ligado}
        onLigado={setLigado}
        temDados={temSalvo}
        textoConfirmar={t.confirmar}
        onLimpar={async () => {
          const vazio = Object.fromEntries(Object.keys(redes).map((k) => [k, ""])) as unknown as MinhasRedes;
          const r = await salvarMinhasRedes(vazio);
          if (r.ok) {
            setRedes(vazio);
            setTemSalvo(false);
          }
          return r.ok;
        }}
        testId="redes-toggle-bloco"
      >
      <div className="space-y-3">
      <p className="text-sm text-muted">Redes sociais (opcional). Só você e a equipe da Viva veem; não aparecem para mais ninguém.</p>
      {campo("instagram", "Instagram", "https://instagram.com/seu-perfil")}
      {campo("facebook", "Facebook", "https://facebook.com/seu-perfil")}
      {campo("tiktok", "TikTok", "https://tiktok.com/@seu-perfil")}
      {msg && (
        <p role="status" className={msg.ok ? "text-sm text-forest" : "text-sm text-red-700"}>
          {msg.texto}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={salvando}
        onClick={() => {
          setSalvando(true);
          void salvarMinhasRedes(redes)
            .then((r) => {
              setMsg(r.ok ? { ok: true, texto: "Redes salvas." } : { ok: false, texto: r.erro ?? "Não foi possível salvar." });
              if (r.ok) setTemSalvo(Object.values(redes).some((v) => String(v ?? "").trim()));
            })
            .finally(() => setSalvando(false));
        }}
      >
        Salvar redes
      </Button>
      </div>
      </BlocoOpcional>
    </div>
  );
}
