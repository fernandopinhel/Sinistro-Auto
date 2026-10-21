/*
 * Sinistro Auto: utilitários compartilhados por todas as telas.
 * JavaScript puro, sem dependências. Nada é enviado a servidor:
 * a sessão e os dados do protótipo ficam só no sessionStorage do navegador.
 */
(function () {
  'use strict';

  const PREFIXO = 'gsre:';

  // sessionStorage pode lançar exceção (modo privado, cota, bloqueio de cookies).
  const store = {
    get(chave, padrao) {
      try {
        const bruto = window.sessionStorage.getItem(PREFIXO + chave);
        return bruto === null ? padrao : JSON.parse(bruto);
      } catch (e) {
        return padrao;
      }
    },
    set(chave, valor) {
      try {
        window.sessionStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
      } catch (e) { /* sem persistência: o protótipo segue funcionando na página atual */ }
    },
    remove(chave) {
      try { window.sessionStorage.removeItem(PREFIXO + chave); } catch (e) { /* idem */ }
    },
    clear() {
      try {
        Object.keys(window.sessionStorage)
          .filter((k) => k.indexOf(PREFIXO) === 0)
          .forEach((k) => window.sessionStorage.removeItem(k));
      } catch (e) { /* idem */ }
    }
  };

  /* ------------------------------------------------------------- DOM */

  // Monta elementos sem innerHTML: todo texto entra como textContent.
  function h(tag, props, ...filhos) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden' || k === 'required' || k === 'readOnly') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    append(el, filhos);
    return el;
  }

  function append(el, filhos) {
    filhos.flat(Infinity).forEach((f) => {
      if (f === null || f === undefined || f === false) return;
      el.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
    });
    return el;
  }

  function icon(nome, classe) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'icon' + (classe ? ' ' + classe : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', 'img/icons.svg#i-' + nome);
    svg.appendChild(use);
    return svg;
  }

  let seq = 0;
  function uid(prefixo) { seq += 1; return (prefixo || 'id') + '-' + seq; }

  function param(nome) { return new URLSearchParams(window.location.search).get(nome); }

  /* ---------------------------------------------------- Formatação */

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inteiro = new Intl.NumberFormat('pt-BR');
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const fmt = {
    money: (n) => (n === null || n === undefined || isNaN(n) ? '' : moeda.format(n)),
    decimal: (n) => (n === null || n === undefined || isNaN(n) ? '' : numero.format(n)),
    int: (n) => inteiro.format(n || 0),
    pct: (n) => (isFinite(n) ? pct.format(n) : ''),
    date(iso) {
      if (!iso) return '';
      const p = String(iso).slice(0, 10).split('-');
      return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
    },
    dateTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },
    plural: (n, um, varios) => fmt.int(n) + ' ' + (n === 1 ? um : varios),
    // "há 3 horas", "ontem", "há 5 dias"
    relativo(iso) {
      if (!iso) return '';
      const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (min < 2) return 'agora há pouco';
      if (min < 60) return 'há ' + min + ' minutos';
      const horas = Math.round(min / 60);
      if (horas < 24) return 'há ' + fmt.plural(horas, 'hora', 'horas');
      const dias = Math.round(horas / 24);
      return dias === 1 ? 'ontem' : 'há ' + dias + ' dias';
    }
  };

  function parseMoney(txt) {
    if (typeof txt === 'number') return txt;
    const limpo = String(txt || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  function hoje() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function somaDias(iso, dias) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  function diasAte(iso) {
    return Math.round((new Date(iso + 'T12:00:00') - new Date(hoje() + 'T12:00:00')) / 86400000);
  }

  function normaliza(txt) {
    return String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  const digitos = (txt) => String(txt || '').replace(/\D/g, '');

  /* -------------------------------------------------------- Máscaras */

  const masks = {
    cnpj(v) {
      const d = digitos(v).slice(0, 14);
      return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
    },
    cpf(v) {
      return digitos(v).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2');
    },
    // CPF até 11 números, CNPJ a partir do 12º.
    cpfCnpj(v) { return digitos(v).length > 11 ? masks.cnpj(v) : masks.cpf(v); },
    cep(v) { return digitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'); },
    placa(v) { return String(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); },
    chassi(v) { return String(v).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17); },
    phone(v) {
      const d = digitos(v).slice(0, 11);
      if (d.length <= 2) return d.length ? '(' + d : '';
      if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    },
    digits(v, el) { return digitos(v).slice(0, Number(el && el.getAttribute('maxlength')) || 30); },
    upper(v) { return String(v).toUpperCase(); },
    money(v) { return String(v).replace(/[^\d,.]/g, ''); }
  };

  function applyMasks(raiz) {
    (raiz || document).querySelectorAll('[data-mask]').forEach((el) => {
      if (el.dataset.maskReady) return;
      el.dataset.maskReady = '1';
      const tipo = el.dataset.mask;
      el.addEventListener('input', () => {
        const antes = el.value;
        const depois = masks[tipo](antes, el);
        if (antes !== depois) el.value = depois;
      });
      if (tipo === 'money') {
        el.addEventListener('blur', () => {
          const n = parseMoney(el.value);
          if (n !== null) el.value = fmt.decimal(n);
        });
      }
    });
  }

  /* ------------------------------------------------------ Validação */

  const valida = {
    cnpj(v) {
      const d = digitos(v);
      if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
      const calc = (base) => {
        let soma = 0;
        let peso = base.length - 7;
        for (let i = 0; i < base.length; i++) {
          soma += Number(base[i]) * peso--;
          if (peso < 2) peso = 9;
        }
        const r = soma % 11;
        return r < 2 ? 0 : 11 - r;
      };
      const d1 = calc(d.slice(0, 12));
      const d2 = calc(d.slice(0, 12) + d1);
      return d.endsWith(String(d1) + String(d2));
    },
    cpf(v) {
      const d = digitos(v);
      if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
      const dv = (n) => {
        let soma = 0;
        for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
        const r = (soma * 10) % 11;
        return r === 10 ? 0 : r;
      };
      return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
    },
    cpfCnpj: (v) => (digitos(v).length > 11 ? valida.cnpj(v) : valida.cpf(v)),
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()),
    phone: (v) => { const d = digitos(v); return d.length >= 10 && d.length <= 11 && Number(d.slice(0, 2)) >= 11; },
    cep: (v) => digitos(v).length === 8,
    matricula: (v) => /^[A-Z]\d{6}$/.test(String(v).trim()),
    // Placa antiga (ABC1234) ou Mercosul (ABC1D23).
    placa: (v) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(String(v).toUpperCase()),
    chassi: (v) => /^[A-HJ-NPR-Z0-9]{17}$/.test(String(v).toUpperCase()),
    banco: (v) => /^\d{3}$/.test(digitos(v)),
    money: (v) => { const n = parseMoney(v); return n !== null && n > 0; }
  };

  const mensagens = {
    cnpj: 'Esse CNPJ não parece válido. Pode conferir os números?',
    email: 'Esse e-mail parece incompleto. Use o formato nome@empresa.com.br.',
    phone: 'Coloque o telefone com DDD, assim: (11) 91234-5678.',
    cep: 'O CEP tem 8 números, assim: 01310-100.',
    matricula: 'A matrícula começa com uma letra e tem 6 números, como T204518.',
    cpf: 'Esse CPF não parece válido. Pode conferir os números?',
    cpfCnpj: 'Esse CPF ou CNPJ não parece válido. Pode conferir os números?',
    placa: 'A placa tem 3 letras e mais 4 caracteres, como ABC1D23 ou ABC1234.',
    chassi: 'O chassi tem 17 caracteres, sem as letras I, O e Q.',
    banco: 'O código do banco tem 3 números, como 341.',
    money: 'Informe um valor maior que zero, por exemplo 1.250,00.'
  };

  function rotulo(el) {
    if (el.dataset.label) return el.dataset.label;
    const grupo = el.closest('fieldset.choice-group');
    if ((el.type === 'radio' || el.type === 'checkbox') && grupo) {
      const lg = grupo.querySelector('legend');
      if (lg) return lg.textContent.replace('*', '').trim();
    }
    const lb = el.id && document.querySelector('label[for="' + el.id + '"]');
    return lb ? lb.textContent.replace('*', '').replace('(opcional)', '').trim() : (el.name || 'campo');
  }

  function erroEl(el) {
    const alvo = el.type === 'radio' ? el.closest('fieldset') : el;
    const id = (alvo.id || el.name) + '-erro';
    let p = document.getElementById(id);
    if (!p) {
      p = h('p', { class: 'field-error', id: id, hidden: true });
      const campo = el.closest('.field, .choice-group') || el.parentNode;
      // Logo abaixo do campo, antes da dica, para o erro ficar colado no que precisa mudar.
      if (el.type !== 'radio' && el.parentNode === campo) el.after(p);
      else if (el.parentNode.classList.contains('input-group')) el.parentNode.after(p);
      else campo.appendChild(p);
      const desc = (alvo.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      if (desc.indexOf(id) < 0) desc.push(id);
      alvo.setAttribute('aria-describedby', desc.join(' '));
    }
    return p;
  }

  function setErro(el, msg) {
    const p = erroEl(el);
    const alvo = el.type === 'radio' ? el.closest('fieldset') : el;
    if (msg) {
      p.replaceChildren(icon('alert'), h('span', { text: msg }));
      p.hidden = false;
      if (el.type === 'radio') {
        alvo.querySelectorAll('input').forEach((r) => r.setAttribute('aria-invalid', 'true'));
      } else {
        el.setAttribute('aria-invalid', 'true');
      }
    } else {
      p.hidden = true;
      p.replaceChildren();
      if (el.type === 'radio') alvo.querySelectorAll('input').forEach((r) => r.removeAttribute('aria-invalid'));
      else el.removeAttribute('aria-invalid');
    }
  }

  // Regras vêm do próprio HTML: required, data-rules="cnpj email ..." e min.
  function checaCampo(el) {
    if (el.disabled || el.closest('[hidden]')) return '';
    const regras = (el.dataset.rules || '').split(' ').filter(Boolean);
    const nome = rotulo(el);
    if (el.type === 'radio') {
      const grupo = el.closest('fieldset');
      const req = grupo && grupo.dataset.required === 'true';
      return req && !grupo.querySelector('input:checked') ? 'Escolha uma opção em "' + nome + '".' : '';
    }
    const v = (el.value || '').trim();
    if (!v) {
      if (!el.required) return '';
      return el.tagName === 'SELECT' ? 'Escolha uma opção em "' + nome + '".' : 'Faltou preencher "' + nome + '".';
    }
    for (const r of regras) {
      if (valida[r] && !valida[r](v)) return mensagens[r];
    }
    if (el.type === 'number' && el.min !== '' && Number(v) < Number(el.min)) {
      return '"' + nome + '" precisa ser pelo menos ' + el.min + '.';
    }
    if (el.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Use uma data válida em "' + nome + '".';
    return '';
  }

  function controles(form) {
    const vistos = new Set();
    return Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => {
      if (el.type === 'hidden' || el.type === 'button' || el.type === 'submit' || el.dataset.novalidate) return false;
      if (el.type === 'checkbox') return false;
      if (el.type === 'radio') {
        if (vistos.has(el.name)) return false;
        vistos.add(el.name);
      }
      return true;
    });
  }

  /*
   * Valida o formulário e mostra os erros no campo e num resumo com links.
   * `extra(addErro)` permite regras de negócio (duplicidade, datas etc.).
   * Retorna true quando está tudo certo.
   */
  function validateForm(form, opcoes) {
    const op = opcoes || {};
    const erros = [];
    controles(form).forEach((el) => {
      const msg = checaCampo(el);
      setErro(el, msg);
      if (msg) erros.push({ el, msg });
    });
    if (op.extra) {
      op.extra((el, msg) => {
        setErro(el, msg);
        erros.push({ el, msg });
      });
    }
    renderResumo(form, erros, op.resumoTitulo);
    if (!form.dataset.liveValidate) {
      form.dataset.liveValidate = '1';
      // Depois da primeira tentativa, revalida enquanto a pessoa corrige:
      // texto ao digitar, opções ao escolher. Nunca no blur, porque mudar
      // o layout nessa hora desloca o botão que a pessoa está clicando.
      const revalida = (ev) => {
        const el = ev.target;
        if (!el.matches('input, select, textarea') || el.type === 'checkbox') return;
        const textual = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'radio' && el.type !== 'date');
        if (textual !== (ev.type === 'input')) return;
        if (el.getAttribute('aria-invalid') !== 'true') return;
        const msg = checaCampo(el);
        setErro(el, msg);
        atualizaResumo(form);
      };
      form.addEventListener('input', revalida);
      form.addEventListener('change', revalida);
    }
    if (erros.length) {
      const resumo = form.querySelector('.error-summary');
      if (resumo && erros.length > 1) resumo.focus();
      else focusField(erros[0].el);
      announce(erros.length === 1 ? 'Falta corrigir um ponto: ' + erros[0].msg : 'Faltam corrigir ' + erros.length + ' pontos. A lista está no topo do formulário.');
    }
    return erros.length === 0;
  }

  function focusField(el) {
    const alvo = el.type === 'radio' ? (el.closest('fieldset').querySelector('input:checked') || el) : el;
    alvo.focus();
    if (alvo.scrollIntoView) alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function renderResumo(form, erros, titulo) {
    let resumo = form.querySelector('.error-summary');
    if (!erros.length) {
      if (resumo) resumo.remove();
      return;
    }
    if (erros.length === 1) {
      if (resumo) resumo.remove();
      return;
    }
    if (!resumo) {
      resumo = h('div', { class: 'alert alert--error error-summary', tabindex: '-1', role: 'group', 'aria-labelledby': form.id + '-resumo-titulo' });
      const ancora = form.querySelector('[data-summary-anchor]');
      if (ancora) ancora.after(resumo); else form.prepend(resumo);
    }
    const lista = h('ul');
    erros.forEach((e) => {
      const alvo = e.el.type === 'radio' ? e.el : e.el;
      lista.appendChild(h('li', null, h('a', {
        href: '#' + alvo.id,
        text: e.msg,
        onClick(ev) { ev.preventDefault(); focusField(e.el); }
      })));
    });
    resumo.replaceChildren(
      icon('alert'),
      h('div', { class: 'alert__body' },
        h('p', { class: 'alert__title', id: form.id + '-resumo-titulo', text: titulo || 'Antes de salvar, confira estes ' + erros.length + ' pontos:' }),
        lista)
    );
  }

  function atualizaResumo(form) {
    const resumo = form.querySelector('.error-summary');
    if (!resumo) return;
    const pendentes = Array.from(form.querySelectorAll('[aria-invalid="true"]'));
    const unicos = [];
    const nomes = new Set();
    pendentes.forEach((el) => {
      const chave = el.type === 'radio' ? el.name : el.id;
      if (nomes.has(chave)) return;
      nomes.add(chave);
      const p = document.getElementById((el.type === 'radio' ? el.closest('fieldset').id : el.id) + '-erro');
      unicos.push({ el, msg: p ? p.textContent : '' });
    });
    if (unicos.length < 2) resumo.remove();
    else renderResumo(form, unicos);
  }

  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => setErro(el, ''));
    const resumo = form.querySelector('.error-summary');
    if (resumo) resumo.remove();
  }

  /* ---------------------------------------------- Anúncios e toast */

  let regiao;
  function announce(mensagem) {
    if (!regiao) {
      regiao = document.getElementById('anuncios');
      if (!regiao) {
        regiao = h('div', { id: 'anuncios', class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
        document.body.appendChild(regiao);
      }
    }
    // Limpa antes para que a mesma mensagem repetida seja anunciada de novo.
    regiao.textContent = '';
    window.setTimeout(() => { regiao.textContent = mensagem; }, 60);
  }

  let toastTimer;
  function toast(mensagem, tipo) {
    const atual = document.querySelector('.toast');
    if (atual) atual.remove();
    window.clearTimeout(toastTimer);
    // O texto vai para a região viva, então o toast visual fica aria-hidden.
    const el = h('div', { class: 'toast' + (tipo === 'error' ? ' toast--error' : ''), 'aria-hidden': 'true' },
      icon(tipo === 'error' ? 'alert' : 'check-circle'), h('span', { text: mensagem }));
    document.body.appendChild(el);
    announce(mensagem);
    toastTimer = window.setTimeout(() => el.remove(), 5000);
  }

  // Mensagem que sobrevive a um redirecionamento (ex.: "Oficina salva").
  function flash(mensagem, extra) { store.set('flash', Object.assign({ mensagem }, extra || {})); }
  function takeFlash() {
    const f = store.get('flash', null);
    store.remove('flash');
    return f;
  }

  /* --------------------------------------------------------- Diálogos */

  /*
   * Diálogo modal nativo (<dialog>): prende o foco, fecha com Esc e
   * devolve o foco a quem abriu. `montar(corpo, fechar)` preenche o conteúdo.
   * Resolve com o valor passado a fechar() ou null se cancelado.
   */
  function dialog(op) {
    return new Promise((resolve) => {
      const origem = document.activeElement;
      const tituloId = uid('dlg-titulo');
      const corpo = h('div', { class: 'dialog__body' });
      const rodape = h('div', { class: 'dialog__foot' });
      const form = h('form', { class: 'dialog__form', method: 'dialog', novalidate: true, id: uid('dlg-form') });
      const dlg = h('dialog', { class: 'dialog' + (op.wide ? ' dialog--wide' : ''), 'aria-labelledby': tituloId },
        form);
      let resultado = null;

      const fechar = (valor) => {
        resultado = valor === undefined ? null : valor;
        dlg.close();
      };

      const cab = h('div', { class: 'dialog__head' },
        h('div', null,
          op.icone ? h('div', { class: 'dialog__icon' + (op.tom ? ' dialog__icon--' + op.tom : '') }, icon(op.icone)) : null,
          h('h2', { id: tituloId, text: op.titulo })),
        h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Fechar', onClick: () => fechar(null) }, icon('x')));

      form.append(cab, corpo, rodape);
      corpo.appendChild(h('div', { 'data-summary-anchor': '' }));
      if (op.descricao) corpo.appendChild(h('p', { text: op.descricao }));
      if (op.montar) op.montar(corpo, fechar, form);

      const cancelar = h('button', { type: 'button', class: 'btn', text: op.cancelar || 'Cancelar', onClick: () => fechar(null) });
      const confirmar = h('button', {
        type: 'submit',
        class: 'btn ' + (op.tomBotao === 'danger' ? 'btn--danger-solid' : op.tomBotao === 'success' ? 'btn--success-solid' : 'btn--primary'),
        text: op.confirmar || 'Confirmar'
      });
      if (op.somenteOk) rodape.append(confirmar);
      else rodape.append(cancelar, confirmar);

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (op.aoConfirmar) {
          const valor = op.aoConfirmar(form);
          if (valor === false || valor === undefined) return; // validação falhou: continua aberto
          fechar(valor);
        } else {
          fechar(true);
        }
      });
      dlg.addEventListener('close', () => {
        dlg.remove();
        if (origem && document.contains(origem)) origem.focus();
        resolve(resultado);
      });

      document.body.appendChild(dlg);
      applyMasks(dlg);
      dlg.showModal();
      const foco = dlg.querySelector('[autofocus]') || (op.focoNoConfirmar ? confirmar : corpo.querySelector('input, select, textarea')) || confirmar;
      foco.focus();
    });
  }

  function confirmDialog(op) {
    return dialog(Object.assign({ icone: 'alert', tom: op.tomBotao === 'danger' ? 'danger' : '', focoNoConfirmar: false }, op));
  }

  /* --------------------------------------------------- Campos de formulário */

  /*
   * Cria um campo com rótulo visível, dica e área de erro ligadas por aria.
   * tipo: text | email | tel | number | date | select | textarea
   */
  function field(op) {
    const id = op.id || uid('campo');
    const dicaId = op.dica ? id + '-dica' : null;
    const label = h('label', { for: id },
      op.label,
      op.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null,
      !op.required && op.opcional ? h('span', { class: 'opt' }, ' (opcional)') : null);
    let ctrl;
    const comum = {
      id,
      name: op.name || id,
      required: !!op.required,
      'aria-describedby': dicaId,
      'data-rules': op.rules || null,
      'data-mask': op.mask || null,
      'data-label': op.dataLabel || null,
      disabled: op.disabled,
      autocomplete: op.autocomplete || 'off'
    };
    if (op.tipo === 'select') {
      ctrl = h('select', Object.assign({ class: 'select' }, comum));
      if (op.vazio !== false) ctrl.appendChild(h('option', { value: '', text: op.vazio || 'Selecione' }));
      (op.opcoes || []).forEach((o) => {
        const val = typeof o === 'object' ? o.value : o;
        const txt = typeof o === 'object' ? o.label : o;
        ctrl.appendChild(h('option', { value: val, text: txt }));
      });
      if (op.valor !== undefined && op.valor !== null) ctrl.value = String(op.valor);
    } else if (op.tipo === 'textarea') {
      ctrl = h('textarea', Object.assign({ class: 'textarea', maxlength: op.max || 1000, rows: 4 }, comum));
      if (op.valor) ctrl.value = op.valor;
    } else {
      ctrl = h('input', Object.assign({
        class: 'input' + (op.mask === 'money' ? ' input--money' : ''),
        type: op.tipo || 'text',
        inputmode: op.inputmode || null,
        maxlength: op.max || null,
        min: op.min !== undefined ? op.min : null,
        max: op.maxValor || null,
        step: op.step || null,
        placeholder: op.placeholder || null,
        readOnly: op.readOnly,
        spellcheck: op.spellcheck === undefined ? null : String(op.spellcheck)
      }, comum));
      if (op.valor !== undefined && op.valor !== null) ctrl.value = op.valor;
    }
    const wrap = h('div', { class: 'field ' + (op.span ? 'span-' + op.span : '') },
      label,
      ctrl,
      op.dica ? h('p', { class: 'hint', id: dicaId, text: op.dica }) : null);
    wrap.control = ctrl;
    return wrap;
  }

  function choiceGroup(op) {
    const id = op.id || uid('grupo');
    const fs = h('fieldset', { class: 'choice-group field ' + (op.span ? 'span-' + op.span : ''), id, 'data-required': op.required ? 'true' : null },
      h('legend', null, op.label, op.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null));
    (op.opcoes || []).forEach((o, i) => {
      const val = typeof o === 'object' ? o.value : o;
      const txt = typeof o === 'object' ? o.label : o;
      const inp = h('input', { type: op.multiplo ? 'checkbox' : 'radio', name: op.name || id, id: id + '-' + i, value: val, checked: op.valor === val || (Array.isArray(op.valor) && op.valor.indexOf(val) >= 0) });
      fs.appendChild(h('label', { class: 'choice' + (op.box ? ' choice--box' : ''), for: id + '-' + i }, inp, txt));
    });
    return fs;
  }

  /* --------------------------------------------------- Tabela de dados */

  /*
   * Tabela com ordenação (aria-sort), paginação e seleção opcional.
   * columns: [{ key, label, sort?: fn|bool, render?: fn(row) => Node|string, num?: bool, class? }]
   */
  function dataTable(op) {
    const estado = { sortKey: op.sortKey || null, sortDir: op.sortDir || 'asc', page: 1, size: op.pageSize || 10, selecionados: new Set() };
    const raiz = op.container;
    const capId = uid('cap');

    function ordenados() {
      const linhas = op.rows.slice();
      if (!estado.sortKey) return linhas;
      const col = op.columns.find((c) => c.key === estado.sortKey);
      const valor = typeof col.sort === 'function' ? col.sort : (r) => r[col.key];
      linhas.sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        let r;
        if (typeof va === 'number' && typeof vb === 'number') r = va - vb;
        else r = normaliza(va).localeCompare(normaliza(vb), 'pt-BR', { numeric: true });
        return estado.sortDir === 'asc' ? r : -r;
      });
      return linhas;
    }

    function render(focoSort) {
      const linhas = ordenados();
      const total = linhas.length;
      const paginas = Math.max(1, Math.ceil(total / estado.size));
      if (estado.page > paginas) estado.page = paginas;
      const ini = (estado.page - 1) * estado.size;
      const visiveis = op.paginate === false ? linhas : linhas.slice(ini, ini + estado.size);

      raiz.replaceChildren();
      if (!total) {
        raiz.appendChild(h('div', { class: 'empty' },
          icon(op.emptyIcon || 'search'),
          h('strong', { text: op.emptyTitle || 'Nada por aqui' }),
          h('p', { text: op.emptyText || 'Tente ajustar os filtros.' })));
        return;
      }

      const thead = h('tr');
      if (op.selectable) {
        const todos = h('input', {
          type: 'checkbox',
          'aria-label': 'Selecionar todos desta página',
          checked: visiveis.every((r) => estado.selecionados.has(op.rowKey(r))),
          onChange(ev) {
            visiveis.forEach((r) => {
              if (op.isSelectable && !op.isSelectable(r)) return;
              if (ev.target.checked) estado.selecionados.add(op.rowKey(r)); else estado.selecionados.delete(op.rowKey(r));
            });
            render();
            mudouSelecao();
          }
        });
        thead.appendChild(h('th', { scope: 'col', class: 'col-check' }, todos));
      }
      op.columns.forEach((c) => {
        const th = h('th', { scope: 'col', class: (c.num ? 'num ' : '') + (c.class || '') });
        if (c.sort) {
          const ativo = estado.sortKey === c.key;
          th.setAttribute('aria-sort', ativo ? (estado.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
          th.appendChild(h('button', {
            type: 'button',
            class: 'sort-btn',
            'data-sort': c.key,
            onClick() {
              if (estado.sortKey === c.key) estado.sortDir = estado.sortDir === 'asc' ? 'desc' : 'asc';
              else { estado.sortKey = c.key; estado.sortDir = 'asc'; }
              render(c.key);
              announce('Ordenado por ' + c.label + ', ' + (estado.sortDir === 'asc' ? 'crescente' : 'decrescente') + '.');
            }
          }, c.label, icon(ativo ? (estado.sortDir === 'asc' ? 'sort-up' : 'sort-down') : 'sort')));
        } else if (c.srOnly) {
          th.appendChild(h('span', { class: 'visually-hidden', text: c.label }));
        } else {
          th.textContent = c.label;
        }
        thead.appendChild(th);
      });

      const tbody = h('tbody');
      visiveis.forEach((r) => {
        const chave = op.rowKey ? op.rowKey(r) : null;
        const tr = h('tr', { class: (op.highlight && op.highlight(r) ? 'is-highlight ' : '') + (estado.selecionados.has(chave) ? 'is-selected' : '') });
        if (op.selectable) {
          const pode = !op.isSelectable || op.isSelectable(r);
          tr.appendChild(h('td', { class: 'col-check' }, h('input', {
            type: 'checkbox',
            disabled: !pode,
            'aria-label': 'Selecionar ' + op.rowLabel(r),
            checked: estado.selecionados.has(chave),
            onChange(ev) {
              if (ev.target.checked) estado.selecionados.add(chave); else estado.selecionados.delete(chave);
              tr.classList.toggle('is-selected', ev.target.checked);
              mudouSelecao();
            }
          })));
        }
        op.columns.forEach((c, i) => {
          const conteudo = c.render ? c.render(r) : (r[c.key] === undefined || r[c.key] === null ? '' : String(r[c.key]));
          const cel = h(i === 0 && op.rowHeader !== false ? 'th' : 'td', { class: (c.num ? 'num ' : '') + (c.class || ''), scope: i === 0 && op.rowHeader !== false ? 'row' : null }, conteudo);
          tr.appendChild(cel);
        });
        tbody.appendChild(tr);
      });

      const tabela = h('table', { class: 'table' + (op.compact ? ' table--compact' : '') },
        h('caption', { class: 'visually-hidden', id: capId, text: op.caption + (estado.sortKey ? ', ordenada por ' + op.columns.find((c) => c.key === estado.sortKey).label : '') }),
        h('thead', null, thead),
        tbody,
        op.footer ? op.footer(linhas) : null);

      raiz.appendChild(h('div', { class: 'table-wrap', role: 'region', 'aria-labelledby': capId, tabindex: '0' }, tabela));

      if (op.paginate !== false && paginas > 1) {
        const lista = h('ul');
        const botao = (rotuloTxt, pagina, conteudo, atual) => h('li', null, h('button', {
          type: 'button',
          'aria-label': rotuloTxt,
          'aria-current': atual ? 'page' : null,
          disabled: pagina < 1 || pagina > paginas,
          onClick() {
            estado.page = pagina;
            render();
            raiz.querySelector('.table-wrap').focus();
            announce('Página ' + pagina + ' de ' + paginas + '.');
          }
        }, conteudo));
        lista.appendChild(botao('Página anterior', estado.page - 1, icon('chevron-left')));
        paginasVisiveis(estado.page, paginas).forEach((p) => {
          if (p === '…') lista.appendChild(h('li', { 'aria-hidden': 'true', class: 'muted', text: '…' }));
          else lista.appendChild(botao('Página ' + p, p, String(p), p === estado.page));
        });
        lista.appendChild(botao('Próxima página', estado.page + 1, icon('chevron-right')));
        raiz.appendChild(h('nav', { class: 'pager', 'aria-label': 'Paginação de ' + op.caption },
          h('p', { text: 'Mostrando ' + (ini + 1) + ' a ' + Math.min(ini + estado.size, total) + ' de ' + fmt.int(total) }),
          lista));
      }
      if (focoSort) {
        const b = raiz.querySelector('[data-sort="' + focoSort + '"]');
        if (b) b.focus();
      }
    }

    function mudouSelecao() {
      if (op.onSelect) op.onSelect(Array.from(estado.selecionados));
    }

    render();
    return {
      update(linhas, manterPagina) {
        op.rows = linhas;
        if (!manterPagina) {
          // Abre na página do registro destacado (ex.: o que acabou de ser salvo).
          const i = op.highlight ? ordenados().findIndex(op.highlight) : -1;
          estado.page = i >= 0 ? Math.floor(i / estado.size) + 1 : 1;
        }
        const validos = new Set(linhas.map(op.rowKey || (() => null)));
        estado.selecionados.forEach((k) => { if (!validos.has(k)) estado.selecionados.delete(k); });
        render();
        mudouSelecao();
      },
      selected: () => Array.from(estado.selecionados),
      clearSelection() { estado.selecionados.clear(); render(); mudouSelecao(); },
      rows: () => ordenados()
    };
  }

  function paginasVisiveis(atual, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out = [1];
    const ini = Math.max(2, atual - 1);
    const fim = Math.min(total - 1, atual + 1);
    if (ini > 2) out.push('…');
    for (let i = ini; i <= fim; i++) out.push(i);
    if (fim < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  // Placa no padrão Mercosul. A faixa "BRASIL" é decorativa.
  function placa(texto, pequena) {
    return h('span', { class: 'placa' + (pequena ? ' placa--sm' : '') },
      h('span', { class: 'placa__faixa', 'aria-hidden': 'true', text: 'BRASIL' }),
      h('span', { class: 'placa__num' }, h('span', { class: 'visually-hidden', text: 'Placa ' }), texto));
  }

  function badge(texto, tom) {
    return h('span', { class: 'badge' + (tom ? ' badge--' + tom : ''), text: texto });
  }

  const TOM_STATUS = {
    'Ativo': 'success', 'Ativa': 'success', 'Inativo': '', 'Inativa': '',
    'Aberto': 'info', 'Encerrado': '', 'Reaberto': 'accent',
    'Aguardando liberação': 'warning', 'Liberado': 'info', 'Pago': 'success', 'Rejeitado': 'danger',
    'Em análise': 'info', 'Autorizado': 'success', 'Não autorizado': 'danger',
    'Recebido': 'success', 'Aguardando': 'warning', 'Dispensado': '',
    'Aguardando acordo': 'warning', 'Em cobrança': 'accent', 'Ressarcido': 'success', 'Sem acordo': 'danger',
    'Prazo estourado': 'danger', 'No prazo': 'success', 'Vence hoje': 'warning'
  };
  const statusBadge = (s) => badge(s, TOM_STATUS[s] !== undefined ? TOM_STATUS[s] : '');

  /* ------------------------------------------------------- Exportação */

  function downloadCsv(nomeArquivo, colunas, linhas) {
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      // Evita injeção de fórmula ao abrir no Excel.
      const seguro = /^[=+\-@]/.test(s) ? "'" + s : s;
      return /[";\n]/.test(seguro) ? '"' + seguro.replace(/"/g, '""') + '"' : seguro;
    };
    const csv = [colunas.map((c) => esc(c.label)).join(';')]
      .concat(linhas.map((r) => colunas.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(';')))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nomeArquivo });
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Arquivo ' + nomeArquivo + ' gerado.');
  }

  /* ------------------------------------------------- Formulário sujo */

  function guardDirty(form) {
    let sujo = false;
    const marca = () => { sujo = true; };
    form.addEventListener('input', marca);
    form.addEventListener('change', marca);
    window.addEventListener('beforeunload', (ev) => {
      if (!sujo) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
    return { clean() { sujo = false; }, mark() { sujo = true; }, isDirty: () => sujo };
  }

  /* ----------------------------------------------- Sessão e estrutura */

  function usuario() { return store.get('usuario', null); }

  const NAV = [
    {
      itens: [
        { chave: 'inicio', href: 'inicio.html', label: 'Início', icone: 'home' },
        { chave: 'caixa', href: 'caixa.html', label: 'Caixa de entrada', icone: 'inbox' }
      ]
    },
    {
      titulo: 'Sinistros',
      itens: [
        { chave: 'sinistros', href: 'sinistros.html', label: 'Consultar sinistros', icone: 'search' },
        { chave: 'aviso', href: 'aviso.html', label: 'Aviso de sinistro', icone: 'file-plus' },
        { chave: 'pagamentos', href: 'pagamentos.html', label: 'Liberação de pagamentos', icone: 'coin' },
        { chave: 'ressarcimentos', href: 'ressarcimentos.html', label: 'Ressarcimentos', icone: 'undo' }
      ]
    },
    {
      titulo: 'Gestão',
      itens: [
        { chave: 'indicadores', href: 'indicadores.html', label: 'Indicadores', icone: 'chart' },
        { chave: 'distribuicao', href: 'distribuicao.html', label: 'Distribuição automática', icone: 'route' }
      ]
    },
    {
      titulo: 'Cadastros',
      itens: [
        { chave: 'oficinas', href: 'consulta.html?tipo=oficinas', label: 'Oficinas', icone: 'wrench' },
        { chave: 'prestadores', href: 'consulta.html?tipo=prestadores', label: 'Despachantes e reguladoras', icone: 'briefcase' },
        { chave: 'instituicoes', href: 'consulta.html?tipo=instituicoes', label: 'Financeiras e hospitais', icone: 'bank' },
        { chave: 'cartas', href: 'consulta.html?tipo=cartas', label: 'Modelos de carta', icone: 'mail' }
      ]
    },
    {
      titulo: 'Configurações',
      itens: [
        { chave: 'usuarios', href: 'consulta.html?tipo=usuarios', label: 'Usuários', icone: 'user' },
        { chave: 'perfis', href: 'consulta.html?tipo=perfis', label: 'Perfis de acesso', icone: 'users' },
        { chave: 'naturezas', href: 'consulta.html?tipo=naturezas', label: 'Naturezas', icone: 'tag' },
        { chave: 'posicoes', href: 'consulta.html?tipo=posicoes', label: 'Posições do processo', icone: 'flag' },
        { chave: 'tiposDocumento', href: 'consulta.html?tipo=tiposDocumento', label: 'Tipos de documento', icone: 'file' }
      ]
    }
  ];

  function iniciais(nome) {
    const p = String(nome || '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '') + ((p.length > 1 ? p[p.length - 1][0] : '') || '');
  }

  // Descrições curtas dos itens nos painéis do menu.
  const DICAS = {
    sinistros: 'Por placa, CPF ou número', aviso: 'Abrir um sinistro novo', pagamentos: 'Dentro da sua alçada', ressarcimentos: 'Cobrança de terceiros',
    indicadores: 'Tempos e valores', distribuicao: 'Grupos e ordem da fila',
    oficinas: 'Rede de reparo', prestadores: 'Quem presta serviço', instituicoes: 'Credores e hospitais', cartas: 'Textos prontos',
    usuarios: 'Quem acessa', perfis: 'Permissões', naturezas: 'Tipos de evento', posicoes: 'Etapas e prazos', tiposDocumento: 'O que pedir'
  };

  /*
   * Monta a barra superior (marca, menu, busca rápida, novo aviso e usuário),
   * a trilha de navegação e o rodapé. `op.ativo` marca o item atual e
   * `op.migalhas` é a trilha [{label, href?}].
   */
  function shell(op) {
    const u = usuario();
    if (!u) {
      window.location.replace('login.html');
      return false;
    }

    const topbar = document.querySelector('.topbar');
    const contexto = document.querySelector('.context-bar');
    const footer = document.querySelector('.app-footer');
    const fundo = () => [document.getElementById('conteudo'), contexto, footer].filter(Boolean);

    const marca = h('a', { class: 'brand', href: 'inicio.html' },
      h('img', { class: 'brand__mark', src: 'img/favicon.svg', alt: '', width: '34', height: '34' }),
      h('span', { class: 'brand__text' },
        h('span', { class: 'brand__name', text: 'Sinistro Auto' }),
        h('span', { class: 'brand__sub', text: 'Travessia Seguros' })));

    /* Menu: links diretos e grupos que abrem um painel (padrão disclosure). */
    const abertos = [];
    function fechaPaineis(exceto) {
      abertos.forEach((b) => {
        if (b === exceto) return;
        b.setAttribute('aria-expanded', 'false');
        document.getElementById(b.getAttribute('aria-controls')).hidden = true;
      });
    }
    function grupoMenu(id, rotulo, grupos) {
      const ativo = grupos.some((g) => g.itens.some((it) => it.chave === op.ativo));
      const botao = h('button', { type: 'button', class: 'mainnav__link' + (ativo ? ' is-active' : ''), 'aria-expanded': 'false', 'aria-controls': id },
        rotulo, icon('chevron-down', 'mainnav__chevron'));
      const painel = h('div', { class: 'mainnav__panel' + (grupos.length > 1 ? ' mainnav__panel--duplo' : ''), id, hidden: true });
      grupos.forEach((g) => {
        const tituloId = id + '-' + uid('t');
        painel.appendChild(h('div', { class: 'mainnav__col' },
          grupos.length > 1 ? h('p', { class: 'mainnav__coltitle', id: tituloId, text: g.titulo }) : null,
          h('ul', { 'aria-labelledby': grupos.length > 1 ? tituloId : null }, g.itens.map((it) => h('li', null,
            h('a', { class: 'mainnav__item', href: it.href, 'aria-current': it.chave === op.ativo ? 'page' : null },
              h('span', { class: 'mainnav__icon' }, icon(it.icone)),
              h('span', null, it.label, h('small', { text: DICAS[it.chave] || '' }))))))));
      });
      botao.addEventListener('click', () => {
        const abrir = botao.getAttribute('aria-expanded') !== 'true';
        fechaPaineis(botao);
        botao.setAttribute('aria-expanded', String(abrir));
        painel.hidden = !abrir;
      });
      abertos.push(botao);
      return h('li', { class: 'mainnav__group' }, botao, painel);
    }

    const grupo = (titulo) => NAV.find((g) => g.titulo === titulo);
    const naCaixa = window.GSRE.db ? window.GSRE.db.all('processos').filter((p) => p.status === 'Aberto' && p.analistaId === u.id).length : 0;
    const linkDireto = (it, extra) => h('li', null, h('a', { class: 'mainnav__link', href: it.href, 'aria-current': it.chave === op.ativo ? 'page' : null }, it.label, extra || null));
    const nav = h('nav', { class: 'mainnav', id: 'menu-principal', 'aria-label': 'Menu principal' },
      h('ul', { class: 'mainnav__list' },
        linkDireto(NAV[0].itens[0]),
        linkDireto(NAV[0].itens[1], naCaixa ? h('span', { class: 'mainnav__count' }, String(naCaixa), h('span', { class: 'visually-hidden', text: naCaixa === 1 ? ' processo' : ' processos' })) : null),
        grupoMenu('menu-sinistros', 'Sinistros', [grupo('Sinistros')]),
        grupoMenu('menu-gestao', 'Gestão', [grupo('Gestão')]),
        grupoMenu('menu-cadastros', 'Cadastros', [grupo('Cadastros'), grupo('Configurações')])));

    /* Busca rápida: leva para a consulta de sinistros já filtrada. */
    const busca = h('form', { class: 'quicksearch', role: 'search', action: 'sinistros.html', 'aria-label': 'Busca rápida de sinistros' },
      h('label', { class: 'visually-hidden', for: 'busca-rapida', text: 'Buscar por placa, sinistro ou CPF' }),
      icon('search', 'quicksearch__icon'),
      h('input', { class: 'quicksearch__input', id: 'busca-rapida', name: 'busca', type: 'search', placeholder: 'Placa, sinistro ou CPF', autocomplete: 'off', spellcheck: 'false' }));
    busca.addEventListener('submit', (ev) => {
      const v = busca.querySelector('input').value.trim();
      if (!v) { ev.preventDefault(); busca.querySelector('input').focus(); return; }
      store.remove('filtros:sinistros');
    });

    const novoAviso = h('a', { class: 'btn btn--accent topbar__novo', href: 'aviso.html', 'aria-label': 'Novo aviso', 'aria-current': op.ativo === 'aviso' ? 'page' : null },
      icon('plus'), h('span', { class: 'topbar__novo-texto', text: 'Novo aviso' }));

    /* Menu do usuário */
    const restaurar = h('button', { type: 'button', class: 'usermenu__item' }, icon('refresh'), 'Restaurar dados de exemplo');
    const sair = h('button', { type: 'button', class: 'usermenu__item' }, icon('logout'), 'Sair');
    const userPainel = h('div', { class: 'usermenu__panel', id: 'menu-usuario', hidden: true },
      h('p', { class: 'usermenu__who' }, h('strong', { text: u.nome }), h('span', { text: u.perfil + ' · ' + u.matricula })),
      restaurar, sair);
    const userBotao = h('button', { type: 'button', class: 'usermenu__btn', 'aria-expanded': 'false', 'aria-controls': 'menu-usuario' },
      h('span', { class: 'avatar', 'aria-hidden': 'true', text: iniciais(u.nome).toUpperCase() }), h('span', { class: 'visually-hidden', text: 'Menu de ' + u.nome }), icon('chevron-down', 'mainnav__chevron'));
    userBotao.addEventListener('click', () => {
      const abrir = userBotao.getAttribute('aria-expanded') !== 'true';
      fechaPaineis(userBotao);
      userBotao.setAttribute('aria-expanded', String(abrir));
      userPainel.hidden = !abrir;
    });
    abertos.push(userBotao);
    sair.addEventListener('click', () => {
      store.remove('usuario');
      window.location.href = 'login.html';
    });

    const abrirMenu = h('button', { type: 'button', class: 'btn btn--ghost btn--icon topbar__menu', 'aria-label': 'Abrir menu', 'aria-expanded': 'false', 'aria-controls': 'menu-principal' }, icon('menu'));

    topbar.replaceChildren(h('div', { class: 'topbar__inner' },
      abrirMenu, marca, nav, busca, novoAviso, h('div', { class: 'usermenu' }, userBotao, userPainel)));

    // Fecha painéis com Esc (devolvendo o foco) e ao clicar fora.
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      const aberto = abertos.find((b) => b.getAttribute('aria-expanded') === 'true');
      if (aberto) { fechaPaineis(); aberto.focus(); }
    });
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('.mainnav__group, .usermenu')) fechaPaineis();
    });

    /* Trilha */
    if (contexto) {
      const trilha = h('ol');
      (op.migalhas || []).forEach((m, i, arr) => {
        const ultimo = i === arr.length - 1;
        trilha.appendChild(h('li', null, ultimo || !m.href
          ? h('span', { 'aria-current': ultimo ? 'page' : null, text: m.label })
          : h('a', { href: m.href, text: m.label })));
      });
      contexto.setAttribute('role', 'region');
      contexto.setAttribute('aria-label', 'Onde você está');
      contexto.replaceChildren(h('div', { class: 'context-bar__inner' },
        h('nav', { class: 'breadcrumbs', 'aria-label': 'Você está em' }, trilha),
        h('span', { class: 'case-tag', text: 'Case de UX/UI · 2020' })));
    }

    if (footer) {
      const restaurarRodape = h('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, icon('refresh'), 'Restaurar dados de exemplo');
      footer.replaceChildren(h('div', { class: 'app-footer__inner' },
        h('p', { text: 'Case de UX/UI · 2020. Travessia Seguros é uma marca fictícia que representa a empresa onde o projeto nasceu. Pessoas, empresas, apólices, placas e valores são de exemplo, e tudo o que você faz fica só nesta aba do navegador.' }),
        restaurarRodape));
      restaurarRodape.addEventListener('click', confirmaRestaurar);
    }

    /* Menu em gaveta no celular e tablet: modal, fecha com Esc e devolve o foco. */
    let scrim = document.querySelector('.scrim');
    if (!scrim) {
      scrim = h('div', { class: 'scrim' });
      document.body.appendChild(scrim);
    }
    const setMenu = (aberto) => {
      nav.classList.toggle('is-open', aberto);
      scrim.classList.toggle('is-open', aberto);
      abrirMenu.setAttribute('aria-expanded', String(aberto));
      abrirMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
      abrirMenu.querySelector('use').setAttribute('href', 'img/icons.svg#i-' + (aberto ? 'x' : 'menu'));
      fundo().forEach((el) => { if (aberto) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
      if (aberto) nav.querySelector('a, button').focus();
    };
    abrirMenu.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
    scrim.addEventListener('click', () => { setMenu(false); abrirMenu.focus(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && nav.classList.contains('is-open') && !abertos.some((b) => b.getAttribute('aria-expanded') === 'true')) {
        setMenu(false);
        abrirMenu.focus();
      }
    });
    window.matchMedia('(min-width: 1180px)').addEventListener('change', (mq) => { if (mq.matches) setMenu(false); });

    async function confirmaRestaurar() {
      fechaPaineis();
      const ok = await confirmDialog({
        titulo: 'Restaurar os dados de exemplo?',
        descricao: 'Tudo o que você cadastrou ou alterou nesta aba volta ao estado original do protótipo. Sua sessão continua aberta.',
        confirmar: 'Restaurar dados',
        tomBotao: 'danger'
      });
      if (!ok) return;
      window.GSRE.db.reset();
      flash('Pronto, os dados de exemplo foram restaurados.');
      window.location.reload();
    }
    restaurar.addEventListener('click', confirmaRestaurar);

    if (op.titulo) document.title = op.titulo + ' | Sinistro Auto';

    const f = takeFlash();
    if (f) window.setTimeout(() => toast(f.mensagem, f.tipo), 150);
    return u;
  }

  window.GSRE = Object.assign(window.GSRE || {}, {
    store, h, append, icon, uid, param, fmt, parseMoney, hoje, somaDias, diasAte, normaliza, digitos,
    masks, applyMasks, valida, validateForm, clearErrors, setErro, focusField,
    announce, toast, flash, takeFlash, dialog, confirmDialog, field, choiceGroup,
    dataTable, badge, statusBadge, placa, downloadCsv, guardDirty, usuario, shell, NAV
  });
})();
