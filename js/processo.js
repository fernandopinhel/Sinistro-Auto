/*
 * Sinistro Auto: detalhe do processo (processo.html?id=...&aba=...).
 * Cabeçalho com os dados principais, alertas e as abas de trabalho:
 * resumo, pareceres, orçamentos, indenizações, documentos, cartas e histórico.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const id = Number(G.param('id'));
  let p = G.db.get('processos', id);

  const ABAS = [
    { chave: 'resumo', label: 'Resumo', icone: 'file' },
    { chave: 'pareceres', label: 'Pareceres', icone: 'message', conta: () => p.pareceres.length },
    { chave: 'orcamentos', label: 'Orçamentos', icone: 'wrench', conta: () => p.orcamentos.length },
    { chave: 'indenizacoes', label: 'Indenizações', icone: 'coin', conta: () => p.pagamentos.length },
    { chave: 'documentos', label: 'Documentos', icone: 'paperclip', conta: () => p.documentos.length },
    { chave: 'cartas', label: 'Cartas', icone: 'mail', conta: () => p.cartas.length },
    { chave: 'historico', label: 'Histórico', icone: 'history' }
  ];
  const aba = ABAS.find((a) => a.chave === G.param('aba')) || ABAS[0];

  const u = G.shell({
    ativo: 'sinistros',
    titulo: p ? 'Processo ' + G.numeroProcesso(p) + (aba.chave !== 'resumo' ? ', ' + aba.label.toLowerCase() : '') : 'Processo não encontrado',
    migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Sinistros', href: 'sinistros.html' }, { label: p ? 'Processo ' + G.numeroProcesso(p) : 'Não encontrado' }]
  });
  if (!u) return;

  const main = document.getElementById('conteudo');
  if (!p) {
    main.replaceChildren(h('div', { class: 'card empty' },
      G.icon('alert'),
      h('h1', { text: 'Não encontramos esse processo' }),
      h('p', { text: 'O endereço pode estar incompleto. Procure o sinistro pela placa, pelo CPF ou pelo número.' }),
      h('a', { class: 'btn btn--primary', href: 'sinistros.html', text: 'Consultar sinistros' })));
    return;
  }

  const eu = G.db.get('usuarios', u.id);
  const supervisor = eu && eu.perfil === 1;
  const ap = G.apolice(p);
  const nat = G.natureza(p.natureza);
  const meu = () => p.analistaId === u.id && p.status === 'Aberto';
  const url = (chave) => 'processo.html?id=' + p.id + (chave && chave !== 'resumo' ? '&aba=' + chave : '');

  function salva(acao) {
    if (acao) G.registra(p, acao);
    G.db.commit();
  }

  const dl = (pares, classe) => h('dl', { class: classe || 'dl-grid' },
    pares.filter(Boolean).map((x) => h('div', null, h('dt', { text: x[0] }), h('dd', null, x[1] === '' || x[1] === null || x[1] === undefined ? h('span', { class: 'muted', text: 'Não informado' }) : x[1]))));

  const secao = (idSec, titulo, texto, ...filhos) => h('section', { class: 'card', 'aria-labelledby': idSec },
    h('div', { class: 'card__head' }, h('div', null, h('h2', { id: idSec, text: titulo }), texto ? h('p', { text: texto }) : null)),
    filhos);

  /* --------------------------------------------------------- Cabeçalho */

  function renderCabecalho() {
    const area = document.getElementById('proc-cabecalho');
    const pz = G.prazo(p);
    const paradas = G.jornada(p);

    area.replaceChildren(h('section', { class: 'ficha', 'aria-labelledby': 'pagina-titulo' },
      h('div', { class: 'ficha__topo' },
        h('div', null,
          h('span', { class: 'eyebrow', text: 'Sinistro ' + p.sinistro + ' · Processo ' + p.seq }),
          h('h1', { id: 'pagina-titulo', text: nat ? nat.descricao : 'Processo' }),
          h('div', { class: 'ficha__veiculo' },
            G.placa(ap.veiculo.placa),
            h('span', null, h('strong', { text: G.veiculoTexto(ap.veiculo) }), h('span', { class: 'cell-sub', text: ap.segurado.nome + ' · ocorrência em ' + G.fmt.date(p.ocorrencia.data) })))),
        h('div', { class: 'ficha__selos' },
          G.statusBadge(p.status),
          pz.status ? G.statusBadge(pz.status) : null,
          p.vistoriaPrioritaria ? G.badge('Vistoria prioritária', 'accent') : null)),
      h('h2', { class: 'visually-hidden', id: 'jornada-titulo', text: 'Jornada do sinistro' }),
      h('ol', { class: 'jornada', 'aria-labelledby': 'jornada-titulo' }, paradas.map((x) => h('li', { class: x.estado === 'feita' ? 'is-done' : x.estado === 'atual' ? 'is-current' : '', 'aria-current': x.estado === 'atual' ? 'step' : null },
        h('span', { class: 'jornada__ponto', 'aria-hidden': 'true' }, x.estado === 'feita' ? G.icon('check') : null),
        h('strong', { text: x.label }),
        h('span', { text: x.estado === 'feita' ? (x.data ? G.fmt.date(x.data) : 'Feito') : x.estado === 'atual' ? 'Agora' : 'A seguir' }))))));

    renderFicha(pz);
  }

  // Coluna lateral: situação, saldo e as ações de quem trata o processo.
  function renderFicha(pz) {
    const aside = document.getElementById('proc-ficha');
    const acoes = h('div');
    if (p.status === 'Aberto' && meu()) {
      acoes.append(
        h('button', { type: 'button', class: 'btn btn--primary', onClick: () => dialogoPosicao(true) }, G.icon('check'), 'Concluir atendimento'),
        h('button', { type: 'button', class: 'btn', onClick: () => dialogoPosicao(false) }, G.icon('flag'), 'Alterar posição'));
    } else if (p.status === 'Aberto' && supervisor) {
      acoes.append(h('button', { type: 'button', class: 'btn btn--primary', onClick: assumir }, G.icon('user-check'), 'Assumir processo'));
    } else if (p.status === 'Encerrado' && supervisor) {
      acoes.append(h('button', { type: 'button', class: 'btn', onClick: reabrir }, G.icon('undo'), 'Reabrir processo'));
    }
    const sal = G.saldo(p);
    aside.replaceChildren(
      h('section', { class: 'aside-card', 'aria-labelledby': 'ficha-situacao' },
        h('h2', { id: 'ficha-situacao', text: 'Situação' }),
        h('dl', null,
          h('div', null, h('dt', { text: 'Posição' }), h('dd', { text: G.nome.posicao(p.posicao) })),
          h('div', null, h('dt', { text: 'Prazo da posição' }), h('dd', null, pz.status ? G.statusBadge(pz.status) : 'Sem prazo', pz.limite ? h('span', { class: 'cell-sub', text: 'Até ' + G.fmt.date(pz.limite) }) : null)),
          h('div', null, h('dt', { text: 'Responsável' }), h('dd', { text: p.analistaId ? (p.analistaId === u.id ? 'Você' : G.nome.usuario(p.analistaId)) : p.status === 'Aberto' ? 'Na fila do grupo' : 'Ninguém, processo encerrado' }))),
        acoes.children.length ? h('div', { class: 'aside-acoes' }, acoes) : null),
      h('section', { class: 'aside-card', 'aria-labelledby': 'ficha-saldo' },
        h('h2', { id: 'ficha-saldo', text: 'Saldo da cobertura' }),
        h('p', { class: 'aside-saldo', text: G.fmt.money(sal.saldo) }),
        medidor(sal, true)),
      h('section', { class: 'aside-card', 'aria-labelledby': 'ficha-ids' },
        h('h2', { id: 'ficha-ids', text: 'Identificação' }),
        h('dl', null,
          h('div', null, h('dt', { text: 'Apólice' }), h('dd', { text: G.chaveApolice(ap) })),
          h('div', null, h('dt', { text: 'Aviso' }), h('dd', { text: p.aviso })),
          h('div', null, h('dt', { text: 'Canal' }), h('dd', { text: p.canal })))));
  }

  /* ----------------------------------------------------------- Alertas */

  function renderAlertas() {
    const area = document.getElementById('proc-alertas');
    area.replaceChildren();
    const alerta = (tom, icone, titulo, texto, acao) => area.appendChild(h('div', { class: 'alert alert--' + tom },
      G.icon(icone), h('div', { class: 'alert__body' }, titulo ? h('p', { class: 'alert__title', text: titulo }) : null, texto ? (typeof texto === 'string' ? h('p', { text: texto }) : texto) : null), acao || null));

    if (p.status === 'Encerrado') {
      alerta('info', 'info', 'Processo encerrado em ' + G.fmt.date(p.encerradoEm) + '.', 'Posição final: ' + G.nome.posicao(p.posicao) + '. As abas ficam disponíveis só para consulta.');
    } else if (!meu()) {
      alerta('info', 'lock', p.analistaId ? 'Este processo está com ' + G.nome.usuario(p.analistaId) + '.' : 'Este processo está na fila.',
        (p.analistaId ? 'Só quem está com o processo pode alterar.' : 'Ele vai para quem pegar o próximo da fila do grupo.') + (supervisor ? ' Como supervisor, você pode assumir.' : ' Você está vendo em modo de consulta.'));
    }

    const news = G.newsPendentes(p);
    if (news.length) {
      const botao = meu() ? h('button', { type: 'button', class: 'btn btn--sm', onClick: tratarNews }, G.icon('check'), 'Marcar como tratadas') : null;
      alerta('info', 'bell', G.fmt.plural(news.length, 'novidade', 'novidades') + ' neste processo',
        h('ul', null, news.map((n) => h('li', null, h('strong', { text: n.tipo + ': ' }), n.texto + ' (' + G.fmt.relativo(n.quando) + ')'))), botao);
    }
    if (p.status === 'Aberto' && G.prazo(p).status === 'Prazo estourado') {
      alerta('error', 'clock', 'O prazo da posição "' + G.nome.posicao(p.posicao) + '" estourou há ' + G.fmt.plural(-G.prazo(p).dias, 'dia', 'dias') + '.', G.posicao(p.posicao).orientacao);
    }
    if (ap.premioPendente) {
      alerta('warning', 'alert', 'Há prêmio pendente de ' + G.fmt.money(ap.premioPendente) + ' nesta apólice.', 'Desconte o valor da indenização ou peça ao segurado para regularizar antes do pagamento.');
    }
    if (ap.alienacao && nat && nat.grupo === 'Indenização integral') {
      const fin = G.db.get('instituicoes', ap.alienacao);
      alerta('warning', 'bank', 'Veículo financiado pela ' + (fin ? fin.nomeFantasia : 'financeira') + '.', 'Na indenização integral, primeiro quitamos o saldo devedor com a financeira e o restante vai para o segurado.');
    }
    if (p.ocorrencia.data < ap.vigInicio || p.ocorrencia.data > ap.vigFim) {
      alerta('error', 'shield', 'A ocorrência está fora da vigência da apólice.', 'Vigência de ' + G.fmt.date(ap.vigInicio) + ' a ' + G.fmt.date(ap.vigFim) + '. Confira antes de indenizar.');
    }
  }

  function tratarNews() {
    const pend = G.newsPendentes(p);
    pend.forEach((n) => { n.lida = true; });
    salva('News tratadas: ' + pend.map((n) => n.tipo.toLowerCase()).join(', '));
    renderAlertas();
    G.toast('Novidades marcadas como tratadas.');
    main.focus();
  }

  /* -------------------------------------------------------------- Abas */

  function renderAbas() {
    const ul = h('ul', { class: 'steps tabs-nav' });
    ABAS.forEach((a) => {
      const n = a.conta ? a.conta() : null;
      ul.appendChild(h('li', null, h('a', { class: 'step-btn', href: url(a.chave), 'aria-current': a.chave === aba.chave ? 'page' : null },
        G.icon(a.icone), a.label, n ? h('span', { class: 'step-num' }, String(n)) : null)));
    });
    document.getElementById('proc-abas').replaceChildren(ul);
  }

  function render() {
    p = G.db.get('processos', id);
    renderCabecalho();
    renderAlertas();
    renderAbas();
    const area = document.getElementById('proc-conteudo');
    area.replaceChildren(h('h2', { class: 'visually-hidden', id: 'aba-titulo', text: aba.label }));
    const corpo = h('div', { class: 'stack' });
    area.appendChild(corpo);
    ({ resumo, pareceres, orcamentos, indenizacoes, documentos, cartas, historico })[aba.chave](corpo);
  }

  /* -------------------------------------------------------------- Resumo */

  function resumo(corpo) {
    const sal = G.saldo(p);
    const ocorrencia = secao('oc-titulo', 'Ocorrência', null,
      dl([
        ['Data e hora', G.fmt.date(p.ocorrencia.data) + ' às ' + p.ocorrencia.hora],
        ['Local', p.ocorrencia.logradouro + ', ' + p.ocorrencia.bairro + ', ' + p.ocorrencia.cidade + '/' + p.ocorrencia.uf],
        ['Aviso feito em', G.fmt.dateTime(p.avisadoEm) + ' pelo canal ' + p.canal.toLowerCase()],
        ['Boletim de ocorrência', p.ocorrencia.boletim],
        ['Quem dirigia', p.condutor.segurado === 'sim' ? 'O próprio segurado' : p.condutor.nome + ' (CPF ' + p.condutor.cpf + ')'],
        ['Quem causou', p.culpado]
      ]),
      h('h3', { text: 'Relato' }),
      h('p', { class: 'relato', text: p.ocorrencia.relato }));

    const linhasCob = Object.keys(G.COBERTURAS).map((k) => {
      const usada = k === sal.cobertura;
      return h('tr', { class: usada ? 'is-selected' : '' },
        h('th', { scope: 'row' }, G.COBERTURAS[k], usada ? h('span', { class: 'cell-sub', text: 'Usada por este processo' }) : null),
        h('td', { class: 'num', text: G.fmt.money(ap.coberturas[k].is) }),
        h('td', { class: 'num', text: ap.coberturas[k].franquia ? G.fmt.money(ap.coberturas[k].franquia) : 'Sem franquia' }));
    });
    const vigente = G.hoje() >= ap.vigInicio && G.hoje() <= ap.vigFim;
    const apolice = secao('ap-titulo', 'Apólice e coberturas', null,
      dl([
        ['Chave da apólice', G.chaveApolice(ap)],
        ['Vigência', h('span', null, G.fmt.date(ap.vigInicio) + ' a ' + G.fmt.date(ap.vigFim), ' ', G.badge(vigente ? 'Vigente' : 'Vencida', vigente ? 'success' : 'danger'))],
        ['Corretor', ap.corretor],
        ['Carro reserva', ap.carroReservaDias ? G.fmt.plural(ap.carroReservaDias, 'dia', 'dias') : 'Não contratado']
      ]),
      h('div', { class: 'table-wrap', role: 'region', 'aria-label': 'Coberturas da apólice', tabindex: '0' },
        h('table', { class: 'table table--compact table--cob' },
          h('caption', { class: 'visually-hidden', text: 'Coberturas da apólice' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Cobertura' }), h('th', { scope: 'col', class: 'num', text: 'Valor segurado' }), h('th', { scope: 'col', class: 'num', text: 'Franquia' }))),
          h('tbody', null, linhasCob))),
      medidor(sal));

    const fin = ap.alienacao ? G.db.get('instituicoes', ap.alienacao) : null;
    const veiculo = secao('vei-titulo', 'Veículo', null, dl([
      ['Marca e modelo', ap.veiculo.marca + ' ' + ap.veiculo.modelo],
      ['Ano', ap.veiculo.anoFab + '/' + ap.veiculo.anoMod],
      ['Cor', ap.veiculo.cor],
      ['Placa', G.placa(ap.veiculo.placa, true)],
      ['Chassi', ap.veiculo.chassi],
      ['Valor de referência', G.fmt.money(ap.veiculo.fipe)],
      ['Financiamento', fin ? fin.nomeFantasia : 'Não financiado']
    ]));
    const segurado = secao('seg-titulo', 'Segurado', null, dl([
      ['Nome', ap.segurado.nome],
      [ap.segurado.tipo === 'PJ' ? 'CNPJ' : 'CPF', ap.segurado.documento],
      ['Telefone', p.contato ? p.contato.telefone : ap.segurado.telefone],
      ['E-mail', p.contato ? p.contato.email : ap.segurado.email],
      ['Cidade', ap.segurado.cidade + '/' + ap.segurado.uf]
    ]));
    const terceiro = p.terceiro ? secao('ter-titulo', 'Terceiro envolvido', null, dl([
      ['Nome', p.terceiro.nome],
      ['CPF ou CNPJ', p.terceiro.documento],
      ['Telefone', p.terceiro.telefone],
      ['Veículo', p.terceiro.veiculo],
      ['Placa', p.terceiro.placa ? G.placa(p.terceiro.placa, true) : '']
    ])) : null;

    const irmaos = G.db.all('processos').filter((x) => x.sinistro === p.sinistro && x.id !== p.id);
    const outros = irmaos.length ? secao('irm-titulo', 'Outros processos deste sinistro', 'Um mesmo acidente pode gerar um processo para cada cobertura.',
      h('ul', { class: 'list-plain attention' }, irmaos.map((x) => h('li', null,
        h('div', null, h('a', { href: 'processo.html?id=' + x.id, text: G.numeroProcesso(x) + ' · ' + G.nome.naturezaCurta(x.natureza) }), h('span', { class: 'cell-sub', text: G.nome.posicao(x.posicao) })),
        G.statusBadge(x.status))))) : null;

    corpo.append(...[ocorrencia, apolice, h('div', { class: 'grid-3' }, veiculo, segurado, terceiro), outros].filter(Boolean));
  }

  function medidor(sal, compacto) {
    const usado = sal.is ? Math.min(1, sal.usado / sal.is) : 0;
    const barra = h('span', { class: 'meter__fill' + (usado > .8 ? ' is-high' : '') });
    barra.style.width = Math.round(usado * 100) + '%';
    return h('div', { class: 'meter-block' },
      compacto ? null : h('p', { class: 'meter-label' }, h('span', { text: 'Saldo disponível' }), h('strong', { text: G.fmt.money(sal.saldo) })),
      h('span', { class: 'meter', role: 'img', 'aria-label': G.fmt.pct(usado) + ' da importância segurada já usada' }, barra),
      h('p', { class: 'hint', text: G.fmt.money(sal.usado) + ' já pagos ou pedidos de ' + G.fmt.money(sal.is) + (compacto ? ' em ' + sal.rotulo.toLowerCase() + '.' : ', somando todos os processos da apólice.') }));
  }

  /* ---------------------------------------------------------- Pareceres */

  function pareceres(corpo) {
    if (meu()) corpo.appendChild(formParecer());

    const filtro = G.field({ id: 'par-filtro', label: 'Mostrar', tipo: 'select', vazio: 'Todas as categorias', opcoes: Object.keys(G.CATEGORIAS_PARECER) });
    filtro.classList.add('span-4');
    const lista = h('div', { class: 'parecer-lista' });
    const abrir = h('button', { type: 'button', class: 'btn btn--sm' }, G.icon('chevron-down'), 'Abrir todos');
    const fechar = h('button', { type: 'button', class: 'btn btn--sm' }, G.icon('x'), 'Fechar todos');
    const contagem = h('p', { 'aria-live': 'polite' });

    function desenha() {
      const cat = filtro.control.value;
      const itens = p.pareceres.slice().reverse().filter((x) => !cat || x.categoria === cat);
      contagem.textContent = G.fmt.plural(itens.length, 'parecer', 'pareceres') + (cat ? ' em ' + cat : '');
      lista.replaceChildren();
      if (!itens.length) {
        lista.appendChild(h('div', { class: 'empty' }, G.icon('message'), h('strong', { text: 'Nenhum parecer por aqui' }), h('p', { text: meu() ? 'Registre o primeiro parecer no formulário acima.' : 'Ainda não há pareceres nesta categoria.' })));
        return;
      }
      itens.forEach((x, i) => {
        const docs = (x.documentos || []).map((d) => p.documentos.find((y) => y.id === d)).filter(Boolean);
        lista.appendChild(h('details', { class: 'disclosure', id: 'parecer-' + x.id, open: i === 0 },
          h('summary', null, G.icon('chevron-down'),
            h('span', null, x.tipo + ' · ' + x.categoria, h('span', { class: 'cell-sub', text: G.fmt.dateTime(x.quando) + ' por ' + x.autor }))),
          h('div', { class: 'disclosure__body' },
            h('p', { class: 'relato', text: x.texto }),
            docs.length ? h('p', { class: 'hint' }, G.icon('paperclip'), ' Documentos associados: ' + docs.map((d) => G.nome.tipoDocumento(d.tipoId)).join(', ')) : null)));
      });
    }
    filtro.control.addEventListener('change', () => { desenha(); G.announce(contagem.textContent + '.'); });
    abrir.addEventListener('click', () => { lista.querySelectorAll('details').forEach((d) => { d.open = true; }); G.announce('Todos os pareceres abertos.'); });
    fechar.addEventListener('click', () => { lista.querySelectorAll('details').forEach((d) => { d.open = false; }); G.announce('Todos os pareceres fechados.'); });

    corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'par-lista-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'par-lista-titulo', text: 'Pareceres do processo' }), contagem), h('div', { class: 'btn-row' }, abrir, fechar)),
      h('div', { class: 'form-grid toolbar-grid' }, filtro),
      lista));
    desenha();
  }

  function formParecer() {
    const form = h('form', { id: 'parecer-form', novalidate: true });
    const categoria = G.field({ id: 'par-categoria', label: 'Categoria', tipo: 'select', opcoes: Object.keys(G.CATEGORIAS_PARECER), required: true, span: 6 });
    const tipo = G.field({ id: 'par-tipo', label: 'Tipo do parecer', tipo: 'select', opcoes: [], required: true, span: 6, vazio: 'Escolha a categoria primeiro' });
    const texto = G.field({ id: 'par-texto', label: 'Parecer', tipo: 'textarea', required: true, max: 2000, dica: 'Explique o que foi analisado e o que vem a seguir. Quem pegar o processo depois vai ler isto.' });
    texto.className += ' span-12';
    categoria.control.addEventListener('change', () => {
      const lista = G.CATEGORIAS_PARECER[categoria.control.value] || [];
      tipo.control.replaceChildren(h('option', { value: '', text: lista.length ? 'Selecione' : 'Escolha a categoria primeiro' }), ...lista.map((t) => h('option', { value: t, text: t })));
    });
    const grade = h('div', { class: 'form-grid' }, categoria, tipo, texto);
    if (p.documentos.length) {
      const docs = G.choiceGroup({ id: 'par-docs', name: 'docs', label: 'Associar documentos (opcional)', multiplo: true, box: true, opcoes: p.documentos.map((d) => ({ value: String(d.id), label: G.nome.tipoDocumento(d.tipoId) })) });
      docs.classList.add('span-12');
      grade.appendChild(docs);
    }
    form.append(h('div', { 'data-summary-anchor': '' }), grade,
      h('div', { class: 'btn-row btn-row--end form-foot' }, h('button', { type: 'submit', class: 'btn btn--primary' }, G.icon('check'), 'Salvar parecer')));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ok = G.validateForm(form, {
        extra(addErro) {
          const v = texto.control.value.trim();
          if (v && v.length < 20) addErro(texto.control, 'Escreva pelo menos 20 caracteres, para o parecer fazer sentido para quem ler depois.');
        }
      });
      if (!ok) return;
      const novo = {
        id: Date.now(), quando: new Date().toISOString(), autor: u.nome,
        categoria: categoria.control.value, tipo: tipo.control.value, texto: texto.control.value.trim(),
        documentos: Array.from(form.querySelectorAll('#par-docs input:checked')).map((i) => Number(i.value))
      };
      p.pareceres.push(novo);
      salva('Parecer incluído: ' + novo.categoria + ', ' + novo.tipo.toLowerCase());
      G.toast('Parecer salvo.');
      render();
      const el = document.getElementById('parecer-' + novo.id);
      if (el) { el.querySelector('summary').focus(); }
    });
    return h('section', { class: 'card', 'aria-labelledby': 'par-novo-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'par-novo-titulo', text: 'Novo parecer' }), h('p', { text: 'Registre o que você analisou. O parecer fica no processo para sempre.' }))),
      form);
  }

  /* --------------------------------------------------------- Orçamentos */

  const LIMITE_REPARO = 0.75;

  function orcamentos(corpo) {
    const sal = G.saldo(p);
    const autorizados = p.orcamentos.filter((o) => o.status === 'Autorizado').reduce((s, o) => s + G.totaisOrcamento(o).total, 0);
    corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'orc-ref-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'orc-ref-titulo', text: 'Referências para o reparo' }),
        h('p', { text: 'Quando o reparo passa de 75% do valor do veículo, o caminho é a indenização integral.' })),
      meu() && (sal.cobertura === 'casco' || sal.cobertura === 'rcfDm') ? h('button', { type: 'button', class: 'btn btn--primary', id: 'orc-incluir', onClick: () => abreFormOrcamento() }, G.icon('plus'), 'Incluir orçamento') : null),
      h('dl', { class: 'totals' },
        h('div', null, h('dt', { text: 'Valor de referência do veículo' }), h('dd', { text: G.fmt.money(ap.veiculo.fipe) })),
        h('div', null, h('dt', { text: 'Limite para reparo (75%)' }), h('dd', { text: G.fmt.money(ap.veiculo.fipe * LIMITE_REPARO) })),
        h('div', null, h('dt', { text: 'Franquia' }), h('dd', { text: sal.franquia ? G.fmt.money(sal.franquia) : 'Sem franquia' })),
        h('div', { class: 'is-good' }, h('dt', { text: 'Total autorizado' }), h('dd', { text: G.fmt.money(autorizados) })))));

    corpo.appendChild(h('div', { id: 'orc-form-area' }));

    if (!p.orcamentos.length) {
      corpo.appendChild(h('div', { class: 'card empty' }, G.icon('wrench'), h('strong', { text: 'Nenhum orçamento ainda' }),
        h('p', { text: 'Quando a oficina mandar o orçamento, ele aparece aqui para análise.' })));
      return;
    }
    p.orcamentos.slice().reverse().forEach((o) => corpo.appendChild(cardOrcamento(o)));
  }

  function cardOrcamento(o) {
    const t = G.totaisOrcamento(o);
    const of = G.db.get('oficinas', o.oficinaId);
    const tituloId = 'orc-' + o.id + '-titulo';
    const acoes = h('div', { class: 'btn-row' });
    if (meu() && o.status === 'Em análise') {
      acoes.append(
        h('button', { type: 'button', class: 'btn btn--danger btn--sm', onClick: () => naoAutorizar(o) }, G.icon('x'), 'Não autorizar'),
        h('button', { type: 'button', class: 'btn btn--success-solid btn--sm', onClick: () => autorizar(o) }, G.icon('check'), 'Autorizar'));
    }
    const itens = h('table', { class: 'table table--compact' },
      h('caption', { class: 'visually-hidden', text: 'Itens do orçamento ' + o.numero }),
      h('thead', null, h('tr', null, ['Item', 'Tipo', 'Quantidade', 'Valor unitário', 'Total'].map((c, i) => h('th', { scope: 'col', class: i > 1 ? 'num' : '', text: c })))),
      h('tbody', null, o.itens.map((i) => h('tr', null,
        h('th', { scope: 'row', text: i.descricao }), h('td', { text: i.tipo }), h('td', { class: 'num', text: String(i.quantidade) }),
        h('td', { class: 'num', text: G.fmt.money(i.valor) }), h('td', { class: 'num', text: G.fmt.money(i.valor * i.quantidade) })))),
      h('tfoot', null, h('tr', null, h('th', { scope: 'row', colspan: '4', text: 'Total do orçamento' }), h('td', { class: 'num', text: G.fmt.money(t.total) }))));
    return h('section', { class: 'card', id: 'orcamento-' + o.id, 'aria-labelledby': tituloId },
      h('div', { class: 'card__head' },
        h('div', null,
          h('h2', { id: tituloId }, 'Orçamento ' + o.numero + ' ', h('span', { class: 'muted', text: '· versão ' + o.versao })),
          h('ul', { class: 'meta' },
            h('li', null, G.icon('wrench'), of ? of.nomeFantasia + ' (' + of.tipo.toLowerCase() + ')' : 'Oficina'),
            h('li', null, G.icon('calendar'), 'Recebido em ' + G.fmt.dateTime(o.data)),
            h('li', null, G.statusBadge(o.status)))),
        acoes),
      h('dl', { class: 'totals' },
        h('div', null, h('dt', { text: 'Peças' }), h('dd', { text: G.fmt.money(t.pecas) })),
        h('div', null, h('dt', { text: 'Mão de obra' }), h('dd', { text: G.fmt.money(t.mao) })),
        h('div', null, h('dt', { text: 'Total' }), h('dd', { text: G.fmt.money(t.total) })),
        h('div', null, h('dt', { text: 'Em relação ao veículo' }), h('dd', { text: G.fmt.pct(t.total / ap.veiculo.fipe) }))),
      o.status === 'Não autorizado' && o.motivo ? h('div', { class: 'alert alert--error' }, G.icon('x-circle'), h('div', { class: 'alert__body' }, h('p', { class: 'alert__title', text: 'Não autorizado por ' + o.analisadoPor }), h('p', { text: o.motivo }))) : null,
      o.status === 'Autorizado' ? h('p', { class: 'hint' }, 'Autorizado por ' + o.analisadoPor + ' em ' + G.fmt.dateTime(o.analisadoEm) + '.') : null,
      o.justificativa ? h('p', { class: 'hint', text: 'Observação: ' + o.justificativa }) : null,
      h('details', { class: 'disclosure' },
        h('summary', null, G.icon('chevron-down'), 'Ver os ' + o.itens.length + ' itens'),
        h('div', { class: 'disclosure__body' }, h('div', { class: 'table-wrap', role: 'region', 'aria-label': 'Itens do orçamento ' + o.numero, tabindex: '0' }, itens))));
  }

  async function autorizar(o) {
    const t = G.totaisOrcamento(o);
    const sal = G.saldo(p);
    const bloqueio = (titulo, texto) => G.dialog({ titulo, icone: 'info', descricao: texto, somenteOk: true, confirmar: 'Entendi' });
    if (sal.cobertura === 'casco' && t.total >= ap.veiculo.fipe * LIMITE_REPARO) {
      await bloqueio('Esse reparo passa do limite de 75%', 'O orçamento de ' + G.fmt.money(t.total) + ' é ' + G.fmt.pct(t.total / ap.veiculo.fipe) + ' do valor do veículo. Nesses casos o caminho é a indenização integral: registre um parecer e mude a natureza do processo com a supervisão.');
      return;
    }
    if (sal.franquia && t.total <= sal.franquia) {
      await bloqueio('O orçamento está abaixo da franquia', 'O total de ' + G.fmt.money(t.total) + ' não passa da franquia de ' + G.fmt.money(sal.franquia) + ', então não há indenização. Use "Não autorizar" e encerre o processo sem indenização.');
      return;
    }
    if (eu.alcadaAnalise && t.total > eu.alcadaAnalise) {
      await bloqueio('Acima da sua alçada de análise', 'Sua alçada é de ' + G.fmt.money(eu.alcadaAnalise) + '. Peça para alguém com alçada maior autorizar este orçamento.');
      return;
    }
    if (t.total - sal.franquia > sal.saldo) {
      await bloqueio('Não há saldo suficiente na cobertura', 'O saldo disponível é de ' + G.fmt.money(sal.saldo) + '. Confira os pagamentos anteriores desta apólice.');
      return;
    }
    const ok = await G.confirmDialog({
      titulo: 'Autorizar o orçamento ' + o.numero + '?',
      icone: 'check-circle',
      tom: 'success',
      montar(corpo) {
        corpo.append(
          h('dl', { class: 'totals' },
            h('div', null, h('dt', { text: 'Total do orçamento' }), h('dd', { text: G.fmt.money(t.total) })),
            h('div', null, h('dt', { text: 'Franquia, paga pelo segurado' }), h('dd', { text: G.fmt.money(sal.franquia) })),
            h('div', { class: 'is-good' }, h('dt', { text: 'A seguradora paga' }), h('dd', { text: G.fmt.money(t.total - sal.franquia) }))),
          h('p', { text: 'A oficina recebe o aviso para começar o reparo e o processo vai para a posição "Em reparo".' }));
      },
      confirmar: 'Autorizar orçamento',
      tomBotao: 'success'
    });
    if (!ok) return;
    o.status = 'Autorizado';
    o.analisadoPor = u.nome;
    o.analisadoEm = new Date().toISOString();
    p.marcos = p.marcos || {};
    if (!p.marcos.orcamento) p.marcos.orcamento = o.data;
    p.marcos.autorizacao = o.analisadoEm;
    G.registra(p, 'Orçamento ' + o.numero + ' autorizado, total de ' + G.fmt.money(t.total));
    G.mudaPosicao(p, 5);
    salva();
    G.toast('Orçamento autorizado. A oficina já pode começar o reparo.');
    render();
  }

  async function naoAutorizar(o) {
    const motivo = await G.dialog({
      titulo: 'Não autorizar o orçamento ' + o.numero + '?',
      icone: 'x-circle',
      tom: 'danger',
      descricao: 'A oficina recebe o motivo e pode mandar uma nova versão.',
      montar(corpo) {
        corpo.appendChild(G.field({ id: 'orc-motivo', label: 'Motivo', tipo: 'textarea', required: true, max: 500, dica: 'Seja específico: quais itens e por quê.' }));
      },
      confirmar: 'Não autorizar',
      tomBotao: 'danger',
      aoConfirmar(form) { return G.validateForm(form) ? document.getElementById('orc-motivo').value.trim() : false; }
    });
    if (!motivo) return;
    o.status = 'Não autorizado';
    o.motivo = motivo;
    o.analisadoPor = u.nome;
    o.analisadoEm = new Date().toISOString();
    G.registra(p, 'Orçamento ' + o.numero + ' não autorizado: ' + motivo);
    G.mudaPosicao(p, 4);
    salva();
    G.toast('Orçamento não autorizado. A oficina vai receber o motivo.');
    render();
  }

  function abreFormOrcamento() {
    const area = document.getElementById('orc-form-area');
    if (area.firstChild) { area.querySelector('select').focus(); return; }
    const form = h('form', { id: 'orc-form', novalidate: true });
    const oficinas = G.db.all('oficinas').filter((o) => o.status === 'Ativo').map((o) => ({ value: String(o.id), label: o.nomeFantasia + ' (' + o.endereco.cidade + '/' + o.endereco.uf + ')' }));
    const oficina = G.field({ id: 'orc-oficina', label: 'Oficina', tipo: 'select', opcoes: oficinas, required: true, span: 6 });
    const numero = G.field({ id: 'orc-numero', label: 'Número do orçamento', required: true, mask: 'digits', inputmode: 'numeric', max: 10, span: 3 });
    const entrada = G.field({ id: 'orc-entrada', label: 'Entrada na oficina', tipo: 'date', required: true, span: 3 });
    entrada.control.max = G.hoje();
    const obs = G.field({ id: 'orc-obs', label: 'Observação', tipo: 'textarea', opcional: true, max: 500, dica: 'Por exemplo: peças em falta no fornecedor, prazo combinado com a oficina.' });
    obs.className += ' span-12';

    const tbody = h('tbody');
    const totais = h('p', { class: 'orc-totais', 'aria-live': 'polite' });
    let n = 0;
    function recalcula() {
      let pecas = 0;
      let mao = 0;
      tbody.querySelectorAll('tr').forEach((tr) => {
        const q = Number(tr.querySelector('[data-q]').value) || 0;
        const v = G.parseMoney(tr.querySelector('[data-v]').value) || 0;
        if (tr.querySelector('select').value === 'Peça') pecas += q * v; else mao += q * v;
      });
      const total = pecas + mao;
      totais.replaceChildren(...['Peças ', h('strong', { text: G.fmt.money(pecas) }), ' · Mão de obra ', h('strong', { text: G.fmt.money(mao) }), ' · Total ', h('strong', { text: G.fmt.money(total) }),
        total >= ap.veiculo.fipe * LIMITE_REPARO ? h('span', { class: 'cell-sub field-error orc-alerta' }, G.icon('alert'), ' Passa de 75% do valor do veículo. Esse orçamento não vai poder ser autorizado.') : null].filter(Boolean));
    }
    function renumera() {
      Array.from(tbody.querySelectorAll('tr')).forEach((tr, i) => {
        tr.querySelector('select').setAttribute('aria-label', 'Tipo do item ' + (i + 1));
        tr.querySelector('[data-d]').setAttribute('aria-label', 'Descrição do item ' + (i + 1));
        tr.querySelector('[data-d]').dataset.label = 'Descrição do item ' + (i + 1);
        tr.querySelector('[data-q]').setAttribute('aria-label', 'Quantidade do item ' + (i + 1));
        tr.querySelector('[data-q]').dataset.label = 'Quantidade do item ' + (i + 1);
        tr.querySelector('[data-v]').setAttribute('aria-label', 'Valor unitário do item ' + (i + 1));
        tr.querySelector('[data-v]').dataset.label = 'Valor unitário do item ' + (i + 1);
        tr.querySelector('[data-remover]').setAttribute('aria-label', 'Remover item ' + (i + 1));
      });
    }
    function linha(tipo) {
      n += 1;
      const base = 'orc-item-' + n;
      const tr = h('tr', null,
        h('td', null, h('select', { class: 'select', id: base + '-tipo', onChange: recalcula }, h('option', { value: 'Peça', text: 'Peça', selected: tipo !== 'Mão de obra' }), h('option', { value: 'Mão de obra', text: 'Mão de obra', selected: tipo === 'Mão de obra' }))),
        h('td', null, h('input', { class: 'input', id: base + '-desc', 'data-d': '', required: true, maxlength: '80' })),
        h('td', null, h('input', { class: 'input', id: base + '-qtd', 'data-q': '', type: 'number', min: '1', max: '99', value: '1', required: true, inputmode: 'numeric', onInput: recalcula })),
        h('td', null, h('input', { class: 'input input--money', id: base + '-valor', 'data-v': '', 'data-mask': 'money', 'data-rules': 'money', required: true, inputmode: 'decimal', maxlength: '12', onInput: recalcula })),
        h('td', { class: 'col-actions' }, h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'data-remover': '' }, G.icon('trash'))));
      tr.querySelector('[data-remover]').addEventListener('click', () => {
        if (tbody.children.length === 1) { G.toast('O orçamento precisa de pelo menos um item.', 'error'); return; }
        const vizinho = tr.nextElementSibling || tr.previousElementSibling;
        tr.remove();
        renumera();
        recalcula();
        G.announce('Item removido.');
        vizinho.querySelector('[data-d]').focus();
      });
      tbody.appendChild(tr);
      G.applyMasks(tr);
      renumera();
      return tr;
    }
    linha('Peça');
    linha('Mão de obra');
    recalcula();
    const adicionar = h('button', { type: 'button', class: 'btn btn--sm' }, G.icon('plus'), 'Adicionar item');
    adicionar.addEventListener('click', () => { linha('Peça').querySelector('[data-d]').focus(); G.announce('Novo item adicionado.'); });

    const cancelar = h('button', { type: 'button', class: 'btn' }, 'Cancelar');
    cancelar.addEventListener('click', () => { area.replaceChildren(); document.getElementById('orc-incluir').focus(); });

    form.append(h('div', { 'data-summary-anchor': '' }),
      h('div', { class: 'form-grid' }, oficina, numero, entrada),
      h('h3', { class: 'subtitulo', text: 'Itens do orçamento' }),
      h('div', { class: 'table-wrap', role: 'region', 'aria-label': 'Itens do novo orçamento', tabindex: '0' },
        h('table', { class: 'table table--compact table--editor' },
          h('caption', { class: 'visually-hidden', text: 'Itens do novo orçamento' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Tipo' }), h('th', { scope: 'col', text: 'Descrição' }), h('th', { scope: 'col', text: 'Quantidade' }), h('th', { scope: 'col', text: 'Valor unitário' }), h('th', { scope: 'col', class: 'col-actions' }, h('span', { class: 'visually-hidden', text: 'Ações' })))),
          tbody)),
      h('div', { class: 'btn-row btn-row--between' }, adicionar, totais),
      h('div', { class: 'form-grid' }, obs),
      h('div', { class: 'btn-row btn-row--end form-foot' }, cancelar, h('button', { type: 'submit', class: 'btn btn--primary' }, G.icon('check'), 'Salvar orçamento')));

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ok = G.validateForm(form, {
        extra(addErro) {
          if (entrada.control.value && entrada.control.value > G.hoje()) addErro(entrada.control, 'A entrada na oficina não pode ser no futuro.');
          if (entrada.control.value && entrada.control.value < p.ocorrencia.data) addErro(entrada.control, 'A entrada na oficina não pode ser antes da ocorrência, em ' + G.fmt.date(p.ocorrencia.data) + '.');
          const num = numero.control.value.trim();
          if (num && p.orcamentos.some((o) => o.numero === num && String(o.oficinaId) === oficina.control.value)) addErro(numero.control, 'Essa oficina já mandou um orçamento com esse número neste processo.');
        }
      });
      if (!ok) return;
      const ofId = Number(oficina.control.value);
      const novo = {
        id: Date.now(), oficinaId: ofId, numero: numero.control.value.trim(),
        versao: p.orcamentos.filter((o) => o.oficinaId === ofId).length + 1,
        data: new Date().toISOString(), entradaOficina: entrada.control.value,
        itens: Array.from(tbody.querySelectorAll('tr')).map((tr) => ({
          tipo: tr.querySelector('select').value, descricao: tr.querySelector('[data-d]').value.trim(),
          quantidade: Number(tr.querySelector('[data-q]').value), valor: G.parseMoney(tr.querySelector('[data-v]').value)
        })),
        status: 'Em análise', motivo: '', analisadoPor: '', analisadoEm: '', justificativa: obs.control.value.trim()
      };
      p.orcamentos.push(novo);
      p.marcos = p.marcos || {};
      if (!p.marcos.orcamento) p.marcos.orcamento = novo.data;
      G.registra(p, 'Orçamento ' + novo.numero + ' incluído para ' + G.nome.oficina(ofId) + ', total de ' + G.fmt.money(G.totaisOrcamento(novo).total));
      if (p.posicao === 1 || p.posicao === 4) G.mudaPosicao(p, 2);
      salva();
      G.toast('Orçamento salvo. Agora ele aparece para análise.');
      render();
      const card = document.getElementById('orcamento-' + novo.id);
      if (card) card.querySelector('h2').setAttribute('tabindex', '-1');
      if (card) card.querySelector('h2').focus();
    });

    area.replaceChildren(h('section', { class: 'card', 'aria-labelledby': 'orc-novo-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'orc-novo-titulo', text: 'Novo orçamento' }), h('p', { text: 'Digite o orçamento que a oficina mandou. Os totais são calculados enquanto você preenche.' }))),
      form));
    oficina.control.focus();
  }

  /* ------------------------------------------------------- Indenizações */

  function indenizacoes(corpo) {
    const sal = G.saldo(p);
    const blocos = h('dl', { class: 'totals' },
      h('div', null, h('dt', { text: 'Cobertura' }), h('dd', { text: sal.rotulo })),
      h('div', null, h('dt', { text: 'Importância segurada' }), h('dd', { text: G.fmt.money(sal.is) })),
      h('div', null, h('dt', { text: 'Já pago ou pedido na apólice' }), h('dd', { text: G.fmt.money(sal.usado) })),
      h('div', { class: 'is-good' }, h('dt', { text: 'Saldo disponível' }), h('dd', { text: G.fmt.money(sal.saldo) })));
    corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'ind-saldo-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'ind-saldo-titulo', text: 'Cobertura e saldo' }), h('p', { text: 'Todo pagamento passa pela liberação de outra pessoa, com alçada para o valor.' }))),
      blocos, medidor(sal)));

    // Em danos parciais (do segurado ou do terceiro), o pagamento sai do orçamento autorizado.
    const precisaOrcamento = nat && (nat.grupo === 'Danos parciais' || nat.cobertura === 'rcfDm') && !p.orcamentos.some((o) => o.status === 'Autorizado');
    if (meu() && precisaOrcamento) {
      corpo.appendChild(h('div', { class: 'alert alert--info' }, G.icon('info'),
        h('div', { class: 'alert__body' }, h('p', { class: 'alert__title', text: 'Ainda não dá para pedir pagamento.' }),
          h('p', null, 'Em ' + nat.descricao.toLowerCase() + ', o valor sai do orçamento autorizado. ', h('a', { href: url('orcamentos'), text: 'Analise o orçamento primeiro' }), '.'))));
    } else if (meu()) corpo.appendChild(formPagamento(sal));

    const area = h('div');
    corpo.appendChild(h('section', { class: 'card card--flush', 'aria-labelledby': 'ind-lista-titulo' },
      h('div', { class: 'table-toolbar' }, h('div', null, h('h2', { id: 'ind-lista-titulo', text: 'Pagamentos do processo' }), h('p', { text: G.fmt.plural(p.pagamentos.length, 'pagamento', 'pagamentos') }))),
      area));
    G.dataTable({
      container: area,
      caption: 'Lista de pagamentos do processo',
      rows: p.pagamentos.slice().reverse(),
      rowKey: (g) => g.id,
      paginate: false,
      emptyIcon: 'coin',
      emptyTitle: 'Nenhum pagamento pedido',
      emptyText: meu() ? 'Use o formulário acima para pedir o primeiro pagamento.' : 'Ainda não há pagamentos neste processo.',
      columns: [
        { key: 'beneficiario', label: 'Beneficiário', render: (g) => h('span', null, g.beneficiario, h('span', { class: 'cell-sub', text: g.beneficiarioTipo + ' · ' + g.documento })) },
        { key: 'forma', label: 'Forma', render: (g) => h('span', null, g.forma, g.forma === 'Conta corrente' ? h('span', { class: 'cell-sub', text: 'Banco ' + g.banco + ' · ag. ' + g.agencia + ' · cc ' + g.conta }) : null) },
        { key: 'valor', label: 'Valor', num: true, render: (g) => h('span', null, G.fmt.money(g.valor), h('span', { class: 'cell-sub', text: g.tipo })) },
        { key: 'data', label: 'Programado para', render: (g) => G.fmt.date(g.dataProgramada) },
        { key: 'status', label: 'Status', render: (g) => h('span', null, G.statusBadge(g.status), g.motivo ? h('span', { class: 'cell-sub', text: g.motivo }) : null) },
        { key: 'quem', label: 'Pedido e liberação', render: (g) => h('span', null, 'Pedido por ' + g.solicitadoPor, h('span', { class: 'cell-sub', text: g.liberadoPor ? (g.status === 'Rejeitado' ? 'Rejeitado' : 'Liberado') + ' por ' + g.liberadoPor : 'Esperando liberação' })) },
        { key: 'acoes', label: 'Ações', srOnly: true, class: 'col-actions', render: (g) => (g.status === 'Aguardando liberação' && g.solicitadoPorId === u.id && meu()
          ? h('button', { type: 'button', class: 'btn btn--danger btn--sm', onClick: () => cancelarPagamento(g) }, 'Cancelar pedido') : '') }
      ]
    });
  }

  async function cancelarPagamento(g) {
    const ok = await G.confirmDialog({
      titulo: 'Cancelar o pedido de ' + G.fmt.money(g.valor) + '?',
      descricao: 'O pedido sai da fila de liberação e o valor volta para o saldo da cobertura.',
      confirmar: 'Cancelar pedido',
      cancelar: 'Manter',
      tomBotao: 'danger'
    });
    if (!ok) return;
    g.status = 'Rejeitado';
    g.motivo = 'Cancelado por quem pediu.';
    g.liberadoPor = u.nome;
    g.liberadoEm = new Date().toISOString();
    salva('Pedido de pagamento de ' + G.fmt.money(g.valor) + ' para ' + g.beneficiario + ' cancelado');
    G.toast('Pedido cancelado.');
    render();
  }

  function formPagamento(sal) {
    const form = h('form', { id: 'pag-form', novalidate: true });
    const autorizado = p.orcamentos.filter((o) => o.status === 'Autorizado');
    const oficinaAut = autorizado.length ? G.db.get('oficinas', autorizado[autorizado.length - 1].oficinaId) : null;
    const fin = ap.alienacao ? G.db.get('instituicoes', ap.alienacao) : null;
    const tipos = [];
    if (oficinaAut) tipos.push({ value: 'Oficina', label: 'Oficina', nome: oficinaAut.nomeFantasia, doc: oficinaAut.cnpj });
    tipos.push({ value: 'Segurado', label: 'Segurado', nome: ap.segurado.nome, doc: ap.segurado.documento });
    if (p.terceiro) tipos.push({ value: 'Terceiro', label: 'Terceiro', nome: p.terceiro.nome, doc: p.terceiro.documento });
    if (fin) tipos.push({ value: 'Financeira', label: 'Financeira', nome: fin.nomeFantasia, doc: fin.cnpj });
    tipos.push({ value: 'Despachante', label: 'Despachante', nome: '', doc: '' });

    const tipoBenef = G.choiceGroup({ id: 'pag-tipo-benef', name: 'benefTipo', label: 'Quem recebe', opcoes: tipos, required: true, box: true, valor: tipos[0].value });
    tipoBenef.classList.add('span-12');
    const nome = G.field({ id: 'pag-nome', label: 'Nome do beneficiário', required: true, max: 120, span: 8, valor: tipos[0].nome });
    const docu = G.field({ id: 'pag-doc', label: 'CPF ou CNPJ', required: true, rules: 'cpfCnpj', mask: 'cpfCnpj', inputmode: 'numeric', max: 18, span: 4, valor: tipos[0].doc });
    tipoBenef.addEventListener('change', () => {
      const t = tipos.find((x) => x.value === form.querySelector('[name="benefTipo"]:checked').value);
      nome.control.value = t.nome;
      docu.control.value = t.doc;
      G.announce(t.nome ? 'Beneficiário preenchido: ' + t.nome + '.' : 'Preencha o nome e o documento do despachante.');
      sugestoes();
    });
    const tipoPag = G.choiceGroup({ id: 'pag-tipo', name: 'tipoPag', label: 'Tipo de pagamento', opcoes: ['Total', 'Parcial'], required: true, box: true, valor: 'Total' });
    tipoPag.classList.add('span-4');
    const forma = G.choiceGroup({ id: 'pag-forma', name: 'forma', label: 'Forma de pagamento', opcoes: ['Conta corrente', 'OP eletrônica', 'Cheque'], required: true, box: true, valor: 'Conta corrente' });
    forma.classList.add('span-8');
    const banco = G.field({ id: 'pag-banco', label: 'Banco', tipo: 'select', opcoes: G.BANCOS, required: true, span: 4 });
    const agencia = G.field({ id: 'pag-agencia', label: 'Agência', required: true, mask: 'digits', inputmode: 'numeric', max: 5, span: 4 });
    const conta = G.field({ id: 'pag-conta', label: 'Conta com dígito', required: true, max: 15, span: 4, dica: 'Por exemplo, 40100-7.' });
    const contaGrupo = h('div', { class: 'form-grid span-12' }, banco, agencia, conta);
    const opInfo = h('p', { class: 'hint span-12', text: 'Na OP eletrônica, o beneficiário saca o valor em qualquer agência apresentando o documento.' });
    const sucursal = G.field({ id: 'pag-sucursal', label: 'Sucursal que emite o cheque', tipo: 'select', opcoes: ['São Paulo · Paulista', 'Rio de Janeiro · Centro', 'Belo Horizonte · Savassi', 'Curitiba · Batel', 'Porto Alegre · Moinhos'], required: true, span: 6 });
    const valor = G.field({ id: 'pag-valor', label: 'Valor (R$)', required: true, mask: 'money', rules: 'money', inputmode: 'decimal', max: 14, span: 4 });
    const data = G.field({ id: 'pag-data', label: 'Data programada', tipo: 'date', required: true, span: 4, valor: G.somaDias(G.hoje(), 2), dica: 'De hoje até 30 dias.' });
    data.control.min = G.hoje();
    data.control.max = G.somaDias(G.hoje(), 30);
    const dicasValor = h('div', { class: 'btn-row span-12 sugestoes', 'aria-label': 'Sugestões de valor', role: 'group' });

    function atualizaForma() {
      const f = form.querySelector('[name="forma"]:checked').value;
      contaGrupo.hidden = f !== 'Conta corrente';
      opInfo.hidden = f !== 'OP eletrônica';
      sucursal.hidden = f !== 'Cheque';
    }
    forma.addEventListener('change', atualizaForma);

    const jaPagoOficina = (ofNome) => p.pagamentos.filter((g) => g.status !== 'Rejeitado' && g.beneficiario === ofNome).reduce((s, g) => s + g.valor, 0);
    const totalAutorizado = autorizado.reduce((s, o) => s + G.totaisOrcamento(o).total, 0);
    function sugestoes() {
      dicasValor.replaceChildren();
      const usar = (rotulo, v) => {
        if (v <= 0) return;
        dicasValor.appendChild(h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onClick: () => { valor.control.value = G.fmt.decimal(v); valor.control.dispatchEvent(new Event('input', { bubbles: true })); G.announce('Valor preenchido: ' + G.fmt.money(v) + '.'); } }, rotulo + ': ' + G.fmt.money(v)));
      };
      const t = form.querySelector('[name="benefTipo"]:checked');
      if (t && t.value === 'Oficina' && oficinaAut) usar('Orçamento autorizado menos franquia', totalAutorizado - sal.franquia - jaPagoOficina(oficinaAut.nomeFantasia));
      if (t && t.value !== 'Oficina') usar('Saldo da cobertura', sal.saldo - (ap.premioPendente || 0));
      if (dicasValor.children.length) dicasValor.prepend(h('span', { class: 'hint', text: 'Sugestões:' }));
    }

    form.append(h('div', { 'data-summary-anchor': '' }),
      h('div', { class: 'form-grid' }, tipoBenef, nome, docu, tipoPag, forma, contaGrupo, opInfo, sucursal, valor, data, dicasValor),
      h('div', { class: 'btn-row btn-row--end form-foot' }, h('button', { type: 'submit', class: 'btn btn--primary' }, G.icon('check'), 'Pedir pagamento')));
    G.applyMasks(form);
    atualizaForma();
    sugestoes();

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const tipoSel = form.querySelector('[name="benefTipo"]:checked').value;
      const ok = G.validateForm(form, {
        extra(addErro) {
          const v = G.parseMoney(valor.control.value);
          if (v && v > sal.saldo) addErro(valor.control, 'Passa do saldo da cobertura, que é de ' + G.fmt.money(sal.saldo) + '.');
          else if (v && tipoSel === 'Oficina' && oficinaAut && v > totalAutorizado - sal.franquia - jaPagoOficina(oficinaAut.nomeFantasia) + 0.001) {
            addErro(valor.control, 'Para a oficina, o máximo é o orçamento autorizado menos a franquia e o que já foi pago: ' + G.fmt.money(totalAutorizado - sal.franquia - jaPagoOficina(oficinaAut.nomeFantasia)) + '.');
          }
          if (data.control.value && (data.control.value < G.hoje() || data.control.value > G.somaDias(G.hoje(), 30))) addErro(data.control, 'Escolha uma data entre hoje e ' + G.fmt.date(G.somaDias(G.hoje(), 30)) + '.');
        }
      });
      if (!ok) return;
      const f = form.querySelector('[name="forma"]:checked').value;
      const novo = {
        id: Date.now(), beneficiarioTipo: tipoSel, beneficiario: nome.control.value.trim(), documento: docu.control.value.trim(),
        tipo: form.querySelector('[name="tipoPag"]:checked').value, forma: f,
        banco: f === 'Conta corrente' ? banco.control.value : '', agencia: f === 'Conta corrente' ? agencia.control.value.trim() : '', conta: f === 'Conta corrente' ? conta.control.value.trim() : '',
        sucursal: f === 'Cheque' ? sucursal.control.value : '',
        valor: G.parseMoney(valor.control.value), dataProgramada: data.control.value, status: 'Aguardando liberação',
        solicitadoPor: u.nome, solicitadoPorId: u.id, solicitadoEm: new Date().toISOString(), liberadoPor: '', liberadoEm: '', motivo: ''
      };
      p.pagamentos.push(novo);
      G.registra(p, 'Pagamento de ' + G.fmt.money(novo.valor) + ' pedido para ' + novo.beneficiario + ' (' + novo.beneficiarioTipo.toLowerCase() + ')');
      if (p.posicao !== 8) G.mudaPosicao(p, 8);
      salva();
      G.toast('Pedido enviado para liberação. Outra pessoa com alçada vai liberar.');
      render();
    });

    return h('section', { class: 'card', 'aria-labelledby': 'pag-novo-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'pag-novo-titulo', text: 'Pedir pagamento' }), h('p', { text: 'O pedido vai para Liberação de pagamentos. Você não pode liberar o seu próprio pedido.' }))),
      form);
  }

  /* --------------------------------------------------------- Documentos */

  function documentos(corpo) {
    const exigidos = G.documentosAguardados(p);
    const prontos = exigidos.filter((d) => d.status !== 'Aguardando').length;
    const lista = h('ul', { class: 'list-plain checklist' });
    exigidos.forEach((d) => {
      let acao = null;
      if (meu() && d.status === 'Aguardando') acao = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onClick: () => dispensar(d) }, 'Dispensar');
      if (meu() && d.status === 'Dispensado') acao = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onClick: () => desfazDispensa(d) }, 'Desfazer dispensa');
      lista.appendChild(h('li', null,
        h('div', null, h('strong', { text: d.nome }),
          h('span', { class: 'cell-sub', text: d.recebido ? 'Recebido em ' + G.fmt.dateTime(d.recebido.recebidoEm) : d.dispensa ? 'Dispensado por ' + d.dispensa.por + ': ' + d.dispensa.motivo : 'Ainda não chegou' })),
        h('span', { class: 'btn-row' }, G.statusBadge(d.status), acao)));
    });
    const completo = exigidos.length && prontos === exigidos.length;
    corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'doc-exig-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'doc-exig-titulo', text: 'Documentos exigidos' }), h('p', { text: prontos + ' de ' + exigidos.length + ' prontos para a natureza ' + G.nome.naturezaCurta(p.natureza).toLowerCase() + '.' }))),
      completo && meu() && p.posicao === 3 ? h('div', { class: 'alert alert--success' }, G.icon('check-circle'),
        h('div', { class: 'alert__body' }, h('p', { class: 'alert__title', text: 'Todos os documentos chegaram.' }), h('p', { text: 'O processo ainda está em "Aguardando documentos". Que tal seguir para a análise?' })),
        h('button', { type: 'button', class: 'btn btn--sm', onClick: () => { G.mudaPosicao(p, 2); salva(); G.toast('Posição alterada para "Em análise".'); render(); } }, 'Mudar para Em análise')) : null,
      lista));

    if (meu()) corpo.appendChild(formDocumento());

    const area = h('div');
    corpo.appendChild(h('section', { class: 'card card--flush', 'aria-labelledby': 'doc-lista-titulo' },
      h('div', { class: 'table-toolbar' }, h('div', null, h('h2', { id: 'doc-lista-titulo', text: 'Documentos recebidos' }), h('p', { text: G.fmt.plural(p.documentos.length, 'documento', 'documentos') }))),
      area));
    G.dataTable({
      container: area,
      caption: 'Lista de documentos recebidos',
      rows: p.documentos.slice().reverse(),
      rowKey: (d) => d.id,
      pageSize: 8,
      emptyIcon: 'paperclip',
      emptyTitle: 'Nenhum documento recebido',
      emptyText: 'Os documentos enviados pelo segurado, pela oficina ou anexados aqui aparecem nesta lista.',
      columns: [
        { key: 'tipo', label: 'Documento', sort: (d) => G.nome.tipoDocumento(d.tipoId), render: (d) => h('span', null, G.nome.tipoDocumento(d.tipoId), h('span', { class: 'cell-sub', text: d.nome + ' · ' + tamanho(d.tamanho) })) },
        { key: 'origem', label: 'Quem enviou', sort: true },
        { key: 'recebidoEm', label: 'Recebido em', sort: true, render: (d) => G.fmt.dateTime(d.recebidoEm) },
        { key: 'por', label: 'Registrado por', sort: true },
        { key: 'acoes', label: 'Ações', srOnly: true, class: 'col-actions', render: (d) => (meu() && d.por === u.nome
          ? h('button', { type: 'button', class: 'btn btn--danger btn--sm', 'aria-label': 'Remover ' + G.nome.tipoDocumento(d.tipoId), onClick: () => removerDocumento(d) }, G.icon('trash'), 'Remover') : '') }
      ]
    });
  }

  const tamanho = (b) => (b >= 1048576 ? G.fmt.decimal(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  function formDocumento() {
    const form = h('form', { id: 'doc-form', novalidate: true });
    const tipos = G.db.all('tiposDocumento').filter((t) => t.status === 'Ativo').map((t) => ({ value: String(t.id), label: t.nome }));
    const tipo = G.field({ id: 'doc-tipo', label: 'Tipo do documento', tipo: 'select', opcoes: tipos, required: true, span: 4 });
    const origem = G.field({ id: 'doc-origem', label: 'Quem enviou', tipo: 'select', opcoes: ['Segurado', 'Oficina', 'Reguladora', 'Financeira', 'Despachante', 'Terceiro'], required: true, span: 4 });
    const arquivoId = 'doc-arquivo';
    const arquivo = h('input', { class: 'input input--file', type: 'file', id: arquivoId, name: 'arquivo', required: true, accept: '.pdf,.jpg,.jpeg,.png', 'aria-describedby': arquivoId + '-dica', 'data-label': 'Arquivo' });
    const campoArquivo = h('div', { class: 'field span-4' },
      h('label', { for: arquivoId }, 'Arquivo', h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')),
      arquivo,
      h('p', { class: 'hint', id: arquivoId + '-dica', text: 'PDF, JPG ou PNG de até 10 MB. O arquivo não sai do seu navegador: guardamos só o nome e o tamanho.' }));
    tipo.control.addEventListener('change', () => {
      const t = G.db.get('tiposDocumento', tipo.control.value);
      if (t) origem.control.value = t.origem;
    });
    form.append(h('div', { 'data-summary-anchor': '' }), h('div', { class: 'form-grid' }, tipo, origem, campoArquivo),
      h('div', { class: 'btn-row btn-row--end form-foot' }, h('button', { type: 'submit', class: 'btn btn--primary' }, G.icon('paperclip'), 'Anexar documento')));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ok = G.validateForm(form, {
        extra(addErro) {
          const f = arquivo.files && arquivo.files[0];
          if (!f) return;
          if (f.size > 10 * 1048576) addErro(arquivo, 'Esse arquivo tem ' + tamanho(f.size) + '. O limite é 10 MB.');
          else if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) addErro(arquivo, 'Use um arquivo PDF, JPG ou PNG.');
        }
      });
      if (!ok) return;
      const f = arquivo.files[0];
      const tipoId = Number(tipo.control.value);
      const aguardado = G.documentosAguardados(p).find((d) => d.tipoId === tipoId && d.status === 'Aguardando');
      p.documentos.push({ id: Date.now(), tipoId, nome: f.name, tamanho: f.size, origem: origem.control.value, recebidoEm: new Date().toISOString(), por: u.nome });
      if (G.nome.tipoDocumento(tipoId) === 'Nota fiscal do reparo') {
        p.marcos = p.marcos || {};
        p.marcos.notaFiscal = new Date().toISOString();
      }
      if (G.documentosAguardados(p).every((d) => d.status !== 'Aguardando')) {
        p.marcos = p.marcos || {};
        if (!p.marcos.documentos) p.marcos.documentos = new Date().toISOString();
      }
      salva('Documento anexado: ' + G.nome.tipoDocumento(tipoId) + ' (' + f.name + ')');
      G.toast(aguardado ? G.nome.tipoDocumento(tipoId) + ' recebido. Um documento a menos na lista.' : 'Documento anexado.');
      render();
    });
    return h('section', { class: 'card', 'aria-labelledby': 'doc-novo-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'doc-novo-titulo', text: 'Anexar documento' }))),
      form);
  }

  async function dispensar(d) {
    const motivo = await G.dialog({
      titulo: 'Dispensar "' + d.nome + '"?',
      descricao: 'Use quando o documento não se aplica a este caso. O motivo fica registrado.',
      montar(corpo) { corpo.appendChild(G.field({ id: 'disp-motivo', label: 'Motivo', tipo: 'textarea', required: true, max: 200 })); },
      confirmar: 'Dispensar documento',
      aoConfirmar(form) { return G.validateForm(form) ? document.getElementById('disp-motivo').value.trim() : false; }
    });
    if (!motivo) return;
    p.dispensados = p.dispensados || [];
    p.dispensados.push({ tipoId: d.tipoId, motivo, por: u.nome, quando: new Date().toISOString() });
    salva('Documento dispensado: ' + d.nome + ' (' + motivo + ')');
    G.toast('Documento dispensado.');
    render();
  }

  function desfazDispensa(d) {
    p.dispensados = p.dispensados.filter((x) => x.tipoId !== d.tipoId);
    salva('Dispensa desfeita: ' + d.nome);
    G.toast('O documento voltou para a lista de pendentes.');
    render();
  }

  async function removerDocumento(d) {
    const ok = await G.confirmDialog({ titulo: 'Remover "' + d.nome + '"?', descricao: 'O documento sai do processo. Você pode anexar de novo depois.', confirmar: 'Remover', tomBotao: 'danger' });
    if (!ok) return;
    p.documentos = p.documentos.filter((x) => x.id !== d.id);
    salva('Documento removido: ' + G.nome.tipoDocumento(d.tipoId) + ' (' + d.nome + ')');
    G.toast('Documento removido.');
    render();
  }

  /* -------------------------------------------------------------- Cartas */

  function preencheCarta(modelo) {
    const pend = G.documentosAguardados(p).filter((d) => d.status === 'Aguardando').map((d) => '- ' + d.nome);
    const pagos = p.pagamentos.filter((g) => g.status !== 'Rejeitado').reduce((s, g) => s + g.valor, 0);
    const campos = {
      segurado: ap.segurado.nome, sinistro: G.numeroProcesso(p), veiculo: ap.veiculo.marca + ' ' + ap.veiculo.modelo, placa: ap.veiculo.placa,
      data_ocorrencia: G.fmt.date(p.ocorrencia.data), franquia: G.fmt.money(G.saldo(p).franquia),
      valor_indenizacao: pagos ? G.fmt.money(pagos) : 'a definir', documentos_pendentes: pend.length ? pend.join('\n') : 'Nenhum documento pendente.',
      terceiro: p.terceiro ? p.terceiro.nome : 'terceiro', analista: u.nome
    };
    return modelo.texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (campos[k] !== undefined ? campos[k] : m));
  }

  function folha(titulo, assunto, texto, data) {
    return h('article', { class: 'letter' },
      h('header', { class: 'letter__head' },
        h('span', { class: 'brand' }, h('img', { class: 'brand__mark', src: 'img/favicon.svg', alt: '', width: '32', height: '32' }), h('span', { class: 'brand__name', text: 'Travessia Seguros' })),
        h('span', { class: 'muted', text: data })),
      h('p', { class: 'letter__assunto' }, h('strong', { text: 'Assunto: ' }), assunto),
      h('div', { class: 'letter__texto', text: texto }),
      h('footer', { class: 'letter__foot', text: titulo + ' · Sinistro ' + G.numeroProcesso(p) + ' · Carta fictícia do case de UX/UI' }));
  }

  function imprimir(el) {
    let area = document.getElementById('area-impressao');
    if (!area) {
      area = h('div', { id: 'area-impressao' });
      document.body.appendChild(area);
    }
    area.replaceChildren(el.cloneNode(true));
    document.body.classList.add('imprimindo-carta');
    const limpa = () => { document.body.classList.remove('imprimindo-carta'); window.removeEventListener('afterprint', limpa); };
    window.addEventListener('afterprint', limpa);
    window.print();
    window.setTimeout(limpa, 1000);
  }

  function cartas(corpo) {
    if (meu()) {
      const modelos = G.db.all('cartas').filter((c) => c.status === 'Ativo' && c.naturezas.indexOf(p.natureza) >= 0);
      const escolha = G.field({ id: 'carta-modelo', label: 'Modelo de carta', tipo: 'select', opcoes: modelos.map((c) => ({ value: String(c.id), label: c.titulo })), span: 6, dica: modelos.length ? 'Os modelos são filtrados pela natureza do processo.' : 'Nenhum modelo ativo para esta natureza.' });
      const previa = h('div', { class: 'letter-preview', 'aria-live': 'polite' });
      const acoes = h('div', { class: 'btn-row btn-row--end form-foot', hidden: true });
      const btImprimir = h('button', { type: 'button', class: 'btn' }, G.icon('print'), 'Imprimir');
      const btEmitir = h('button', { type: 'button', class: 'btn btn--primary' }, G.icon('check'), 'Registrar emissão');
      acoes.append(btImprimir, btEmitir);
      let atual = null;
      escolha.control.addEventListener('change', () => {
        const m = G.db.get('cartas', escolha.control.value);
        atual = m ? { modelo: m, texto: preencheCarta(m) } : null;
        previa.replaceChildren(atual ? folha(m.titulo, m.assunto, atual.texto, G.fmt.date(G.hoje())) : '');
        acoes.hidden = !atual;
        if (atual && /\[[^\]]+\]/.test(atual.texto)) previa.prepend(h('div', { class: 'alert alert--warning' }, G.icon('alert'), h('div', { class: 'alert__body' }, h('p', { text: 'Este modelo tem um trecho entre colchetes para você completar antes de enviar. Edite o modelo ou complete no documento impresso.' }))));
      });
      btImprimir.addEventListener('click', () => { if (atual) imprimir(previa.querySelector('.letter')); });
      btEmitir.addEventListener('click', () => {
        if (!atual) return;
        p.cartas.push({ id: Date.now(), modeloId: atual.modelo.id, titulo: atual.modelo.titulo, assunto: atual.modelo.assunto, texto: atual.texto, emitidaEm: new Date().toISOString(), por: u.nome });
        salva('Carta emitida: ' + atual.modelo.titulo);
        G.toast('Carta registrada no processo.');
        render();
      });
      corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'carta-nova-titulo' },
        h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'carta-nova-titulo', text: 'Emitir carta' }), h('p', { text: 'A carta já sai com os dados do segurado, do veículo e do sinistro.' }))),
        h('div', { class: 'form-grid' }, escolha), previa, acoes));
    }

    const area = h('div');
    corpo.appendChild(h('section', { class: 'card card--flush', 'aria-labelledby': 'carta-lista-titulo' },
      h('div', { class: 'table-toolbar' }, h('div', null, h('h2', { id: 'carta-lista-titulo', text: 'Cartas emitidas' }), h('p', { text: G.fmt.plural(p.cartas.length, 'carta', 'cartas') }))),
      area));
    G.dataTable({
      container: area,
      caption: 'Lista de cartas emitidas',
      rows: p.cartas.slice().reverse(),
      rowKey: (c) => c.id,
      paginate: false,
      emptyIcon: 'mail',
      emptyTitle: 'Nenhuma carta emitida',
      emptyText: 'As cartas registradas aparecem aqui, com quem emitiu e quando.',
      columns: [
        { key: 'titulo', label: 'Carta', render: (c) => h('span', null, c.titulo, h('span', { class: 'cell-sub', text: c.assunto })) },
        { key: 'emitidaEm', label: 'Emitida em', render: (c) => G.fmt.dateTime(c.emitidaEm) },
        { key: 'por', label: 'Por' },
        { key: 'acoes', label: 'Ações', srOnly: true, class: 'col-actions', render: (c) => h('button', { type: 'button', class: 'btn btn--sm', onClick: () => verCarta(c) }, G.icon('eye'), 'Ver carta') }
      ]
    });
  }

  function verCarta(c) {
    const el = folha(c.titulo, c.assunto, c.texto, G.fmt.date(c.emitidaEm));
    G.dialog({
      titulo: c.titulo,
      wide: true,
      montar(corpo) { corpo.appendChild(el); },
      cancelar: 'Fechar',
      confirmar: 'Imprimir',
      aoConfirmar() { imprimir(el); return true; }
    });
  }

  /* ----------------------------------------------------------- Histórico */

  function historico(corpo) {
    const lista = h('ol', { class: 'history' });
    p.historico.slice().reverse().forEach((x) => {
      lista.appendChild(h('li', null, h('strong', { text: x.acao }), ' · ' + x.quem, h('time', { datetime: x.quando, text: G.fmt.dateTime(x.quando) })));
    });
    corpo.appendChild(h('section', { class: 'card', 'aria-labelledby': 'hist-titulo' },
      h('div', { class: 'card__head' }, h('div', null, h('h2', { id: 'hist-titulo', text: 'Histórico do processo' }), h('p', { text: 'Tudo o que aconteceu, do mais recente para o mais antigo.' }))),
      lista));
  }

  /* ------------------------------------------------- Ações do cabeçalho */

  async function dialogoPosicao(concluir) {
    const pendentes = p.pagamentos.filter((g) => g.status === 'Aguardando liberação').length;
    const opcoes = G.db.all('posicoes').filter((x) => x.status === 'Ativo' && x.numero !== p.posicao).map((x) => ({ value: String(x.numero), label: x.descricao + (x.encerra === 'sim' ? ' (encerra o processo)' : '') }));
    const ok = await G.dialog({
      titulo: concluir ? 'Concluir o atendimento' : 'Alterar a posição',
      descricao: concluir
        ? 'Para sair do processo, escolha a nova posição e escreva o parecer. Ele volta para a fila e segue para a próxima pessoa livre.'
        : 'O processo continua com você. Escreva o motivo da mudança no parecer.',
      montar(corpo) {
        corpo.append(
          G.field({ id: 'pos-nova', label: 'Nova posição', tipo: 'select', opcoes, required: true, dica: 'Hoje: ' + G.nome.posicao(p.posicao) + '.' }),
          G.field({ id: 'pos-parecer', label: 'Parecer', tipo: 'textarea', required: true, max: 2000, dica: 'Conte o que foi feito e o que falta. Fica na aba Pareceres.' }));
      },
      confirmar: concluir ? 'Concluir e sair do processo' : 'Alterar posição',
      aoConfirmar(form) {
        const sel = document.getElementById('pos-nova');
        const txt = document.getElementById('pos-parecer');
        const okForm = G.validateForm(form, {
          extra(addErro) {
            const pos = G.posicao(sel.value);
            if (pos && pos.encerra === 'sim' && pendentes) addErro(sel, 'Há ' + G.fmt.plural(pendentes, 'pagamento esperando', 'pagamentos esperando') + ' liberação. Encerre depois da liberação ou cancele o pedido.');
            if (pos && pos.numero === 9 && !p.pagamentos.some((g) => g.status !== 'Rejeitado')) addErro(sel, 'Para encerrar com indenização, o processo precisa ter um pagamento.');
            if (txt.value.trim() && txt.value.trim().length < 20) addErro(txt, 'Escreva pelo menos 20 caracteres no parecer.');
          }
        });
        return okForm ? { posicao: Number(sel.value), texto: txt.value.trim() } : false;
      }
    });
    if (!ok) return;
    p.pareceres.push({ id: Date.now(), quando: new Date().toISOString(), autor: u.nome, categoria: 'Análise', tipo: concluir ? 'Conclusão de atendimento' : 'Mudança de posição', texto: ok.texto, documentos: [] });
    G.mudaPosicao(p, ok.posicao);
    if (concluir && p.status === 'Aberto') {
      p.analistaId = null;
      p.distribuidoAuto = false;
      G.registra(p, 'Atendimento concluído por ' + u.nome + ', processo devolvido para a fila');
    }
    salva();
    if (concluir) {
      G.flash(p.status === 'Encerrado' ? 'Processo ' + G.numeroProcesso(p) + ' encerrado.' : 'Atendimento concluído. O processo ' + G.numeroProcesso(p) + ' voltou para a fila em "' + G.nome.posicao(p.posicao) + '".');
      window.location.href = 'caixa.html';
      return;
    }
    G.toast(p.status === 'Encerrado' ? 'Processo encerrado.' : 'Posição alterada para "' + G.nome.posicao(p.posicao) + '".');
    render();
    main.focus();
  }

  async function assumir() {
    const ok = await G.confirmDialog({
      titulo: 'Assumir o processo ' + G.numeroProcesso(p) + '?',
      icone: 'user-check',
      descricao: p.analistaId ? 'Ele sai da caixa de ' + G.nome.usuario(p.analistaId) + ' e vai para a sua. A mudança fica no histórico.' : 'Ele sai da fila e vai direto para a sua caixa. A mudança fica no histórico.',
      confirmar: 'Assumir processo'
    });
    if (!ok) return;
    const antes = p.analistaId;
    G.atribui(p, u.id, antes ? 'Assumido por ' + u.nome + ' (estava com ' + G.nome.usuario(antes) + ')' : 'Assumido por ' + u.nome + ' direto da fila');
    p.distribuidoAuto = false;
    salva();
    G.toast('Agora o processo está com você.');
    render();
    main.focus();
  }

  async function reabrir() {
    const motivo = await G.dialog({
      titulo: 'Reabrir o processo ' + G.numeroProcesso(p) + '?',
      icone: 'undo',
      descricao: 'Ele volta para a posição "Em análise" e fica na sua caixa.',
      montar(corpo) { corpo.appendChild(G.field({ id: 'reab-motivo', label: 'Motivo da reabertura', tipo: 'textarea', required: true, max: 500, dica: 'Por exemplo: chegou uma nota fiscal complementar, o segurado pediu revisão.' })); },
      confirmar: 'Reabrir processo',
      aoConfirmar(form) { return G.validateForm(form) ? document.getElementById('reab-motivo').value.trim() : false; }
    });
    if (!motivo) return;
    p.status = 'Aberto';
    p.encerradoEm = '';
    G.registra(p, 'Processo reaberto por ' + u.nome + ': ' + motivo);
    G.mudaPosicao(p, 2);
    G.atribui(p, u.id, 'Processo atribuído a ' + u.nome + ' na reabertura');
    salva();
    G.toast('Processo reaberto e na sua caixa.');
    render();
    main.focus();
  }

  render();
})();
