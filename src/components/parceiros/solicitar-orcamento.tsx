"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, ButtonLink } from "@/components/ui/button";
import { DESCRICAO_PEDIDO_MAX, HORARIOS_MAX } from "@/lib/parceiros/pedido";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { meusImoveisParaServico, solicitarOrcamento } from "@/lib/parceiros/pedido-actions";

const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

export interface ServicoDoParceiro {
  id: string;
  titulo: string;
  categoria: string;
}

/**
 * "Solicitar orçamento" (Prompt 31b, item 2): folha com o serviço, a descrição (até 1000), o imóvel (obrigatório
 * quando vem do passo de fotos do cadastro) e até 3 horários dentro da agenda do parceiro. Sem login, leva à entrada
 * e volta para a mesma página. O 4º pedido aberto na mesma categoria mostra o texto do teto.
 */
export function SolicitarOrcamento({
  parceiroId,
  nomeParceiro,
  categorias,
  servicos,
  logado,
  voltarPara,
  imovelInicial,
  doCadastroDoImovel,
}: {
  parceiroId: string;
  nomeParceiro: string;
  categorias: string[];
  servicos: ServicoDoParceiro[];
  logado: boolean;
  voltarPara: string;
  imovelInicial?: string | null;
  doCadastroDoImovel?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [imoveis, setImoveis] = useState<{ id: string; titulo: string }[] | null>(null);
  const [servicoId, setServicoId] = useState<string>(servicos[0]?.id ?? "");
  const [categoria, setCategoria] = useState<string>(servicos[0]?.categoria ?? categorias[0] ?? "outro");
  const [descricao, setDescricao] = useState("");
  const [imovel, setImovel] = useState<string>(imovelInicial ?? "");
  const [horarios, setHorarios] = useState<string[]>([""]);

  if (!logado) {
    return (
      <ButtonLink href={`/auth?redirect=${encodeURIComponent(voltarPara)}`} variant="primary" data-testid="solicitar-orcamento">
        Solicitar orçamento
      </ButtonLink>
    );
  }

  const abrir = () => {
    setAberto(true);
    if (!imoveis) void meusImoveisParaServico().then(setImoveis);
  };

  const enviar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await solicitarOrcamento({
        parceiroId,
        servicoId: servicoId || null,
        categoria,
        descricao,
        propertyId: imovel || null,
        horarios: horarios.filter(Boolean).map((h) => `${h}:00-03:00`),
        doCadastroDoImovel,
      });
      if (!r.ok) setErro(r.erro);
      else router.push(`/dashboard/servicos/pedidos/${r.valor.id}`);
    });

  return (
    <>
      <Button variant="primary" onClick={abrir} data-testid="solicitar-orcamento">
        Solicitar orçamento
      </Button>
      <BottomSheet
        open={aberto}
        onClose={() => setAberto(false)}
        title={`Orçamento com ${nomeParceiro}`}
        testId="solicitar-orcamento-folha"
        lateral
        footer={
          <Button variant="primary" className="w-full" disabled={pendente || descricao.trim().length < 10 || !horarios.some(Boolean)} onClick={enviar} data-testid="solicitar-orcamento-enviar">
            Enviar pedido
          </Button>
        }
      >
        <div className="grid gap-4">
          {servicos.length > 0 ? (
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Serviço
              <select
                className={campo}
                value={servicoId}
                onChange={(e) => {
                  setServicoId(e.target.value);
                  const s = servicos.find((x) => x.id === e.target.value);
                  if (s) setCategoria(s.categoria);
                }}
                data-testid="solicitar-orcamento-servico"
              >
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo} · {rotuloCategoria(s.categoria)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Categoria
              <select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)} data-testid="solicitar-orcamento-categoria">
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {rotuloCategoria(c)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1 text-sm font-semibold text-ink">
            O que você precisa
            <textarea className={campo} rows={4} maxLength={DESCRICAO_PEDIDO_MAX} value={descricao} onChange={(e) => setDescricao(e.target.value)} data-testid="solicitar-orcamento-descricao" />
            <span className="text-xs font-normal text-muted">
              {descricao.length}/{DESCRICAO_PEDIDO_MAX}. Contato pessoal não vai aqui: vocês combinam tudo pelas mensagens da Viva.
            </span>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-ink">
            Imóvel {doCadastroDoImovel && categoria === "fotografia" ? "" : "(opcional)"}
            <select className={campo} value={imovel} onChange={(e) => setImovel(e.target.value)} data-testid="solicitar-orcamento-imovel">
              <option value="">{imoveis === null ? "Carregando…" : "Sem imóvel"}</option>
              {(imoveis ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.titulo}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-muted">Antes do aceite, o parceiro vê só o bairro, o tamanho do imóvel e a data.</span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-ink">Até {HORARIOS_MAX} horários que servem para você (horário de Brasília)</legend>
            {horarios.map((h, i) => (
              <input
                key={i}
                type="datetime-local"
                className={campo}
                value={h}
                onChange={(e) => setHorarios((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                data-testid={`solicitar-orcamento-horario-${i}`}
              />
            ))}
            {horarios.length < HORARIOS_MAX && (
              <Button variant="tertiary" size="sm" onClick={() => setHorarios((l) => [...l, ""])} data-testid="solicitar-orcamento-mais-horario">
                Sugerir outro horário
              </Button>
            )}
          </fieldset>

          {erro && (
            <p role="alert" className="text-sm font-semibold text-red-700" data-testid="solicitar-orcamento-erro">
              {erro}
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
