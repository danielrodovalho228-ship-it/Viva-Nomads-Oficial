# E694 (resíduo) — anúncio de exemplo sem botões de ação

**Decisão aprovada:** a vitrine de exemplos continua, com aviso antecipado. Os avisos já existiam (#3275), mas **"Pedir para morar", "Enviar mensagem", "Agendar visita" e "Visita por vídeo" seguiam ativos** no exemplo.

**Agora, no anúncio de exemplo (`isExemplo`):**
- Coluna do computador: os 4 botões saem; entra `exemplo-sem-acoes` (aviso + "não dá para pedir para morar, enviar mensagem, agendar visita ou fazer visita por vídeo: nada seria enviado a ninguém. Nos anúncios reais, esses botões ficam neste lugar") + **Ver imóveis reais** (`/buscar`). "Fale com a Viva" continua.
- Barra fixa do celular: sem "Pedir para morar" e sem "Agendar visita"; só **Ver imóveis reais** (`barra-ver-reais`). A frase de tranquilidade do botão some no exemplo.
- Cartão "Sobre o proprietário": sem botão "Enviar mensagem"; a explicação (`mensagem-demo`) fica à vista.
- Anúncio real: nada muda.

**Mantido de propósito:** os avisos dentro da candidatura/mensagem/visita (E694 anterior e E320) continuam no código, para o caso de o modal abrir por link (`?abrir=`).

**Testes:** `src/components/property/e694-exemplo-sem-acoes.test.ts` (visto vermelho antes). Specs de e2e ajustados: `t130`, `t132`, `t152`, `t225`, `t262`, `t762` (agora afirmam a explicação e a ausência dos botões). `t357` e `t855` precisavam do fluxo de candidatura, que só existe em anúncio real: passam a criar um anúncio no laboratório (`criarImovelPronto`) e pulam fora do laboratório.

## Dúvidas
1. Os campos de data/motivo da coluna de reserva (`candidatura-inicio`, etc.) continuam visíveis no exemplo, sem botão para enviar. Se preferirem esconder, é um ajuste pequeno.
2. Sem rodar e2e aqui (só o laboratório roda): os specs ajustados dependem da CI.
