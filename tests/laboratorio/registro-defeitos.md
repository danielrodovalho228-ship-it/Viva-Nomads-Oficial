# Registro de defeitos novos do laboratório

Um registro por defeito novo achado na triagem contínua (Pista C). Defeito conhecido da varredura usa o código D-V da t249; aqui entram os demais, com código L-n. Fonte: `lab_execucoes` (só o primeiro achado de cada teste; o artefato não abre na sessão da Pista C).

| Código | Aberto em | Spec · cenário | Página / papel | Evidência (execução) | Classificação | Dono | Situação |
|---|---|---|---|---|---|---|---|
| L-1 | 22/10 | t255 · F18 "filtrar o funil por cidade só estreita, nunca soma" (390 px) | /admin, funil de pedidos · admin | Etapa 1 em Uberlândia deu 88 com o máximo esperado de 37 ([39744748029](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/39744748029), `1a3e04f`). Repete em quase toda execução desde 21/10, completas e "metade" | Produto | A | Aberto |
| L-2 | 22/10 | t28 · "só parte avalia, uma vez, em 14 dias; às cegas; moderação" | Avaliação da estadia · inquilino e dono | O texto da avaliação ("Imóvel impecável T28 …") não aparece em 2 s ([39744748029](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/39744748029)). Em 3 execuções completas: 02h42, 07h23, 09h58 | A investigar (produto ou espera curta do teste) | C investiga | Aberto |
| L-3 | 22/10 | t249 · varrer a 1280 e a 390 px, critério d | Painel (3 papéis) e Painel do parceiro (`/dashboard`, `/dashboard/parceiro`) | `script GET net::ERR_ABORTED` em `/_next/static/chunks/…` às 07h23 (passou no retry) e às 09h58 | Régua: falta decisão do Muse se script do próprio site cancelado pelo navegador conta | Muse | Aguardando decisão |
| L-4 | 22/10 | t263 · visual-41 (01, 02, 03 e 06) | Página do imóvel inteira; barras inferiores de inquilino e dono; cogumelo da estadia | Diferença de pixels contra a linha de base em toda execução desde 02h42 (página do imóvel com 97 a 144 px a mais de altura) | Alarme de baseline (spec nova) | A + Muse | Aberto |
| L-5 | 22/10 | Suíte inteira | — | Execuções de 05h07 (622 pulados) e 06h17 (782) bateram no teto de 65 min com poucas falhas; a suíte passou de ~1.600 testes | Laboratório (capacidade) | C, com OK do Muse para mexer no workflow | Aberto |

## Fechados sem registro

- **t50 · anon em `parceiro_galeria`** (02h42 e 03h58): a galeria de parceiro publicado é pública de propósito (migração 0190); a spec já foi ajustada na main e não repetiu.
- **t255 · F15** (selo de Agentes): corrida de teste, resolvida no #1013.
- **D-V2** (barra de fotos fixa a 390 px): falhou às 02h42 e às 03h58, passa desde 05h07.
- **t188** (ordem das seções do pedido): seção nova "Trabalho ou estudo" do #997; não repetiu.
