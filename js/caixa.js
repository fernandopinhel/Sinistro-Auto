/* Sinistro Auto: caixa de entrada do analista e fila do grupo. */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'caixa', titulo: 'Caixa de entrada', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Caixa de entrada' }] });
  if (!u) return;
  G.verificaPrazoCaixa(u.id);

  const cfg = G.db.raw().distribuicao;
  const prazoBadge = (p) => {
    const pz = G.prazo(p);
    return pz.status ? G.statusBadge(pz.status) : G.badge('Sem prazo');
  };
  const linkProcesso = (p) => h('span', null,
    h('a', { class: 'row-link', href: 'processo.html?id=' + p.id, text: G.numeroProcesso(p) }),
    h('span', { class: 'cell-sub', text: 'Aviso ' + p.aviso }));
  const segurado = (p) => {
    const ap = G.apolice(p);
    return h('span', null, ap.segurado.nome, h('span', { class: 'cell-veiculo' }, G.placa(ap.veiculo.placa, true), ap.veiculo.marca + ' ' + ap.veiculo.modelo));
  };

  /* --------------------------------------------- Processo devolvido */

  function renderDevolucoes() {
    const area = document.getElementById('devolucao');
    const pendentes = G.db.raw().devolucoes.filter((d) => d.usuarioId === u.id && !d.justificativa);
    area.replaceChildren();
    pendentes.forEach((d) => {
      const p = G.db.get('processos', d.processoId);
      const botao = h('button', { type: 'button', class: 'btn btn--sm' }, G.icon('message'), 'Justificar');
      botao.addEventListener('click', () => justificar(d, p));
      area.appendChild(h('div', { class: 'alert alert--warning', role: 'status' },
        G.icon('alert'),
        h('div', { class: 'alert__body' },
          h('p', { class: 'alert__title', text: 'O processo ' + G.numeroProcesso(p) + ' voltou para a fila ' + G.fmt.relativo(d.quando) + '.' }),
          h('p', { text: 'Ele ficou mais de ' + cfg.prazoMinutos + ' minutos na sua caixa sem nenhuma ação. Conte o que aconteceu, para a supervisão entender e ajustar a distribuição se for preciso.' })),
        botao));
    });
  }

  async function justificar(d, p) {
    const texto = await G.dialog({
      titulo: 'Por que o processo ' + G.numeroProcesso(p) + ' ficou parado?',
      montar(corpo) {
        corpo.appendChild(G.field({ id: 'just-texto', label: 'Justificativa', tipo: 'textarea', required: true, max: 200, dica: 'Até 200 caracteres. Por exemplo: estava em reunião, precisei atender outro processo urgente.' }));
      },
      confirmar: 'Enviar justificativa',
      aoConfirmar(form) {
        const ok = G.validateForm(form);
        return ok ? document.getElementById('just-texto').value.trim() : false;
      }
    });
    if (!texto) return;
    d.justificativa = texto;
    G.registra(p, 'Justificativa de ' + u.nome + ' para o processo parado: ' + texto);
    G.db.commit();
    renderDevolucoes();
    G.toast('Justificativa enviada. Obrigado!');
    document.getElementById('pegar-proximo').focus();
  }

  /* ------------------------------------------------------ Com você */

  const marcar = document.getElementById('marcar-news');
  const devolver = document.getElementById('devolver');
  const minhas = () => G.ordenaFila(G.db.all('processos').filter((p) => p.status === 'Aberto' && p.analistaId === u.id));

  const tabela = G.dataTable({
    container: document.getElementById('minha'),
    caption: 'Processos com você',
    rows: minhas(),
    rowKey: (p) => p.id,
    rowLabel: (p) => 'processo ' + G.numeroProcesso(p),
    selectable: true,
    emptyIcon: 'inbox',
    emptyTitle: 'Sua caixa está vazia',
    emptyText: 'Use "Pegar o próximo processo" para receber o próximo da fila.',
    columns: [
      { key: 'processo', label: 'Processo', sort: (p) => G.numeroProcesso(p), render: linkProcesso, class: 'nowrap' },
      { key: 'segurado', label: 'Segurado e veículo', sort: (p) => G.apolice(p).segurado.nome, render: segurado, class: 'col-seg' },
      { key: 'natureza', label: 'Natureza', sort: (p) => p.natureza, render: (p) => G.nome.naturezaCurta(p.natureza) },
      { key: 'posicao', label: 'Posição', sort: (p) => p.posicao, render: (p) => h('span', null, G.nome.posicao(p.posicao), h('span', { class: 'cell-sub', text: 'Desde ' + G.fmt.relativo(p.posicaoDesde) })) },
      { key: 'prazo', label: 'Prazo', sort: (p) => G.prazo(p).dias, render: prazoBadge },
      { key: 'news', label: 'News', sort: (p) => G.newsPendentes(p).length, render: (p) => {
        const n = G.newsPendentes(p);
        return n.length ? h('span', { class: 'badge-list' }, n.map((x) => G.badge(x.tipo, 'accent'))) : h('span', { class: 'muted', text: 'Nenhuma' });
      } }
    ],
    onSelect(sel) {
      marcar.disabled = !sel.length;
      devolver.disabled = !sel.length;
      if (sel.length) G.announce(G.fmt.plural(sel.length, 'processo selecionado', 'processos selecionados') + '.');
    }
  });

  function atualizaMinha() {
    const linhas = minhas();
    tabela.update(linhas, true);
    const comNews = linhas.filter((p) => G.newsPendentes(p).length).length;
    document.getElementById('minha-total').textContent = linhas.length
      ? G.fmt.plural(linhas.length, 'processo', 'processos') + (comNews ? ', ' + G.fmt.plural(comNews, 'com news', 'com news') : '') + '. Os que têm novidade aparecem primeiro.'
      : 'Nenhum processo com você agora.';
  }

  marcar.addEventListener('click', () => {
    const ids = tabela.selected();
    let n = 0;
    ids.forEach((id) => {
      const p = G.db.get('processos', id);
      const pend = G.newsPendentes(p);
      if (!pend.length) return;
      pend.forEach((x) => { x.lida = true; });
      G.registra(p, 'News tratadas: ' + pend.map((x) => x.tipo.toLowerCase()).join(', '));
      n += pend.length;
    });
    G.db.commit();
    tabela.clearSelection();
    atualizaMinha();
    G.toast(n ? G.fmt.plural(n, 'news marcada como tratada', 'news marcadas como tratadas') + '.' : 'Os processos selecionados não tinham news pendentes.');
  });

  devolver.addEventListener('click', async () => {
    const ids = tabela.selected();
    const motivo = await G.dialog({
      titulo: ids.length === 1 ? 'Devolver o processo para a fila?' : 'Devolver ' + ids.length + ' processos para a fila?',
      icone: 'undo',
      descricao: 'Eles voltam para a fila do grupo e a distribuição entrega para a próxima pessoa livre.',
      montar(corpo) {
        corpo.appendChild(G.field({ id: 'dev-motivo', label: 'Motivo', tipo: 'textarea', required: true, max: 200, dica: 'Fica registrado no histórico de cada processo.' }));
      },
      confirmar: 'Devolver para a fila',
      aoConfirmar(form) {
        return G.validateForm(form) ? document.getElementById('dev-motivo').value.trim() : false;
      }
    });
    if (!motivo) return;
    ids.forEach((id) => {
      const p = G.db.get('processos', id);
      p.analistaId = null;
      p.distribuidoAuto = false;
      G.registra(p, 'Devolvido para a fila por ' + u.nome + ': ' + motivo);
    });
    G.db.commit();
    tabela.clearSelection();
    atualizaMinha();
    renderFila();
    G.toast(ids.length === 1 ? 'Processo devolvido para a fila.' : ids.length + ' processos devolvidos para a fila.');
  });

  /* ------------------------------------------------------------ Fila */


  function renderFila() {
    const fila = G.filaDoUsuario(u.id);
    const grupos = cfg.grupos.filter((g) => g.analistas.indexOf(u.id) >= 0).map((g) => g.nome);
    document.getElementById('fila-total').textContent = grupos.length
      ? G.fmt.plural(fila.length, 'processo espera', 'processos esperam') + ' nos grupos ' + grupos.join(', ') + '. Quem pega o próximo recebe sempre o primeiro da lista.'
      : 'Você não está em nenhum grupo da distribuição automática.';
    const linhas = fila.map((p, i) => Object.assign({ ordem: i + 1 }, { p }));
    G.dataTable({
      container: document.getElementById('fila-lista'),
      caption: 'Fila do seu grupo, na ordem da distribuição',
      rows: linhas,
      rowKey: (r) => r.p.id,
      rowHeader: false,
      paginate: true,
      pageSize: 8,
      emptyIcon: 'check-circle',
      emptyTitle: 'Fila zerada',
      emptyText: 'Nenhum processo esperando no seu grupo.',
      columns: [
        { key: 'ordem', label: 'Ordem', num: true, class: 'col-ordem', render: (r) => String(r.ordem) },
        { key: 'processo', label: 'Processo', render: (r) => linkProcesso(r.p), class: 'nowrap' },
        { key: 'natureza', label: 'Natureza', render: (r) => G.nome.naturezaCurta(r.p.natureza) },
        { key: 'motivo', label: 'Por que está nessa ordem', render: (r) => G.motivoNaFila(r.p) },
        { key: 'prazo', label: 'Prazo', render: (r) => prazoBadge(r.p) },
        { key: 'desde', label: 'Na posição desde', render: (r) => G.fmt.relativo(r.p.posicaoDesde) }
      ]
    });
  }

  document.getElementById('pegar-proximo').addEventListener('click', () => {
    const p = G.pegaProximo(u.id);
    if (!p) {
      G.toast('A fila do seu grupo está vazia. Nada para pegar agora.');
      return;
    }
    G.flash('O processo ' + G.numeroProcesso(p) + ' agora está com você.');
    window.location.href = 'processo.html?id=' + p.id;
  });

  renderDevolucoes();
  atualizaMinha();
  renderFila();
})();
