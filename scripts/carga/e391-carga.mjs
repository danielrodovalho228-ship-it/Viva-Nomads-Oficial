#!/usr/bin/env node
/*
  E391 (2) — carga: N usuários virtuais por M minutos contra um Preview. Ver docs/e391-carga.md.
  TRAVA: o Preview hoje usa o Supabase de PRODUÇÃO. O roteiro só roda com CONFIRMO_SUPABASE_SEPARADO=1
  (a pessoa afirma que o Preview aponta para um Supabase de carga) e nunca contra o domínio de produção.
  Sem dependências: Node 20+ (fetch nativo).
*/
import { readFileSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const USUARIOS = Number(process.env.USUARIOS ?? 200);
const MINUTOS = Number(process.env.MINUTOS ?? 10);
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 15_000); // tempo de leitura entre navegações
const PUBLICAS = ["/", "/buscar", "/pedidos/novo"];
const LOGADAS = ["/dashboard", "/dashboard/visitas", "/dashboard/conta"];

export function motivoParaNaoRodar(base, env) {
  if (!base) return "Defina BASE_URL (o endereço do Preview).";
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    return "BASE_URL inválida.";
  }
  if (/(^|\.)vivanomads\.com\.br$/.test(host)) return "Nunca contra o domínio de produção.";
  if (env.CONFIRMO_SUPABASE_SEPARADO !== "1")
    return "O Preview usa o Supabase de produção. Aponte o Preview para um Supabase de carga e rode com CONFIRMO_SUPABASE_SEPARADO=1.";
  return null;
}

export function percentil(ordenados, p) {
  if (!ordenados.length) return 0;
  const i = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, i)];
}

async function main() {
  const motivo = motivoParaNaoRodar(BASE, process.env);
  if (motivo) {
    console.error(`Não rodou: ${motivo}`);
    process.exit(2);
  }
  const sessoes = process.env.COOKIES_ARQUIVO
    ? readFileSync(process.env.COOKIES_ARQUIVO, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
    : [];
  const fim = Date.now() + MINUTOS * 60_000;
  const tempos = [];
  const status = new Map();
  let paraLogin = 0;

  async function usuario(n) {
    const cookie = sessoes.length ? sessoes[n % sessoes.length] : null;
    const rotas = cookie ? LOGADAS : PUBLICAS;
    await new Promise((r) => setTimeout(r, Math.random() * PAUSA_MS)); // rampa
    while (Date.now() < fim) {
      const rota = rotas[Math.floor(Math.random() * rotas.length)];
      const t0 = performance.now();
      let chave = "erro";
      try {
        const r = await fetch(BASE + rota, { redirect: "manual", headers: cookie ? { cookie } : {} });
        await r.arrayBuffer();
        chave = String(r.status);
        if (r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/auth")) paraLogin++;
      } catch {
        /* conta como erro */
      }
      tempos.push(performance.now() - t0);
      status.set(chave, (status.get(chave) ?? 0) + 1);
      await new Promise((r) => setTimeout(r, PAUSA_MS * (0.5 + Math.random())));
    }
  }

  console.log(`Carga: ${USUARIOS} usuários, ${MINUTOS} min, ${sessoes.length ? "logados" : "só telas públicas"} → ${BASE}`);
  await Promise.all(Array.from({ length: USUARIOS }, (_, i) => usuario(i)));
  const ord = tempos.sort((a, b) => a - b);
  console.log(`Pedidos: ${ord.length}`);
  console.log(`p50 ${percentil(ord, 50).toFixed(0)} ms · p95 ${percentil(ord, 95).toFixed(0)} ms · p99 ${percentil(ord, 99).toFixed(0)} ms`);
  console.log(`Status: ${[...status].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`Mandados ao login (sessão perdida): ${paraLogin}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
