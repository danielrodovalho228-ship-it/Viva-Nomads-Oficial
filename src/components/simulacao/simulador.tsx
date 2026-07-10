"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Printer } from "lucide-react";
import styles from "./simulacao.module.css";
import {
  PREMISSAS_PADRAO,
  VOLUMES_PADRAO,
  PROJECAO_PADRAO,
  DESTAQUE_RATIO,
  calcularMes,
  calcularProjecao,
} from "@/lib/simulacao/model";
import type { Premissas, Volumes, ProjecaoParams } from "@/lib/simulacao/model";
import { KpiBar } from "./kpi-bar";
import { ReceitaPorFonte } from "./receita-por-fonte";
import { ComposicaoBar } from "./composicao-bar";
import { ProjecaoCharts } from "./projecao-charts";
import { CenarioCards } from "./cenario-cards";
import { Metodologia } from "./metodologia";
import { AvisoLegal } from "./aviso-legal";

type NumFieldCfg<T> = { key: keyof T; label: string; min: number; max?: number; step: number };

const PREMISSAS_FIELDS: NumFieldCfg<Premissas>[] = [
  { key: "aluguel", label: "Aluguel médio / mês (R$)", min: 0, step: 50 },
  { key: "duracao", label: "Duração média da estadia (meses)", min: 1, step: 1 },
  { key: "comissaoPct", label: "Comissão sobre o 1º mês (%)", min: 0, step: 0.5 },
  { key: "mensalidadePlano", label: "Mensalidade do plano pago (R$)", min: 0, step: 1 },
  { key: "repasseServico", label: "Repasse de serviço / contrato (R$)", min: 0, step: 1 },
  { key: "comissaoGarantia", label: "Comissão de garantia locatícia / contrato (R$)", min: 0, step: 1 },
  { key: "comissaoSeguro", label: "Comissão de seguro incêndio / contrato (R$)", min: 0, step: 1 },
  { key: "receitaDestaque", label: "Receita de destaque/anúncio / contrato (R$)", min: 0, step: 1 },
  { key: "custoFixo", label: "Custo FIXO mensal (R$)", min: 0, step: 100 },
  { key: "custoVariavel", label: "Custo VARIÁVEL / contrato (R$)", min: 0, step: 10 },
];

const VOLUME_SLIDERS: { key: keyof Volumes; label: string; min: number; max: number }[] = [
  { key: "alugueisMes", label: "Aluguéis fechados no mês", min: 0, max: 100 },
  { key: "basePlanos", label: "Base acumulada de planos pagos", min: 0, max: 800 },
  { key: "contratosDestaque", label: "Contratos com destaque/anúncio no mês", min: 0, max: 100 },
];

const PROJECAO_FIELDS: NumFieldCfg<ProjecaoParams>[] = [
  { key: "horizonte", label: "Horizonte (meses)", min: 1, max: 60, step: 1 },
  { key: "novosBase", label: "Novos aluguéis / mês (base)", min: 0, step: 1 },
  { key: "crescimento", label: "Crescimento mensal dos fechamentos (%)", min: 0, step: 1 },
  { key: "conversao", label: "Conversão em plano pago (%)", min: 0, max: 100, step: 1 },
  { key: "churn", label: "Churn mensal da base (%)", min: 0, max: 100, step: 1 },
  { key: "baseInicial", label: "Base inicial de planos", min: 0, step: 1 },
];

