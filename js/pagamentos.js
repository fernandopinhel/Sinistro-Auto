/*
 * Sinistro Auto: liberação de pagamentos. Quatro olhos: quem pede não
 * libera, e quem libera precisa de alçada para o valor.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'pagamentos', titulo: 'Liberação de pagamentos', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Sinistros' }, { label: 'Liberação de pagamentos' }] });
  if (!u) return;

  const eu = G.db.get('usuarios', u.id);
  const CHAVE = 'filtros:pagamentos';
  const salvos = G.store.get(CHAVE, { status: 'Aguardando liberação' });

  // Pagamento liberado com data programada vencida já foi creditado.
  G.db.all('processos').forEach((p) => p.pagamentos.forEach((g) => {
    if (g.status === 'Liberado' && g.dataProgramada <= G.hoje()) {
      g.status = 'Pago';
      G.registra(p, 'Pagamento de ' + G.fmt.money(g.valor) + ' creditado para ' + g.beneficiario, 'Sistema');
    }
  }));
  G.db.commit();

  function todos() {
    const out = [];
    G.db.all('processos').forEach((p) => p.pagamentos.forEach((g) => out.push({ g, p })));
    return out;
  }

  /* ------------------------------------------------------------ Resumo */

  function renderResumo() {
    const lista = todos();
    const aguardando = lista.filter((x) => x.g.status === 'Aguardando liberação');
    const posso = aguardando.filter((x) => !G.motivoNaoLibera(x.g, u.id));
    const hoje = lista.filter((x) => x.g.liberadoEm && x.g.liberadoEm.slice(0, 10) === G.hoje() && x.g.status !== 'Rejeitado');
    const soma = (l) => l.reduce((s, x) => s + x.g.valor, 0);
    document.getElementById('resumo-texto').textContent = eu.alcadaPagamento
      ? 'Sua alçada de pagamento é de ' + G.fmt.money(eu.alcadaPagamento) + '.'
      : 'Seu usuário não tem alçada de pagamento: você só consegue consultar.';
    document.getElementById('resumo').replaceChildren(
      h('div', null, h('dt', { text: 'Esperando liberação' }), h('dd', { text: G.fmt.int(aguardando.length) + ' · ' + G.fmt.money(soma(aguardando)) })),
      h('div', { class: 'is-good' }, h('dt', { text: 'Você pode liberar' }), h('dd', { text: G.fmt.int(posso.length) + ' · ' + G.fmt.money(soma(posso)) })),
      h('div', null, h('dt', { text: 'Liberados hoje' }), h('dd', { text: G.fmt.int(hoje.length) + ' · ' + G.fmt.money(soma(hoje)) })));
  }

  /* ----------------------------------------------------------- Filtros */

  const filtros = [
    { key: 'status', label: 'Status', tipo: 'select', opcoes: ['Aguardando liberação', 'Liberado', 'Pago', 'Rejeitado'], span: 3 },
    { key: 'forma', label: 'Forma de pagamento', tipo: 'select', opcoes: ['Conta corrente', 'OP eletrônica', 'Cheque'], span: 3 },
    { key: 'beneficiario', label: 'Quem recebe', tipo: 'select', opcoes: ['Oficina', 'Segurado', 'Terceiro', 'Financeira', 'Despachante'], span: 3 },
    { key: 'processo', label: 'Processo ou beneficiário', span: 3 },
    { key: 'de', label: 'Programado a partir de', tipo: 'date', span: 3 },
    { key: 'ate', label: 'Programado até', tipo: 'date', span: 3 }
  ];
  const form = document.getElementById('filtros');
  const grade = form.querySelector('.form-grid');
  const campos = {};
  filtros.forEach((f) => {
    const el = G.field({ id: 'filtro-' + f.key, name: f.key, label: f.label, tipo: f.tipo || 'text', opcoes: f.opcoes, vazio: f.tipo === 'select' ? 'Todos' : undefined, valor: salvos[f.key] || '', span: f.span });
    grade.appendChild(el);
    campos[f.key] = el.control;
  });
  const soMeus = h('input', { type: 'checkbox', id: 'filtro-alcada', name: 'alcada', checked: !!salvos.alcada });
  grade.appendChild(h('div', { class: 'field span-6 align-end' }, h('label', { class: 'choice', for: 'filtro-alcada' }, soMeus, 'Só os que eu posso liberar')));

  function valores() {
    const v = {};
    Object.keys(campos).forEach((k) => { v[k] = campos[k].value.trim(); });
    v.alcada = soMeus.checked;
    return v;
  }

  function filtra(v) {
    const termo = G.normaliza(v.processo);
    return todos().filter((x) => {
      if (v.status && x.g.status !== v.status) return false;
      if (v.forma && x.g.forma !== v.forma) return false;
      if (v.beneficiario && x.g.beneficiarioTipo !== v.beneficiario) return false;
      if (termo && G.normaliza(G.numeroProcesso(x.p) + ' ' + x.g.beneficiario).indexOf(termo) < 0) return false;
      if (v.de && x.g.dataProgramada < v.de) return false;
      if (v.ate && x.g.dataProgramada > v.ate) return false;
      if (v.alcada && (x.g.status !== 'Aguardando liberação' || G.motivoNaoLibera(x.g, u.id))) return false;
      return true;
    });
  }

  /* ---------------------------------------------------------- Tabela */

  const liberar = document.getElementById('liberar');
  const rejeitar = document.getElementById('rejeitar');
  const colunas = [
    { key: 'processo', label: 'Processo', sort: (x) => G.numeroProcesso(x.p), class: 'nowrap', csv: (x) => G.numeroProcesso(x.p),
      render: (x) => h('span', null, h('a', { class: 'row-link', href: 'processo.html?id=' + x.p.id + '&aba=indenizacoes', text: G.numeroProcesso(x.p) }), h('span', { class: 'cell-sub', text: G.nome.naturezaCurta(x.p.natureza) })) },
    { key: 'beneficiario', label: 'Quem recebe', sort: (x) => x.g.beneficiario, csv: (x) => x.g.beneficiario + ' (' + x.g.beneficiarioTipo + ')',
      render: (x) => h('span', null, x.g.beneficiario, h('span', { class: 'cell-sub', text: x.g.beneficiarioTipo + ' · ' + x.g.documento })) },
    { key: 'forma', label: 'Forma', sort: (x) => x.g.forma, csv: (x) => x.g.forma, render: (x) => h('span', null, x.g.forma, x.g.forma === 'Conta corrente' ? h('span', { class: 'cell-sub', text: G.nome.banco(x.g.banco) }) : null) },
    { key: 'valor', label: 'Valor', num: true, sort: (x) => x.g.valor, csv: (x) => G.fmt.decimal(x.g.valor), render: (x) => G.fmt.money(x.g.valor) },
    { key: 'data', label: 'Programado para', sort: (x) => x.g.dataProgramada, csv: (x) => G.fmt.date(x.g.dataProgramada), render: (x) => G.fmt.date(x.g.dataProgramada) },
    { key: 'pedido', label: 'Pedido por', sort: (x) => x.g.solicitadoPor, csv: (x) => x.g.solicitadoPor, render: (x) => h('span', null, x.g.solicitadoPor, h('span', { class: 'cell-sub', text: G.fmt.relativo(x.g.solicitadoEm) })) },
    { key: 'status', label: 'Situação', sort: (x) => x.g.status, csv: (x) => x.g.status, render: (x) => {
      const motivo = x.g.status === 'Aguardando liberação' ? G.motivoNaoLibera(x.g, u.id) : '';
      return h('span', null, G.statusBadge(x.g.status),
        h('span', { class: 'cell-sub', text: x.g.status === 'Aguardando liberação' ? (motivo || 'Você pode liberar') : x.g.motivo || (x.g.liberadoPor ? 'Por ' + x.g.liberadoPor : '') }));
    } }
  ];
  const contador = document.getElementById('resultado-total');
  const tabela = G.dataTable({
    container: document.getElementById('resultado'),
    caption: 'Pagamentos',
    columns: colunas,
    rows: [],
    rowKey: (x) => x.g.id,
    rowLabel: (x) => 'pagamento de ' + G.fmt.money(x.g.valor) + ' para ' + x.g.beneficiario,
    selectable: true,
    isSelectable: (x) => x.g.status === 'Aguardando liberação' && !G.motivoNaoLibera(x.g, u.id),
    sortKey: 'data',
    emptyIcon: 'coin',
    emptyTitle: 'Nenhum pagamento com esses filtros',
    emptyText: 'Revise os filtros ou limpe tudo para ver todos.',
    onSelect(sel) {
      liberar.disabled = !sel.length;
      rejeitar.disabled = !sel.length;
      const soma = sel.reduce((s, k) => s + achar(k).g.valor, 0);
      if (sel.length) G.announce(G.fmt.plural(sel.length, 'pagamento selecionado', 'pagamentos selecionados') + ', total de ' + G.fmt.money(soma) + '.');
    }
  });
  const achar = (idPag) => todos().find((x) => x.g.id === idPag);

  function aplicar(anunciar) {
    const v = valores();
    G.store.set(CHAVE, v);
    const linhas = filtra(v);
    tabela.update(linhas);
    contador.textContent = G.fmt.plural(linhas.length, 'pagamento', 'pagamentos') + ', ' + G.fmt.money(linhas.reduce((s, x) => s + x.g.valor, 0)) + ' no total';
    renderResumo();
    if (anunciar) G.announce(contador.textContent + '.');
  }

  form.addEventListener('submit', (ev) => { ev.preventDefault(); aplicar(true); });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      Object.keys(campos).forEach((k) => { campos[k].value = ''; });
      soMeus.checked = false;
      aplicar(true);
    }, 0);
  });

  /* ---------------------------------------------------------- Ações */

  liberar.addEventListener('click', async () => {
    const sel = tabela.selected().map(achar);
    const total = sel.reduce((s, x) => s + x.g.valor, 0);
    const ok = await G.confirmDialog({
      titulo: sel.length === 1 ? 'Liberar este pagamento?' : 'Liberar ' + sel.length + ' pagamentos?',
      icone: 'check-circle',
      tom: 'success',
      montar(corpo) {
        corpo.append(
          h('ul', null, sel.map((x) => h('li', { text: G.fmt.money(x.g.valor) + ' para ' + x.g.beneficiario + ' (processo ' + G.numeroProcesso(x.p) + ')' }))),
          h('p', null, 'Total: ', h('strong', { text: G.fmt.money(total) }), '. O banco credita na data programada de cada um.'));
      },
      confirmar: 'Liberar pagamentos',
      tomBotao: 'success'
    });
    if (!ok) return;
    let ressarcimentos = 0;
    sel.forEach((x) => {
      x.g.status = 'Liberado';
      x.g.liberadoPor = u.nome;
      x.g.liberadoEm = new Date().toISOString();
      x.p.marcos = x.p.marcos || {};
      x.p.marcos.pagamento = x.g.liberadoEm;
      G.registra(x.p, 'Pagamento de ' + G.fmt.money(x.g.valor) + ' para ' + x.g.beneficiario + ' liberado por ' + u.nome);
      // Se o terceiro causou o acidente, a seguradora passa a cobrar dele.
      if (x.p.culpado === 'Terceiro' && x.p.terceiro && G.natureza(x.p.natureza).cobertura === 'casco') {
        const pago = x.p.pagamentos.filter((g) => g.status === 'Liberado' || g.status === 'Pago').reduce((s, g) => s + g.valor, 0);
        if (!x.p.ressarcimento) {
          x.p.ressarcimento = { status: 'Aguardando acordo', valor: pago, recebido: 0, desde: x.g.liberadoEm, historico: [{ quando: x.g.liberadoEm, quem: 'Sistema', acao: 'Ressarcimento aberto depois do pagamento' }] };
          G.registra(x.p, 'Ressarcimento aberto contra ' + x.p.terceiro.nome, 'Sistema');
          ressarcimentos += 1;
        } else {
          x.p.ressarcimento.valor = pago;
        }
      }
    });
    G.db.commit();
    tabela.clearSelection();
    aplicar(false);
    G.toast((sel.length === 1 ? 'Pagamento liberado.' : sel.length + ' pagamentos liberados.') + (ressarcimentos ? ' Abrimos ' + G.fmt.plural(ressarcimentos, 'ressarcimento', 'ressarcimentos') + ' contra o terceiro.' : ''));
  });

  rejeitar.addEventListener('click', async () => {
    const sel = tabela.selected().map(achar);
    const motivo = await G.dialog({
      titulo: sel.length === 1 ? 'Rejeitar este pagamento?' : 'Rejeitar ' + sel.length + ' pagamentos?',
      icone: 'x-circle',
      tom: 'danger',
      descricao: 'Quem pediu recebe uma news no processo com o motivo, para corrigir e pedir de novo.',
      montar(corpo) { corpo.appendChild(G.field({ id: 'rej-motivo', label: 'Motivo', tipo: 'textarea', required: true, max: 300, dica: 'Por exemplo: conta do beneficiário não confere com o cadastro.' })); },
      confirmar: 'Rejeitar',
      tomBotao: 'danger',
      aoConfirmar(f) { return G.validateForm(f) ? document.getElementById('rej-motivo').value.trim() : false; }
    });
    if (!motivo) return;
    sel.forEach((x) => {
      x.g.status = 'Rejeitado';
      x.g.motivo = motivo;
      x.g.liberadoPor = u.nome;
      x.g.liberadoEm = new Date().toISOString();
      x.p.news.push({ id: Date.now() + x.g.id, tipo: 'Pagamento rejeitado', texto: G.fmt.money(x.g.valor) + ' para ' + x.g.beneficiario + ': ' + motivo, quando: x.g.liberadoEm, lida: false });
      G.registra(x.p, 'Pagamento de ' + G.fmt.money(x.g.valor) + ' rejeitado por ' + u.nome + ': ' + motivo);
    });
    G.db.commit();
    tabela.clearSelection();
    aplicar(false);
    G.toast(sel.length === 1 ? 'Pagamento rejeitado.' : sel.length + ' pagamentos rejeitados.');
  });

  document.getElementById('exportar').addEventListener('click', () => G.downloadCsv('pagamentos.csv', colunas, tabela.rows()));

  aplicar(false);
})();
