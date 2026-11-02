"use client";

/*
  E399-C, pacote 1 — "Link do anúncio no Airbnb" no Passo 8 (cadastro e edição). Só com a chave PRECO_JUSTO_COMPARADOR.
  O dono cola o link e salva; o servidor guarda só o número do anúncio e confere cidade e quartos (trava antifraude).
  O link nunca aparece em público. Sem link = sem selo.
*/
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { meuLinkAirbnb, salvarLinkAirbnb, type MeuLinkAirbnb } from "@/lib/comparador-airbnb/link-actions";
import { TEXTO_DIVERGENCIA } from "@/lib/comparador-airbnb/antifraude";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { formatBRL } from "@/lib/utils";
import { DIAS_DADO_VALIDO } from "@/lib/comparador-airbnb/comparacao";

export function CampoLinkAirbnb({ imovelId }: { imovelId: string }) {
  const [salvo, setSalvo] = useState<MeuLinkAirbnb | null | undefined>(undefined);
  const [leituraFalhou, setLeituraFalhou] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    meuLinkAirbnb(imovelId)
      .then((l) => vivo && setSalvo(l))
      .catch(() => vivo && setLeituraFalhou(true));
    return () => {
      vivo = false;
    };
  }, [imovelId]);

  const salvar = (valor: string) =>
    iniciar(async () => {
      setErro(null);
      const r = await semQuedaDeRede(salvarLinkAirbnb(imovelId, valor));
      if (r.ok) {
        setSalvo(r.link);
        setTexto("");
      } else setErro(r.erro);
    });

  return (
    <div className="rounded-xl border border-line p-4" data-testid="campo-link-airbnb">
      <label className="block text-sm font-semibold text-ink" htmlFor="link-airbnb">
        Link do anúncio no Airbnb <span className="font-normal text-muted">(opcional)</span>
      </label>
      <p className="mt-1 text-xs text-muted">
        Se o imóvel também está no Airbnb, cole o link do anúncio. A Viva guarda só o número do anúncio, nunca mostra o link, e compara os preços para o selo &quot;Preço justo&quot;.
      </p>
      {leituraFalhou && (
        <p className="mt-2 text-xs text-amber-800" role="alert" data-testid="link-airbnb-falha">
          Não foi possível ler o link guardado agora.
        </p>
      )}
      {salvo?.airbnbId && (
        <div className="mt-2 text-sm" data-testid="link-airbnb-salvo" data-conferencia={salvo.conferencia ?? undefined}>
          <p className="text-ink">Anúncio nº {salvo.airbnbId} guardado.</p>
          {salvo.conferencia === "confere" && (
            <p className="mt-1 flex items-center gap-1 text-forest">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Cidade e quartos conferem com este imóvel.
            </p>
          )}
          {salvo.conferencia === "diverge" && (
            <div className="mt-1 text-red-700" data-testid="link-airbnb-diverge">
              {salvo.divergencias.map((d) => (
                <p key={d} className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {TEXTO_DIVERGENCIA[d]}
                </p>
              ))}
              <p className="mt-1 text-xs text-muted">Sem selo até o link ser deste imóvel. A equipe da Viva também foi avisada.</p>
            </div>
          )}
          {salvo.conferencia === "pendente" && <p className="mt-1 text-muted">Conferindo cidade e quartos.</p>}
          {/* Pacote 2: o resultado da comparação — o aviso de preço é só do dono, nunca público. */}
          {salvo.decisao && salvo.conferencia === "confere" && (
            <div className="mt-2" data-testid="preco-justo-resultado" data-estado={salvo.decisao.estado}>
              <p className="text-xs text-muted">Valores do Airbnb simulados enquanto a consulta real não está ligada.</p>
              {salvo.decisao.estado === "justo" && (
                <p className="mt-1 text-forest">Selo &quot;Preço justo&quot;: o total por mês aqui fica abaixo de 30 noites do mesmo imóvel no Airbnb.</p>
              )}
              {salvo.decisao.avisoDono && (
                <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-ink" data-testid="preco-justo-aviso-dono">
                  <p>
                    Sem o selo: no Airbnb, 30 noites deste imóvel saem por {formatBRL(salvo.decisao.avisoDono.valorAirbnb)}
                    {salvo.totalViva ? `; aqui, o total por mês é ${formatBRL(salvo.totalViva)}` : ""}.
                  </p>
                  <p className="mt-1 font-semibold">Para ganhar o selo, o total por mês precisa ficar até {formatBRL(salvo.decisao.avisoDono.ate)}.</p>
                  <p className="mt-1 text-xs text-muted">Só você vê este aviso.</p>
                </div>
              )}
              {salvo.decisao.estado === "suspenso" && <p className="mt-1 text-muted">Selo suspenso: a última consulta ao Airbnb tem mais de {DIAS_DADO_VALIDO} dias. A Viva consulta de novo toda semana.</p>}
              {salvo.decisao.estado === "sem_dado" && <p className="mt-1 text-muted">Ainda sem os preços do Airbnb para comparar (é preciso o valor mensal e 30 noites livres no calendário de lá).</p>}
            </div>
          )}
          <button type="button" className="mt-1 text-xs text-forest underline" disabled={pendente} onClick={() => salvar("")} data-testid="link-airbnb-remover">
            Tirar o link
          </button>
        </div>
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="link-airbnb"
          type="url"
          inputMode="url"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="airbnb.com.br/rooms/…"
          className="input"
          data-testid="link-airbnb"
        />
        <Button type="button" variant="secondary" disabled={pendente || !texto.trim()} onClick={() => salvar(texto)} data-testid="link-airbnb-salvar">
          {pendente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {salvo?.airbnbId ? "Trocar o link" : "Salvar o link"}
        </Button>
      </div>
      {erro && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600" role="alert" data-testid="link-airbnb-erro">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {erro}
        </p>
      )}
    </div>
  );
}
