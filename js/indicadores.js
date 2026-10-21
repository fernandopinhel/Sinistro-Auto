/*
 * Sinistro Auto: indicadores. Cada gráfico é uma tabela com barras, então
 * os números ficam sempre visíveis em texto e a tabela é a versão acessível.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'indicadores', titulo: 'Indicadores', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Gestão' }, { label: 'Indicadores' }] });
  if (!u) return;

  const salvos = G.store.get('filtros:indicadores', { periodo: '180', grupo: '' });
  const form = document.getElementById('filtros');
  const grade = form.querySelector('.form-grid');
  const periodo = G.field({ id: 'ind-periodo', label: 'Período', tipo: 'select', vazio: false, opcoes: [{ value: '30', label: 'Últimos 30 dias' }, { value: '90', label: 'Últimos 90 dias' }, { value: '180', label: 'Últimos 6 meses' }], valor: salvos.periodo, span: 6 });
  const grupo = G.field({ id: 'ind-grupo', label: 'Grupo de naturezas', tipo: 'select', vazio: 'Todos', opcoes: G.GRUPOS_NATUREZA, valor: salvos.grupo, span: 6 });
  grade.append(periodo, grupo);

  const dias = (a, b) => (new Date(b) - new Date(a)) / 86400000;
  const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
  const fmtDias = (d) => (d < 1 ? G.fmt.decimal(d * 24).replace(',00', '') + ' h' : G.fmt.decimal(d).replace(',00', '') + (Math.abs(d - 1) < 0.005 ? ' dia' : ' dias'));
  const csv = {};

  // Barra de uma série só: o valor fica em texto ao lado, a barra é reforço visual.
  function barra(valor, maximo, rotulo) {
    const fill = h('span', { class: 'bar__fill' });
    fill.style.width = (maximo ? Math.max(2, Math.round(valor / maximo * 100)) : 0) + '%';
    return h('span', { class: 'bar-cell' + (typeof valor === 'number' && rotulo.length <= 4 ? ' bar-cell--curto' : '') }, h('span', { class: 'bar__label', text: rotulo }), h('span', { class: 'bar', 'aria-hidden': 'true' }, fill));
  }

  function tabela(alvo, caption, colunas, linhas, nomeCsv) {
    csv[alvo] = { nome: nomeCsv, colunas, linhas };
    G.dataTable({
      container: document.getElementById(alvo), caption: 'Tabela: ' + caption, columns: colunas, rows: linhas, rowKey: (r) => r.chave,
      paginate: false, compact: true, emptyIcon: 'chart', emptyTitle: 'Sem dados no período', emptyText: 'Escolha um período maior.'
    });
  }

  function render() {
    const corte = G.somaDias(G.hoje(), -Number(periodo.control.value));
    const g = grupo.control.value;
    G.store.set('filtros:indicadores', { periodo: periodo.control.value, grupo: g });
    const doGrupo = (p) => !g || (G.natureza(p.natureza) && G.natureza(p.natureza).grupo === g);
    const processos = G.db.all('processos').filter(doGrupo);
    const pagos = processos.filter((p) => p.marcos && p.marcos.pagamento && p.marcos.pagamento.slice(0, 10) >= corte);
    const valorPago = (p) => p.pagamentos.filter((x) => x.status === 'Pago' || x.status === 'Liberado').reduce((s, x) => s + x.valor, 0);
    const ciclo = pagos.map((p) => dias(p.avisadoEm, p.marcos.pagamento));
    // A Susep dá 30 dias, contados da entrega dos documentos, para a seguradora indenizar.
    const noPrazo = pagos.filter((p) => dias(p.marcos.documentos || p.avisadoEm, p.marcos.pagamento) <= 30).length;

    /* KPIs */
    const kpis = [
      { icone: 'check-circle', rotulo: 'Sinistros pagos', valor: G.fmt.int(pagos.length), nota: 'No período escolhido' },
      { icone: 'coin', rotulo: 'Valor pago', valor: G.fmt.money(pagos.reduce((s, p) => s + valorPago(p), 0)), nota: 'Oficinas, segurados e financeiras', tom: 'success' },
      { icone: 'clock', rotulo: 'Do aviso ao pagamento', valor: ciclo.length ? fmtDias(media(ciclo)) : 'Sem dados', nota: 'Tempo médio', tom: 'accent' },
      { icone: 'shield', rotulo: 'Pagos em até 30 dias', valor: pagos.length ? G.fmt.pct(noPrazo / pagos.length) : 'Sem dados', nota: 'Contados dos documentos, como pede a Susep', tom: 'warning' }
    ];
    document.getElementById('kpis').replaceChildren(...kpis.map((k) => h('li', { class: 'kpi' + (k.tom ? ' kpi--' + k.tom : '') },
      h('span', { class: 'kpi__icon' }, G.icon(k.icone)),
      h('span', { class: 'kpi__label', text: k.rotulo }),
      h('span', { class: 'kpi__value', text: k.valor }),
      h('span', { class: 'kpi__note', text: k.nota }))));

    /* Etapas */
    const ETAPAS = [
      ['Envio dos documentos', 'Do aviso até o último documento exigido', (p) => [p.avisadoEm, p.marcos.documentos]],
      ['Orçamento da oficina', 'Dos documentos até o primeiro orçamento', (p) => [p.marcos.documentos, p.marcos.orcamento]],
      ['Análise do orçamento', 'Do orçamento até a autorização', (p) => [p.marcos.orcamento, p.marcos.autorizacao]],
      ['Reparo na oficina', 'Da autorização até a nota fiscal', (p) => [p.marcos.autorizacao, p.marcos.notaFiscal]],
      ['Análise da indenização integral', 'Dos documentos até a quitação', (p) => (p.marcos.autorizacao ? [] : [p.marcos.documentos, p.marcos.notaFiscal])],
      ['Liberação e pagamento', 'Da nota fiscal ou quitação até o pagamento', (p) => [p.marcos.notaFiscal, p.marcos.pagamento]]
    ];
    const etapas = ETAPAS.map((e, i) => {
      const t = pagos.map((p) => e[2](p)).filter((x) => x[0] && x[1] && x[1] >= x[0]).map((x) => dias(x[0], x[1]));
      return { chave: i, etapa: e[0], explica: e[1], n: t.length, media: media(t), max: t.length ? Math.max.apply(null, t) : 0 };
    }).filter((e) => e.n);
    const maxEtapa = Math.max.apply(null, etapas.map((e) => e.media).concat(0));
    tabela('etapas', 'Tempo médio de cada etapa', [
      { key: 'etapa', label: 'Etapa', render: (r) => h('span', null, r.etapa, h('span', { class: 'cell-sub', text: r.explica })) },
      { key: 'n', label: 'Processos', num: true },
      { key: 'media', label: 'Tempo médio', class: 'col-bar', render: (r) => barra(r.media, maxEtapa, fmtDias(r.media)), csv: (r) => G.fmt.decimal(r.media) },
      { key: 'max', label: 'Mais demorado', num: true, render: (r) => fmtDias(r.max), csv: (r) => G.fmt.decimal(r.max) }
    ], etapas, 'tempo-por-etapa.csv');

    /* Naturezas */
    const porNat = {};
    pagos.forEach((p) => {
      const k = p.natureza;
      porNat[k] = porNat[k] || { chave: k, natureza: G.nome.natureza(k), qtd: 0, valor: 0 };
      porNat[k].qtd += 1;
      porNat[k].valor += valorPago(p);
    });
    const nats = Object.keys(porNat).map((k) => porNat[k]).sort((a, b) => b.valor - a.valor);
    const maxNat = Math.max.apply(null, nats.map((n) => n.valor).concat(0));
    tabela('naturezas', 'Pagamentos por natureza', [
      { key: 'natureza', label: 'Natureza' },
      { key: 'qtd', label: 'Pagos', num: true },
      { key: 'valor', label: 'Valor pago', class: 'col-bar', render: (r) => barra(r.valor, maxNat, G.fmt.money(r.valor)), csv: (r) => G.fmt.decimal(r.valor) },
      { key: 'ticket', label: 'Valor médio', num: true, render: (r) => G.fmt.money(r.valor / r.qtd), csv: (r) => G.fmt.decimal(r.valor / r.qtd) }
    ], nats, 'pagamentos-por-natureza.csv');

    /* Posições (hoje) */
    const abertos = processos.filter((p) => p.status === 'Aberto');
    const pos = G.db.all('posicoes').filter((x) => x.encerra !== 'sim').map((x) => {
      const l = abertos.filter((p) => p.posicao === x.numero);
      return { chave: x.numero, posicao: x.descricao, qtd: l.length, media: media(l.map((p) => dias(p.posicaoDesde, new Date().toISOString()))), estourados: l.filter((p) => G.prazo(p).status === 'Prazo estourado').length };
    }).filter((x) => x.qtd);
    const maxPos = Math.max.apply(null, pos.map((x) => x.qtd).concat(0));
    tabela('posicoes', 'Processos abertos por posição', [
      { key: 'posicao', label: 'Posição' },
      { key: 'qtd', label: 'Abertos', class: 'col-bar', render: (r) => barra(r.qtd, maxPos, String(r.qtd)) },
      { key: 'media', label: 'Parado há', num: true, render: (r) => fmtDias(r.media), csv: (r) => G.fmt.decimal(r.media) },
      { key: 'estourados', label: 'Prazo estourado', num: true }
    ], pos, 'processos-por-posicao.csv');

    /* Analistas */
    const analistas = G.db.all('usuarios').filter((x) => x.status === 'Ativo' && x.alcadaAnalise).map((x) => {
      const meus = pagos.filter((p) => p.pagamentos.some((g2) => g2.solicitadoPorId === x.id));
      return { chave: x.id, nome: x.nome, encerrados: meus.length, caixa: abertos.filter((p) => p.analistaId === x.id).length, ciclo: media(meus.map((p) => dias(p.avisadoEm, p.marcos.pagamento))) };
    }).sort((a, b) => b.encerrados - a.encerrados);
    const maxAn = Math.max.apply(null, analistas.map((a) => a.encerrados).concat(0));
    tabela('analistas', 'Processos por analista', [
      { key: 'nome', label: 'Analista' },
      { key: 'encerrados', label: 'Pagos no período', class: 'col-bar', render: (r) => barra(r.encerrados, maxAn, String(r.encerrados)) },
      { key: 'caixa', label: 'Na caixa', num: true },
      { key: 'ciclo', label: 'Ciclo médio', num: true, render: (r) => (r.encerrados ? fmtDias(r.ciclo) : 'Sem dados'), csv: (r) => G.fmt.decimal(r.ciclo) }
    ], analistas, 'processos-por-analista.csv');
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    render();
    G.announce('Indicadores atualizados para ' + periodo.control.options[periodo.control.selectedIndex].text.toLowerCase() + '.');
  });
  document.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () => {
    const c = csv[b.dataset.csv];
    G.downloadCsv(c.nome, c.colunas, c.linhas);
  }));

  render();
})();
