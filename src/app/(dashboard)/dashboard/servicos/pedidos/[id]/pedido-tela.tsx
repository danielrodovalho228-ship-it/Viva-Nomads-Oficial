"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CampoReais } from "@/components/ui/campo-reais";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import {
  AVISO_RECUSAR_ORCAMENTO,
  AVISO_RECUSAR_PEDIDO,
  MOTIVO_RECUSA_MAX,
  proximoPasso,
  ROTULO_REGISTRO_SEM_DINHEIRO,
  rotuloStatus,
  TEXTO_CONTATO_ANTES_DO_ACEITE,
  TEXTO_DIVISAO_NA_ORIGEM,
  TEXTO_PAGAMENTO_INATIVO,
  telefoneNaTela,
  textoDivisaoParceiro,
} from "@/lib/parceiros/pedido";
import {
  enviarDocumentoParceiro,
  enviarEntrega,
  enviarMensagemDoPedido,
  linkArquivoDoPedido,
  type DetalhePedido,
} from "@/lib/parceiros/pedido-actions";

type Res = { ok: true } | { ok: false; erro: string };
type Rodar = (acao: string, campos?: Record<string, unknown>, ok?: string) => void;
const brl = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

export function PedidoParceiroTela({ d, pagamentoAtivo }: { d: DetalhePedido; pagamentoAtivo: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cliente = d.papel === "cliente";
  const parceiro = d.papel === "parceiro";

  // O aviso de sucesso atravessa o recarregamento da página (fica na sessão do navegador só até ser mostrado).
  const chaveAviso = `pedido-aviso:${d.id}`;
  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(chaveAviso);
      if (guardado) {
        sessionStorage.removeItem(chaveAviso);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura o aviso depois da hidratação
        setAviso(guardado);
      }
    } catch {
      /* sem armazenamento (aba privada): segue sem o aviso */
    }
  }, [chaveAviso]);

  // Os botões vão pela rota /api/parceiros/pedidos/<id>, com prazo, e recarregam a página: pela ação do servidor, o
  // laboratório mostrou "Enviar orçamento" sem nenhum POST quando a fila do roteador da página ficava presa (t250, 22/10).
  const rodar: Rodar = (acao, campos = {}, ok) =>
    iniciar(async () => {
      setErro(null);
      setAviso(null);
      const ctl = new AbortController();
      const prazo = setTimeout(() => ctl.abort(), 20_000);
      try {
        const resp = await fetch(`/api/parceiros/pedidos/${d.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao, ...campos }),
          signal: ctl.signal,
        });
        const r = (await resp.json().catch(() => null)) as Res | null;
        if (!r?.ok) {
          setErro(r && !r.ok ? r.erro : "Não deu certo agora. Tente de novo.");
          return;
        }
        try {
          if (ok) sessionStorage.setItem(chaveAviso, ok);
        } catch {
          /* sem armazenamento: recarrega sem o aviso */
        }
        window.location.reload();
      } catch {
        setErro("Sem resposta agora. Confira a conexão e tente de novo.");
      } finally {
        clearTimeout(prazo);
      }
    });

  const passo = proximoPasso(d.status, d.papel);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" data-testid="pedido-parceiro" data-status={d.status}>
      <div className="grid content-start gap-6">
        <Panel title="Andamento">
          <p className="text-base font-semibold text-ink" data-testid="pedido-status">
            {rotuloStatus(d.status)}
          </p>
          {passo && (
            <p className="mt-1 text-sm text-muted" data-testid="pedido-proximo-passo">
              {passo}
            </p>
          )}
          {d.status === "recusado" && d.motivoRecusa && (
            <p className="mt-2 text-sm text-ink" data-testid="pedido-motivo-recusa">
              Motivo: {d.motivoRecusa}
            </p>
          )}
          {/* L2-B item 17: recusado → o cliente pede a outro parceiro da mesma categoria. */}
          {cliente && d.status === "recusado" && (
            <ButtonLink href={d.linkOutroParceiro} variant="secondary" size="sm" className="mt-3" data-testid="pedido-outro-parceiro">
              Pedir a outro parceiro
            </ButtonLink>
          )}
          {/* Prompt 38: pedido gerado pela regra do imóvel. */}
          {d.automatico && (
            <p className="mt-2 text-sm text-muted" data-testid="pedido-automatico-info">
              {parceiro ? "Pedido automático do imóvel fixo." : "Gerado pela regra do imóvel (Parceiros do imóvel)."}
            </p>
          )}
          {cliente && d.aguardandoDono && d.status === "solicitado" && (
            <div className="mt-3 space-y-2" data-testid="pedido-aguardando-dono">
              <p className="text-sm text-ink">Confira o pedido. Ele só vai ao parceiro depois da sua confirmação.</p>
              <Button variant="primary" size="sm" disabled={pendente} onClick={() => rodar("confirmar-automatico", {}, "Pedido enviado ao parceiro.")} data-testid="pedido-confirmar-automatico">
                Confirmar e enviar
              </Button>
            </div>
          )}
          {cliente && d.semResposta && (
            <div className="mt-3 space-y-2" data-testid="pedido-sem-resposta">
              <p className="text-sm text-ink">O parceiro não respondeu em 24 horas.</p>
              <Button variant="secondary" size="sm" disabled={pendente} onClick={() => rodar("trocar-parceiro", {}, "Pedido enviado a outro parceiro.")} data-testid="pedido-trocar-parceiro">
                Trocar parceiro
              </Button>
            </div>
          )}
          {d.descricao && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{d.descricao}</p>}
          {d.imovel && (
            <p className="mt-3 text-sm text-muted" data-testid="pedido-imovel">
              {[d.imovel.titulo, d.imovel.bairro, d.imovel.cidade, d.imovel.areaM2 ? `${d.imovel.areaM2} m²` : null, d.imovel.quartos ? `${d.imovel.quartos} quarto(s)` : null].filter(Boolean).join(" · ")}
              {d.imovel.endereco ? (
                <span className="block text-ink" data-testid="pedido-endereco">
                  Endereço: {d.imovel.endereco}
                </span>
              ) : (
                parceiro && <span className="block">Endereço e nome completo aparecem depois do aceite do orçamento.</span>
              )}
            </p>
          )}
        </Panel>

        {/* L2-B item 16: depois do aceite, telefone e e-mail da outra parte; antes, a conversa segue pela plataforma. */}
        {!["recusado", "cancelado"].includes(d.status) && (
          <Panel title={cliente ? "Contato do parceiro" : "Contato do cliente"} data-testid="pedido-contato">
            {d.contato ? (
              <ul className="grid gap-1 text-sm text-ink">
                {d.contato.telefone && (
                  <li data-testid="pedido-contato-telefone">
                    Telefone: <a className="underline" href={`tel:+55${d.contato.telefone.replace(/^55(?=\d{10,11}$)/, "")}`}>{telefoneNaTela(d.contato.telefone)}</a>
                  </li>
                )}
                {d.contato.email && (
                  <li data-testid="pedido-contato-email">
                    E-mail: <a className="underline" href={`mailto:${d.contato.email}`}>{d.contato.email}</a>
                  </li>
                )}
                <li className="mt-1 text-muted">{TEXTO_PAGAMENTO_INATIVO}</li>
              </ul>
            ) : (
              <p className="text-sm text-muted" data-testid="pedido-contato-antes">
                {TEXTO_CONTATO_ANTES_DO_ACEITE}
              </p>
            )}
          </Panel>
        )}

        <Panel title="Horário">
          {/* E213-B: a estadia foi renovada depois do aceite — o parceiro confirma um horário novo ou recusa a nova data. */}
          {d.reagendamento && (
            <div className="mb-3 space-y-2" data-testid="pedido-reagendamento">
              <p className="text-sm text-ink">
                {parceiro
                  ? "A estadia foi renovada e a data mudou. Confirme um dos novos horários ou recuse a nova data. O valor combinado continua o mesmo."
                  : "A estadia foi renovada: o parceiro confirma a nova data. O valor combinado continua o mesmo."}
              </p>
              {parceiro && (
                <Button size="sm" variant="secondary" disabled={pendente} onClick={() => rodar("recusar-nova-data", {}, "Nova data recusada.")} data-testid="pedido-recusar-nova-data">
                  Recusar a nova data
                </Button>
              )}
            </div>
          )}
          {d.horarioConfirmado ? (
            <p className="text-sm font-semibold text-ink" data-testid="pedido-horario-confirmado">
              {dataHoraBRT(d.horarioConfirmado)}
            </p>
          ) : (
            <ul className="grid gap-2" data-testid="pedido-horarios">
              {d.horariosPropostos.map((h) => (
                <li key={h} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                  <span>{dataHoraBRT(h)}</span>
                  {parceiro && d.status === "aceito" && (
                    <Button size="sm" variant="secondary" disabled={pendente} onClick={() => rodar("confirmar-horario", { horario: h })} data-testid="pedido-confirmar-horario">
                      Confirmar este horário
                    </Button>
                  )}
                  {cliente && d.status === "aceito" && d.ultimoHorarioDoParceiro === h && (
                    <Button size="sm" variant="primary" disabled={pendente} onClick={() => rodar("confirmar-horario", { horario: h })} data-testid="pedido-confirmar-horario-proposto">
                      Confirmar o horário proposto
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {parceiro && d.status === "aceito" && <ProporHorario pendente={pendente} onPropor={(h) => rodar("propor-horario", { horario: h }, "Horário proposto ao cliente.")} />}
        </Panel>

        <Panel title="Valores e pagamento" data-testid="pedido-valores">
          {d.valores.combinado == null ? (
            <p className="text-sm text-muted">{parceiro ? "Envie o orçamento para o cliente decidir." : "O valor aparece aqui quando o parceiro enviar o orçamento."}</p>
          ) : (
            <>
              <p className="text-sm text-ink">
                Valor do serviço: <strong data-testid="pedido-valor">{brl(d.valores.combinado)}</strong>
              </p>
              {parceiro && d.valores.taxa == null && (
                <p className="mt-1 text-sm text-muted" data-testid="pedido-divisao-previa">
                  {textoDivisaoParceiro(d.valores.combinado)}
                </p>
              )}
              {d.valores.taxa != null && (
                <p className="mt-1 text-sm text-muted" data-testid="pedido-divisao">
                  Taxa de serviço da Viva (10%): {brl(d.valores.taxa)} · Parceiro recebe: {brl(d.valores.parceiro)}
                  {d.pagamentoStatus !== "pago" ? ` (${ROTULO_REGISTRO_SEM_DINHEIRO})` : ""}
                </p>
              )}
            </>
          )}
          {!pagamentoAtivo && (
            <p className="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink" data-testid="pedido-pagamento-inativo">
              {TEXTO_PAGAMENTO_INATIVO} {TEXTO_DIVISAO_NA_ORIGEM}
            </p>
          )}
          {d.pagamentoStatus === "simulado" && (
            <p className="mt-2 text-sm font-semibold text-ink" data-testid="pedido-pagamento-simulado">
              Pagamento simulado: divisão 90/10 registrada ({ROTULO_REGISTRO_SEM_DINHEIRO}).
            </p>
          )}
          {d.podeSimularPagamento && (
            <Button className="mt-3" variant="secondary" disabled={pendente} onClick={() => rodar("simular-pagamento")} data-testid="pedido-simular-pagamento">
              Simular pagamento
            </Button>
          )}
        </Panel>

        <Acoes d={d} pendente={pendente} rodar={rodar} />

        {(d.entregas.length > 0 || d.temDocumento || (parceiro && ["aceito", "agendado", "em_execucao", "entregue", "concluido"].includes(d.status))) && (
          <Panel title="Entrega e documento" data-testid="pedido-entrega">
            {d.entregas.length > 0 && (
              <ul className="grid gap-2">
                {d.entregas.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                    <span className="min-w-0 break-all">{e.legenda ?? "Arquivo"}</span>
                    <BaixarArquivo pedidoId={d.id} alvo={{ entregaId: e.id }} rotulo="Baixar" />
                  </li>
                ))}
              </ul>
            )}
            {d.temDocumento && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                <span>Nota ou recibo do parceiro</span>
                <BaixarArquivo pedidoId={d.id} alvo={{ documento: true }} rotulo="Baixar documento" />
              </div>
            )}
            {cliente && d.categoria === "fotografia" && d.ehDonoDoImovel && ["entregue", "concluido"].includes(d.status) && d.entregas.length > 0 && (
              <Button className="mt-3" variant="secondary" disabled={pendente} onClick={() => rodar("usar-fotos", {}, "Fotos acrescentadas ao anúncio.")} data-testid="pedido-usar-fotos">
                Usar estas fotos no anúncio
              </Button>
            )}
            {parceiro && ["em_execucao", "entregue"].includes(d.status) && (
              <EnviarArquivos pedidoId={d.id} campo="arquivos" multiplo rotulo="Enviar arquivos da entrega" testid="pedido-enviar-entrega" acao={enviarEntrega} onFeito={() => router.refresh()} />
            )}
            {parceiro && ["aceito", "agendado", "em_execucao", "entregue", "concluido"].includes(d.status) && (
              <EnviarArquivos pedidoId={d.id} campo="documento" rotulo="Anexar nota ou recibo" testid="pedido-enviar-documento" acao={enviarDocumentoParceiro} onFeito={() => router.refresh()} />
            )}
            <p className="mt-3 text-xs text-muted">O documento do serviço é do parceiro. A Viva não emite nota nem recibo deste serviço.</p>
          </Panel>
        )}

        {d.status === "concluido" && <Avaliacao d={d} pendente={pendente} rodar={rodar} />}

        {erro && (
          <p role="alert" className="text-sm font-semibold text-red-700" data-testid="pedido-erro">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="text-sm font-semibold text-forest" data-testid="pedido-aviso">
            {aviso}
          </p>
        )}
      </div>

      <Conversa d={d} />
    </div>
  );
}

function Acoes({ d, pendente, rodar }: { d: DetalhePedido; pendente: boolean; rodar: Rodar }) {
  const [valor, setValor] = useState<number | null>(d.valores.combinado);
  const [motivo, setMotivo] = useState("");
  const cliente = d.papel === "cliente";
  const parceiro = d.papel === "parceiro";
  const blocos: React.ReactNode[] = [];

  if (parceiro && ["solicitado", "orcado"].includes(d.status)) {
    blocos.push(
      <div key="orcar" className="grid gap-2" data-testid="pedido-orcar">
        <label className="text-sm font-semibold text-ink" htmlFor="pedido-valor-campo">
          Valor do serviço
        </label>
        <CampoReais id="pedido-valor-campo" value={valor} onChange={setValor} centavos />
        {valor ? <p className="text-sm text-muted">{textoDivisaoParceiro(valor)}</p> : null}
        <Button variant="primary" disabled={pendente || !valor} onClick={() => rodar("enviar-orcamento", { valor }, "Orçamento enviado.")} data-testid="pedido-enviar-orcamento">
          {d.status === "orcado" ? "Atualizar orçamento" : "Enviar orçamento"}
        </Button>
        <label className="mt-3 text-sm font-semibold text-ink" htmlFor="pedido-motivo">
          Não vai atender?
        </label>
        <input id="pedido-motivo" className={campo} maxLength={MOTIVO_RECUSA_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional), em poucas palavras" />
        <ConfirmarNaPagina aviso={AVISO_RECUSAR_PEDIDO} confirmar="Recusar o pedido" disabled={pendente} onConfirmar={() => rodar("recusar-pedido", { motivo })} testid="pedido-recusar">
          Recusar o pedido
        </ConfirmarNaPagina>
      </div>,
    );
  }
  if (cliente && d.status === "orcado") {
    blocos.push(
      <div key="decidir" className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={pendente} onClick={() => rodar("aceitar-orcamento", {}, "Orçamento aceito.")} data-testid="pedido-aceitar">
          Aceitar o orçamento
        </Button>
        <ConfirmarNaPagina aviso={AVISO_RECUSAR_ORCAMENTO} confirmar="Recusar o orçamento" disabled={pendente} onConfirmar={() => rodar("recusar-orcamento")} testid="pedido-recusar-orcamento">
          Recusar o orçamento
        </ConfirmarNaPagina>
      </div>,
    );
  }
  if (cliente && d.status === "solicitado") {
    blocos.push(
      <ConfirmarNaPagina key="cancelar" aviso="Cancelar este pedido?" confirmar="Cancelar o pedido" disabled={pendente} onConfirmar={() => rodar("cancelar")} testid="pedido-cancelar">
        Cancelar o pedido
      </ConfirmarNaPagina>,
    );
  }
  if (parceiro && d.status === "agendado") {
    blocos.push(
      <Button key="iniciar" variant="primary" disabled={pendente} onClick={() => rodar("iniciar")} data-testid="pedido-iniciar">
        Iniciar o serviço
      </Button>,
    );
  }
  if (parceiro && d.status === "em_execucao") {
    blocos.push(
      <Button key="entregar" variant="primary" disabled={pendente} onClick={() => rodar("marcar-entregue", {}, "Entrega marcada.")} data-testid="pedido-marcar-entregue">
        Marcar como entregue
      </Button>,
    );
  }
  if (cliente && d.status === "entregue") {
    blocos.push(
      <ConfirmarNaPagina key="concluir" aviso="Confirmar que o serviço foi concluído?" confirmar="Confirmar a conclusão" variant="primary" disabled={pendente} onConfirmar={() => rodar("concluir", {}, "Serviço concluído.")} testid="pedido-concluir">
        Confirmar a conclusão
      </ConfirmarNaPagina>,
    );
  }
  if (blocos.length === 0) return null;
  return (
    <Panel title="O que fazer agora" data-testid="pedido-acoes">
      <div className="grid gap-3">{blocos}</div>
    </Panel>
  );
}

function ProporHorario({ pendente, onPropor }: { pendente: boolean; onPropor: (iso: string) => void }) {
  const [quando, setQuando] = useState("");
  return (
    <div className="mt-4 grid gap-2">
      <label className="text-sm font-semibold text-ink" htmlFor="pedido-outro-horario">
        Nenhum serve? Proponha outro (horário de Brasília)
      </label>
      <input id="pedido-outro-horario" type="datetime-local" className={campo} value={quando} onChange={(e) => setQuando(e.target.value)} data-testid="pedido-outro-horario" />
      <Button variant="secondary" size="sm" disabled={pendente || !quando} onClick={() => onPropor(`${quando}:00-03:00`)} data-testid="pedido-propor-horario">
        Propor este horário
      </Button>
    </div>
  );
}

function BaixarArquivo({ pedidoId, alvo, rotulo }: { pedidoId: string; alvo: { entregaId: string } | { documento: true }; rotulo: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pendente}
        data-testid="pedido-baixar"
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await linkArquivoDoPedido(pedidoId, alvo);
            if (r.ok) window.location.assign(r.valor);
            else setErro(r.erro);
          })
        }
      >
        {rotulo}
      </Button>
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </span>
  );
}

function EnviarArquivos({
  pedidoId,
  campo: nome,
  multiplo,
  rotulo,
  testid,
  acao,
  onFeito,
}: {
  pedidoId: string;
  campo: string;
  multiplo?: boolean;
  rotulo: string;
  testid: string;
  acao: (f: FormData) => Promise<{ ok: true; valor: null } | { ok: false; erro: string }>;
  onFeito: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="mt-3 grid gap-2"
      data-testid={testid}
      action={(f) =>
        iniciar(async () => {
          setMsg(null);
          f.set("pedidoId", pedidoId);
          const r = await acao(f);
          if (r.ok) {
            setMsg("Enviado.");
            onFeito();
          } else setMsg(r.erro);
        })
      }
    >
      <label className="text-sm font-semibold text-ink">
        {rotulo}
        <input type="file" name={nome} multiple={multiplo} className="mt-1 block w-full text-sm" data-testid={`${testid}-arquivo`} />
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={pendente}>
        Enviar
      </Button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </form>
  );
}

function Avaliacao({ d, pendente, rodar }: { d: DetalhePedido; pendente: boolean; rodar: Rodar }) {
  const [nota, setNota] = useState(0);
  const [texto, setTexto] = useState("");
  return (
    <Panel title={d.papel === "cliente" ? "Avalie o serviço" : "Avalie o cliente"} data-testid="pedido-avaliacao">
      {d.minhaAvaliacao ? (
        <p className="text-sm text-ink" data-testid="pedido-avaliacao-enviada">
          Sua avaliação: {d.minhaAvaliacao.nota} de 5. {d.minhaAvaliacao.status === "publicada" ? "Publicada." : "Aparece quando as duas partes avaliarem (ou em 14 dias)."}
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Nota de 1 a 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} ativo={nota === n} onClick={() => setNota(n)} data-testid={`pedido-nota-${n}`}>
                {n}
              </Chip>
            ))}
          </div>
          <textarea className={campo} rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Conte como foi (opcional)" data-testid="pedido-avaliacao-texto" />
          <Button variant="primary" disabled={pendente || nota === 0} onClick={() => rodar("avaliar", { nota, texto }, "Avaliação enviada.")} data-testid="pedido-avaliar">
            Enviar avaliação
          </Button>
        </div>
      )}
      {d.avaliacaoDoOutro && (
        <p className="mt-3 text-sm text-muted" data-testid="pedido-avaliacao-outro">
          {d.papel === "cliente" ? "O parceiro" : "O cliente"} avaliou: {d.avaliacaoDoOutro.nota} de 5{d.avaliacaoDoOutro.texto ? ` — ${d.avaliacaoDoOutro.texto}` : ""}
        </p>
      )}
    </Panel>
  );
}

function Conversa({ d }: { d: DetalhePedido }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const encerrado = ["recusado", "cancelado"].includes(d.status);
  return (
    <Panel title="Mensagens do pedido" data-testid="pedido-conversa">
      <ul className="grid max-h-[28rem] gap-2 overflow-y-auto" data-testid="pedido-mensagens">
        {d.mensagens.map((m) => (
          <li key={m.id} className={m.minha ? "ml-6 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink" : "mr-6 rounded-xl border border-line px-3 py-2 text-sm text-ink"}>
            <span className="block whitespace-pre-wrap break-words">{m.texto}</span>
            <span className="mt-1 block text-xs text-muted">{dataHoraBRT(m.em)}</span>
          </li>
        ))}
      </ul>
      {!encerrado && (
        <form
          className="mt-3 grid gap-2"
          action={() =>
            iniciar(async () => {
              setAviso(null);
              const r = await enviarMensagemDoPedido(d.id, texto);
              if (!r.ok) setAviso(r.erro);
              else {
                setTexto("");
                if (r.valor.mascarado) setAviso("Contato pessoal não passa por aqui: combine tudo pela plataforma.");
                router.refresh();
              }
            })
          }
        >
          <textarea className={campo} rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva sua mensagem" data-testid="pedido-mensagem-texto" />
          <Button type="submit" variant="secondary" disabled={pendente || !texto.trim()} data-testid="pedido-mensagem-enviar">
            Enviar
          </Button>
          {aviso && <p className="text-xs text-muted" data-testid="pedido-mensagem-aviso">{aviso}</p>}
        </form>
      )}
    </Panel>
  );
}
