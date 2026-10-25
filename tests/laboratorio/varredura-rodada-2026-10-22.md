# Varredura t249 — rodada de 22/10 (main com 26 telas)

Fontes:
- **Lab-crítico do #1023** (job 119783262445, 11h15–11h20 UTC): main `abb6d2a` com #1016, #1021, #1022 e a correção do D-V6/D-V7. Log completo do Playwright no job.
- **Laboratório da main** (run 39752316743, `78fee96`, terminou 11h14): suíte inteira, 1.403 aprovados, 29 falhas, 244 pulados. Registro em `lab_execucoes`; o artefato não abre na sessão da Pista C (proxy).

## Resultado da t249 (lab-crítico do #1023)

| Teste | Resultado | Classificação |
|---|---|---|
| D-V1 · imagens do anúncio de 17 fotos | Passou | Conhecido, corrigido |
| D-V2 · barra "Fotos: 0 de 8" a 390 px | Passou | Conhecido, corrigido (sob vigilância) |
| D-V3 · "Enviar documento" (trava da matrícula) | Falhou como esperado | Conhecido, aberto (A) |
| D-V4 · miniaturas de Meus imóveis | Passou | Conhecido, corrigido (sob vigilância) |
| D-V5 · "publicado" e "falta para publicar" juntos | Falhou como esperado | Conhecido, aberto (A) |
| D-V6 · imagens de Minhas locações | Passou | Conhecido, regra nova sem capa (Prompt 42) |
| D-V7 · rascunho com link para a página pública | Falhou como esperado | Novo hoje, aberto (A) |
| Varrer a 1280 px | Falhou (2 achados) | Ver abaixo |
| Varrer a 390 px | Falhou (3 achados) | Ver abaixo |

## Achados da varredura geral

| Tela | Tamanho | Critério | Evidência | Classificação |
|---|---|---|---|---|
| Entrar (`/auth`) | 390 e 1280 | c (abertura) | "sem `<main>` em 20 s": a página monta só uma `<div>` em grade | **Novo, produto (D-V8, A)**: falta o marco principal para leitor de tela. Entra como `test.fail` e combinação anotada |
| Pedido de moradia (`/pedidos/novo`) | 390 e 1280 | d | `fetch GET /api/conta/local-trabalho` cancelado (`net::ERR_ABORTED`) | Laboratório: leitura do próprio site cancelada pela tela. Sai do critério d e vai para a lista de exceções |
| Painel do inquilino (`/dashboard`) | 390 | d | `fetch GET /api/painel/contadores` cancelado | Laboratório: o painel aborta essa leitura de propósito ao trocar de tela (`AbortController`, #1014). Mesma regra |

Imagens que não carregam: nenhuma na rodada do #1023 (a foto fictícia saiu com o #1016). Sobreposição (b): nenhuma. Clique sem resposta (f): nenhum.

## Main `78fee96` (antes do #1016, #1021, #1022 e #1023)

| Falha | Classificação |
|---|---|
| t249 · D-V6 "nenhuma imagem de capa" | Teste desatualizado pelo Prompt 42: corrigido no #1023 |
| t249 · Buscar @390, 400 em `/_next/image` | Foto fictícia: corrigida no #1016 |
| t192 · Tributação a 390 px | **Novo, teste**: o #1014 pôs a Tributação no menu lateral; `.first()` pegava o link do menu, escondido a 390 px. Corrigido no #1023 (procura dentro do `<main>`) |
| t248 · "Enviado para conferência" a 390 px | A investigar: falha intermitente desde 21/10 (5 execuções). Sem print (artefato bloqueado) |
| t245 (20), t263 (5) | Linha de base visual: A + Muse |
| t155, t184, t250, t255 F18, t256 | Instáveis (passaram no retry); F18 segue como L-1 |
| t251 e t259 | **Não falharam mais** (#1007, #1010, #1011) |

## Catraca

Depois do #1023, a t249 não tem falha nova em relação à main: tudo que falhou ou tem código D-V ou foi corrigido no próprio PR.
