/*
 * Sinistro Auto: parâmetros da distribuição automática. Grupos de análise,
 * ordem da fila, news que passam na frente e o prazo máximo na caixa.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'distribuicao', titulo: 'Distribuição automática', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Gestão' }, { label: 'Distribuição automática' }] });
  if (!u) return;

  const raw = G.db.raw();
  const form = document.getElementById('distribuicao-form');
  const secoes = document.getElementById('distribuicao-secoes');
  const copia = () => JSON.parse(JSON.stringify(raw.distribuicao));
  let cfg = copia();
  const dirty = G.guardDirty(form);

  const naturezas = G.db.all('naturezas').filter((n) => n.status === 'Ativo');
  const analistas = G.db.all('usuarios').filter((x) => x.status === 'Ativo' && x.alcadaAnalise);
  const posicoes = G.db.all('posicoes').filter((x) => x.status === 'Ativo' && x.encerra !== 'sim');
  const NEWS = G.TIPOS_NEWS.concat('Pagamento rejeitado');

  const card = (idSec, titulo, texto, ...filhos) => h('section', { class: 'card', 'aria-labelledby': idSec },
    h('div', { class: 'card__head' }, h('div', null, h('h2', { id: idSec, text: titulo }), texto ? h('p', { text: texto }) : null)), filhos);

  function render() {
    secoes.replaceChildren();

    /* Grupos */
    const grupos = h('div', { class: 'stack' });
    cfg.grupos.forEach((g) => {
      const nome = G.field({ id: 'g' + g.id + '-nome', label: 'Nome do grupo', required: true, max: 60, valor: g.nome, span: 6 });
      nome.control.addEventListener('input', () => { g.nome = nome.control.value; previa(); });
      const nats = G.choiceGroup({ id: 'g' + g.id + '-nat', name: 'g' + g.id + '-nat', label: 'Naturezas que o grupo atende', multiplo: true, box: true, valor: g.naturezas.map(String), opcoes: naturezas.map((n) => ({ value: String(n.numero), label: n.descricao })) });
      const pessoas = G.choiceGroup({ id: 'g' + g.id + '-ana', name: 'g' + g.id + '-ana', label: 'Analistas do grupo', multiplo: true, box: true, valor: g.analistas.map(String), opcoes: analistas.map((a) => ({ value: String(a.id), label: a.nome })) });
      nats.classList.add('span-12');
      pessoas.classList.add('span-12');
      nats.addEventListener('change', () => { g.naturezas = Array.from(nats.querySelectorAll('input:checked')).map((i) => Number(i.value)); previa(); });
      pessoas.addEventListener('change', () => { g.analistas = Array.from(pessoas.querySelectorAll('input:checked')).map((i) => Number(i.value)); previa(); });
      grupos.appendChild(h('fieldset', { class: 'card grupo-dist' }, h('legend', { class: 'visually-hidden', text: 'Grupo ' + g.nome }), h('div', { class: 'form-grid' }, nome, nats, pessoas)));
    });
    secoes.appendChild(card('dist-grupos-titulo', 'Grupos de análise', 'Cada natureza precisa estar em um grupo, e só em um. A pessoa pode estar em mais de um grupo.', grupos));

    /* Ordem da fila */
    const lista = h('ol', { class: 'order-list', id: 'ordem-fila' });
    const ordem = cfg.prioridade.filter((n) => posicoes.some((x) => x.numero === n)).concat(posicoes.filter((x) => cfg.prioridade.indexOf(x.numero) < 0).map((x) => x.numero));
    cfg.prioridade = ordem;
    ordem.forEach((n, i) => {
      const desc = G.nome.posicao(n);
      const subir = h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Subir ' + desc, disabled: i === 0, 'data-mover': 'subir' }, G.icon('chevron-up'));
      const descer = h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Descer ' + desc, disabled: i === ordem.length - 1, 'data-mover': 'descer' }, G.icon('chevron-down'));
      const mover = (delta, qual) => () => {
        const j = i + delta;
        cfg.prioridade.splice(j, 0, cfg.prioridade.splice(i, 1)[0]);
        dirty.mark();
        render();
        const botao = document.querySelector('#ordem-fila li:nth-child(' + (j + 1) + ') [data-mover="' + qual + '"]');
        (botao && !botao.disabled ? botao : document.querySelector('#ordem-fila li:nth-child(' + (j + 1) + ') button:not([disabled])')).focus();
        G.announce(desc + ' agora é a ' + (j + 1) + 'ª de ' + ordem.length + ' na fila.');
      };
      subir.addEventListener('click', mover(-1, 'subir'));
      descer.addEventListener('click', mover(1, 'descer'));
      lista.appendChild(h('li', null, h('span', { class: 'order-list__pos', text: String(i + 1) }), h('span', { class: 'order-list__nome', text: desc }), h('span', { class: 'btn-row' }, subir, descer)));
    });
    secoes.appendChild(card('dist-ordem-titulo', 'Ordem da fila', 'Quem pega o próximo recebe primeiro as posições do topo. Dentro da mesma posição, vai o processo parado há mais tempo.', lista));

    /* News */
    const news = G.choiceGroup({ id: 'dist-news', name: 'news', label: 'News que passam na frente', multiplo: true, box: true, valor: cfg.news, opcoes: NEWS });
    news.querySelector('legend').classList.add('visually-hidden');
    news.addEventListener('change', () => { cfg.news = Array.from(news.querySelectorAll('input:checked')).map((i) => i.value); previa(); });
    secoes.appendChild(card('dist-news-titulo', 'News que passam na frente', 'Processos com essas novidades vão para o topo da fila, antes da ordem das posições. Vistoria prioritária vem logo depois.', news));

    /* Prazo */
    const prazo = G.field({ id: 'dist-prazo', label: 'Prazo máximo na caixa (minutos)', tipo: 'number', required: true, min: 5, maxValor: 240, inputmode: 'numeric', valor: cfg.prazoMinutos, span: 4, dica: 'De 5 a 240. Depois disso, um processo distribuído e não tratado volta para a fila e pede justificativa.' });
    prazo.control.removeAttribute('maxlength');
    prazo.control.addEventListener('input', () => { cfg.prazoMinutos = Number(prazo.control.value); });
    secoes.appendChild(card('dist-prazo-titulo', 'Prazo na caixa', null, h('div', { class: 'form-grid' }, prazo)));

    /* Prévia */
    secoes.appendChild(card('dist-previa-titulo', 'Prévia', 'Com esses parâmetros, este seria o próximo processo de cada pessoa. Nada é distribuído até alguém clicar em "Pegar o próximo".', h('div', { id: 'previa' })));
    previa();
    G.applyMasks(form);
  }

  function previa() {
    const area = document.getElementById('previa');
    if (!area) return;
    const salvo = raw.distribuicao;
    raw.distribuicao = cfg;
    const linhas = analistas.map((a) => ({ a, p: G.filaDoUsuario(a.id)[0] || null, n: G.filaDoUsuario(a.id).length }));
    raw.distribuicao = salvo;
    G.dataTable({
      container: area, caption: 'Próximo processo de cada analista', rows: linhas, rowKey: (r) => r.a.id, paginate: false, compact: true,
      columns: [
        { key: 'nome', label: 'Analista', render: (r) => r.a.nome },
        { key: 'fila', label: 'Na fila dessa pessoa', num: true, render: (r) => String(r.n) },
        { key: 'proximo', label: 'Próximo processo', render: (r) => (r.p ? h('span', null, G.numeroProcesso(r.p) + ' · ' + G.nome.naturezaCurta(r.p.natureza), h('span', { class: 'cell-sub', text: G.nome.posicao(r.p.posicao) })) : h('span', { class: 'muted', text: 'Nenhum: a fila está vazia ou a pessoa não está em grupo' })) }
      ]
    });
  }

  function alterado() {
    document.getElementById('distribuicao-alterado').textContent = 'Última alteração em ' + G.fmt.dateTime(raw.distribuicao.alteradoEm) + ' por ' + raw.distribuicao.alteradoPor + '.';
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const ok = G.validateForm(form, {
      resumoTitulo: 'Antes de salvar, confira estes pontos:',
      extra(addErro) {
        cfg.grupos.forEach((g) => {
          const nat = document.querySelector('#g' + g.id + '-nat input');
          const ana = document.querySelector('#g' + g.id + '-ana input');
          if (!g.naturezas.length) addErro(nat, 'O grupo "' + g.nome + '" precisa de pelo menos uma natureza.');
          if (!g.analistas.length) addErro(ana, 'O grupo "' + g.nome + '" precisa de pelo menos uma pessoa.');
        });
        naturezas.forEach((n) => {
          const em = cfg.grupos.filter((g) => g.naturezas.indexOf(n.numero) >= 0);
          if (em.length > 1) addErro(document.querySelector('#g' + em[1].id + '-nat input[value="' + n.numero + '"]'), '"' + n.descricao + '" está em dois grupos: ' + em.map((g) => g.nome).join(' e ') + '. Deixe em um só.');
          if (!em.length) addErro(document.querySelector('#g' + cfg.grupos[0].id + '-nat input[value="' + n.numero + '"]'), '"' + n.descricao + '" não está em nenhum grupo e ficaria sem ninguém para atender.');
        });
        const prazo = document.getElementById('dist-prazo');
        if (prazo.value && (Number(prazo.value) < 5 || Number(prazo.value) > 240)) addErro(prazo, 'Use um prazo entre 5 e 240 minutos.');
      }
    });
    if (!ok) return;
    cfg.alteradoEm = new Date().toISOString();
    cfg.alteradoPor = u.nome;
    raw.distribuicao = cfg;
    G.db.commit();
    cfg = copia();
    dirty.clean();
    alterado();
    G.toast('Parâmetros salvos. A fila já anda com a nova ordem.');
  });

  document.getElementById('desfazer').addEventListener('click', () => {
    cfg = copia();
    G.clearErrors(form);
    render();
    dirty.clean();
    G.toast('Alterações desfeitas.');
  });

  alterado();
  render();
})();
