/*
 * Sinistro Auto: formulário genérico de cadastro e edição
 * (cadastro.html?tipo=...&id=...). Os campos vêm do esquema em data.js.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const tipo = G.param('tipo');
  const id = Number(G.param('id')) || null;
  const schema = G.schemas[tipo];
  const grupoNav = G.NAV.find((g) => g.itens.some((i) => i.chave === tipo));
  const original = schema && id ? G.db.get(tipo, id) : null;

  const titulo = !schema ? 'Página não encontrada' : original ? schema.nomeRegistro(original) : schema.novo;
  const u = G.shell({
    ativo: tipo,
    titulo: schema ? titulo + ' | ' + schema.titulo : titulo,
    migalhas: [
      { label: 'Início', href: 'inicio.html' },
      { label: grupoNav ? grupoNav.titulo : 'Cadastros' },
      schema ? { label: schema.titulo, href: 'consulta.html?tipo=' + tipo } : null,
      { label: original ? 'Editar' : 'Novo cadastro' }
    ].filter(Boolean)
  });
  if (!u) return;

  const main = document.getElementById('conteudo');
  if (!schema || (id && !original)) {
    main.replaceChildren(h('div', { class: 'card empty' },
      G.icon('alert'),
      h('h1', { text: schema ? 'Esse cadastro não existe mais' : 'Não encontramos essa página' }),
      h('p', { text: schema ? 'Ele pode ter sido excluído. Volte para a lista e tente de novo.' : 'O endereço pode estar incompleto.' }),
      h('a', { class: 'btn btn--primary', href: schema ? 'consulta.html?tipo=' + tipo : 'inicio.html', text: schema ? 'Voltar para a lista' : 'Voltar ao início' })));
    return;
  }

  const rec = original ? JSON.parse(JSON.stringify(original)) : {};
  const visiveis = [];   // campos com showIf, reavaliados quando algo muda

  /* ---------------------------------------------------------- Cabeçalho */

  document.getElementById('pagina-grupo').textContent = schema.titulo;
  document.getElementById('pagina-titulo').textContent = titulo;
  const desc = document.getElementById('pagina-descricao');
  if (original) {
    desc.replaceChildren(h('ul', { class: 'meta' },
      h('li', null, G.icon('tag'), 'Código ' + original.codigo),
      h('li', null, G.icon('clock'), 'Última alteração em ' + G.fmt.dateTime(original.alteradoEm) + ' por ' + original.alteradoPor),
      h('li', null, G.statusBadge(original.status))));
  } else {
    desc.textContent = 'Preencha os dados abaixo. Os campos com * são obrigatórios.';
  }
  const voltar = document.getElementById('pagina-voltar');
  voltar.href = 'consulta.html?tipo=' + tipo;
  document.getElementById('cancelar').href = voltar.href;

  /* ------------------------------------------------------------ Campos */

  const form = document.getElementById('cadastro-form');
  const corpo = document.getElementById('cadastro-secoes');

  const fid = (key) => 'f-' + key.replace(/\./g, '-');
  const valorDe = (key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), rec);

  function campoSimples(c, chave) {
    const valor = valorDe(chave);
    const el = G.field({
      id: fid(chave), name: chave, label: c.label, tipo: c.tipo || 'text', opcoes: c.ref ? c.ref() : c.opcoes,
      required: c.required, opcional: c.opcional, rules: c.rules, mask: c.mask, inputmode: c.inputmode, max: c.max,
      min: c.min, maxValor: c.tipo === 'number' ? c.max : null, dica: c.dica, span: c.span, autocomplete: c.autocomplete, spellcheck: c.spellcheck,
      valor: valor !== undefined && valor !== null && valor !== ''
        ? (c.dinheiro && typeof valor === 'number' ? G.fmt.decimal(valor) : valor)
        : (original ? '' : (c.padrao || ''))
    });
    if (c.tipo === 'number') el.control.removeAttribute('maxlength');
    return el;
  }

  function campoRadio(c) {
    const valor = rec[c.key] !== undefined && rec[c.key] !== '' ? rec[c.key] : c.padrao;
    return G.choiceGroup({ id: fid(c.key), name: c.key, label: c.label, opcoes: c.opcoes, required: c.required, valor, span: c.span, box: true });
  }

  function campoEndereco(c) {
    const k = c.key;
    const e = rec[k] || {};
    const grade = h('div', { class: 'form-grid span-12', 'data-group': k });
    const def = [
      { key: 'cep', label: 'CEP', required: true, rules: 'cep', mask: 'cep', inputmode: 'numeric', max: 9, span: 3, autocomplete: 'off' },
      { key: 'logradouro', label: 'Logradouro', required: true, max: 120, span: 6 },
      { key: 'numero', label: 'Número', required: true, max: 10, span: 3 },
      { key: 'complemento', label: 'Complemento', opcional: true, max: 60, span: 4 },
      { key: 'bairro', label: 'Bairro', required: true, max: 60, span: 4 },
      { key: 'cidade', label: 'Cidade', required: true, max: 60, span: 4 },
      { key: 'uf', label: 'UF', tipo: 'select', opcoes: G.UFS, required: true, span: 3 }
    ];
    def.forEach((d) => {
      const el = campoSimples(d, k + '.' + d.key);
      el.control.value = e[d.key] || '';
      if (k === 'entrega') el.control.dataset.label = d.label + ' da entrega';
      grade.appendChild(el);
    });
    return grade;
  }

  function campoContatos(c) {
    const lista = h('div', { class: 'span-12 stack', 'data-contatos': c.key });
    const vazio = h('p', { class: 'muted', text: 'Nenhum contato ainda.' });
    const add = h('button', { type: 'button', class: 'btn btn--sm' }, G.icon('plus'), 'Adicionar contato');
    let n = 0;

    function renumera() {
      Array.from(lista.querySelectorAll('fieldset')).forEach((fs, i) => {
        fs.querySelector('legend').textContent = 'Contato ' + (i + 1);
        fs.querySelector('[data-remover]').setAttribute('aria-label', 'Remover contato ' + (i + 1));
      });
      vazio.hidden = lista.querySelectorAll('fieldset').length > 0;
    }

    function linha(ct) {
      n += 1;
      const base = c.key + '-' + n;
      const fs = h('fieldset', { class: 'card contato', 'data-contato': '' }, h('legend', { class: 'visually-hidden' }));
      const grade = h('div', { class: 'form-grid' },
        G.field({ id: base + '-nome', label: 'Nome', required: true, max: 80, span: 4, valor: ct.nome, dataLabel: 'Nome do contato' }),
        G.field({ id: base + '-telefone', label: 'Telefone', tipo: 'tel', required: true, rules: 'phone', mask: 'phone', inputmode: 'tel', max: 15, span: 4, valor: ct.telefone, dataLabel: 'Telefone do contato' }),
        G.field({ id: base + '-email', label: 'E-mail', tipo: 'email', opcional: true, rules: 'email', max: 80, span: 4, valor: ct.email, dataLabel: 'E-mail do contato' }));
      const remover = h('button', { type: 'button', class: 'btn btn--danger btn--sm', 'data-remover': '' }, G.icon('trash'), 'Remover');
      remover.addEventListener('click', () => {
        const anterior = fs.previousElementSibling;
        fs.remove();
        renumera();
        G.announce('Contato removido.');
        (anterior && anterior.querySelector('input') ? anterior.querySelector('input') : add).focus();
      });
      fs.append(grade, h('div', { class: 'btn-row btn-row--end' }, remover));
      lista.insertBefore(fs, vazio);
      G.applyMasks(fs);
      return fs;
    }

    lista.appendChild(vazio);
    (rec[c.key] || []).forEach(linha);
    renumera();
    add.addEventListener('click', () => {
      const fs = linha({});
      renumera();
      fs.querySelector('input').focus();
      G.announce('Novo contato adicionado.');
    });
    return h('div', { class: 'span-12' }, lista, h('div', { class: 'btn-row' }, add));
  }

  function campoChecklist(c) {
    const opcoes = c.ref ? c.ref() : c.opcoes;
    const atual = (rec[c.key] || []).map(String);
    const fs = G.choiceGroup({
      id: fid(c.key), name: c.key, label: c.label, opcoes, multiplo: true, box: true,
      valor: atual
    });
    fs.querySelector('legend').classList.add('visually-hidden');
    fs.dataset.numero = c.numero ? '1' : '';
    const contagem = h('p', { class: 'hint span-12', 'aria-live': 'polite' });
    const conta = () => { contagem.textContent = G.fmt.plural(fs.querySelectorAll('input:checked').length, 'opção marcada', 'opções marcadas') + ' de ' + opcoes.length + '.'; };
    fs.addEventListener('change', conta);
    conta();
    return h('div', { class: 'span-12' }, fs, contagem);
  }

  function campoPermissoes(c) {
    const telas = G.db.all('telas').filter((t) => t.status === 'Ativo');
    const acoes = [['consultar', 'Consultar'], ['incluir', 'Incluir'], ['alterar', 'Alterar'], ['excluir', 'Excluir']];
    const atual = rec[c.key] || {};
    const tbody = h('tbody');
    telas.forEach((t) => {
      const tr = h('tr', null, h('th', { scope: 'row', class: 'cell-title', text: t.nome }));
      acoes.forEach((a) => {
        tr.appendChild(h('td', null, h('input', {
          type: 'checkbox',
          'data-tela': t.id,
          'data-acao': a[0],
          'aria-label': a[1] + ' em ' + t.nome,
          checked: (atual[t.id] || []).indexOf(a[0]) >= 0
        })));
      });
      tbody.appendChild(tr);
    });
    const tabela = h('table', { class: 'table table--compact', id: fid(c.key) },
      h('caption', { class: 'visually-hidden', text: 'Permissões do perfil por funcionalidade' }),
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Funcionalidade' }), acoes.map((a) => h('th', { scope: 'col', text: a[1] })))),
      tbody);
    // Incluir, alterar ou excluir pressupõe enxergar a tela.
    tabela.addEventListener('change', (ev) => {
      const cb = ev.target;
      const linha = cb.closest('tr');
      const consultar = linha.querySelector('[data-acao="consultar"]');
      if (cb.dataset.acao !== 'consultar' && cb.checked && !consultar.checked) {
        consultar.checked = true;
        G.announce('Consultar também foi marcado, porque é preciso ver a funcionalidade para mexer nela.');
      }
      if (cb.dataset.acao === 'consultar' && !cb.checked) {
        const outros = linha.querySelectorAll('input:checked');
        if (outros.length) {
          outros.forEach((o) => { o.checked = false; });
          G.announce('As outras permissões dessa funcionalidade também foram desmarcadas.');
        }
      }
    });
    const todos = (marcar) => () => {
      tabela.querySelectorAll('input').forEach((i) => { i.checked = marcar; });
      G.announce(marcar ? 'Todas as permissões foram marcadas.' : 'Todas as permissões foram desmarcadas.');
    };
    return h('div', { class: 'span-12' },
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn btn--sm', onClick: todos(true) }, G.icon('check'), 'Liberar tudo'),
        h('button', { type: 'button', class: 'btn btn--sm', onClick: todos(false) }, G.icon('x'), 'Limpar tudo')),
      h('div', { class: 'table-wrap', role: 'region', 'aria-label': 'Permissões do perfil por funcionalidade', tabindex: '0' }, tabela));
  }

  function renderCampo(c) {
    let el;
    switch (c.tipo) {
      case 'radio': el = campoRadio(c); break;
      case 'endereco': el = campoEndereco(c); break;
      case 'contatos': el = campoContatos(c); break;
      case 'checklist': el = campoChecklist(c); break;
      case 'permissoes': el = campoPermissoes(c); break;
      default: el = campoSimples(c, c.key);
    }
    if (c.showIf) visiveis.push({ el, cond: c.showIf });
    return el;
  }

  const secoes = schema.secoes.filter((s) => !s.somenteEdicao || original);
  if (secoes.length > 3) {
    const indice = h('ul', { class: 'btn-row list-plain' });
    secoes.forEach((s, i) => indice.appendChild(h('li', null, h('a', { class: 'btn btn--sm', href: '#secao-' + i, text: s.titulo }))));
    corpo.appendChild(h('nav', { class: 'card no-print', 'aria-label': 'Seções deste cadastro' }, indice));
  }
  secoes.forEach((s, i) => {
    const tituloId = 'secao-' + i + '-titulo';
    const sec = h('section', { class: 'card', id: 'secao-' + i, 'aria-labelledby': tituloId },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: tituloId, text: s.titulo }), s.dica ? h('p', { text: s.dica }) : null)));
    const grade = h('div', { class: 'form-grid' });
    s.campos.forEach((c) => grade.appendChild(renderCampo(c)));
    sec.appendChild(grade);
    corpo.appendChild(sec);
  });

  function atualizaVisiveis() {
    visiveis.forEach((v) => {
      const marcado = form.querySelector('[name="' + v.cond.key + '"]:checked');
      v.el.hidden = !marcado || marcado.value !== v.cond.value;
    });
  }
  form.addEventListener('change', atualizaVisiveis);
  atualizaVisiveis();
  G.applyMasks(form);

  /* ------------------------------------------------------ Histórico */

  if (original && original.historico && original.historico.length) {
    const lista = h('ol', { class: 'history' });
    original.historico.slice().reverse().slice(0, 8).forEach((x) => {
      lista.appendChild(h('li', null, h('strong', { text: x.acao }), ' por ' + x.quem, h('time', { datetime: x.quando, text: G.fmt.dateTime(x.quando) })));
    });
    corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'historico-titulo' },
      h('div', { class: 'card__head' }, h('h2', { id: 'historico-titulo', text: 'Histórico de alterações' })),
      lista));
  }

  /* -------------------------------------------------------- Coleta */

  function coleta() {
    const out = JSON.parse(JSON.stringify(rec));
    schema.secoes.forEach((s) => s.campos.forEach((c) => {
      const oculto = visiveis.some((v) => v.cond && c.showIf && v.cond === c.showIf && v.el.hidden);
      switch (c.tipo) {
        case 'radio': {
          const m = form.querySelector('[name="' + c.key + '"]:checked');
          out[c.key] = m ? m.value : '';
          return;
        }
        case 'endereco': {
          if (oculto) { out[c.key] = null; return; }
          out[c.key] = {};
          ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'].forEach((k) => {
            out[c.key][k] = document.getElementById(fid(c.key + '.' + k)).value.trim();
          });
          return;
        }
        case 'contatos':
          out[c.key] = Array.from(form.querySelectorAll('[data-contatos="' + c.key + '"] fieldset')).map((fs) => {
            const ins = fs.querySelectorAll('input');
            return { nome: ins[0].value.trim(), telefone: ins[1].value.trim(), email: ins[2].value.trim() };
          });
          return;
        case 'checklist':
          out[c.key] = Array.from(document.querySelectorAll('#' + fid(c.key) + ' input:checked')).map((i) => (c.numero ? Number(i.value) : i.value));
          return;
        case 'permissoes': {
          const p = {};
          document.querySelectorAll('#' + fid(c.key) + ' input:checked').forEach((i) => {
            (p[i.dataset.tela] = p[i.dataset.tela] || []).push(i.dataset.acao);
          });
          out[c.key] = p;
          return;
        }
        default: {
          const el = document.getElementById(fid(c.key));
          if (oculto) { out[c.key] = ''; return; }
          const v = el.value.trim();
          if (c.dinheiro) out[c.key] = v ? G.parseMoney(v) : 0;
          else out[c.key] = c.numero && v ? Number(v) : (c.tipo === 'number' && v ? Number(v) : v);
        }
      }
    }));
    return out;
  }

  /* ---------------------------------------------------------- Salvar */

  const dirty = G.guardDirty(form);

  function semelhante(a, b) {
    const x = G.normaliza(a).replace(/[^a-z0-9 ]/g, '');
    const y = G.normaliza(b).replace(/[^a-z0-9 ]/g, '');
    if (!x || !y) return false;
    if (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return true;
    return x.split(' ')[0].length > 3 && x.split(' ')[0] === y.split(' ')[0];
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const ok = G.validateForm(form, {
      extra(addErro) {
        (schema.unico || []).forEach((regra) => {
          const el = document.getElementById(fid(regra.key));
          if (!el || !el.value.trim() || el.getAttribute('aria-invalid') === 'true') return;
          const alvo = regra.normaliza ? G.normaliza(el.value) : G.digitos(el.value) || el.value.trim();
          const repetido = G.db.all(tipo).some((r) => r.id !== id && (regra.normaliza ? G.normaliza(r[regra.key]) : G.digitos(r[regra.key]) || String(r[regra.key]).trim()) === alvo);
          if (repetido) addErro(el, regra.msg);
        });
      }
    });
    if (!ok) return;

    const dados = coleta();

    if (schema.parecidos) {
      const parecidos = G.db.all(tipo).filter((r) => r.id !== id && semelhante(r.nome, dados.nome));
      if (parecidos.length) {
        const seguir = await G.confirmDialog({
          titulo: 'Já existem nomes parecidos',
          montar(corpoDlg) {
            corpoDlg.append(
              h('p', { text: 'Encontramos cadastros com nome parecido com "' + dados.nome + '":' }),
              h('ul', null, parecidos.map((p) => h('li', { text: p.nome + ' (' + p.procedencia.toLowerCase() + ', ' + p.status.toLowerCase() + ')' }))),
              h('p', { text: 'Se for a mesma empresa, é melhor usar o cadastro que já existe. Quer salvar mesmo assim?' }));
          },
          cancelar: 'Revisar o nome',
          confirmar: 'Salvar mesmo assim'
        });
        if (!seguir) {
          document.getElementById(fid('nome')).focus();
          return;
        }
      }
    }

    const salvo = G.db.save(tipo, dados, original ? 'Cadastro alterado' : 'Cadastro criado');
    dirty.clean();
    G.store.set('destaque', { tipo, id: salvo.id });
    G.flash(original
      ? 'Alterações salvas em "' + schema.nomeRegistro(salvo) + '".'
      : 'Prontinho! "' + schema.nomeRegistro(salvo) + '" foi cadastrado.');
    window.location.href = 'consulta.html?tipo=' + tipo;
  });

  /* ---------------------------------------------------------- Excluir */

  const excluir = document.getElementById('excluir');
  if (original) {
    excluir.hidden = false;
    excluir.addEventListener('click', async () => {
      const motivo = tipo === 'usuarios' && id === u.id
        ? 'Esse é o seu próprio usuário. Peça para outra pessoa administradora fazer isso.'
        : (schema.emUso ? schema.emUso(id) : '');
      if (motivo) {
        await G.dialog({
          titulo: 'Não dá para excluir este cadastro',
          icone: 'info',
          descricao: motivo,
          somenteOk: true,
          confirmar: 'Entendi'
        });
        return;
      }
      const ok = await G.confirmDialog({
        titulo: 'Excluir "' + schema.nomeRegistro(original) + '"?',
        descricao: 'Essa ação não pode ser desfeita. Se a ideia é só tirar de uso, mude o status para Inativo.',
        confirmar: 'Excluir',
        tomBotao: 'danger'
      });
      if (!ok) return;
      G.db.remove(tipo, id);
      dirty.clean();
      G.flash('"' + schema.nomeRegistro(original) + '" foi excluído.');
      window.location.href = 'consulta.html?tipo=' + tipo;
    });
  }
})();
