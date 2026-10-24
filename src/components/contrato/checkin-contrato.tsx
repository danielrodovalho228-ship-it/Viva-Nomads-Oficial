"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { salvarInstrucoesEntrada, type InstrucoesDoContrato } from "@/lib/data/checkin-actions";
import { LIMITE_INSTRUCOES, MSG_ABRIU_ACESSO, telefoneParaExibir } from "@/lib/checkin";

/**
 * Check-in garantido (ordem 404cd213, item 2). Proprietário: preenche horário, como pegar a chave/acesso e o
 * telefone de plantão. Inquilino: lê as instruções e, se não conseguir entrar, abre uma ordem URGENTE (4 h).
 */
export function CheckinContrato({
  contratoId,
  info,
  podeEditar,
  podeNaoConsegui,
}: {
  contratoId: string;
  info: InstrucoesDoContrato;
  podeEditar: boolean;
  podeNaoConsegui: boolean;
}) {
  const router = useRouter();
  const [horario, setHorario] = useState(info.dados?.horario ?? "");
  const [instrucoes, setInstrucoes] = useState(info.dados?.instrucoes ?? "");
  const [plantao, setPlantao] = useState(info.dados ? telefoneParaExibir(info.dados.plantao) : "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await salvarInstrucoesEntrada({ contratoId, horario, instrucoes, plantao });
      if (!r.ok) return setErro(r.error);
      setAviso("Instruções salvas. O morador as vê depois que as duas partes assinarem.");
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function naoConsegui() {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await abrirChamado({
        categoria: "acesso_imovel",
        mensagem: MSG_ABRIU_ACESSO,
        assunto: "Não consegui entrar no imóvel",
        contextoTipo: "contrato",
        contextoId: contratoId,
        contratoId,
        urgencia: "urgente",
      });
      if (!r.ok) return setErro(r.error);
      setAviso(`Abrimos um pedido URGENTE (${r.numero}). O proprietário e a equipe da Viva foram avisados; o proprietário tem até 4 horas para responder.`);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="checkin">
      {podeEditar && (
        <form onSubmit={salvar} className="space-y-3" data-testid="checkin-form">
          <p className="text-sm text-muted">
            Combine a entrada com antecedência: horário, como o morador pega a chave ou o acesso e um telefone de plantão para o dia. O morador só vê isto depois que as duas partes assinarem.
          </p>
          <label className="block text-sm font-medium text-ink">
            Horário de entrada
            <input type="time" required value={horario} onChange={(e) => setHorario(e.target.value)} className="mt-1 block h-11 w-full max-w-[10rem] rounded-xl border border-sage-200 bg-white px-3 text-sm text-ink" data-testid="checkin-horario" />
          </label>
          <label className="block text-sm font-medium text-ink">
            Como pegar a chave ou o acesso
            <textarea
              required
              minLength={10}
              maxLength={LIMITE_INSTRUCOES}
              rows={4}
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm text-ink"
              data-testid="checkin-instrucoes"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Telefone de plantão (com DDD)
            <input type="tel" inputMode="tel" required autoComplete="off" value={plantao} onChange={(e) => setPlantao(e.target.value)} className="mt-1 block h-11 w-full max-w-xs rounded-xl border border-sage-200 bg-white px-3 text-sm text-ink" data-testid="checkin-plantao" />
          </label>
          <Button type="submit" disabled={ocupado} data-testid="checkin-salvar">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Salvar instruções de entrada
          </Button>
        </form>
      )}

      {!podeEditar && info.dados && (
        <div className="rounded-xl bg-sage-50 p-4 text-sm text-ink" data-testid="checkin-instrucoes-lidas">
          <p className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4" aria-hidden /> Entrada às {info.dados.horario}
          </p>
          <p className="mt-2 whitespace-pre-line">{info.dados.instrucoes}</p>
          <p className="mt-2 flex items-center gap-2 text-muted">
            <PhoneCall className="h-4 w-4" aria-hidden /> Plantão do proprietário: <span className="font-medium text-ink">{telefoneParaExibir(info.dados.plantao)}</span>
          </p>
        </div>
      )}

      {!podeEditar && !info.dados && (
        <p className="text-sm text-muted" data-testid="checkin-pendente">
          O proprietário ainda não enviou as instruções de entrada. Se precisar, fale com ele pelas mensagens da plataforma.
        </p>
      )}

      {podeNaoConsegui && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4" data-testid="checkin-nao-consegui">
          <p className="text-sm text-ink">Chegou e não consegue entrar? Abra um pedido urgente: o proprietário e a equipe da Viva são avisados na hora.</p>
          <Button type="button" variant="outline" className="mt-3" disabled={ocupado} onClick={naoConsegui} data-testid="checkin-nao-consegui-botao">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Não consegui entrar
          </Button>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-sm text-red-700" data-testid="checkin-erro">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm text-forest" data-testid="checkin-aviso">
          {aviso}
        </p>
      )}
    </div>
  );
}
