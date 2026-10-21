/*
 * Sinistro Auto: aviso de sinistro. Começa pela apólice, registra a
 * ocorrência e abre o sinistro com um processo por cobertura envolvida.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const h = G.h;
  const u = G.shell({ ativo: 'aviso', titulo: 'Aviso de sinistro', migalhas: [{ label: 'Início', href: 'inicio.html' }, { label: 'Sinistros' }, { label: 'Aviso de sinistro' }] });
  if (!u) return;

  const form = document.getElementById('aviso-form');
  const secoes = document.getElementById('aviso-secoes');
  const FURTO_ROUBO = [3, 6];
  let apolice = null;

  const secao = (idSec, titulo, texto, ...filhos) => h('section', { class: 'card', 'aria-labelledby': idSec },
    h('div', { class: 'card__head' }, h('div', null, h('h2', { id: idSec, text: titulo }), texto ? h('p', { text: texto }) : null)),
    filhos);
  const simNao = (id, label, valor, opcoes) => {
    const g = G.choiceGroup({ id, name: id, label, required: true, box: true, valor, opcoes: opcoes || [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }] });
    g.classList.add('span-12');
    return g;
  };
  const marcado = (nome) => { const el = form.querySelector('[name="' + nome + '"]:checked'); return el ? el.value : ''; };

  /* -------------------------------------------------------- 1. Apólice */

  const busca = G.field({ id: 'av-busca', label: 'Placa, CPF ou CNPJ do segurado, ou número da apólice', span: 9, dica: 'Por exemplo, a placa sem o traço.', autocomplete: 'off' });
  busca.control.dataset.novalidate = '1';
  const btBuscar = h('button', { type: 'button', class: 'btn btn--primary' }, G.icon('search'), 'Buscar apólice');
  const resultados = h('div', { class: 'span-12', id: 'av-resultados', 'aria-live': 'polite' });
  const resumoAp = h('div', { class: 'span-12', id: 'av-resumo' });

  function procura() {
    const termo = G.normaliza(busca.control.value).replace(/[\s.\-/]/g, '');
    resultados.replaceChildren();
    resumoAp.replaceChildren();
    apolice = null;
    G.setErro(busca.control, '');
    if (termo.length < 3) {
      G.setErro(busca.control, 'Digite pelo menos 3 caracteres para buscar.');
      busca.control.focus();
      return;
    }
    const achadas = G.db.all('apolices').filter((a) => [a.veiculo.placa, G.digitos(a.segurado.documento), a.numero, G.normaliza(a.segurado.nome).replace(/\s/g, '')]
      .some((v) => G.normaliza(v).indexOf(termo) >= 0)).slice(0, 6);
    if (!achadas.length) {
      resultados.appendChild(h('div', { class: 'empty' }, G.icon('search'), h('strong', { text: 'Nenhuma apólice encontrada' }), h('p', { text: 'Confira a placa ou o documento. Para testar, busque pelo nome Marina ou Rafael.' })));
      G.announce('Nenhuma apólice encontrada.');
      return;
    }
    const grupo = G.choiceGroup({
      id: 'av-apolice', name: 'apolice', label: 'Escolha a apólice', box: true,
      opcoes: achadas.map((a) => ({ value: String(a.id), label: a.segurado.nome }))
    });
    grupo.classList.add('apolice-opcoes');
    grupo.querySelectorAll('label.choice').forEach((lb, i) => {
      const a = achadas[i];
      const vigente = G.hoje() >= a.vigInicio && G.hoje() <= a.vigFim;
      lb.classList.add('choice--card');
      lb.appendChild(h('span', { class: 'choice__detalhe' },
        h('span', { class: 'cell-sub', text: a.veiculo.placa + ' · ' + G.veiculoTexto(a.veiculo) }),
        h('span', { class: 'cell-sub', text: 'Apólice ' + G.chaveApolice(a) }),
        G.badge(vigente ? 'Vigente até ' + G.fmt.date(a.vigFim) : 'Vencida em ' + G.fmt.date(a.vigFim), vigente ? 'success' : 'danger')));
    });
    grupo.addEventListener('change', () => escolhe(achadas.find((a) => String(a.id) === marcado('apolice'))));
    resultados.appendChild(grupo);
    G.announce(G.fmt.plural(achadas.length, 'apólice encontrada', 'apólices encontradas') + '. Escolha uma.');
    if (achadas.length === 1) {
      grupo.querySelector('input').checked = true;
      escolhe(achadas[0]);
    }
    grupo.querySelector('input').focus();
  }

  function escolhe(a) {
    apolice = a;
    G.setErro(busca.control, '');
    const vigente = G.hoje() >= a.vigInicio && G.hoje() <= a.vigFim;
    const abertos = G.db.all('processos').filter((p) => p.apoliceId === a.id && p.status === 'Aberto');
    const avisos = [];
    if (!vigente) avisos.push(['error', 'Apólice vencida em ' + G.fmt.date(a.vigFim) + '.', 'Só dá para avisar ocorrências que aconteceram dentro da vigência.']);
    if (a.premioPendente) avisos.push(['warning', 'Prêmio pendente de ' + G.fmt.money(a.premioPendente) + '.', 'O aviso pode ser registrado, mas o valor será descontado da indenização.']);
    if (abertos.length) avisos.push(['info', 'Esta apólice já tem ' + G.fmt.plural(abertos.length, 'processo aberto', 'processos abertos') + '.', 'Confira se não é o mesmo acidente: ' + abertos.map(G.numeroProcesso).join(', ') + '.']);
    resumoAp.replaceChildren(
      h('dl', { class: 'totals' },
        h('div', null, h('dt', { text: 'Casco' }), h('dd', { text: G.fmt.money(a.coberturas.casco.is) })),
        h('div', null, h('dt', { text: 'Franquia' }), h('dd', { text: G.fmt.money(a.coberturas.casco.franquia) })),
        h('div', null, h('dt', { text: 'Danos materiais a terceiros' }), h('dd', { text: G.fmt.money(a.coberturas.rcfDm.is) })),
        h('div', null, h('dt', { text: 'Carro reserva' }), h('dd', { text: a.carroReservaDias ? G.fmt.plural(a.carroReservaDias, 'dia', 'dias') : 'Não contratado' }))),
      ...avisos.map((x) => h('div', { class: 'alert alert--' + x[0] }, G.icon(x[0] === 'info' ? 'info' : 'alert'), h('div', { class: 'alert__body' }, h('p', { class: 'alert__title', text: x[1] }), h('p', { text: x[2] })))));
    contatoTel.control.value = a.segurado.telefone;
    contatoEmail.control.value = a.segurado.email;
    cidade.control.value = a.segurado.cidade;
    uf.control.value = a.segurado.uf;
    G.announce('Apólice de ' + a.segurado.nome + ' escolhida. Telefone, e-mail e cidade do segurado foram preenchidos.');
  }

  // Campo e botão na mesma linha: a dica fica embaixo dos dois.
  const grupoBusca = h('div', { class: 'input-group' });
  busca.control.replaceWith(grupoBusca);
  grupoBusca.append(busca.control, btBuscar);
  btBuscar.addEventListener('click', procura);
  busca.control.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); procura(); }
  });

  secoes.appendChild(secao('av-ap-titulo', '1. Apólice', 'Busque pelo veículo ou pelo segurado.',
    h('div', { class: 'form-grid' }, busca, resultados, resumoAp)));

  /* ----------------------------------------------------- 2. Ocorrência */

  const data = G.field({ id: 'av-data', label: 'Data da ocorrência', tipo: 'date', required: true, span: 3 });
  data.control.max = G.hoje();
  const hora = G.field({ id: 'av-hora', label: 'Hora aproximada', tipo: 'time', required: true, span: 3 });
  const naturezas = G.db.all('naturezas').filter((n) => n.status === 'Ativo' && n.grupo !== 'Terceiros').map((n) => ({ value: String(n.numero), label: n.descricao }));
  const natureza = G.field({ id: 'av-natureza', label: 'O que aconteceu', tipo: 'select', opcoes: naturezas, required: true, span: 3 });
  const canal = G.field({ id: 'av-canal', label: 'Canal do aviso', tipo: 'select', opcoes: ['Telefone', 'Aplicativo', 'Corretor', 'Site'], required: true, span: 3, valor: 'Telefone' });
  const logradouro = G.field({ id: 'av-logradouro', label: 'Onde foi', required: true, max: 120, span: 6, dica: 'Rua e número aproximado, ou a rodovia e o quilômetro.' });
  const bairro = G.field({ id: 'av-bairro', label: 'Bairro', opcional: true, max: 60, span: 6 });
  const cidade = G.field({ id: 'av-cidade', label: 'Cidade', required: true, max: 60, span: 6 });
  const uf = G.field({ id: 'av-uf', label: 'UF', tipo: 'select', opcoes: G.UFS, required: true, span: 2 });
  const boletim = G.field({ id: 'av-boletim', label: 'Número do boletim de ocorrência', opcional: true, max: 20, span: 4 });
  const boletimDica = h('p', { class: 'hint', id: 'av-boletim-regra', text: 'Obrigatório em furto ou roubo.' });
  boletim.appendChild(boletimDica);
  boletim.control.setAttribute('aria-describedby', 'av-boletim-regra');
  const relato = G.field({ id: 'av-relato', label: 'Relato do segurado', tipo: 'textarea', required: true, max: 1500, dica: 'Com as palavras do segurado: o que aconteceu, como e quem estava junto.' });
  relato.className += ' span-12';
  const prioritaria = h('input', { type: 'checkbox', id: 'av-prioritaria', name: 'prioritaria' });
  const campoPrioritaria = h('div', { class: 'field span-12' }, h('label', { class: 'choice', for: 'av-prioritaria' }, prioritaria, 'O veículo não tem condições de rodar. Pedir vistoria prioritária.'));
  natureza.control.addEventListener('change', () => {
    const exige = FURTO_ROUBO.indexOf(Number(natureza.control.value)) >= 0;
    boletim.querySelector('label').replaceChildren('Número do boletim de ocorrência', exige ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : h('span', { class: 'opt' }, ' (opcional)'));
    boletim.control.required = exige;
  });

  secoes.appendChild(secao('av-oc-titulo', '2. O que aconteceu', null,
    h('div', { class: 'form-grid' }, data, hora, natureza, canal, logradouro, bairro, cidade, uf, boletim, relato, campoPrioritaria)));

  /* ------------------------------------------------------- 3. Condutor */

  const condutor = simNao('av-condutor', 'Quem dirigia era o próprio segurado?', 'sim');
  const condNome = G.field({ id: 'av-cond-nome', label: 'Nome de quem dirigia', required: true, max: 80, span: 8 });
  const condCpf = G.field({ id: 'av-cond-cpf', label: 'CPF de quem dirigia', required: true, rules: 'cpf', mask: 'cpf', inputmode: 'numeric', max: 14, span: 4 });
  const condGrupo = h('div', { class: 'form-grid span-12' }, condNome, condCpf);
  secoes.appendChild(secao('av-cond-titulo', '3. Quem dirigia', null, h('div', { class: 'form-grid' }, condutor, condGrupo)));

  /* ------------------------------------------------------- 4. Terceiro */

  const terceiro = simNao('av-terceiro', 'Teve outro veículo ou pessoa envolvida?', 'nao');
  const terNome = G.field({ id: 'av-ter-nome', label: 'Nome do terceiro', required: true, max: 80, span: 6 });
  const terDoc = G.field({ id: 'av-ter-doc', label: 'CPF ou CNPJ do terceiro', opcional: true, rules: 'cpfCnpj', mask: 'cpfCnpj', inputmode: 'numeric', max: 18, span: 3 });
  const terTel = G.field({ id: 'av-ter-tel', label: 'Telefone do terceiro', opcional: true, tipo: 'tel', rules: 'phone', mask: 'phone', inputmode: 'tel', max: 15, span: 3 });
  const terPlaca = G.field({ id: 'av-ter-placa', label: 'Placa do terceiro', opcional: true, rules: 'placa', mask: 'placa', max: 7, span: 3, spellcheck: false });
  const terVeiculo = G.field({ id: 'av-ter-veiculo', label: 'Veículo do terceiro', opcional: true, max: 60, span: 5, dica: 'Marca e modelo, se souber.' });
  const culpado = simNao('av-culpado', 'Quem causou o acidente?', 'A apurar', [{ value: 'Segurado', label: 'O segurado' }, { value: 'Terceiro', label: 'O terceiro' }, { value: 'A apurar', label: 'Ainda não se sabe' }]);
  const culpaDica = h('p', { class: 'hint span-12', text: 'Se foi o segurado, abrimos também um processo para os danos do terceiro. Se foi o terceiro, a seguradora pode cobrar dele depois (ressarcimento).' });
  const terGrupo = h('div', { class: 'form-grid span-12' }, terNome, terDoc, terTel, terPlaca, terVeiculo, culpado, culpaDica);
  secoes.appendChild(secao('av-ter-titulo', '4. Terceiro envolvido', null, h('div', { class: 'form-grid' }, terceiro, terGrupo)));

  /* -------------------------------------------------------- 5. Contato */

  const contatoTel = G.field({ id: 'av-tel', label: 'Telefone para retorno', tipo: 'tel', required: true, rules: 'phone', mask: 'phone', inputmode: 'tel', max: 15, span: 4 });
  const contatoEmail = G.field({ id: 'av-email', label: 'E-mail para retorno', tipo: 'email', opcional: true, rules: 'email', max: 80, span: 8 });
  const tratar = h('input', { type: 'checkbox', id: 'av-tratar', name: 'tratar' });
  const campoTratar = h('div', { class: 'field span-12' }, h('label', { class: 'choice', for: 'av-tratar' }, tratar, 'Quero tratar este processo agora (ele vem direto para a minha caixa)'));
  secoes.appendChild(secao('av-ct-titulo', '5. Contato para retorno', 'Já preenchemos com os dados da apólice. Ajuste se o segurado pedir.',
    h('div', { class: 'form-grid' }, contatoTel, contatoEmail, campoTratar)));

  function atualizaVisiveis() {
    condGrupo.hidden = marcado('av-condutor') !== 'nao';
    terGrupo.hidden = marcado('av-terceiro') !== 'sim';
  }
  form.addEventListener('change', atualizaVisiveis);
  atualizaVisiveis();
  G.applyMasks(form);
  const dirty = G.guardDirty(form);

  /* ------------------------------------------------------------ Envio */

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const ok = G.validateForm(form, {
      extra(addErro) {
        if (!apolice) {
          addErro(busca.control, 'Busque e escolha a apólice do veículo.');
          return;
        }
        if (G.hoje() > apolice.vigFim || G.hoje() < apolice.vigInicio) addErro(busca.control, 'Essa apólice está fora da vigência. Confira se não existe uma renovação.');
        const d = data.control.value;
        if (d && d > G.hoje()) addErro(data.control, 'A data da ocorrência não pode ser no futuro.');
        else if (d && (d < apolice.vigInicio || d > apolice.vigFim)) addErro(data.control, 'A apólice só cobre ocorrências de ' + G.fmt.date(apolice.vigInicio) + ' a ' + G.fmt.date(apolice.vigFim) + '.');
        const r = relato.control.value.trim();
        if (r && r.length < 30) addErro(relato.control, 'Conte um pouco mais: o relato precisa de pelo menos 30 caracteres.');
        if (marcado('av-terceiro') === 'sim' && marcado('av-culpado') === 'Segurado' && !terNome.control.value.trim()) addErro(terNome.control, 'Faltou o nome do terceiro.');
      }
    });
    if (!ok) return;

    const parecido = G.db.all('processos').find((p) => p.apoliceId === apolice.id && p.ocorrencia.data === data.control.value);
    if (parecido) {
      const seguir = await G.confirmDialog({
        titulo: 'Já existe um aviso parecido',
        descricao: 'O processo ' + G.numeroProcesso(parecido) + ' é da mesma apólice e tem a mesma data de ocorrência. Se for o mesmo acidente, é melhor usar o processo que já existe.',
        cancelar: 'Revisar o aviso',
        confirmar: 'Registrar mesmo assim'
      });
      if (!seguir) { data.control.focus(); return; }
    }

    const temTerceiro = marcado('av-terceiro') === 'sim';
    const criados = G.abreSinistro({
      apoliceId: apolice.id,
      natureza: Number(natureza.control.value),
      canal: canal.control.value,
      prioritaria: prioritaria.checked,
      ocorrencia: {
        data: data.control.value, hora: hora.control.value, logradouro: logradouro.control.value.trim(), bairro: bairro.control.value.trim() || 'Não informado',
        cidade: cidade.control.value.trim(), uf: uf.control.value, relato: relato.control.value.trim(), boletim: boletim.control.value.trim()
      },
      condutor: marcado('av-condutor') === 'sim' ? { segurado: 'sim', nome: '', cpf: '' } : { segurado: 'nao', nome: condNome.control.value.trim(), cpf: condCpf.control.value.trim() },
      terceiro: temTerceiro ? { nome: terNome.control.value.trim(), documento: terDoc.control.value.trim(), telefone: terTel.control.value.trim(), placa: terPlaca.control.value.trim(), veiculo: terVeiculo.control.value.trim() } : null,
      culpado: temTerceiro ? marcado('av-culpado') : 'Segurado',
      contato: { telefone: contatoTel.control.value.trim(), email: contatoEmail.control.value.trim() }
    });
    dirty.clean();

    let comigo = false;
    if (tratar.checked) {
      const grupo = G.grupoDaNatureza(criados[0].natureza);
      if (grupo && grupo.analistas.indexOf(u.id) >= 0) {
        G.atribui(criados[0], u.id, 'Processo assumido por ' + u.nome + ' no registro do aviso');
        comigo = true;
      }
    }
    sucesso(criados, comigo, tratar.checked);
  });

  function sucesso(criados, comigo, pediu) {
    const pagina = document.getElementById('aviso-pagina');
    const titulo = h('h1', { id: 'pagina-titulo', tabindex: '-1', text: 'Aviso registrado' });
    pagina.replaceChildren(h('section', { class: 'card sucesso', 'aria-labelledby': 'pagina-titulo' },
      h('div', { class: 'dialog__icon dialog__icon--success' }, G.icon('check-circle')),
      titulo,
      h('p', null, 'Passe o número do aviso para o segurado: ', h('strong', { class: 'numero-destaque', text: criados[0].aviso })),
      h('ul', { class: 'list-plain attention' }, criados.map((p) => h('li', null,
        h('div', null, h('a', { href: 'processo.html?id=' + p.id, text: 'Processo ' + G.numeroProcesso(p) + ' · ' + G.nome.naturezaCurta(p.natureza) }),
          h('span', { class: 'cell-sub', text: 'Posição inicial: ' + G.nome.posicao(p.posicao) + (p.seq > 1 ? '. Aberto para os danos do terceiro.' : '') })),
        G.statusBadge(p.status)))),
      h('p', { class: 'muted', text: comigo ? 'O processo principal já está na sua caixa.' : pediu ? 'Você não está no grupo que trata essa natureza, então o processo entrou na fila do grupo certo.' : 'Os processos entraram na fila e a distribuição automática entrega para quem estiver livre.' }),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn btn--primary', href: 'processo.html?id=' + criados[0].id }, G.icon('arrow-right'), 'Abrir o processo'),
        h('a', { class: 'btn', href: 'aviso.html' }, G.icon('file-plus'), 'Registrar outro aviso'),
        h('a', { class: 'btn btn--ghost', href: 'inicio.html' }, 'Voltar ao início'))));
    document.title = 'Aviso registrado | Sinistro Auto';
    titulo.focus();
    G.announce('Aviso ' + criados[0].aviso + ' registrado.');
  }
})();
