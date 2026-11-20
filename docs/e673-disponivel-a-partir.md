# E673 — "Disponível a partir de" olha os períodos ocupados

**Relato (07/11, retomada do E652):** depois do Aditivo 1 (17/01–17/03/2027), o cabeçalho do anúncio seguia "Disponível a
partir de 10/01/2027". O calendário público já refletia o bloqueio 17/01–17/03 numa segunda leitura.

**Causa:** o cabeçalho (calendário e cartão de preço) lia só `properties.available_from`, a data que o dono escolheu no
cadastro; nunca olhava os períodos ocupados. O calendário carrega os dias ocupados depois, por isso aparecia atrasado.

**Correção (sem migração):** `primeiraEntradaPossivel` (`src/lib/imovel/disponivel-a-partir.ts`): a primeira data, a partir
do maior entre o início do anúncio e hoje, em que cabe a estadia mínima sem cruzar um dia ocupado e sem passar do fim da
janela. O calendário calcula com os dias ocupados que já carrega e avisa a página (`onDisponivelDesde`); o cartão de preço e
a barra do celular dizem a mesma data. Enquanto as datas não carregam, ou se a leitura falha, vale a data do cadastro.

**Sobre o atraso do calendário:** a leitura das datas é feita no navegador a cada abertura (`getDatasIndisponiveis`, sem
cache de página); o "atraso de propagação" visto na primeira leitura é a página carregada antes do aditivo assinado. Não mudei
a leitura do calendário.

**Teste:** `src/lib/imovel/e673-disponivel-a-partir.test.ts` (escrito antes, visto vermelho).

**Dúvida:** a data é a primeira entrada que comporta a estadia MÍNIMA do anúncio. Com mínimo de 30 dias e o bloqueio
17/01–17/03, os 7 dias livres antes não contam; a data passa a ser 18/03.
