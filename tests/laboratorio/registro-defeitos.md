# Registro de defeitos novos do laboratório

Um registro por defeito novo achado na triagem contínua (Pista C). Defeito conhecido da varredura usa o código D-V da t249; aqui entram os demais, com código L-n. Fonte: `lab_execucoes` (só o primeiro achado de cada teste; o artefato não abre na sessão da Pista C).

| Código | Aberto em | Spec · cenário | Página / papel | Evidência (execução) | Classificação | Dono | Situação |
|---|---|---|---|---|---|---|---|
| L-1 | 22/10 | t255 · F18 "filtrar o funil por cidade só estreita, nunca soma" (390 px) | /admin, funil de pedidos · admin | Etapa 1 em Uberlândia deu 88 com o máximo esperado de 37 ([39744748029](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/39744748029), `1a3e04f`). Repete em quase toda execução desde 21/10, completas e "metade" | Produto | A | Aberto |
| L-2 | 22/10 | t28 · "só parte avalia, uma vez, em 14 dias; às cegas; moderação" | Avaliação da estadia · inquilino e dono | O texto da avaliação ("Imóvel impecável T28 …") não aparece em 2 s ([39744748029](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/39744748029)). Em 3 execuções completas: 02h42, 07h23, 09h58 | Teste, por hipótese (espera curta após a página nova do Prompt 41) | C | Ajuste no #1019; se seguir falhando, vira produto da Pista A |
| L-3 | 22/10 | t249 · varrer a 1280 e a 390 px, critério d | Painel (3 papéis) e Painel do parceiro (`/dashboard`, `/dashboard/parceiro`) | `script GET net::ERR_ABORTED` em `/_next/static/chunks/…` às 07h23 (passou no retry) e às 09h58 | Laboratório (régua do d) | C | Ajuste no #1021: arquivo de `/_next/static` cancelado não conta (opção recomendada) |
| L-4 | 22/10 | t263 · visual-41 (01, 02, 03 e 06) | Página do imóvel inteira; barras inferiores de inquilino e dono; cogumelo da estadia | Diferença de pixels contra a linha de base em toda execução desde 02h42 (página do imóvel com 97 a 144 px a mais de altura) | Alarme de baseline (spec nova) | A + Muse | Aberto |
| L-5 | 22/10 | Suíte inteira | — | Execuções de 05h07 (622 pulados) e 06h17 (782) bateram no teto de 65 min com poucas falhas; a suíte passou de ~1.600 testes | Laboratório (capacidade) | C, com OK do Muse para mexer no workflow | Aberto |
| L-6 | 22/10 | t248 · "Qualificação do rascunho abre o checklist" (390 px) | /qualificar · dono | "Enviado para conferência" não aparece depois de enviar a matrícula; falhou em 21/10 02h02 e 12h19, 22/10 11h14; instável às 06h17 e 08h41 | A investigar (pode ser a trava do D-V3) | C | Aberto |

## Lista priorizada para as pistas A e B

Só defeito de produto confirmado, cada um com o teste do laboratório que o reproduz. Quem corrige troca o `test.fail` (quando houver) por teste normal no mesmo PR.

| Prioridade | Código | Defeito | Página | Teste que reproduz | Pista |
|---|---|---|---|---|---|
| 1 | D-V3 | "Enviar documento" (trava da matrícula) não responde e não diz qual campo falta | Editar anúncio (`/dashboard/imoveis/:id/editar`), 390 px | t249 · "D-V3" (`test.fail`) | A |
| 2 | D-V7 | Título do cartão de rascunho é link para a página pública, que dá 404 (o botão "Ver" já esconde) | Meus imóveis (`/dashboard/imoveis`), 1280 px | t249 · "D-V7" (`test.fail`, #1023) | A |
| 3 | D-V8 | Tela de entrar sem `<main>` (falta o marco principal para leitor de tela) | Entrar (`/auth`), 390 e 1280 px | t249 · "D-V8" (`test.fail`, #1023) | A |
| 4 | L-1 | Funil filtrado por cidade soma em vez de estreitar (88 com o máximo de 37) | /admin, funil de pedidos, 390 px | t255 · "F18" | A |
| 5 | D-V5 | "Anúncio publicado" e "Falta para publicar" ao mesmo tempo | Editar anúncio (`/dashboard/imoveis/:id/editar`), 1280 px | t249 · "D-V5" (`test.fail`) | A |
| 6 | L-4 | Diferença contra a linha de base nas telas do Prompt 41 | Página do imóvel, barras inferiores, estadia | t263 · 01, 02, 03 e 06 | A + Muse: atualizar a baseline se a tela nova está aprovada |

Critério da ordem: 1 trava o dono de publicar; 2 leva o dono a uma página que não existe; 3 atrapalha quem usa leitor de tela; 4 mostra número errado ao admin; 5 confunde, mas não trava; 6 pode ser só baseline desatualizada.

## Fechados sem registro

- **t50 · anon em `parceiro_galeria`** (02h42 e 03h58): a galeria de parceiro publicado é pública de propósito (migração 0190); a spec já foi ajustada na main e não repetiu.
- **t255 · F15** (selo de Agentes): corrida de teste, resolvida no #1013.
- **D-V2** (barra de fotos fixa a 390 px): falhou às 02h42 e às 03h58, passa desde 05h07.
- **t188** (ordem das seções do pedido): seção nova "Trabalho ou estudo" do #997; não repetiu.
