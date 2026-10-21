# Política de segurança

Este repositório é um **protótipo navegável estático** (HTML, CSS e JavaScript). Ele não
tem back-end, banco de dados nem autenticação real, e não deve ser usado com dados reais
de segurados, veículos ou empresas.

## Reportando uma vulnerabilidade

Se encontrar um problema de segurança, abra um
[security advisory privado](https://github.com/fernandopinhel/prototipo-GSRE/security/advisories/new)
em vez de uma issue pública.

## Medidas adotadas

- Content Security Policy via `<meta>` (`script-src 'self'` e `style-src` sem
  `'unsafe-inline'`, ou seja, sem scripts nem estilos inline). Não há nenhum
  `<script>`, `<style>`, `style=` ou `onclick=` escrito direto no HTML.
- Nenhuma biblioteca de terceiros no runtime: só HTML, CSS e JavaScript próprios.
- Todo texto digitado entra na página como `textContent`, nunca como HTML.
- Nada é enviado a servidor. A sessão e os dados ficam só no `sessionStorage`
  do navegador e somem ao fechar a aba ou ao clicar em "Sair" (a sessão) e
  "Restaurar dados de exemplo" (os dados).
- Arquivos anexados nos processos não são lidos nem enviados: só o nome e o
  tamanho ficam registrados.
- A exportação para CSV neutraliza valores que começam com `=`, `+`, `-` ou `@`,
  evitando injeção de fórmulas ao abrir o arquivo no Excel.
