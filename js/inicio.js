/* Sinistro Auto: painel inicial com indicadores, caixa e atalhos. */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'inicio', titulo: 'Início', migalhas: [{ label: 'Início' }] });
  if (!u) return;
  G.verificaPrazoCaixa(u.id);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('pagina-titulo').textContent = saudacao + ', ' + u.nome.split(' ')[0] + '!';

  const processos = G.db.all('processos');
  const abertos = processos.filter((p) => p.status === 'Aberto');
  const meus = G.ordenaFila(abertos.filter((p) => p.analistaId === u.id));
  const fila = G.filaDoUsuario(u.id);
  const estourados = abertos.filter((p) => G.prazo(p).status === 'Prazo estourado')
    .sort((a, b) => G.prazo(a).dias - G.prazo(b).dias);
  const aguardando = [];
  processos.forEach((p) => p.pagamentos.forEach((g) => { if (g.status === 'Aguardando liberação') aguardando.push(g); }));
  const totalAguardando = aguardando.reduce((s, g) => s + g.valor, 0);
  const comNews = meus.filter((p) => G.newsPendentes(p).length).length;

  document.getElementById('hero-texto').textContent = meus.length
    ? 'Você tem ' + G.fmt.plural(meus.length, 'processo', 'processos') + ' na caixa' + (comNews ? ', ' + G.fmt.plural(comNews, 'com novidade', 'com novidades') : '') + ', e ' + G.fmt.plural(fila.length, 'processo espera', 'processos esperam') + ' na fila do seu grupo.'
    : 'Sua caixa está vazia. ' + (fila.length ? G.fmt.plural(fila.length, 'processo espera', 'processos esperam') + ' na fila do seu grupo.' : 'A fila do seu grupo também está em dia.');

  const kpis = [
    { icone: 'inbox', rotulo: 'Na sua caixa', valor: G.fmt.int(meus.length), nota: comNews ? G.fmt.plural(comNews, 'com news', 'com news') : 'Nenhuma novidade', href: 'caixa.html' },
    { icone: 'route', rotulo: 'Na fila do seu grupo', valor: G.fmt.int(fila.length), nota: 'Esperando distribuição', href: 'caixa.html#fila', tom: 'accent' },
    { icone: 'coin', rotulo: 'Pagamentos para liberar', valor: G.fmt.int(aguardando.length), nota: G.fmt.money(totalAguardando) + ' no total', href: 'pagamentos.html', tom: 'success' },
    { icone: 'clock', rotulo: 'Prazos estourados', valor: G.fmt.int(estourados.length), nota: 'Em processos abertos', href: 'sinistros.html?prazo=' + encodeURIComponent('Prazo estourado'), tom: 'warning' }
  ];
  const lista = document.getElementById('kpis');
  kpis.forEach((k) => {
    lista.appendChild(h('li', { class: 'kpi' + (k.tom ? ' kpi--' + k.tom : '') },
      h('span', { class: 'kpi__icon' }, G.icon(k.icone)),
      h('a', { class: 'kpi__label', href: k.href, text: k.rotulo }),
      h('span', { class: 'kpi__value', text: k.valor }),
      h('span', { class: 'kpi__note', text: k.nota })));
  });

  const prazoBadge = (p) => {
    const pz = G.prazo(p);
    return pz.status ? G.statusBadge(pz.status) : null;
  };

  /* Na sua caixa */
  const caixa = document.getElementById('minha-caixa');
  if (!meus.length) {
    caixa.appendChild(h('p', { class: 'muted', text: 'Nada por aqui. Use "Pegar o próximo processo" para começar.' }));
  } else {
    const ul = h('ul', { class: 'list-plain attention' });
    meus.slice(0, 5).forEach((p) => {
      const ap = G.apolice(p);
      const news = G.newsPendentes(p).length;
      ul.appendChild(h('li', null,
        h('div', { class: 'cell-veiculo' }, G.placa(ap.veiculo.placa, true), h('div', null,
          h('a', { href: 'processo.html?id=' + p.id, text: G.numeroProcesso(p) + ' · ' + G.nome.naturezaCurta(p.natureza) }),
          h('span', { class: 'cell-sub', text: ap.segurado.nome + ' · ' + G.nome.posicao(p.posicao) }))),
        h('span', { class: 'btn-row' }, news ? G.badge(G.fmt.plural(news, 'news', 'news'), 'accent') : null, prazoBadge(p))));
    });
    caixa.appendChild(ul);
  }

  /* Prazos estourados */
  const est = document.getElementById('estourados');
  if (!estourados.length) {
    est.appendChild(h('p', { class: 'muted', text: 'Nenhum prazo estourado. Bom trabalho!' }));
  } else {
    const ul = h('ul', { class: 'list-plain attention' });
    estourados.slice(0, 5).forEach((p) => {
      const atraso = -G.prazo(p).dias;
      ul.appendChild(h('li', null,
        h('div', null,
          h('a', { href: 'processo.html?id=' + p.id, text: G.numeroProcesso(p) + ' · ' + G.nome.posicao(p.posicao) }),
          h('span', { class: 'cell-sub', text: (p.analistaId ? 'Com ' + G.nome.usuario(p.analistaId) : 'Na fila') + ' · passou ' + G.fmt.plural(atraso, 'dia', 'dias') + ' do prazo' })),
        G.badge(atraso === 1 ? '1 dia de atraso' : atraso + ' dias de atraso', 'danger')));
    });
    est.appendChild(ul);
  }

  /* Pegar o próximo */
  document.getElementById('pegar-proximo').addEventListener('click', () => {
    const p = G.pegaProximo(u.id);
    if (!p) {
      G.toast('A fila do seu grupo está vazia. Nada para pegar agora.');
      return;
    }
    G.flash('O processo ' + G.numeroProcesso(p) + ' agora está com você.');
    window.location.href = 'processo.html?id=' + p.id;
  });

  /* Próximo da fila: o que a pessoa vai receber ao clicar */
  const proximo = document.getElementById('proximo');
  if (!fila.length) {
    proximo.appendChild(h('p', { class: 'muted', text: 'A fila do seu grupo está vazia. Bom momento para revisar os prazos estourados.' }));
  } else {
    const p = fila[0];
    const ap = G.apolice(p);
    proximo.append(
      h('div', { class: 'cell-veiculo' }, G.placa(ap.veiculo.placa), h('span', null, h('span', { class: 'proximo__numero', text: G.numeroProcesso(p) }), h('span', { class: 'cell-sub', text: G.nome.naturezaCurta(p.natureza) + ' · ' + ap.veiculo.marca + ' ' + ap.veiculo.modelo }))),
      h('p', { class: 'proximo__motivo' }, G.icon('route'), 'Primeiro da fila por: ' + G.motivoNaFila(p).replace('News: ', 'news de ').replace('Posição ', 'posição ').replace('Vistoria', 'vistoria')),
      h('p', { class: 'hint', text: 'Depois dele, ' + G.fmt.plural(fila.length - 1, 'processo espera', 'processos esperam') + '. A ordem é definida pela supervisão em Distribuição automática.' }));
  }
})();
