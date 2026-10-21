/* Sinistro Auto: cobrança de ressarcimento dos terceiros que causaram o acidente. */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'ressarcimentos', titulo: 'Ressarcimentos', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Sinistros' }, { label: 'Ressarcimentos' }] });
  if (!u) return;

  const STATUS = ['Aguardando acordo', 'Em cobrança', 'Ressarcido', 'Sem acordo'];
  const CHAVE = 'filtros:ressarcimentos';
  const salvos = G.store.get(CHAVE, {});
  const todos = () => G.db.all('processos').filter((p) => p.ressarcimento);
  const ultima = (p) => p.ressarcimento.historico[p.ressarcimento.historico.length - 1];

  function renderResumo() {
    const lista = todos();
    const abertos = lista.filter((p) => ['Aguardando acordo', 'Em cobrança'].indexOf(p.ressarcimento.status) >= 0);
    const valorTotal = lista.reduce((s, p) => s + p.ressarcimento.valor, 0);
    const recebido = lista.reduce((s, p) => s + (p.ressarcimento.recebido || 0), 0);
    document.getElementById('resumo').replaceChildren(
      h('div', null, h('dt', { text: 'Em aberto' }), h('dd', { text: G.fmt.int(abertos.length) + ' · ' + G.fmt.money(abertos.reduce((s, p) => s + p.ressarcimento.valor, 0)) })),
      h('div', { class: 'is-good' }, h('dt', { text: 'Já recuperado' }), h('dd', { text: G.fmt.money(recebido) })),
      h('div', null, h('dt', { text: 'Taxa de recuperação' }), h('dd', { text: valorTotal ? G.fmt.pct(recebido / valorTotal) : 'Sem dados' })),
      h('div', null, h('dt', { text: 'Sem acordo' }), h('dd', { text: G.fmt.int(lista.filter((p) => p.ressarcimento.status === 'Sem acordo').length) })));
  }

  const filtros = [
    { key: 'busca', label: 'Processo, terceiro ou placa', span: 6 },
    { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS, span: 6 },
    { key: 'de', label: 'Aberto a partir de', tipo: 'date', span: 6 },
    { key: 'ate', label: 'Aberto até', tipo: 'date', span: 6 }
  ];
  const form = document.getElementById('filtros');
  const grade = form.querySelector('.form-grid');
  const campos = {};
  filtros.forEach((f) => {
    const el = G.field({ id: 'filtro-' + f.key, name: f.key, label: f.label, tipo: f.tipo || 'text', opcoes: f.opcoes, vazio: f.tipo === 'select' ? 'Todos' : undefined, valor: salvos[f.key] || '', span: f.span });
    grade.appendChild(el);
    campos[f.key] = el.control;
  });

  function filtra(v) {
    const termo = G.normaliza(v.busca);
    return todos().filter((p) => {
      const r = p.ressarcimento;
      if (termo && G.normaliza([G.numeroProcesso(p), p.terceiro ? p.terceiro.nome + ' ' + p.terceiro.placa : '', G.apolice(p).veiculo.placa].join(' ')).indexOf(termo) < 0) return false;
      if (v.status && r.status !== v.status) return false;
      if (v.de && r.desde.slice(0, 10) < v.de) return false;
      if (v.ate && r.desde.slice(0, 10) > v.ate) return false;
      return true;
    });
  }

  const alterar = document.getElementById('alterar-status');
  const colunas = [
    { key: 'processo', label: 'Processo', sort: (p) => G.numeroProcesso(p), class: 'nowrap', csv: (p) => G.numeroProcesso(p),
      render: (p) => h('span', null, h('a', { class: 'row-link', href: 'processo.html?id=' + p.id, text: G.numeroProcesso(p) }), h('span', { class: 'cell-sub', text: 'Segurado: ' + G.apolice(p).segurado.nome })) },
    { key: 'terceiro', label: 'Terceiro', sort: (p) => p.terceiro.nome, csv: (p) => p.terceiro.nome,
      render: (p) => h('span', null, p.terceiro.nome, h('span', { class: 'cell-sub', text: [p.terceiro.placa, p.terceiro.veiculo].filter(Boolean).join(' · ') })) },
    { key: 'valor', label: 'A ressarcir', num: true, sort: (p) => p.ressarcimento.valor, csv: (p) => G.fmt.decimal(p.ressarcimento.valor), render: (p) => G.fmt.money(p.ressarcimento.valor) },
    { key: 'recebido', label: 'Recebido', num: true, sort: (p) => p.ressarcimento.recebido || 0, csv: (p) => G.fmt.decimal(p.ressarcimento.recebido || 0), render: (p) => G.fmt.money(p.ressarcimento.recebido || 0) },
    { key: 'status', label: 'Status', sort: (p) => p.ressarcimento.status, csv: (p) => p.ressarcimento.status, render: (p) => G.statusBadge(p.ressarcimento.status) },
    { key: 'desde', label: 'Aberto em', sort: (p) => p.ressarcimento.desde, csv: (p) => G.fmt.date(p.ressarcimento.desde), render: (p) => h('span', null, G.fmt.date(p.ressarcimento.desde), h('span', { class: 'cell-sub', text: G.fmt.relativo(p.ressarcimento.desde) })) },
    { key: 'ultima', label: 'Última ação', csv: (p) => ultima(p).acao, render: (p) => h('span', null, ultima(p).acao, h('span', { class: 'cell-sub', text: ultima(p).quem + ', ' + G.fmt.date(ultima(p).quando) })) }
  ];
  const contador = document.getElementById('resultado-total');
  const tabela = G.dataTable({
    container: document.getElementById('resultado'),
    caption: 'Ressarcimentos',
    columns: colunas,
    rows: [],
    rowKey: (p) => p.id,
    rowLabel: (p) => 'ressarcimento do processo ' + G.numeroProcesso(p),
    selectable: true,
    sortKey: 'desde',
    sortDir: 'desc',
    emptyIcon: 'undo',
    emptyTitle: 'Nenhum ressarcimento com esses filtros',
    emptyText: 'Os ressarcimentos aparecem quando um pagamento é liberado num processo em que o terceiro causou o acidente.',
    onSelect(sel) {
      alterar.disabled = !sel.length;
      if (sel.length) G.announce(G.fmt.plural(sel.length, 'ressarcimento selecionado', 'ressarcimentos selecionados') + '.');
    }
  });

  function aplicar(anunciar) {
    const v = {};
    Object.keys(campos).forEach((k) => { v[k] = campos[k].value.trim(); });
    G.store.set(CHAVE, v);
    const linhas = filtra(v);
    tabela.update(linhas);
    contador.textContent = G.fmt.plural(linhas.length, 'ressarcimento', 'ressarcimentos');
    renderResumo();
    if (anunciar) G.announce(contador.textContent + '.');
  }
  form.addEventListener('submit', (ev) => { ev.preventDefault(); aplicar(true); });
  form.addEventListener('reset', () => window.setTimeout(() => { Object.keys(campos).forEach((k) => { campos[k].value = ''; }); aplicar(true); }, 0));

  alterar.addEventListener('click', async () => {
    const sel = tabela.selected().map((pid) => G.db.get('processos', pid));
    const res = await G.dialog({
      titulo: sel.length === 1 ? 'Alterar o ressarcimento de ' + G.numeroProcesso(sel[0]) : 'Alterar ' + sel.length + ' ressarcimentos',
      montar(corpo) {
        const status = G.field({ id: 'res-status', label: 'Novo status', tipo: 'select', opcoes: STATUS, required: true });
        const recebido = G.field({ id: 'res-recebido', label: 'Valor recebido (R$)', mask: 'money', rules: 'money', inputmode: 'decimal', max: 14, required: true, dica: sel.length === 1 ? 'O valor a ressarcir é de ' + G.fmt.money(sel[0].ressarcimento.valor) + '.' : 'Será aplicado a cada ressarcimento selecionado.' });
        if (sel.length === 1) recebido.control.value = G.fmt.decimal(sel[0].ressarcimento.valor);
        recebido.hidden = true;
        status.control.addEventListener('change', () => { recebido.hidden = status.control.value !== 'Ressarcido'; });
        corpo.append(status, recebido, G.field({ id: 'res-obs', label: 'O que aconteceu', tipo: 'textarea', required: true, max: 300, dica: 'Por exemplo: acordo fechado em 3 parcelas, terceiro não respondeu.' }));
      },
      confirmar: 'Salvar',
      aoConfirmar(f) {
        if (!G.validateForm(f)) return false;
        return { status: document.getElementById('res-status').value, recebido: G.parseMoney(document.getElementById('res-recebido').value), obs: document.getElementById('res-obs').value.trim() };
      }
    });
    if (!res) return;
    const agora = new Date().toISOString();
    sel.forEach((p) => {
      const r = p.ressarcimento;
      r.status = res.status;
      if (res.status === 'Ressarcido') r.recebido = res.recebido;
      r.historico.push({ quando: agora, quem: u.nome, acao: res.status + ': ' + res.obs });
      G.registra(p, 'Ressarcimento: ' + res.status.toLowerCase() + ' (' + res.obs + ')');
    });
    G.db.commit();
    tabela.clearSelection();
    aplicar(false);
    G.toast(sel.length === 1 ? 'Ressarcimento atualizado.' : sel.length + ' ressarcimentos atualizados.');
  });

  document.getElementById('exportar').addEventListener('click', () => G.downloadCsv('ressarcimentos.csv', colunas, tabela.rows()));

  aplicar(false);
})();
