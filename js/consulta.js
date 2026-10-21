/*
 * Sinistro Auto: consulta genérica dos cadastros (consulta.html?tipo=...).
 * Filtros, colunas e regras vêm do esquema em data.js.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const tipo = G.param('tipo');
  const schema = G.schemas[tipo];
  const grupoNav = G.NAV.find((g) => g.itens.some((i) => i.chave === tipo));

  const u = G.shell({
    ativo: tipo,
    titulo: schema ? schema.titulo : 'Página não encontrada',
    migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: grupoNav ? grupoNav.titulo : 'Cadastros' }, { label: schema ? schema.titulo : 'Não encontrada' }]
  });
  if (!u) return;

  const main = document.getElementById('conteudo');
  if (!schema) {
    main.replaceChildren(h('div', { class: 'card empty' },
      G.icon('alert'),
      h('h1', { text: 'Não encontramos essa lista' }),
      h('p', { text: 'O endereço pode estar incompleto. Escolha uma opção no menu ao lado.' }),
      h('a', { class: 'btn btn--primary', href: 'inicio.html', text: 'Voltar ao início' })));
    return;
  }

  const flash = G.store.get('destaque', null);
  G.store.remove('destaque');
  const chaveFiltros = 'filtros:' + tipo;
  const salvos = G.store.get(chaveFiltros, {});

  /* ---------------------------------------------------------- Cabeçalho */

  document.getElementById('pagina-grupo').textContent = grupoNav ? grupoNav.titulo : 'Cadastros';
  document.getElementById('pagina-titulo').textContent = schema.titulo;
  document.getElementById('pagina-descricao').textContent = schema.descricao;
  const novo = document.getElementById('pagina-novo');
  novo.href = 'cadastro.html?tipo=' + tipo;
  novo.append(G.icon('plus'), schema.novo);

  /* ------------------------------------------------------------ Filtros */

  const form = document.getElementById('filtros');
  form.setAttribute('aria-label', 'Filtrar ' + schema.titulo.toLowerCase());
  const grade = form.querySelector('.form-grid');
  const campos = {};
  schema.filtros.forEach((f) => {
    const id = 'filtro-' + f.key;
    if (f.tipo === 'checkbox') {
      const cb = h('input', { type: 'checkbox', id, name: f.key, checked: !!salvos[f.key] });
      grade.appendChild(h('div', { class: 'field span-12' }, h('label', { class: 'choice', for: id }, cb, f.label)));
      campos[f.key] = cb;
      return;
    }
    const opcoes = f.ref ? f.ref() : f.opcoes;
    const el = G.field({
      id, name: f.key, label: f.label, tipo: f.tipo === 'select' ? 'select' : 'text', opcoes,
      vazio: f.tipo === 'select' ? 'Todos' : undefined, mask: f.mask, inputmode: f.inputmode, max: f.max,
      valor: salvos[f.key] || '', span: schema.filtros.length > 4 ? 3 : (schema.filtros.length === 4 ? 3 : 4)
    });
    grade.appendChild(el);
    campos[f.key] = el.control;
  });
  G.applyMasks(form);

  function valoresFiltro() {
    const v = {};
    Object.keys(campos).forEach((k) => {
      const c = campos[k];
      v[k] = c.type === 'checkbox' ? c.checked : c.value.trim();
    });
    return v;
  }

  function filtra(v) {
    return G.db.all(tipo).filter((r) => schema.filtros.every((f) => {
      const val = v[f.key];
      if (!val) return true;
      if (f.match) return f.match(r, val);
      if (f.tipo === 'select') return String(r[f.key]) === String(val);
      return G.normaliza(r[f.key]).indexOf(G.normaliza(val)) >= 0;
    }));
  }

  /* ---------------------------------------------------------- Resultados */

  const colunas = schema.colunas.map((c) => Object.assign({}, c, {
    render: c.link
      ? (r) => h('span', null,
        h('a', { class: 'row-link', href: 'cadastro.html?tipo=' + tipo + '&id=' + r.id, text: c.linkText ? c.linkText(r) : r[c.key] }),
        c.sub && c.sub(r) ? h('span', { class: 'cell-sub', text: c.sub(r) }) : null)
      : c.render
  }));

  const contador = document.getElementById('resultado-total');
  const tabela = G.dataTable({
    container: document.getElementById('resultado'),
    columns: colunas,
    rows: [],
    caption: schema.titulo,
    rowKey: (r) => r.id,
    sortKey: schema.colunas[0].key,
    highlight: (r) => flash && flash.tipo === tipo && flash.id === r.id,
    emptyTitle: 'Nenhum resultado com esses filtros',
    emptyText: 'Revise os filtros ou limpe tudo para ver a lista completa.'
  });

  function aplicar(anunciar) {
    const v = valoresFiltro();
    G.store.set(chaveFiltros, v);
    const linhas = filtra(v);
    tabela.update(linhas);
    const ativos = Object.keys(v).filter((k) => v[k]).length;
    contador.textContent = G.fmt.plural(linhas.length, 'registro encontrado', 'registros encontrados') + (ativos ? ' com os filtros aplicados' : '');
    if (anunciar) G.announce(contador.textContent + '.');
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    aplicar(true);
  });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      Object.keys(campos).forEach((k) => {
        if (campos[k].type === 'checkbox') campos[k].checked = false; else campos[k].value = '';
      });
      aplicar(true);
    }, 0);
  });

  document.getElementById('exportar').addEventListener('click', () => {
    G.downloadCsv(tipo + '.csv', schema.colunas, tabela.rows());
  });
  document.getElementById('imprimir').addEventListener('click', () => window.print());

  aplicar(false);
})();
