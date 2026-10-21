/* Sinistro Auto: consulta de sinistros e processos. */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'sinistros', titulo: 'Consultar sinistros', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Sinistros' }, { label: 'Consultar sinistros' }] });
  if (!u) return;

  const CHAVE = 'filtros:sinistros';
  const salvos = G.store.get(CHAVE, {});
  // Links de outras telas (ex.: "Prazos estourados" no início) chegam pela URL.
  ['prazo', 'busca', 'status', 'posicao'].forEach((k) => { if (G.param(k)) salvos[k] = G.param(k); });

  const analistas = G.db.all('usuarios').filter((x) => x.status === 'Ativo' && x.alcadaAnalise)
    .map((x) => ({ value: String(x.id), label: x.nome }));
  analistas.unshift({ value: 'fila', label: 'Na fila (sem responsável)' });

  const filtros = [
    { key: 'busca', label: 'Sinistro, aviso, placa, chassi, segurado ou CPF/CNPJ', span: 6, dica: 'Pode digitar só uma parte, como os 4 últimos números da placa.' },
    { key: 'natureza', label: 'Natureza', tipo: 'select', opcoes: G.db.all('naturezas').map((n) => ({ value: String(n.numero), label: n.numero + ' · ' + n.descricao })), span: 3 },
    { key: 'posicao', label: 'Posição', tipo: 'select', opcoes: G.db.all('posicoes').map((p) => ({ value: String(p.numero), label: p.descricao })), span: 3 },
    { key: 'status', label: 'Status', tipo: 'select', opcoes: ['Aberto', 'Encerrado'], span: 2 },
    { key: 'analista', label: 'Responsável', tipo: 'select', opcoes: analistas, span: 3 },
    { key: 'prazo', label: 'Prazo', tipo: 'select', opcoes: ['No prazo', 'Vence hoje', 'Prazo estourado'], span: 3 },
    { key: 'de', label: 'Ocorrência de', tipo: 'date', span: 2 },
    { key: 'ate', label: 'Ocorrência até', tipo: 'date', span: 2 }
  ];

  const form = document.getElementById('filtros');
  const grade = form.querySelector('.form-grid');
  const campos = {};
  filtros.forEach((f) => {
    const el = G.field({
      id: 'filtro-' + f.key, name: f.key, label: f.label, tipo: f.tipo || 'text', opcoes: f.opcoes,
      vazio: f.tipo === 'select' ? 'Todos' : undefined, valor: salvos[f.key] || '', span: f.span, dica: f.dica
    });
    grade.appendChild(el);
    campos[f.key] = el.control;
  });
  const soNews = h('input', { type: 'checkbox', id: 'filtro-news', name: 'news', checked: !!salvos.news });
  grade.appendChild(h('div', { class: 'field span-12' }, h('label', { class: 'choice', for: 'filtro-news' }, soNews, 'Mostrar só processos com news pendentes')));

  function valores() {
    const v = {};
    Object.keys(campos).forEach((k) => { v[k] = campos[k].value.trim(); });
    v.news = soNews.checked;
    return v;
  }

  function texto(p) {
    const ap = G.apolice(p);
    return G.normaliza([G.numeroProcesso(p), p.sinistro, p.aviso, ap.veiculo.placa, ap.veiculo.chassi, ap.segurado.nome, G.digitos(ap.segurado.documento), G.chaveApolice(ap), p.terceiro ? p.terceiro.nome + ' ' + p.terceiro.placa : ''].join(' '));
  }

  function filtra(v) {
    const busca = G.normaliza(v.busca).replace(/[.\-/]/g, '');
    return G.db.all('processos').filter((p) => {
      if (busca && texto(p).replace(/[.\-/]/g, '').indexOf(busca) < 0) return false;
      if (v.natureza && String(p.natureza) !== v.natureza) return false;
      if (v.posicao && String(p.posicao) !== v.posicao) return false;
      if (v.status && p.status !== v.status) return false;
      if (v.analista === 'fila' && (p.analistaId || p.status !== 'Aberto')) return false;
      if (v.analista && v.analista !== 'fila' && String(p.analistaId) !== v.analista) return false;
      if (v.prazo && G.prazo(p).status !== v.prazo) return false;
      if (v.de && p.ocorrencia.data < v.de) return false;
      if (v.ate && p.ocorrencia.data > v.ate) return false;
      if (v.news && !G.newsPendentes(p).length) return false;
      return true;
    });
  }

  const colunas = [
    { key: 'processo', label: 'Processo', sort: (p) => G.numeroProcesso(p), class: 'nowrap', csv: (p) => G.numeroProcesso(p),
      render: (p) => h('span', null, h('a', { class: 'row-link', href: 'processo.html?id=' + p.id, text: G.numeroProcesso(p) }), h('span', { class: 'cell-sub', text: 'Aviso ' + p.aviso })) },
    { key: 'segurado', label: 'Segurado e veículo', class: 'col-seg', sort: (p) => G.apolice(p).segurado.nome, csv: (p) => G.apolice(p).segurado.nome + ' (' + G.apolice(p).veiculo.placa + ')',
      render: (p) => { const ap = G.apolice(p); return h('span', null, ap.segurado.nome, h('span', { class: 'cell-veiculo' }, G.placa(ap.veiculo.placa, true), ap.veiculo.marca + ' ' + ap.veiculo.modelo)); } },
    { key: 'natureza', label: 'Natureza', sort: (p) => p.natureza, render: (p) => G.nome.naturezaCurta(p.natureza), csv: (p) => G.nome.natureza(p.natureza) },
    { key: 'ocorrencia', label: 'Ocorrência', sort: (p) => p.ocorrencia.data, class: 'nowrap', render: (p) => G.fmt.date(p.ocorrencia.data), csv: (p) => G.fmt.date(p.ocorrencia.data) },
    { key: 'posicao', label: 'Posição', sort: (p) => p.posicao, csv: (p) => G.nome.posicao(p.posicao),
      render: (p) => { const pz = G.prazo(p); return h('span', null, G.nome.posicao(p.posicao), pz.status ? h('span', { class: 'cell-sub' }, G.statusBadge(pz.status)) : null); } },
    { key: 'responsavel', label: 'Responsável', sort: (p) => (p.analistaId ? G.nome.usuario(p.analistaId) : 'zz'), csv: (p) => (p.analistaId ? G.nome.usuario(p.analistaId) : ''),
      render: (p) => (p.analistaId ? G.nome.usuario(p.analistaId) : p.status === 'Aberto' ? h('span', { class: 'muted', text: 'Na fila' }) : h('span', { class: 'muted', text: 'Ninguém' })) },
    { key: 'status', label: 'Status', sort: true, render: (p) => G.statusBadge(p.status) }
  ];

  const contador = document.getElementById('resultado-total');
  const tabela = G.dataTable({
    container: document.getElementById('resultado'),
    caption: 'Processos de sinistro',
    columns: colunas,
    rows: [],
    rowKey: (p) => p.id,
    sortKey: 'ocorrencia',
    sortDir: 'desc',
    emptyTitle: 'Nenhum processo com esses filtros',
    emptyText: 'Revise os filtros ou limpe tudo para ver a lista completa.'
  });

  function aplicar(anunciar) {
    const v = valores();
    G.store.set(CHAVE, v);
    const linhas = filtra(v);
    tabela.update(linhas);
    const ativos = Object.keys(v).filter((k) => v[k]).length;
    contador.textContent = G.fmt.plural(linhas.length, 'processo encontrado', 'processos encontrados') + (ativos ? ' com os filtros aplicados' : '');
    if (anunciar) G.announce(contador.textContent + '.');
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = valores();
    if (v.de && v.ate && v.de > v.ate) {
      G.setErro(campos.ate, 'A data final precisa ser depois da inicial.');
      G.focusField(campos.ate);
      return;
    }
    G.setErro(campos.ate, '');
    aplicar(true);
  });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      Object.keys(campos).forEach((k) => { campos[k].value = ''; });
      soNews.checked = false;
      G.setErro(campos.ate, '');
      aplicar(true);
    }, 0);
  });

  document.getElementById('exportar').addEventListener('click', () => G.downloadCsv('sinistros.csv', colunas, tabela.rows()));
  document.getElementById('imprimir').addEventListener('click', () => window.print());

  aplicar(false);
})();