export function Simulador() {
  const [premissas, setPremissas] = useState<Premissas>(PREMISSAS_PADRAO);
  const [volumes, setVolumes] = useState<Volumes>(VOLUMES_PADRAO);
  const [proj, setProj] = useState<ProjecaoParams>(PROJECAO_PADRAO);
  const [cenarioAtivo, setCenarioAtivo] = useState<string | null>(null);

  const mes = useMemo(() => calcularMes(premissas, volumes), [premissas, volumes]);
  const projecao = useMemo(() => calcularProjecao(premissas, proj), [premissas, proj]);

  function setPremissa(key: keyof Premissas, value: number) {
    setPremissas((p) => ({ ...p, [key]: value }));
  }
  function setVolume(key: keyof Volumes, value: number) {
    setVolumes((v) => ({ ...v, [key]: value }));
    setCenarioAtivo(null); // edição manual desfaz o preset ativo
  }
  function setProjParam(key: keyof ProjecaoParams, value: number) {
    setProj((p) => ({ ...p, [key]: value }));
  }

  function aplicarCenario(c: { nome: string; alugueisMes: number; basePlanos: number }) {
    setVolumes({
      alugueisMes: c.alugueisMes,
      basePlanos: c.basePlanos,
      contratosDestaque: Math.round(c.alugueisMes * DESTAQUE_RATIO),
    });
    setCenarioAtivo(c.nome);
  }

  function reset() {
    setPremissas(PREMISSAS_PADRAO);
    setVolumes(VOLUMES_PADRAO);
    setProj(PROJECAO_PADRAO);
    setCenarioAtivo(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={`${styles.topbar} ${styles.noprint}`}>
          <a className={styles.brand} href="/home">
            <span className={styles.v}>Viva</span>
            <span className={styles.n}>Nomads</span>
          </a>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={reset}>
              <RotateCcw size={15} /> Valores de exemplo
            </button>
            <button type="button" className={styles.btn} onClick={() => window.print()}>
              <Printer size={15} /> Imprimir / PDF
            </button>
          </div>
        </div>

        <h1 className={styles.h1}>Simulação do negócio — documento interno dos sócios</h1>
        <p className={styles.sub}>
          Modelo ilustrativo das fontes de receita da plataforma (uso interno dos sócios, não é a
          ferramenta do proprietário). Edite as premissas e os volumes — tudo recalcula na hora.
        </p>

        <KpiBar r={mes} />

        <div className={styles.cols}>
          {/* Coluna de entradas */}
          <div>
            <div className={styles.card}>
              <h2>Premissas (por contrato)</h2>
              <p className={styles.cardHelp}>Parâmetros do modelo — o que a plataforma cobra e gasta.</p>
              <div className={styles.grid}>
                {PREMISSAS_FIELDS.map((f) => (
                  <NumberField
                    key={f.key as string}
                    label={f.label}
                    value={premissas[f.key]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onChange={(v) => setPremissa(f.key, v)}
                  />
                ))}
              </div>
              <p className={styles.cardHelp} style={{ marginTop: 10, marginBottom: 0 }}>
                Custo do mês = fixo + variável × aluguéis fechados. Assim o ROI fica realista quando o
                volume cresce.
              </p>
            </div>

            <div className={styles.card}>
              <h2>Volumes do mês</h2>
              <p className={styles.cardHelp}>Quantos contratos e planos no mês simulado.</p>
              {VOLUME_SLIDERS.map((s) => (
                <SliderField
                  key={s.key}
                  label={s.label}
                  value={volumes[s.key]}
                  min={s.min}
                  max={s.max}
                  onChange={(v) => setVolume(s.key, v)}
                />
              ))}
            </div>

            <div className={styles.card}>
              <h2>Projeção no tempo (parâmetros)</h2>
              <p className={styles.cardHelp}>Como o negócio evolui mês a mês.</p>
              <div className={styles.grid}>
                {PROJECAO_FIELDS.map((f) => (
                  <NumberField
                    key={f.key as string}
                    label={f.label}
                    value={proj[f.key]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onChange={(v) => setProjParam(f.key, v)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Coluna de resultados */}
          <div>
            <ReceitaPorFonte r={mes} />
            <ComposicaoBar r={mes} />
            <ProjecaoCharts proj={projecao} />
            <CenarioCards premissas={premissas} ativo={cenarioAtivo} onSelect={aplicarCenario} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Metodologia />
          <AvisoLegal />
        </div>

        <footer className={styles.footer}>
          Números ilustrativos. Não constituem promessa de resultado.
        </footer>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.slider}>
      <div className={styles.top}>
        <span className={styles.lbl}>{label}</span>
        <span className={styles.val}>{value.toLocaleString("pt-BR")}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        aria-valuenow={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}
