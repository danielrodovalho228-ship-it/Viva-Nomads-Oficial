"use client";

import { useState } from "react";
import { iniciais } from "@/lib/agentes/central";
import styles from "./central.module.css";

/** Foto do agente em public/agentes/<slug>.webp (256 px). Sem arquivo: hexágono com as iniciais. */
export const fotoDoAgente = (slug: string) => `/agentes/${slug}.webp`;

export function Hex({ nome, cor, tamanho = 44 }: { nome: string; cor: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill={cor} fillOpacity="0.16" stroke={cor} strokeWidth="4" />
      <text x="50" y="50" dominantBaseline="central" textAnchor="middle" fontSize="32" fontWeight="700" fill={cor}>
        {iniciais(nome)}
      </text>
    </svg>
  );
}

/**
 * Avatar hexagonal. `anel` = cor do status da última ronda (verde ok, âmbar
 * alerta, vermelho falhou); `recente` gira um anel quando a ronda é de agora.
 */
export function AvatarAgente({
  slug,
  nome,
  cor,
  anel,
  recente = false,
  tamanho = 52,
  semFoto = false,
}: {
  slug: string;
  nome: string;
  cor: string;
  anel?: string;
  recente?: boolean;
  tamanho?: number;
  semFoto?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const foto = !semFoto && !falhou;
  return (
    <span
      className={`${styles.avatar} ${recente ? styles.recente : ""} inline-block`}
      style={{ width: tamanho, height: tamanho, ["--anel" as string]: anel ?? cor }}
      aria-hidden
    >
      {anel && <span className={styles.anel} style={{ background: anel }} />}
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- 256 px local, sem otimização
        <img src={fotoDoAgente(slug)} alt="" width={tamanho} height={tamanho} loading="lazy" onError={() => setFalhou(true)} className={`${styles.hex} block h-full w-full bg-[#0B1638] object-cover`} />
      ) : (
        <span className={`${styles.hex} block h-full w-full bg-[#0B1638]`}>
          <Hex nome={nome} cor={cor} tamanho={tamanho} />
        </span>
      )}
    </span>
  );
}
