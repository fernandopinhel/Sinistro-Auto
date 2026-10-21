/*
 * Sinistro Auto: dados de exemplo, regras de negócio e esquemas dos cadastros.
 * Tudo é fictício: pessoas, empresas, apólices, placas, chassis, CPFs, CNPJs e valores.
 * O "banco" vive no sessionStorage; restaurar recria estes dados.
 */
(function () {
  'use strict';

  const G = window.GSRE;
  const VERSAO = 5;

  /* ------------------------------------------------------- Listas fixas */

  const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
  const STATUS = ['Ativo', 'Inativo'];

  // Cada natureza consome uma cobertura da apólice.
  const COBERTURAS = {
    casco: 'Casco (veículo segurado)',
    rcfDm: 'RCF danos materiais a terceiros',
    rcfDp: 'RCF danos corporais a terceiros',
    app: 'Acidentes pessoais de passageiros'
  };

  const GRUPOS_NATUREZA = ['Danos parciais', 'Indenização integral', 'Terceiros', 'Acidentes pessoais'];

  const CATEGORIAS_PARECER = {
    'Análise': ['Análise técnica', 'Pedido de documentos', 'Cobertura confirmada', 'Negativa de cobertura'],
    'Regulação': ['Vistoria realizada', 'Orçamento revisado', 'Peças em falta'],
    'Salvados': ['Recolha de salvado', 'Avaliação de salvado', 'Venda em leilão'],
    'Despachante': ['Documentação do veículo', 'Transferência para a seguradora', 'Baixa do gravame'],
    'Jurídico': ['Ação judicial', 'Acordo extrajudicial']
  };

  const TIPOS_NEWS = ['Novos documentos', 'Novo orçamento', 'Nota fiscal recebida', 'Parecer do despachante', 'Vistoria concluída'];

  const BANCOS = [
    { value: '901', label: '901 · Banco Aurora' }, { value: '902', label: '902 · Banco Ipê' },
    { value: '903', label: '903 · Banco Litoral' }, { value: '904', label: '904 · Cooperativa Serra Azul' },
    { value: '905', label: '905 · Mirante Digital' }, { value: '906', label: '906 · Banco Horizonte' },
    { value: '907', label: '907 · Banco Cais' }, { value: '908', label: '908 · Banco Pampa' }
  ];

  /* --------------------------------------------- Gerador determinístico */

  let semente = 20200417;
  function rnd() {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  }
  const entre = (a, b) => a + rnd() * (b - a);
  const inteiro = (a, b) => Math.floor(entre(a, b + 1));
  const sorteia = (lista) => lista[Math.floor(rnd() * lista.length)];
  const redondo = (n, passo) => Math.round(n / (passo || 10)) * (passo || 10);

  function cnpj(base8, filial) {
    const b = String(base8).padStart(8, '0') + String(filial || 1).padStart(4, '0');
    const dv = (s) => {
      let soma = 0;
      let peso = s.length - 7;
      for (let i = 0; i < s.length; i++) {
        soma += Number(s[i]) * peso--;
        if (peso < 2) peso = 9;
      }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = dv(b);
    const d2 = dv(b + d1);
    return G.masks.cnpj(b + d1 + d2);
  }

  function cpf(base9) {
    const b = String(base9).padStart(9, '0').slice(0, 9);
    const dv = (s) => {
      let soma = 0;
      for (let i = 0; i < s.length; i++) soma += Number(s[i]) * (s.length + 1 - i);
      const r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    const d1 = dv(b);
    const d2 = dv(b + d1);
    return G.masks.cpf(b + d1 + d2);
  }

  const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  function placa() {
    const l = () => LETRAS[Math.floor(rnd() * LETRAS.length)];
    return 'R' + l() + l() + inteiro(1, 9) + l() + inteiro(10, 99);
  }
  function chassi() {
    const cs = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let s = '9TV';
    while (s.length < 17) s += cs[Math.floor(rnd() * cs.length)];
    return s;
  }

  const cod = (n) => String(n).padStart(3, '0');

  /* ------------------------------------------------------ Dados de exemplo */

  function seed() {
    semente = 20200417;
    const hoje = G.hoje();
    const dia = (d) => G.somaDias(hoje, d);
    const quando = (d, hora) => dia(d) + 'T' + (hora || '10:30') + ':00';
    // Horas atrás, a partir de agora (para filas e prazos curtos).
    const horasAtras = (h) => new Date(Date.now() - h * 3600000).toISOString();
    const db = { versao: VERSAO };
    const meta = (id, dias, quem) => ({
      id,
      codigo: cod(id),
      criadoEm: quando(dias),
      criadoPor: quem || 'Bruno Tavares',
      alteradoEm: quando(Math.min(0, dias + 40)),
      alteradoPor: quem || 'Bruno Tavares',
      historico: [{ quando: quando(dias), quem: quem || 'Bruno Tavares', acao: 'Cadastro criado' }]
    });
    const endereco = (cep, logradouro, numero, bairro, cidade, uf) => ({ cep, logradouro, numero, complemento: '', bairro, cidade, uf });

    /* ---------- Tabelas do sistema */

    db.tiposDocumento = [
      ['CNH do condutor', 'Segurado', 'sim'], ['CRLV do veículo', 'Segurado', 'sim'], ['Boletim de ocorrência', 'Segurado', 'sim'],
      ['Fotos do veículo', 'Oficina', 'nao'], ['Orçamento da oficina', 'Oficina', 'nao'], ['Laudo de vistoria', 'Reguladora', 'nao'],
      ['Nota fiscal do reparo', 'Oficina', 'nao'], ['Recibo de quitação', 'Segurado', 'sim'], ['Certificado de registro (CRV) assinado', 'Segurado', 'sim'],
      ['Extrato de quitação do financiamento', 'Financeira', 'nao'], ['Procuração', 'Segurado', 'nao'], ['Laudo médico', 'Segurado', 'sim'],
      ['Comprovante de residência', 'Segurado', 'nao'], ['Telegrama antigo (fax)', 'Segurado', 'nao', 'Inativo']
    ].map((t, i) => Object.assign(meta(i + 1, -1100 + i), { nome: t[0], origem: t[1], exigeOriginal: t[2], status: t[3] || 'Ativo', descricao: '' }));
    const doc = (nome) => db.tiposDocumento.find((t) => t.nome === nome).id;
    const DOCS_DP = [doc('CNH do condutor'), doc('CRLV do veículo'), doc('Fotos do veículo'), doc('Orçamento da oficina')];
    const DOCS_II = [doc('CNH do condutor'), doc('CRLV do veículo'), doc('Boletim de ocorrência'), doc('Certificado de registro (CRV) assinado'), doc('Recibo de quitação')];
    const DOCS_T = [doc('CNH do condutor'), doc('Boletim de ocorrência'), doc('Orçamento da oficina')];
    const DOCS_AP = [doc('Boletim de ocorrência'), doc('Laudo médico'), doc('Comprovante de residência')];

    db.naturezas = [
      [1, 'Colisão, danos parciais', 'Danos parciais', 'casco', DOCS_DP, 15],
      [2, 'Incêndio, danos parciais', 'Danos parciais', 'casco', DOCS_DP.concat(doc('Boletim de ocorrência')), 20],
      [3, 'Furto ou roubo do veículo', 'Indenização integral', 'casco', DOCS_II, 30],
      [4, 'Indenização integral por colisão', 'Indenização integral', 'casco', DOCS_II.filter((d) => d !== doc('Boletim de ocorrência')).concat(doc('Laudo de vistoria')), 30],
      [6, 'Furto ou roubo de acessórios', 'Danos parciais', 'casco', [doc('Boletim de ocorrência'), doc('CRLV do veículo'), doc('Orçamento da oficina')], 15],
      [8, 'APP invalidez', 'Acidentes pessoais', 'app', DOCS_AP, 30],
      [10, 'RCF danos corporais a terceiros', 'Terceiros', 'rcfDp', DOCS_AP.concat(doc('CNH do condutor')), 30],
      [11, 'RCF danos materiais a terceiros', 'Terceiros', 'rcfDm', DOCS_T, 20],
      [54, 'Alagamento, danos parciais', 'Danos parciais', 'casco', DOCS_DP, 15],
      [58, 'Indenização integral por alagamento', 'Indenização integral', 'casco', DOCS_II.filter((d) => d !== doc('Boletim de ocorrência')), 30],
      [72, 'Lucros cessantes', 'Terceiros', 'rcfDm', [doc('Boletim de ocorrência')], 30, 'Inativo']
    ].map((n, i) => Object.assign(meta(i + 1, -1090 + i), {
      numero: n[0], descricao: n[1], grupo: n[2], cobertura: n[3], documentos: n[4], prazoDias: n[5], status: n[6] || 'Ativo'
    }));

    db.posicoes = [
      [1, 'Sem orçamento', 2, 'nao', 'Aviso aberto, esperando a oficina mandar o orçamento.'],
      [2, 'Em análise', 1, 'nao', 'O analista está conferindo cobertura, documentos e valores.'],
      [3, 'Aguardando documentos', 10, 'nao', 'Falta algum documento do segurado ou de terceiros.'],
      [4, 'Orçamento não autorizado', 2, 'nao', 'A oficina precisa revisar o orçamento.'],
      [5, 'Em reparo', 15, 'nao', 'Orçamento autorizado e veículo na oficina.'],
      [6, 'Aguardando vistoria', 3, 'nao', 'Reguladora acionada para vistoriar o veículo.'],
      [7, 'Aguardando nota fiscal', 5, 'nao', 'Reparo concluído, falta a nota fiscal da oficina.'],
      [8, 'Aguardando pagamento', 3, 'nao', 'Pagamento solicitado, esperando liberação.'],
      [9, 'Encerrado com indenização', 0, 'sim', 'Sinistro pago e encerrado.'],
      [10, 'Encerrado sem indenização', 0, 'sim', 'Negativa de cobertura, desistência ou valor abaixo da franquia.']
    ].map((p, i) => Object.assign(meta(i + 1, -1080 + i), { numero: p[0], descricao: p[1], prazoDias: p[2], encerra: p[3], orientacao: p[4], status: 'Ativo' }));

    db.telas = [
      'Caixa de entrada', 'Consulta de sinistros', 'Aviso de sinistro', 'Processo: pareceres', 'Processo: orçamentos', 'Processo: indenizações',
      'Processo: documentos', 'Processo: cartas', 'Liberação de pagamentos', 'Ressarcimentos', 'Indicadores', 'Distribuição automática',
      'Oficinas', 'Despachantes e reguladoras', 'Financeiras e hospitais', 'Modelos de carta', 'Usuários', 'Perfis de acesso', 'Tabelas do sistema'
    ].map((t, i) => Object.assign(meta(i + 1, -1070), { nome: t, status: 'Ativo', descricao: '' }));

    const todas = ['incluir', 'consultar', 'alterar', 'excluir'];
    const perm = (ids, acoes) => ids.reduce((acc, id) => { acc[id] = acoes.slice(); return acc; }, {});
    const tudo = db.telas.map((t) => t.id);
    db.perfis = [
      ['Supervisor de sinistros', 'Acesso completo, inclusive distribuição e cadastros.', perm(tudo, todas)],
      ['Analista de danos parciais', 'Trata colisões e reparos na oficina.', Object.assign(perm([1, 2, 3, 4, 5, 6, 7, 8], ['incluir', 'consultar', 'alterar']), perm([13, 14, 15], ['consultar']))],
      ['Analista de indenização integral', 'Trata furto, roubo e perda total.', Object.assign(perm([1, 2, 3, 4, 6, 7, 8], ['incluir', 'consultar', 'alterar']), perm([10, 15], ['consultar']))],
      ['Analista de terceiros', 'Trata danos a terceiros e ressarcimentos.', Object.assign(perm([1, 2, 3, 4, 5, 6, 7, 8, 10], ['incluir', 'consultar', 'alterar']), perm([13], ['consultar']))],
      ['Liberação de pagamentos', 'Libera ou rejeita pagamentos dentro da alçada.', Object.assign(perm([9], ['consultar', 'alterar']), perm([2, 6, 11], ['consultar']))],
      ['Consulta', 'Somente leitura.', perm([2, 11], ['consultar'])],
      ['Auditoria externa', 'Perfil criado e ainda sem telas liberadas.', {}, 'Inativo']
    ].map((g, i) => Object.assign(meta(i + 1, -1060 + i), { nome: g[0], descricao: g[1], permissoes: g[2], status: g[3] || 'Ativo' }));

    db.usuarios = [
      ['T204518', 'Bruno Tavares', 1, 'Supervisor de sinistros', 80000, 60000, 287345120],
      ['T198330', 'Larissa Monte', 2, 'Analista de sinistros', 25000, 15000, 312904587],
      ['T211472', 'Vitor Amaral', 2, 'Analista de sinistros', 25000, 15000, 405128773],
      ['T187604', 'Renata Coelho', 3, 'Analista de sinistros sênior', 120000, 40000, 198273645],
      ['T220915', 'Fábio Lacerda', 3, 'Analista de sinistros', 90000, 40000, 276590314],
      ['T176283', 'Sandra Quintela', 5, 'Especialista de pagamentos', 0, 150000, 334120987],
      ['T230447', 'Elisa Pacheco', 4, 'Analista de sinistros', 30000, 20000, 221908765],
      ['T169052', 'Otto Ramalho', 2, 'Analista de sinistros', 25000, 15000, 190876543, 'Inativo'],
      ['T241306', 'Helena Prates', 6, 'Assistente de atendimento', 0, 0, 356781209]
    ].map((u, i) => Object.assign(meta(i + 1, -1000 + i * 9), {
      matricula: u[0], nome: u[1], perfil: u[2], cargo: u[3], alcadaAnalise: u[4], alcadaPagamento: u[5], cpf: cpf(u[6]),
      tipo: 'Funcionário', status: u[7] || 'Ativo', graduado: i === 0 || i === 3 ? 'sim' : 'nao',
      email: G.normaliza(u[1]).replace(/\s+/g, '.') + '@travessia.exemplo'
    }));
    const usu = (nome) => db.usuarios.find((u) => u.nome === nome).id;

    /* ---------- Cadastros de parceiros */

    const DDD = { SP: 11, RJ: 21, MG: 31, RS: 51, PR: 41, BA: 71, DF: 61, PE: 81, SC: 48, GO: 62 };
    const tel = (uf, i) => '(' + DDD[uf] + ') 3' + (210 + i * 7) + '-' + (4400 + i * 23);
    const cel = (uf, i) => '(' + DDD[uf] + ') 9' + (8120 + i * 37) + '-' + (2200 + i * 113);

    const oficinas = [
      ['Reparadora Pé na Estrada LTDA', 'Pé na Estrada Reparos', 'Referenciada', 'Multimarcas', 'Ouro', 37120458, endereco('04019-001', 'Rua Domingos de Morais', '2100', 'Vila Mariana', 'São Paulo', 'SP')],
      ['Funilaria Estrela Guia LTDA', 'Funilaria Estrela Guia', 'Referenciada', 'Multimarcas', 'Prata', 33410276, endereco('22775-040', 'Avenida das Américas', '7700', 'Barra da Tijuca', 'Rio de Janeiro', 'RJ')],
      ['Arion Horizonte Concessionária S.A.', 'Arion Horizonte', 'Concessionária', 'Arion', 'Ouro', 21987345, endereco('30411-000', 'Avenida Amazonas', '5400', 'Gameleira', 'Belo Horizonte', 'MG')],
      ['Mecânica e Pintura Lagoa Clara LTDA', 'Lagoa Clara Car', 'Referenciada', 'Multimarcas', 'Bronze', 44120983, endereco('01124-000', 'Rua José Paulino', '900', 'Bom Retiro', 'São Paulo', 'SP')],
      ['Martelinho Pampa Azul LTDA', 'Martelinho Pampa Azul', 'Referenciada', 'Multimarcas', 'Prata', 19203847, endereco('90035-001', 'Avenida Independência', '1200', 'Independência', 'Porto Alegre', 'RS')],
      ['Primavera Volta Comércio de Veículos LTDA', 'Primavera Volta', 'Concessionária', 'Volta', 'Ouro', 28345120, endereco('80420-090', 'Rua Comendador Araújo', '700', 'Batel', 'Curitiba', 'PR')],
      ['Oficina Maré Alta Reparação Automotiva LTDA', 'Oficina Maré Alta', 'Referenciada', 'Multimarcas', 'Prata', 35678901, endereco('41820-020', 'Avenida Tancredo Neves', '1500', 'Caminho das Árvores', 'Salvador', 'BA')],
      ['Garagem Ipê Funilaria LTDA', 'Garagem Ipê', 'Livre escolha', 'Multimarcas', 'Bronze', 27890123, endereco('70390-100', 'SGAS Quadra 613', '10', 'Asa Sul', 'Brasília', 'DF')],
      ['Reparadora Campo Sereno LTDA', 'Reparadora Campo Sereno', 'Referenciada', 'Multimarcas', 'Prata', 38901234, endereco('52011-000', 'Rua Joaquim Nabuco', '800', 'Graças', 'Recife', 'PE')],
      ['Serra Nova Auto Pintura LTDA', 'Serra Nova Auto Pintura', 'Referenciada', 'Multimarcas', 'Bronze', 22109876, endereco('88036-000', 'Rua Lauro Linhares', '1200', 'Trindade', 'Florianópolis', 'SC'), 'Inativo']
    ];
    db.oficinas = oficinas.map((o, i) => Object.assign(meta(i + 1, -800 + i * 11), {
      cnpj: cnpj(o[5]), razaoSocial: o[0], nomeFantasia: o[1], tipo: o[2], bandeira: o[3], categoria: o[4],
      inscricaoEstadual: String(110000000 + o[5] % 99999999).slice(0, 9), endereco: o[6], status: o[7] || 'Ativo',
      abertura: '08:00', fechamento: i % 3 === 0 ? '18:00' : '17:30', carroReserva: i % 2 === 0 ? 'sim' : 'nao', observacoes: '',
      contatos: [{ nome: ['Rogério Alves', 'Simone Barros', 'Paulo Henrique', 'Cíntia Moraes', 'Leandro Kuhn', 'Mariana Toledo', 'Joana Brito', 'Sérgio Paiva', 'Lúcia Vidal', 'André Coelho'][i] + ' (orçamentos)', telefone: tel(o[6].uf, i), email: 'orcamento@' + G.normaliza(o[1]).replace(/\s+/g, '') + '.exemplo' }]
    }));

    const prestadores = [
      ['Despachante', 'Despachante Papel em Dia LTDA', 'Papel em Dia', 18332540, 'SP'],
      ['Despachante', 'Rota Certa Despachos LTDA', 'Rota Certa', 27114809, 'RJ'],
      ['Reguladora', 'Vistora Regulação de Sinistros LTDA', 'Vistora', 30876112, 'SP'],
      ['Reguladora', 'Vistoria Sul Peritos Associados LTDA', 'Vistoria Sul', 22650871, 'RS'],
      ['Guincho e remoção', 'Leva e Traz Serviços Automotivos LTDA', 'Guincho Leva e Traz', 33902447, 'MG'],
      ['Leiloeiro', 'Arremate Certo Leilões LTDA', 'Arremate Certo', 15448203, 'PR'],
      ['Despachante', 'Despachante Central Norte LTDA', 'Central Norte', 29081536, 'PE', 'Inativo']
    ];
    db.prestadores = prestadores.map((p, i) => Object.assign(meta(i + 1, -760 + i * 13), {
      tipo: p[0], razaoSocial: p[1], nomeFantasia: p[2], cnpj: cnpj(p[3]), status: p[5] || 'Ativo',
      formaPagamento: i % 3 === 2 ? 'Boleto' : 'Conta corrente', banco: ['901', '902', '903', '904', '905', '906', '901'][i], agencia: String(1200 + i * 137), conta: String(40100 + i * 2711) + '-' + (i % 9),
      endereco: endereco(['01310-100', '20031-170', '04538-133', '90570-020', '30140-071', '80250-104', '52011-000'][i], ['Avenida Paulista', 'Rua da Assembleia', 'Avenida Brigadeiro Faria Lima', 'Rua Mostardeiro', 'Rua da Bahia', 'Avenida Sete de Setembro', 'Rua do Futuro'][i], String(100 + i * 77), 'Centro', ['São Paulo', 'Rio de Janeiro', 'São Paulo', 'Porto Alegre', 'Belo Horizonte', 'Curitiba', 'Recife'][i], p[4]),
      contatos: [{ nome: ['Larissa Campos', 'Rafael Mendes', 'Tatiane Rocha', 'Eduardo Lima', 'Priscila Gomes', 'Vinícius Prado', 'Aline Duarte'][i], telefone: cel(p[4], i), email: 'contato@' + G.normaliza(p[2]).replace(/\s+/g, '') + '.exemplo' }],
      observacoes: ''
    }));

    const instituicoes = [
      ['Financeira', 'Aurora Crédito Financiamentos S.A.', 'Aurora Crédito', 41250877, 'SP'],
      ['Financeira', 'Credvia Veículos S.A.', 'Credvia', 52981004, 'RJ'],
      ['Financeira', 'Leasing Planalto Arrendamento Mercantil S.A.', 'Planalto Leasing', 26554318, 'DF'],
      ['Hospital', 'Hospital Vale Sereno S.A.', 'Hospital Vale Sereno', 31029384, 'SP'],
      ['Hospital', 'Associação Hospitalar Ponte Alta', 'Hospital Ponte Alta', 24561230, 'RJ']
    ];
    db.instituicoes = instituicoes.map((x, i) => Object.assign(meta(i + 1, -740 + i * 17), {
      tipo: x[0], razaoSocial: x[1], nomeFantasia: x[2], cnpj: cnpj(x[3]), status: 'Ativo',
      formaPagamento: 'Conta corrente', banco: ['903', '901', '905', '902', '907'][i], agencia: String(3300 + i * 211), conta: String(70100 + i * 3319) + '-' + (i % 9),
      endereco: endereco(['04094-050', '22250-040', '70390-100', '05424-150', '22410-001'][i], ['Avenida Ibirapuera', 'Praia de Botafogo', 'SCS Quadra 2', 'Rua dos Pinheiros', 'Rua Visconde de Pirajá'][i], String(300 + i * 91), ['Moema', 'Botafogo', 'Asa Sul', 'Pinheiros', 'Ipanema'][i], ['São Paulo', 'Rio de Janeiro', 'Brasília', 'São Paulo', 'Rio de Janeiro'][i], x[4]),
      contatos: [{ nome: ['Central de gravames', 'Mesa de quitação', 'Atendimento a seguradoras', 'Faturamento', 'Faturamento'][i], telefone: tel(x[4], i + 3), email: 'seguradoras@' + G.normaliza(x[2]).replace(/\s+/g, '') + '.exemplo' }],
      observacoes: ''
    }));

    db.cartas = [
      ['Autorização de reparo', 'Autorização', [1, 2, 6, 54], 'Seu reparo foi autorizado',
        'Olá, {{segurado}}.\n\nBoas notícias: o orçamento do reparo do seu {{veiculo}}, placa {{placa}}, foi autorizado. A oficina já pode começar o serviço.\n\nSinistro: {{sinistro}}\nData da ocorrência: {{data_ocorrencia}}\nFranquia a pagar na oficina: {{franquia}}\n\nSe tiver qualquer dúvida, é só responder esta carta ou falar com a gente pelos canais de atendimento.\n\n{{analista}}\nTravessia Seguros'],
      ['Pedido de documentos', 'Pedido de documentos', [1, 2, 3, 4, 6, 8, 10, 11, 54, 58], 'Precisamos de alguns documentos',
        'Olá, {{segurado}}.\n\nPara seguir com a análise do sinistro {{sinistro}}, do seu {{veiculo}}, ainda precisamos destes documentos:\n\n{{documentos_pendentes}}\n\nVocê pode enviar fotos ou PDFs pelo aplicativo ou pelo e-mail do atendimento. Assim que recebermos, a análise continua de onde parou.\n\n{{analista}}\nTravessia Seguros'],
      ['Indenização integral', 'Quitação', [3, 4, 58], 'Indenização do seu veículo',
        'Olá, {{segurado}}.\n\nConcluímos a análise do sinistro {{sinistro}} e o seu {{veiculo}}, placa {{placa}}, será indenizado de forma integral.\n\nValor da indenização: {{valor_indenizacao}}\n\nO pagamento é feito depois da entrega dos documentos de transferência. Quando houver financiamento, primeiro quitamos o saldo com a financeira e o restante vai para você.\n\n{{analista}}\nTravessia Seguros'],
      ['Negativa de cobertura', 'Negativa', [1, 2, 3, 4, 6, 8, 10, 11, 54, 58], 'Resposta sobre o seu sinistro',
        'Olá, {{segurado}}.\n\nAnalisamos com cuidado o sinistro {{sinistro}}, ocorrido em {{data_ocorrencia}}, e infelizmente ele não está coberto pela sua apólice.\n\nMotivo: [descreva aqui o motivo, citando a cláusula das condições gerais]\n\nSe você não concordar, pode pedir uma nova análise em até 30 dias, enviando os documentos que achar importantes.\n\n{{analista}}\nTravessia Seguros'],
      ['Cobrança de ressarcimento', 'Ressarcimento', [1, 54], 'Ressarcimento de danos',
        'Prezado(a) {{terceiro}},\n\nA Travessia Seguros indenizou o segurado {{segurado}} pelos danos causados ao veículo {{veiculo}}, placa {{placa}}, no acidente de {{data_ocorrencia}} (sinistro {{sinistro}}).\n\nComo a responsabilidade pelo acidente foi atribuída a você, solicitamos o ressarcimento de {{valor_indenizacao}}. Podemos combinar um acordo e parcelar o valor.\n\n{{analista}}\nTravessia Seguros'],
      ['Aviso de vistoria (modelo antigo)', 'Outros', [1], 'Vistoria', 'Modelo substituído pela notificação do aplicativo.', 'Inativo']
    ].map((c, i) => Object.assign(meta(i + 1, -700 + i * 5), { titulo: c[0], tipo: c[1], naturezas: c[2], assunto: c[3], texto: c[4], status: c[5] || 'Ativo' }));

    /* ---------- Apólices (sem cadastro na interface) */

    const veiculos = [
      ['Arion', 'Lume LT 1.0 Turbo', 2021, 2022, 'Branco', 78000], ['Volta', 'Pique 1.0', 2019, 2019, 'Prata', 48000],
      ['Montes', 'Atlas 2.8 Diesel', 2019, 2020, 'Preto', 198000], ['Kaimo', 'K20 Comfort 1.0', 2018, 2019, 'Vermelho', 52000],
      ['Montes', 'Sereno XS 2.0', 2020, 2021, 'Cinza', 118000], ['Brisa', 'Nativa Trail 1.8', 2021, 2021, 'Azul', 104000],
      ['Kaimo', 'Arco EX 2.0', 2019, 2019, 'Preto', 112000], ['Tarsa', 'Mini Zen 1.0', 2022, 2023, 'Branco', 52000],
      ['Tarsa', 'Bravio 1.8', 2020, 2021, 'Cinza', 115000], ['Volta', 'Rota Comfort 1.0 TSI', 2021, 2022, 'Branco', 126000],
      ['Arion', 'Ponto SE 1.0', 2018, 2019, 'Prata', 46000], ['Kaimo', 'Serra SV 1.6', 2020, 2021, 'Laranja', 98000],
      ['Tarsa', 'Duna Drive 1.3', 2020, 2021, 'Vermelho', 68000], ['Tarsa', 'Lida Cabine 1.3', 2021, 2022, 'Branco', 96000],
      ['Brisa', 'Coral Limited 2.0 Diesel', 2021, 2022, 'Preto', 189000], ['Volta', 'Prata Highline 1.0 TSI', 2019, 2020, 'Azul', 82000]
    ];
    const segurados = [
      ['Marina Albuquerque Teles', 'PF', 'SP', 'São Paulo'], ['Rafael Monteiro Dias', 'PF', 'RJ', 'Rio de Janeiro'],
      ['Transportes Rota Leste LTDA', 'PJ', 'MG', 'Belo Horizonte'], ['Beatriz Nogueira Prado', 'PF', 'SP', 'Campinas'],
      ['Lucas Ferreira Antunes', 'PF', 'PR', 'Curitiba'], ['Patrícia Ramos Vieira', 'PF', 'RS', 'Porto Alegre'],
      ['Henrique Sato', 'PF', 'SP', 'São Paulo'], ['Camila Duarte Moura', 'PF', 'BA', 'Salvador'],
      ['Construtora Pedra Firme LTDA', 'PJ', 'DF', 'Brasília'], ['Tiago Brandão Lins', 'PF', 'PE', 'Recife'],
      ['Aline Castro Rezende', 'PF', 'RJ', 'Niterói'], ['Gustavo Pires Neto', 'PF', 'SC', 'Florianópolis'],
      ['Fernanda Lopes Araújo', 'PF', 'MG', 'Belo Horizonte'], ['Otávio Mendes Rocha', 'PF', 'GO', 'Goiânia'],
      ['Juliana Freire Bastos', 'PF', 'SP', 'São Paulo'], ['Sérgio Paiva Leal', 'PF', 'RJ', 'Rio de Janeiro']
    ];
    const NOMES = ['Ana', 'Bruno', 'Cláudia', 'Daniel', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'Jorge', 'Karina', 'Leonardo', 'Mônica', 'Nelson', 'Olívia', 'Pedro', 'Renata', 'Samuel', 'Tânia', 'Vítor'];
    const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Dantas', 'Esteves', 'Fontes', 'Guimarães', 'Holanda', 'Igarashi', 'Junqueira', 'Lacerda', 'Macedo', 'Nunes', 'Queiroz', 'Ribeiro', 'Salgado', 'Toledo', 'Valente'];
    const CIDADES = [['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'], ['Porto Alegre', 'RS'], ['Salvador', 'BA'], ['Recife', 'PE'], ['Brasília', 'DF'], ['Campinas', 'SP'], ['Florianópolis', 'SC'], ['Goiânia', 'GO']];

    db.apolices = [];
    function novaApolice(seg, vei, i, extra) {
      const pj = seg[1] === 'PJ';
      const fipe = vei[5];
      const ap = {
        id: db.apolices.length + 1,
        sucursal: String(100 + (i * 37) % 800),
        ramo: '531',
        numero: String(550000 + i * 1373),
        item: '1',
        vigInicio: dia(-inteiro(30, 330)),
        segurado: {
          nome: seg[0], tipo: seg[1], documento: pj ? cnpj(46000000 + i * 977) : cpf(300000000 + i * 7919 + 13),
          telefone: '(' + (DDD[seg[2]] || 11) + ') 9' + (8300 + i * 41) + '-' + (1200 + i * 77),
          email: G.normaliza(seg[0].split(' ')[0]).replace(/\s+/g, '') + '.' + G.normaliza(seg[0].split(' ').slice(-1)[0]) + '@email.exemplo',
          cidade: seg[3], uf: seg[2]
        },
        veiculo: { marca: vei[0], modelo: vei[1], anoFab: vei[2], anoMod: vei[3], cor: vei[4], placa: placa(), chassi: chassi(), fipe },
        coberturas: {
          casco: { is: fipe, franquia: redondo(fipe * (pj ? .06 : .045), 50) },
          rcfDm: { is: pj ? 200000 : 100000 },
          rcfDp: { is: pj ? 300000 : 100000 },
          app: { is: 20000 }
        },
        carroReservaDias: pj ? 0 : [7, 15, 30][i % 3],
        alienacao: null,
        premioPendente: 0,
        corretor: ['Corretora Ponte Segura', 'Amparo Corretagem', 'Rede Proteja Corretores'][i % 3]
      };
      ap.vigFim = G.somaDias(ap.vigInicio, 365);
      Object.assign(ap, extra || {});
      db.apolices.push(ap);
      return ap;
    }
    segurados.forEach((s, i) => {
      novaApolice(s, veiculos[i], i, {
        alienacao: [2, 5, 8, 14].indexOf(i) >= 0 ? (i % 3) + 1 : null,
        premioPendente: i === 5 ? 1249.46 : 0
      });
    });
    // Uma apólice já vencida, para testar a regra de vigência no aviso.
    db.apolices[15].vigInicio = dia(-420);
    db.apolices[15].vigFim = dia(-55);

    /* ---------- Processos */

    db.processos = [];
    db.contador = { sinistro: 3140212, aviso: 15 };
    const nat = (n) => db.naturezas.find((x) => x.numero === n);
    const ofic = (i) => db.oficinas[i];

    let pidSeq = 0;
    const idPag = () => { pidSeq += 1; return pidSeq; };

    function orcamento(of, valorBase, dias, status, extra) {
      const pecas = redondo(valorBase * .62, 1);
      const mao = redondo(valorBase - pecas, 1);
      const itensPecas = [
        ['Para-choque dianteiro', 1, redondo(pecas * .36, 1)], ['Farol dianteiro esquerdo', 1, redondo(pecas * .28, 1)],
        ['Grade do radiador', 1, redondo(pecas * .14, 1)], ['Suporte do para-choque', 2, redondo(pecas * .11, 1)]
      ];
      const somaPecas = itensPecas.reduce((s, x) => s + x[1] * x[2], 0);
      const itensMao = [['Funilaria e reparação', 1, redondo(mao * .55, 1)], ['Pintura', 1, redondo(mao * .35, 1)]];
      const somaMao = itensMao.reduce((s, x) => s + x[1] * x[2], 0);
      itensMao.push(['Montagem e alinhamento', 1, Math.max(80, Math.round(valorBase - somaPecas - somaMao))]);
      return Object.assign({
        id: idPag(), oficinaId: of.id, numero: String(780000 + pidSeq * 37), versao: 1, data: quando(dias, '14:10'),
        itens: itensPecas.map((x) => ({ tipo: 'Peça', descricao: x[0], quantidade: x[1], valor: x[2] }))
          .concat(itensMao.map((x) => ({ tipo: 'Mão de obra', descricao: x[0], quantidade: x[1], valor: x[2] }))),
        status: status || 'Em análise', motivo: '', analisadoPor: '', analisadoEm: '', justificativa: ''
      }, extra || {});
    }

    function pagamento(benefTipo, benef, documento, valor, status, dias, extra) {
      return Object.assign({
        id: idPag(), beneficiarioTipo: benefTipo, beneficiario: benef, documento, tipo: 'Total', forma: 'Conta corrente',
        banco: '901', agencia: '0' + (1200 + pidSeq), conta: String(40000 + pidSeq * 137) + '-' + (pidSeq % 9), valor,
        dataProgramada: dia(dias + 2), status, solicitadoPor: 'Larissa Monte', solicitadoPorId: usu('Larissa Monte'), solicitadoEm: quando(dias, '16:20'),
        liberadoPor: status === 'Pago' || status === 'Liberado' ? 'Sandra Quintela' : '', liberadoEm: status === 'Pago' || status === 'Liberado' ? quando(dias + 1, '09:40') : '', motivo: ''
      }, extra || {});
    }

    function processo(op) {
      const ap = db.apolices[op.ap - 1];
      const n = nat(op.nat);
      db.contador.sinistro += op.seq && op.seq > 1 ? 0 : 1;
      db.contador.aviso += 1;
      const ocorr = dia(op.dias);
      const p = {
        id: db.processos.length + 1,
        sinistro: op.sinistro || String(db.contador.sinistro),
        seq: op.seq || 1,
        apoliceId: ap.id,
        natureza: n.numero,
        aviso: '206' + ocorr.replace(/-/g, '') + String(db.contador.aviso).padStart(4, '0'),
        ocorrencia: {
          data: ocorr, hora: op.hora || '18:40', logradouro: op.local || 'Avenida Brasil, altura do número 1500', bairro: op.bairro || 'Centro',
          cidade: ap.segurado.cidade, uf: ap.segurado.uf, relato: op.relato, boletim: op.boletim || ''
        },
        avisadoEm: quando(op.dias + (op.diasAviso || 1), '09:15'),
        avisadoPor: 'Central de atendimento',
        canal: op.canal || sorteia(['Telefone', 'Aplicativo', 'Corretor', 'Site']),
        condutor: op.condutor || { segurado: 'sim', nome: '', cpf: '' },
        terceiro: op.terceiro || null,
        culpado: op.culpado || 'Segurado',
        posicao: op.pos,
        posicaoDesde: op.posDesde || quando(op.dias + 2, '11:00'),
        status: op.status || 'Aberto',
        encerradoEm: op.encerradoEm || '',
        analistaId: op.analista ? usu(op.analista) : null,
        atribuidoEm: op.atribuido || (op.analista ? horasAtras(inteiro(1, 20)) : null),
        vistoriaPrioritaria: !!op.prioritaria,
        news: (op.news || []).map((x, k) => ({ id: k + 1, tipo: x[0], texto: x[1], quando: horasAtras(x[2] || 3), lida: false })),
        pareceres: op.pareceres || [],
        orcamentos: op.orcamentos || [],
        pagamentos: op.pagamentos || [],
        documentos: (op.docs || []).map((d, k) => ({
          id: k + 1, tipoId: d, nome: G.normaliza(db.tiposDocumento.find((t) => t.id === d).nome).replace(/[^a-z0-9]+/g, '-') + (d === doc('Fotos do veículo') ? '.jpg' : '.pdf'),
          tamanho: inteiro(180, 2400) * 1024, origem: db.tiposDocumento.find((t) => t.id === d).origem, recebidoEm: quando(op.dias + 2 + (k % 3), '10:0' + k), por: 'Importação automática'
        })),
        dispensados: [],
        cartas: op.cartas || [],
        ressarcimento: op.ressarcimento || null,
        marcos: op.marcos || {},
        historico: [
          { quando: quando(op.dias + (op.diasAviso || 1), '09:15'), quem: 'Central de atendimento', acao: 'Aviso registrado pelo canal ' + (op.canal || 'telefone').toLowerCase() },
          { quando: quando(op.dias + (op.diasAviso || 1), '09:16'), quem: 'Sistema', acao: 'Processo aberto na posição "' + (op.posInicial || (n.grupo === 'Danos parciais' ? 'Sem orçamento' : 'Aguardando documentos')) + '"' }
        ].concat(op.hist || []),
        criadoEm: quando(op.dias + (op.diasAviso || 1), '09:15'),
        criadoPor: 'Central de atendimento',
        alteradoEm: op.posDesde || quando(op.dias + 2, '11:00'),
        alteradoPor: op.analista || 'Sistema'
      };
      // Marcos que dá para deduzir dos documentos e orçamentos de exemplo.
      const exigidos = n.documentos;
      if (!p.marcos.documentos && exigidos.length && exigidos.every((d) => p.documentos.some((x) => x.tipoId === d))) {
        p.marcos.documentos = p.documentos.map((x) => x.recebidoEm).sort().pop();
      }
      if (!p.marcos.orcamento && p.orcamentos.length) p.marcos.orcamento = p.orcamentos[0].data;
      db.processos.push(p);
      return p;
    }

    const parecer = (dias, autor, categoria, tipo, texto) => ({ id: idPag(), quando: quando(dias, '15:' + String(10 + (pidSeq % 49)).padStart(2, '0')), autor, categoria, tipo, texto, documentos: [] });
    const segDoc = (ap) => db.apolices[ap - 1].segurado.documento;
    const segNome = (ap) => db.apolices[ap - 1].segurado.nome;

    // 1. Na caixa do Bruno: colisão com orçamento esperando análise e news de novo orçamento.
    processo({
      ap: 1, nat: 1, dias: -6, pos: 2, analista: 'Bruno Tavares', atribuido: horasAtras(.4), posDesde: horasAtras(30),
      relato: 'Segurada parou no semáforo e foi atingida na traseira por uma moto que não freou a tempo. Depois, ao sair da faixa, bateu a frente no meio-fio.',
      local: 'Rua Vergueiro, 3200', bairro: 'Vila Mariana', boletim: '2020-001873',
      terceiro: { nome: 'Wesley Prado Santana', documento: cpf(412398765), telefone: '(11) 98877-6655', placa: 'RQT4C21', veiculo: 'Kaimo Ágil 160 (moto)' },
      culpado: 'Terceiro', docs: [doc('CNH do condutor'), doc('CRLV do veículo'), doc('Fotos do veículo'), doc('Orçamento da oficina')],
      orcamentos: [orcamento(ofic(0), 6840, -3, 'Em análise', { entradaOficina: dia(-4) })],
      news: [['Novo orçamento', 'A Pé na Estrada Reparos enviou o orçamento 1 do reparo.', 5]],
      pareceres: [parecer(-4, 'Larissa Monte', 'Análise', 'Análise técnica', 'Cobertura confirmada: apólice vigente, sem prêmio pendente e condutora habilitada. Veículo encaminhado para a Pé na Estrada Reparos. Terceiro identificado, possível ressarcimento depois do pagamento.')],
      hist: [{ quando: horasAtras(30), quem: 'Larissa Monte', acao: 'Posição alterada para "Em análise"' }, { quando: horasAtras(.4), quem: 'Sistema', acao: 'Distribuído automaticamente para Bruno Tavares' }]
    });

    // 2. Na caixa do Bruno: furto, aguardando documentos, com news de novos documentos.
    processo({
      ap: 6, nat: 3, dias: -12, pos: 3, analista: 'Bruno Tavares', posDesde: quando(-10, '10:00'), posInicial: 'Aguardando documentos',
      relato: 'Segurada estacionou na rua por volta das 21h e, na manhã seguinte, o veículo não estava mais no local. Fez boletim de ocorrência na delegacia do bairro.',
      local: 'Rua Padre Chagas, 300', bairro: 'Moinhos de Vento', boletim: '2020-118204',
      docs: [doc('CNH do condutor'), doc('CRLV do veículo'), doc('Boletim de ocorrência')],
      news: [['Novos documentos', 'A segurada enviou 2 documentos pelo aplicativo.', 2]],
      pareceres: [parecer(-10, 'Renata Coelho', 'Análise', 'Pedido de documentos', 'Atenção: há prêmio pendente de R$ 1.249,46 e o veículo é financiado. Pedidos o CRV assinado e o recibo de quitação. Antes de indenizar, consultar o saldo devedor com a financeira.')]
    });

    // 3. Na caixa do Bruno: alagamento recém-distribuído, sem orçamento.
    processo({
      ap: 8, nat: 54, dias: -2, pos: 1, analista: 'Bruno Tavares', posDesde: quando(-1, '09:20'), prioritaria: true,
      relato: 'Durante a chuva forte, a rua alagou e a água chegou na altura do painel. O carro foi rebocado pela assistência 24 horas até a oficina.',
      local: 'Avenida Vasco da Gama, 900', bairro: 'Rio Vermelho', docs: [doc('CNH do condutor')],
      news: [['Vistoria concluída', 'A reguladora Vistora concluiu a vistoria e enviou as fotos.', 1]]
    });

    // 4. Na caixa do Bruno: RCF danos materiais a terceiro, orçamento autorizado esperando NF.
    processo({
      ap: 7, nat: 11, dias: -25, pos: 7, analista: 'Bruno Tavares', posDesde: quando(-3, '16:00'),
      relato: 'Segurado mudou de faixa sem perceber o carro ao lado e encostou na lateral do veículo do terceiro. Assumiu a culpa no local.',
      local: 'Avenida Rebouças, 2100', bairro: 'Pinheiros', boletim: '',
      terceiro: { nome: 'Cristina Albuquerque Mota', documento: cpf(502938176), telefone: '(11) 97766-5544', placa: 'RBE2F47', veiculo: 'Tarsa Mini Like 1.0' },
      docs: [doc('CNH do condutor'), doc('Orçamento da oficina')],
      orcamentos: [orcamento(ofic(3), 4210, -20, 'Autorizado', { analisadoPor: 'Elisa Pacheco', analisadoEm: quando(-19, '11:00'), entradaOficina: dia(-21) })],
      pareceres: [parecer(-19, 'Elisa Pacheco', 'Análise', 'Cobertura confirmada', 'Culpa do segurado confirmada pelo relato e pela declaração do terceiro. Orçamento da Lagoa Clara Car autorizado. Aguardando a nota fiscal para pagar a oficina.')],
      marcos: { orcamento: quando(-20), autorizacao: quando(-19) }
    });

    // 5. Na caixa do Bruno, com prazo estourado: orçamento não autorizado esperando a revisão.
    processo({
      ap: 13, nat: 1, dias: -15, pos: 4, analista: 'Bruno Tavares', posDesde: quando(-5, '15:00'),
      relato: 'Segurada bateu em um poste ao desviar de um buraco na pista. Danos na frente e na roda dianteira direita.',
      local: 'Avenida do Contorno, 4500', bairro: 'Funcionários', docs: DOCS_DP,
      orcamentos: [orcamento(ofic(2), 9980, -9, 'Não autorizado', { motivo: 'Troca da roda e do pneu sem fotos que mostrem o dano. Pedimos revisão com as fotos.', analisadoPor: 'Bruno Tavares', analisadoEm: quando(-5, '15:00'), entradaOficina: dia(-10) })],
      pareceres: [parecer(-5, 'Bruno Tavares', 'Regulação', 'Orçamento revisado', 'Orçamento da Arion Horizonte não autorizado: a troca da roda não está comprovada por fotos. Oficina avisada para mandar a versão 2.')]
    });

    // 6 a 12. Na fila, esperando distribuição.
    processo({
      ap: 2, nat: 1, dias: -3, pos: 1, posDesde: quando(-2, '09:20'),
      relato: 'Segurado saía da garagem de ré e bateu em um pilar. Amassado na traseira e lanterna quebrada.',
      local: 'Rua Barão de Mesquita, 610', bairro: 'Tijuca', docs: [doc('CNH do condutor'), doc('CRLV do veículo')]
    });
    processo({
      ap: 4, nat: 6, dias: -5, pos: 2, posDesde: quando(-1, '14:00'),
      relato: 'Quebraram o vidro e levaram o som e os retrovisores enquanto o carro estava estacionado no shopping.',
      local: 'Avenida Iguatemi, 777', bairro: 'Vila Brandina', boletim: '2020-332190',
      docs: [doc('Boletim de ocorrência'), doc('CRLV do veículo'), doc('Orçamento da oficina')],
      orcamentos: [orcamento(ofic(0), 2380, -2, 'Em análise', { entradaOficina: dia(-3) })],
      news: [['Novo orçamento', 'A Pé na Estrada Reparos enviou o orçamento 1.', 20]]
    });
    processo({
      ap: 10, nat: 4, dias: -18, pos: 3, posDesde: quando(-14, '10:00'), posInicial: 'Aguardando documentos',
      relato: 'Colisão frontal com caminhão na rodovia. O veículo foi removido para o pátio e a vistoria indicou perda total.',
      local: 'BR-232, quilômetro 18', bairro: 'Zona rural', docs: [doc('CNH do condutor'), doc('CRLV do veículo'), doc('Laudo de vistoria')],
      pareceres: [parecer(-14, 'Fábio Lacerda', 'Regulação', 'Vistoria realizada', 'Danos estimados em 82% do valor do veículo pela tabela de referência. Indicada indenização integral. Pedidos os documentos de transferência ao segurado.')],
      news: [['Novos documentos', 'Chegou o CRV assinado pelo segurado.', 30]]
    });
    processo({
      ap: 12, nat: 54, dias: -1, pos: 6, posDesde: quando(0, '08:10'), prioritaria: true,
      relato: 'Carro estava estacionado na rua e foi atingido pela enxurrada. Motor não liga mais.',
      local: 'Rua Lauro Linhares, 400', bairro: 'Trindade', docs: []
    });
    processo({
      ap: 14, nat: 1, dias: -8, pos: 2, posDesde: quando(-3, '10:30'),
      relato: 'Segurado não conseguiu frear a tempo e bateu na traseira do carro da frente em um engavetamento leve.',
      local: 'Avenida T-63, 1200', bairro: 'Setor Bueno', docs: DOCS_DP,
      terceiro: { nome: 'Mauro Siqueira Lemos', documento: cpf(376109284), telefone: '(62) 99812-4400', placa: 'RPA7D10', veiculo: 'Arion Lume Sedan 1.4' },
      orcamentos: [orcamento(ofic(7), 3150, -6, 'Em análise', { entradaOficina: dia(-7) })]
    });
    processo({
      ap: 14, nat: 11, seq: 2, sinistro: String(db.contador.sinistro), dias: -8, pos: 1, posDesde: quando(-6, '09:20'),
      relato: 'Danos no veículo do terceiro atingido na traseira, no mesmo acidente do processo 1.',
      local: 'Avenida T-63, 1200', bairro: 'Setor Bueno',
      terceiro: { nome: 'Mauro Siqueira Lemos', documento: cpf(376109284), telefone: '(62) 99812-4400', placa: 'RPA7D10', veiculo: 'Arion Lume Sedan 1.4' }
    });
    processo({
      ap: 11, nat: 8, dias: -20, pos: 3, posDesde: quando(-16, '09:00'), posInicial: 'Aguardando documentos',
      relato: 'Passageira do banco de trás machucou o braço na colisão e ficou afastada do trabalho.',
      local: 'Estrada Francisco da Cruz Nunes, 300', bairro: 'Itaipu', docs: [doc('Boletim de ocorrência')],
      condutor: { segurado: 'sim', nome: '', cpf: '' }
    });

    // 13 a 16. Com outros analistas.
    processo({
      ap: 5, nat: 1, dias: -10, pos: 5, analista: 'Larissa Monte', posDesde: quando(-6, '10:00'),
      relato: 'Ao manobrar no estacionamento do supermercado, o segurado raspou a lateral em uma coluna.',
      local: 'Rua XV de Novembro, 1500', bairro: 'Centro', docs: DOCS_DP,
      orcamentos: [orcamento(ofic(5), 5320, -8, 'Autorizado', { analisadoPor: 'Larissa Monte', analisadoEm: quando(-6, '10:00'), entradaOficina: dia(-9) })],
      marcos: { orcamento: quando(-8), autorizacao: quando(-6) }
    });
    processo({
      ap: 9, nat: 3, dias: -40, pos: 8, analista: 'Renata Coelho', posDesde: quando(-1, '17:00'),
      relato: 'Veículo da empresa foi roubado à mão armada quando o motorista fazia uma entrega.',
      local: 'SIA Trecho 3', bairro: 'Guará', boletim: '2020-778812', docs: DOCS_II,
      condutor: { segurado: 'nao', nome: 'Wellington Barros', cpf: cpf(287364519) },
      pagamentos: [
        pagamento('Financeira', 'Aurora Crédito', db.instituicoes[0].cnpj, 61800, 'Aguardando liberação', -1, { solicitadoPor: 'Renata Coelho', solicitadoPorId: usu('Renata Coelho'), tipo: 'Parcial', dataProgramada: dia(2) }),
        pagamento('Segurado', 'Construtora Pedra Firme LTDA', segDoc(9), 47300, 'Aguardando liberação', -1, { solicitadoPor: 'Renata Coelho', solicitadoPorId: usu('Renata Coelho'), tipo: 'Parcial', dataProgramada: dia(2) })
      ],
      pareceres: [parecer(-1, 'Renata Coelho', 'Análise', 'Cobertura confirmada', 'Veículo não localizado em 30 dias. Indenização integral de R$ 115.000,00 (100% da tabela de referência), dividida entre a quitação do financiamento e o segurado.')]
    });
    processo({
      ap: 3, nat: 1, dias: -9, pos: 8, analista: 'Larissa Monte', posDesde: quando(0, '09:00'),
      relato: 'A caminhonete da empresa bateu a lateral em um portão durante a manobra de carga.',
      local: 'Avenida Cristiano Machado, 4000', bairro: 'Cidade Nova', docs: DOCS_DP.concat(doc('Nota fiscal do reparo')),
      orcamentos: [orcamento(ofic(2), 11240, -7, 'Autorizado', { analisadoPor: 'Larissa Monte', analisadoEm: quando(-6, '09:00'), entradaOficina: dia(-8) })],
      pagamentos: [pagamento('Oficina', 'Arion Horizonte', db.oficinas[2].cnpj, 11240 - db.apolices[2].coberturas.casco.franquia, 'Aguardando liberação', 0, { dataProgramada: dia(3) })],
      marcos: { orcamento: quando(-7), autorizacao: quando(-6), notaFiscal: quando(-1) }
    });
    processo({
      ap: 15, nat: 1, dias: -7, pos: 8, analista: 'Vitor Amaral', posDesde: quando(0, '10:30'),
      relato: 'Segurada bateu de leve no carro da frente no trânsito parado. Danos no para-choque e no capô.',
      local: 'Avenida Sumaré, 1200', bairro: 'Perdizes', docs: DOCS_DP.concat(doc('Nota fiscal do reparo')),
      orcamentos: [orcamento(ofic(0), 7390, -5, 'Autorizado', { analisadoPor: 'Vitor Amaral', analisadoEm: quando(-4, '09:30'), entradaOficina: dia(-6) })],
      pagamentos: [pagamento('Oficina', 'Pé na Estrada Reparos', db.oficinas[0].cnpj, 7390 - db.apolices[14].coberturas.casco.franquia, 'Aguardando liberação', 0, { solicitadoPor: 'Vitor Amaral', solicitadoPorId: usu('Vitor Amaral'), dataProgramada: dia(2) })],
      marcos: { orcamento: quando(-5), autorizacao: quando(-4), notaFiscal: quando(0) }
    });

    // 17 a 21. Encerrados, com pagamento e ressarcimento.
    const pagoCompleto = (ap, nt, dias, valor, ofIdx, culpado, terceiro, ress, analista) => {
      const a = db.apolices[ap - 1];
      const fr = a.coberturas.casco.franquia;
      const of = ofic(ofIdx);
      const p = processo({
        ap, nat: nt, dias, pos: 9, status: 'Encerrado', encerradoEm: quando(dias + 26, '17:00'), posDesde: quando(dias + 26, '17:00'),
        relato: 'Colisão em cruzamento. O outro motorista avançou o sinal vermelho, conforme o boletim de ocorrência e duas testemunhas.',
        local: 'Cruzamento da Rua Augusta com a Rua Estados Unidos', bairro: 'Jardins', boletim: '2020-' + inteiro(100000, 999999), culpado, terceiro,
        docs: DOCS_DP.concat(doc('Nota fiscal do reparo'), doc('Boletim de ocorrência')),
        orcamentos: [orcamento(of, valor, dias + 4, 'Autorizado', { analisadoPor: analista, analisadoEm: quando(dias + 6, '10:00'), entradaOficina: dia(dias + 3) })],
        pagamentos: [pagamento('Oficina', of.nomeFantasia, of.cnpj, valor - fr, 'Pago', dias + 22, { solicitadoPor: analista, solicitadoPorId: usu(analista), dataProgramada: dia(dias + 25) })],
        ressarcimento: ress,
        marcos: { documentos: quando(dias + 3), orcamento: quando(dias + 4), autorizacao: quando(dias + 6), notaFiscal: quando(dias + 21), pagamento: quando(dias + 25) },
        hist: [{ quando: quando(dias + 26, '17:00'), quem: analista, acao: 'Processo encerrado na posição "Encerrado com indenização"' }]
      });
      return p;
    };
    const ter = (nome, base, placaT, veic) => ({ nome, documento: cpf(base), telefone: '(11) 9' + String(base).slice(0, 4) + '-' + String(base).slice(4, 8), placa: placaT, veiculo: veic });
    pagoCompleto(16, 1, -150, 8460, 1, 'Terceiro', ter('Ronaldo Teixeira Brum', 498123765, 'RKD3B55', 'Volta Pique Sedan 1.6'), { status: 'Em cobrança', valor: 8460, recebido: 0, desde: quando(-120), historico: [{ quando: quando(-120), quem: 'Elisa Pacheco', acao: 'Ressarcimento aberto' }, { quando: quando(-90), quem: 'Elisa Pacheco', acao: 'Carta de cobrança enviada ao terceiro' }] }, 'Larissa Monte');
    pagoCompleto(1, 1, -95, 5120, 0, 'Terceiro', ter('Paulo Vasconcelos Reis', 345612987, 'RFH8A12', 'Brisa Nativa 1.0'), { status: 'Aguardando acordo', valor: 5120, recebido: 0, desde: quando(-65), historico: [{ quando: quando(-65), quem: 'Sistema', acao: 'Ressarcimento aberto depois do pagamento' }] }, 'Vitor Amaral');
    pagoCompleto(5, 1, -210, 12780, 5, 'Terceiro', ter('Distribuidora Ômega LTDA', 451230987, 'RJU9C34', 'Montes Carga 10 (caminhão leve)'), { status: 'Ressarcido', valor: 12780, recebido: 12780, desde: quando(-180), historico: [{ quando: quando(-180), quem: 'Sistema', acao: 'Ressarcimento aberto depois do pagamento' }, { quando: quando(-150), quem: 'Elisa Pacheco', acao: 'Acordo fechado com a seguradora do terceiro' }, { quando: quando(-130), quem: 'Elisa Pacheco', acao: 'Valor recebido' }] }, 'Larissa Monte');
    pagoCompleto(7, 1, -60, 3980, 3, 'Terceiro', ter('Bianca Moreira Luz', 512098347, 'RMN5E77', 'Tarsa Duna Way 1.0'), { status: 'Sem acordo', valor: 3980, recebido: 0, desde: quando(-30), historico: [{ quando: quando(-30), quem: 'Sistema', acao: 'Ressarcimento aberto depois do pagamento' }, { quando: quando(-8), quem: 'Elisa Pacheco', acao: 'Terceiro não respondeu às cobranças' }] }, 'Vitor Amaral');
    pagoCompleto(13, 54, -75, 9310, 2, 'Segurado', null, null, 'Bruno Tavares');

    // Encerrado sem indenização (abaixo da franquia).
    processo({
      ap: 11, nat: 1, dias: -50, pos: 10, status: 'Encerrado', encerradoEm: quando(-41, '15:00'), posDesde: quando(-41, '15:00'),
      relato: 'Arranhão no para-choque traseiro ao estacionar.', local: 'Rua Moreira César, 200', bairro: 'Icaraí', docs: [doc('CNH do condutor'), doc('Fotos do veículo'), doc('Orçamento da oficina')],
      orcamentos: [orcamento(ofic(1), 1240, -47, 'Não autorizado', { motivo: 'Valor abaixo da franquia da apólice.', analisadoPor: 'Vitor Amaral', analisadoEm: quando(-41, '15:00'), entradaOficina: dia(-48) })],
      pareceres: [parecer(-41, 'Vitor Amaral', 'Análise', 'Negativa de cobertura', 'Orçamento de R$ 1.240,00 abaixo da franquia de R$ 2.070,00. Segurada avisada por telefone e por carta. Processo encerrado sem indenização.')],
      hist: [{ quando: quando(-41, '15:00'), quem: 'Vitor Amaral', acao: 'Processo encerrado na posição "Encerrado sem indenização"' }]
    });

    // Histórico dos últimos 6 meses, para os indicadores.
    const DP = [1, 1, 1, 1, 54, 6, 2];
    const II = [3, 4, 58];
    const analistasDP = ['Larissa Monte', 'Vitor Amaral', 'Bruno Tavares'];
    const analistasII = ['Renata Coelho', 'Fábio Lacerda'];
    for (let i = 0; i < 46; i++) {
      const integral = i % 5 === 4;
      const nt = integral ? sorteia(II) : sorteia(DP);
      const vei = veiculos[i % veiculos.length];
      const cidade = sorteia(CIDADES);
      const ap = novaApolice([sorteia(NOMES) + ' ' + sorteia(SOBRENOMES) + ' ' + sorteia(SOBRENOMES), 'PF', cidade[1], cidade[0]], vei, 40 + i);
      ap.vigInicio = dia(-inteiro(200, 360));
      ap.vigFim = G.somaDias(ap.vigInicio, 365);
      const ini = -inteiro(15, 185);
      const analista = integral ? sorteia(analistasII) : sorteia(analistasDP);
      // Tempos de cada etapa, em dias.
      const tDoc = inteiro(1, integral ? 12 : 6);
      const tOrc = integral ? 0 : inteiro(1, 5);
      const tAut = integral ? 0 : inteiro(1, 3);
      const tNf = integral ? inteiro(6, 18) : inteiro(5, 16);
      const tPag = inteiro(1, 4);
      const fim = ini + 1 + tDoc + tOrc + tAut + tNf + tPag;
      if (fim > -1) continue;
      const valor = integral ? redondo(vei[5] * entre(.9, 1), 100) : redondo(entre(1800, 16000), 10);
      const of = ofic(inteiro(0, 8));
      const marcos = { documentos: quando(ini + 1 + tDoc) };
      if (!integral) {
        marcos.orcamento = quando(ini + 1 + tDoc + tOrc);
        marcos.autorizacao = quando(ini + 1 + tDoc + tOrc + tAut);
      }
      marcos.notaFiscal = quando(fim - tPag);
      marcos.pagamento = quando(fim);
      const pg = integral
        ? pagamento('Segurado', ap.segurado.nome, ap.segurado.documento, valor, 'Pago', fim - tPag, { solicitadoPor: analista, solicitadoPorId: usu(analista), dataProgramada: dia(fim) })
        : pagamento('Oficina', of.nomeFantasia, of.cnpj, valor - ap.coberturas.casco.franquia, 'Pago', fim - tPag, { solicitadoPor: analista, solicitadoPorId: usu(analista), dataProgramada: dia(fim) });
      pg.liberadoEm = quando(fim - 1, '10:00');
      processo({
        ap: ap.id, nat: nt, dias: ini, pos: 9, status: 'Encerrado', encerradoEm: quando(fim, '17:00'), posDesde: quando(fim, '17:00'),
        relato: integral ? 'Veículo levado enquanto estava estacionado.' : 'Colisão leve no trânsito da cidade.',
        local: 'Rua das Flores, ' + inteiro(10, 2000), bairro: 'Centro',
        docs: integral ? DOCS_II : DOCS_DP.concat(doc('Nota fiscal do reparo')),
        orcamentos: integral ? [] : [orcamento(of, valor, ini + 1 + tDoc + tOrc, 'Autorizado', { analisadoPor: analista, analisadoEm: marcos.autorizacao, entradaOficina: dia(ini + tDoc) })],
        pagamentos: [pg], marcos,
        hist: [{ quando: quando(fim, '17:00'), quem: analista, acao: 'Processo encerrado na posição "Encerrado com indenização"' }]
      });
    }

    /* ---------- Distribuição automática */

    db.distribuicao = {
      grupos: [
        { id: 1, nome: 'Danos parciais', naturezas: [1, 2, 6, 54], analistas: [usu('Bruno Tavares'), usu('Larissa Monte'), usu('Vitor Amaral')] },
        { id: 2, nome: 'Indenização integral', naturezas: [3, 4, 58], analistas: [usu('Bruno Tavares'), usu('Renata Coelho'), usu('Fábio Lacerda')] },
        { id: 3, nome: 'Terceiros e acidentes pessoais', naturezas: [8, 10, 11], analistas: [usu('Elisa Pacheco'), usu('Bruno Tavares')] }
      ],
      prioridade: [6, 2, 4, 7, 1, 3, 5, 8],
      news: ['Novos documentos', 'Novo orçamento', 'Nota fiscal recebida'],
      prazoMinutos: 30,
      alteradoEm: quando(-12, '09:00'),
      alteradoPor: 'Bruno Tavares'
    };

    // Um processo que ficou parado na caixa do Bruno e voltou para a fila.
    const devolvido = db.processos.find((p) => p.apoliceId === 4 && p.natureza === 6);
    db.devolucoes = [{ id: 1, usuarioId: usu('Bruno Tavares'), processoId: devolvido.id, quando: horasAtras(18), justificativa: '' }];
    devolvido.historico.push({ quando: horasAtras(18), quem: 'Sistema', acao: 'Devolvido para a fila: ficou mais de 30 minutos na caixa de Bruno Tavares sem tratamento' });

    return db;
  }

  /* ------------------------------------------------------------- Banco */

  let cache = null;
  function carregar() {
    if (cache) return cache;
    const salvo = G.store.get('db', null);
    cache = salvo && salvo.versao === VERSAO ? salvo : seed();
    if (!salvo || salvo.versao !== VERSAO) G.store.set('db', cache);
    return cache;
  }
  function persistir() { G.store.set('db', cache); }

  function agora() { return new Date().toISOString(); }
  function quemSou() { const u = G.usuario(); return u ? u.nome : 'Sistema'; }

  const db = {
    all(col) { return carregar()[col] || []; },
    get(col, id) { return db.all(col).find((r) => r.id === Number(id)) || null; },
    raw: () => carregar(),
    // Grava o registro e anota quem/quando no histórico.
    save(col, rec, acao) {
      const lista = carregar()[col];
      const quem = quemSou();
      const quando = agora();
      if (!rec.id) {
        rec.id = lista.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        rec.codigo = cod(rec.id);
        rec.criadoEm = quando;
        rec.criadoPor = quem;
        rec.historico = [];
        lista.push(rec);
      } else {
        const i = lista.findIndex((r) => r.id === rec.id);
        if (i >= 0) lista[i] = rec; else lista.push(rec);
      }
      rec.alteradoEm = quando;
      rec.alteradoPor = quem;
      if (!rec.historico) rec.historico = [];
      if (acao) rec.historico.push({ quando, quem, acao });
      persistir();
      return rec;
    },
    remove(col, id) {
      const c = carregar();
      c[col] = c[col].filter((r) => r.id !== Number(id));
      persistir();
    },
    commit: persistir,
    reset() {
      cache = seed();
      persistir();
    }
  };

  /* ------------------------------------------------- Consultas auxiliares */

  const porNumero = (col, n) => db.all(col).find((r) => r.numero === Number(n)) || null;

  const nome = {
    usuario: (id) => { const r = db.get('usuarios', id); return r ? r.nome : ''; },
    perfil: (id) => { const r = db.get('perfis', id); return r ? r.nome : ''; },
    oficina: (id) => { const r = db.get('oficinas', id); return r ? r.nomeFantasia : ''; },
    tipoDocumento: (id) => { const r = db.get('tiposDocumento', id); return r ? r.nome : ''; },
    natureza: (n) => { const r = porNumero('naturezas', n); return r ? r.numero + ' · ' + r.descricao : String(n); },
    naturezaCurta: (n) => { const r = porNumero('naturezas', n); return r ? r.descricao : String(n); },
    posicao: (n) => { const r = porNumero('posicoes', n); return r ? r.descricao : String(n); },
    banco: (v) => { const r = BANCOS.find((b) => b.value === v); return r ? r.label : v; }
  };

  const natureza = (n) => porNumero('naturezas', n);
  const posicao = (n) => porNumero('posicoes', n);
  const apolice = (p) => db.get('apolices', p.apoliceId);
  const chaveApolice = (a) => a.sucursal + '.' + a.ramo + '.' + a.numero + '.' + a.item;
  const numeroProcesso = (p) => p.sinistro + '-' + p.seq;
  const veiculoTexto = (v) => v.marca + ' ' + v.modelo + ' ' + v.anoFab + '/' + v.anoMod;

  // Prazo da posição atual: dias corridos desde que o processo entrou nela.
  function prazo(p) {
    const pos = posicao(p.posicao);
    if (p.status === 'Encerrado' || !pos || !pos.prazoDias) return { status: '', dias: 0, limite: '' };
    const desde = String(p.posicaoDesde).slice(0, 10);
    const limite = G.somaDias(desde, pos.prazoDias);
    const resta = G.diasAte(limite);
    return { status: resta < 0 ? 'Prazo estourado' : resta === 0 ? 'Vence hoje' : 'No prazo', dias: resta, limite };
  }

  // Saldo da cobertura usada pelo processo, somando os pagamentos de todos os processos da apólice.
  function saldo(p) {
    const ap = apolice(p);
    const chave = natureza(p.natureza) ? natureza(p.natureza).cobertura : 'casco';
    const cob = ap.coberturas[chave];
    const usado = db.all('processos')
      .filter((x) => x.apoliceId === ap.id && natureza(x.natureza) && natureza(x.natureza).cobertura === chave)
      .reduce((s, x) => s + x.pagamentos.filter((g) => g.status !== 'Rejeitado').reduce((t, g) => t + g.valor, 0), 0);
    return { cobertura: chave, rotulo: COBERTURAS[chave], is: cob.is, franquia: cob.franquia || 0, usado, saldo: Math.max(0, cob.is - usado) };
  }

  function totaisOrcamento(o) {
    const t = { pecas: 0, mao: 0, total: 0 };
    o.itens.forEach((i) => {
      const v = i.quantidade * i.valor;
      if (i.tipo === 'Peça') t.pecas += v; else t.mao += v;
    });
    t.total = Math.round((t.pecas + t.mao) * 100) / 100;
    return t;
  }

  // Documentos que a natureza exige, com a situação de cada um no processo.
  function documentosAguardados(p) {
    const n = natureza(p.natureza);
    return (n ? n.documentos : []).map((tipoId) => {
      const recebido = p.documentos.find((d) => d.tipoId === tipoId);
      const dispensa = (p.dispensados || []).find((d) => d.tipoId === tipoId);
      return { tipoId, nome: nome.tipoDocumento(tipoId), status: recebido ? 'Recebido' : dispensa ? 'Dispensado' : 'Aguardando', recebido, dispensa };
    });
  }

  const newsPendentes = (p) => p.news.filter((n) => !n.lida);

  /*
   * Paradas da jornada do sinistro. Reparo tem orçamento e oficina;
   * indenização integral e acidentes pessoais vão direto da análise ao pagamento.
   */
  function jornada(p) {
    const n = natureza(p.natureza);
    const m = p.marcos || {};
    const pagos = p.pagamentos.filter((g) => g.status === 'Liberado' || g.status === 'Pago');
    const pedido = p.pagamentos.find((g) => g.status !== 'Rejeitado');
    const reparo = n && (n.grupo === 'Danos parciais' || n.cobertura === 'rcfDm');
    const paradas = [{ label: 'Aviso', data: p.avisadoEm, feita: true }];
    paradas.push({ label: 'Documentos', data: m.documentos, feita: !!m.documentos });
    if (reparo) {
      paradas.push({ label: 'Orçamento', data: m.autorizacao, feita: !!m.autorizacao });
      paradas.push({ label: 'Reparo', data: m.notaFiscal, feita: !!m.notaFiscal });
    } else {
      paradas.push({ label: 'Análise', data: pedido ? pedido.solicitadoEm : '', feita: !!pedido });
    }
    paradas.push({ label: 'Pagamento', data: m.pagamento || (pagos[0] && pagos[0].liberadoEm), feita: !!(m.pagamento || pagos.length) });
    paradas.push({ label: 'Encerrado', data: p.encerradoEm, feita: p.status === 'Encerrado' });
    // Encerrado sem indenização pula as paradas que não aconteceram.
    const atual = p.status === 'Encerrado' ? -1 : paradas.findIndex((x) => !x.feita);
    return paradas.map((x, i) => Object.assign(x, { estado: x.feita ? 'feita' : i === atual ? 'atual' : 'futura' }));
  }

  function grupoDaNatureza(n) {
    return db.raw().distribuicao.grupos.find((g) => g.naturezas.indexOf(Number(n)) >= 0) || null;
  }

  // Ordena a fila do jeito que a distribuição automática entrega os processos.
  function ordenaFila(lista) {
    const cfg = db.raw().distribuicao;
    const peso = (p) => {
      const news = newsPendentes(p).some((n) => cfg.news.indexOf(n.tipo) >= 0) ? 0 : 1;
      const prio = p.vistoriaPrioritaria ? 0 : 1;
      const pos = cfg.prioridade.indexOf(p.posicao);
      return [news, prio, pos < 0 ? 99 : pos, p.posicaoDesde];
    };
    return lista.slice().sort((a, b) => {
      const x = peso(a);
      const y = peso(b);
      for (let i = 0; i < x.length; i++) {
        if (x[i] < y[i]) return -1;
        if (x[i] > y[i]) return 1;
      }
      return 0;
    });
  }

  // Por que o processo está nessa posição da fila: a regra explicada.
  function motivoNaFila(p) {
    const cfg = db.raw().distribuicao;
    const news = newsPendentes(p).filter((n) => cfg.news.indexOf(n.tipo) >= 0);
    if (news.length) return 'News: ' + news[0].tipo.toLowerCase();
    if (p.vistoriaPrioritaria) return 'Vistoria prioritária';
    return 'Posição "' + nome.posicao(p.posicao) + '"';
  }

  function filaDoUsuario(usuarioId) {
    const grupos = db.raw().distribuicao.grupos.filter((g) => g.analistas.indexOf(Number(usuarioId)) >= 0);
    const naturezas = grupos.reduce((acc, g) => acc.concat(g.naturezas), []);
    const fila = db.all('processos').filter((p) => p.status === 'Aberto' && !p.analistaId && naturezas.indexOf(p.natureza) >= 0);
    return ordenaFila(fila);
  }

  function registra(p, acao, quem) {
    p.historico.push({ quando: agora(), quem: quem || quemSou(), acao });
    p.alteradoEm = agora();
    p.alteradoPor = quem || quemSou();
  }

  function atribui(p, usuarioId, acao) {
    p.analistaId = usuarioId;
    p.atribuidoEm = agora();
    registra(p, acao || 'Processo atribuído a ' + nome.usuario(usuarioId));
    db.commit();
  }

  // A distribuição entrega o primeiro da fila: ninguém escolhe processo a dedo.
  function pegaProximo(usuarioId) {
    const p = filaDoUsuario(usuarioId)[0];
    if (!p) return null;
    atribui(p, Number(usuarioId), 'Distribuído automaticamente para ' + nome.usuario(usuarioId));
    p.distribuidoAuto = true;
    db.commit();
    return p;
  }

  /*
   * Processo que veio da distribuição e ficou na caixa além do prazo, sem
   * nenhuma ação de quem recebeu, volta para a fila e pede uma justificativa.
   */
  function verificaPrazoCaixa(usuarioId) {
    const c = db.raw();
    const limite = c.distribuicao.prazoMinutos * 60000;
    const quem = nome.usuario(usuarioId);
    const devolvidos = c.processos.filter((p) => p.analistaId === Number(usuarioId) && p.status === 'Aberto' && p.distribuidoAuto &&
      Date.now() - new Date(p.atribuidoEm).getTime() > limite &&
      !p.historico.some((x) => x.quem === quem && x.quando > p.atribuidoEm));
    devolvidos.forEach((p) => {
      p.analistaId = null;
      p.distribuidoAuto = false;
      registra(p, 'Devolvido para a fila: ficou mais de ' + c.distribuicao.prazoMinutos + ' minutos na caixa de ' + quem + ' sem tratamento', 'Sistema');
      c.devolucoes.push({ id: c.devolucoes.reduce((m, d) => Math.max(m, d.id), 0) + 1, usuarioId: Number(usuarioId), processoId: p.id, quando: agora(), justificativa: '' });
    });
    if (devolvidos.length) persistir();
    return devolvidos;
  }

  // Quatro olhos: quem pede o pagamento não libera, e quem libera precisa de alçada.
  function motivoNaoLibera(pag, usuarioId) {
    const u = db.get('usuarios', usuarioId);
    if (!u) return 'Usuário não encontrado.';
    if (pag.solicitadoPorId === u.id) return 'Foi você quem pediu este pagamento. Outra pessoa precisa liberar.';
    if (!u.alcadaPagamento) return 'Seu usuário não tem alçada de pagamento.';
    if (pag.valor > u.alcadaPagamento) return 'Acima da sua alçada de ' + G.fmt.money(u.alcadaPagamento) + '.';
    return '';
  }

  function mudaPosicao(p, numero, quem) {
    const pos = posicao(numero);
    p.posicao = Number(numero);
    p.posicaoDesde = agora();
    if (pos && pos.encerra === 'sim') {
      p.status = 'Encerrado';
      p.encerradoEm = agora();
      p.analistaId = null;
      registra(p, 'Processo encerrado na posição "' + pos.descricao + '"', quem);
    } else {
      registra(p, 'Posição alterada para "' + (pos ? pos.descricao : numero) + '"', quem);
    }
  }

  /*
   * Abre um sinistro a partir do aviso. Quando o segurado causou danos a um
   * terceiro, abre também o processo de RCF para o terceiro, no mesmo sinistro.
   */
  function abreSinistro(dados) {
    const c = db.raw();
    c.contador.sinistro += 1;
    const sinistro = String(c.contador.sinistro);
    const criados = [];
    const base = (seq, numNatureza) => {
      c.contador.aviso += 1;
      const n = natureza(numNatureza);
      const posInicial = n.grupo === 'Danos parciais' || n.grupo === 'Terceiros' ? 1 : 3;
      const p = {
        id: c.processos.reduce((m, r) => Math.max(m, r.id), 0) + 1,
        sinistro, seq, apoliceId: dados.apoliceId, natureza: n.numero,
        aviso: '206' + G.hoje().replace(/-/g, '') + String(c.contador.aviso).padStart(4, '0'),
        ocorrencia: dados.ocorrencia,
        avisadoEm: agora(), avisadoPor: quemSou(), canal: dados.canal,
        condutor: dados.condutor, terceiro: dados.terceiro, culpado: dados.culpado,
        posicao: posInicial, posicaoDesde: agora(), status: 'Aberto', encerradoEm: '',
        analistaId: null, atribuidoEm: null, vistoriaPrioritaria: !!dados.prioritaria,
        news: [], pareceres: [], orcamentos: [], pagamentos: [], documentos: [], dispensados: [], cartas: [],
        ressarcimento: null, marcos: {},
        contato: dados.contato,
        historico: [
          { quando: agora(), quem: quemSou(), acao: 'Aviso registrado pelo canal ' + String(dados.canal).toLowerCase() },
          { quando: agora(), quem: 'Sistema', acao: 'Processo aberto na posição "' + nome.posicao(posInicial) + '"' }
        ],
        criadoEm: agora(), criadoPor: quemSou(), alteradoEm: agora(), alteradoPor: quemSou()
      };
      c.processos.push(p);
      criados.push(p);
      return p;
    };
    base(1, dados.natureza);
    if (dados.terceiro && dados.culpado === 'Segurado' && natureza(dados.natureza).cobertura === 'casco') base(2, 11);
    persistir();
    return criados;
  }

  /* ------------------------------------------------- Esquemas dos cadastros */

  const opcoesRef = (col, rotuloFn, soAtivos) => () => db.all(col)
    .filter((r) => !soAtivos || r.status === 'Ativo')
    .map((r) => ({ value: String(r.id), label: rotuloFn(r) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const opcoesNaturezas = () => db.all('naturezas').filter((n) => n.status === 'Ativo')
    .map((n) => ({ value: String(n.numero), label: n.numero + ' · ' + n.descricao }));

  const C = {
    status: { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS, required: true, span: 4, padrao: 'Ativo' },
    observacoes: { key: 'observacoes', label: 'Observações', tipo: 'textarea', max: 600, opcional: true, dica: 'Informações que ajudam o time, até 600 caracteres.' }
  };
  const simNao = (key, label, padrao, span) => ({ key, label, tipo: 'radio', opcoes: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }], required: true, span: span || 4, padrao: padrao || 'nao' });
  const pagamentoCampos = [
    { key: 'formaPagamento', label: 'Forma de pagamento', tipo: 'radio', opcoes: ['Conta corrente', 'Boleto'], required: true, span: 12, padrao: 'Conta corrente' },
    { key: 'banco', label: 'Banco', tipo: 'select', opcoes: BANCOS, required: true, span: 4, showIf: { key: 'formaPagamento', value: 'Conta corrente' } },
    { key: 'agencia', label: 'Agência', required: true, mask: 'digits', inputmode: 'numeric', max: 5, span: 4, showIf: { key: 'formaPagamento', value: 'Conta corrente' } },
    { key: 'conta', label: 'Conta com dígito', required: true, max: 15, span: 4, dica: 'Por exemplo, 40100-7.', showIf: { key: 'formaPagamento', value: 'Conta corrente' } }
  ];

  const colStatus = { key: 'status', label: 'Status', sort: true, render: (r) => G.statusBadge(r.status) };
  const usoEmProcessos = (fn, msg) => (id) => (db.all('processos').some((p) => fn(p, id)) ? msg : '');

  const schemas = {
    oficinas: {
      titulo: 'Oficinas',
      singular: 'oficina',
      novo: 'Nova oficina',
      descricao: 'Oficinas referenciadas, concessionárias e de livre escolha que enviam orçamentos.',
      icone: 'wrench',
      nomeRegistro: (r) => r.nomeFantasia,
      unico: [{ key: 'cnpj', msg: 'Já existe uma oficina com esse CNPJ.' }],
      secoes: [
        {
          titulo: 'Dados gerais',
          campos: [
            { key: 'cnpj', label: 'CNPJ', required: true, rules: 'cnpj', mask: 'cnpj', inputmode: 'numeric', max: 18, span: 4 },
            { key: 'inscricaoEstadual', label: 'Inscrição estadual', mask: 'digits', inputmode: 'numeric', max: 14, span: 4, opcional: true },
            Object.assign({}, C.status, { span: 4 }),
            { key: 'razaoSocial', label: 'Razão social', required: true, max: 120, span: 6 },
            { key: 'nomeFantasia', label: 'Nome fantasia', required: true, max: 80, span: 6, dica: 'É o nome que aparece nas telas e nas cartas.' },
            { key: 'tipo', label: 'Tipo de oficina', tipo: 'select', opcoes: ['Referenciada', 'Concessionária', 'Livre escolha'], required: true, span: 4 },
            { key: 'bandeira', label: 'Bandeira', tipo: 'select', opcoes: ['Multimarcas', 'Arion', 'Brisa', 'Kaimo', 'Montes', 'Tarsa', 'Volta'], required: true, span: 4 },
            { key: 'categoria', label: 'Categoria', tipo: 'select', opcoes: ['Ouro', 'Prata', 'Bronze'], required: true, span: 4, dica: 'Vem da avaliação de qualidade e prazo.' }
          ]
        },
        { titulo: 'Endereço', campos: [{ key: 'endereco', tipo: 'endereco' }] },
        {
          titulo: 'Atendimento',
          campos: [
            { key: 'abertura', label: 'Abre às', tipo: 'time', required: true, span: 4 },
            { key: 'fechamento', label: 'Fecha às', tipo: 'time', required: true, span: 4 },
            simNao('carroReserva', 'Tem convênio de carro reserva?', 'nao', 4),
            C.observacoes
          ]
        },
        { titulo: 'Contatos', dica: 'Quem o time de sinistros procura para falar sobre orçamentos e prazos.', campos: [{ key: 'contatos', tipo: 'contatos' }] }
      ],
      filtros: [
        { key: 'nome', label: 'Nome ou razão social', tipo: 'text', match: (r, v) => G.normaliza(r.nomeFantasia + ' ' + r.razaoSocial).indexOf(G.normaliza(v)) >= 0 },
        { key: 'cnpj', label: 'CNPJ', tipo: 'text', mask: 'cnpj', match: (r, v) => G.digitos(r.cnpj).indexOf(G.digitos(v)) >= 0 },
        { key: 'uf', label: 'UF', tipo: 'select', opcoes: UFS, match: (r, v) => r.endereco && r.endereco.uf === v },
        { key: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Referenciada', 'Concessionária', 'Livre escolha'] },
        { key: 'categoria', label: 'Categoria', tipo: 'select', opcoes: ['Ouro', 'Prata', 'Bronze'] },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'nomeFantasia', label: 'Oficina', sort: true, link: true, sub: (r) => r.razaoSocial },
        { key: 'cnpj', label: 'CNPJ', sort: true, class: 'nowrap' },
        { key: 'tipo', label: 'Tipo', sort: true, sub: (r) => r.bandeira },
        { key: 'categoria', label: 'Categoria', sort: true },
        { key: 'cidade', label: 'Cidade', sort: (r) => r.endereco.cidade, render: (r) => r.endereco.cidade + '/' + r.endereco.uf, csv: (r) => r.endereco.cidade + '/' + r.endereco.uf },
        colStatus
      ],
      emUso: usoEmProcessos((p, id) => p.orcamentos.some((o) => o.oficinaId === id), 'Essa oficina tem orçamentos em processos de sinistro. Para tirar de uso, mude o status para Inativo.')
    },

    prestadores: {
      titulo: 'Despachantes e reguladoras',
      singular: 'prestador',
      novo: 'Novo prestador',
      descricao: 'Despachantes, reguladoras, guinchos e leiloeiros que trabalham nos sinistros.',
      icone: 'briefcase',
      nomeRegistro: (r) => r.nomeFantasia,
      unico: [{ key: 'cnpj', msg: 'Já existe um prestador com esse CNPJ.' }],
      secoes: [
        {
          titulo: 'Dados gerais',
          campos: [
            { key: 'tipo', label: 'Tipo de prestador', tipo: 'select', opcoes: ['Despachante', 'Reguladora', 'Guincho e remoção', 'Leiloeiro'], required: true, span: 4 },
            { key: 'cnpj', label: 'CNPJ', required: true, rules: 'cnpj', mask: 'cnpj', inputmode: 'numeric', max: 18, span: 4 },
            Object.assign({}, C.status, { span: 4 }),
            { key: 'razaoSocial', label: 'Razão social', required: true, max: 120, span: 6 },
            { key: 'nomeFantasia', label: 'Nome fantasia', required: true, max: 80, span: 6 }
          ]
        },
        { titulo: 'Pagamento', dica: 'Para onde vão os pagamentos dos serviços prestados.', campos: pagamentoCampos },
        { titulo: 'Endereço', campos: [{ key: 'endereco', tipo: 'endereco' }] },
        { titulo: 'Contatos', campos: [{ key: 'contatos', tipo: 'contatos' }, C.observacoes] }
      ],
      filtros: [
        { key: 'nome', label: 'Nome ou razão social', tipo: 'text', match: (r, v) => G.normaliza(r.nomeFantasia + ' ' + r.razaoSocial).indexOf(G.normaliza(v)) >= 0 },
        { key: 'cnpj', label: 'CNPJ', tipo: 'text', mask: 'cnpj', match: (r, v) => G.digitos(r.cnpj).indexOf(G.digitos(v)) >= 0 },
        { key: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Despachante', 'Reguladora', 'Guincho e remoção', 'Leiloeiro'] },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'nomeFantasia', label: 'Prestador', sort: true, link: true, sub: (r) => r.razaoSocial },
        { key: 'tipo', label: 'Tipo', sort: true },
        { key: 'cnpj', label: 'CNPJ', sort: true, class: 'nowrap' },
        { key: 'formaPagamento', label: 'Pagamento', sort: true, render: (r) => (r.formaPagamento === 'Boleto' ? 'Boleto' : nome.banco(r.banco)), csv: (r) => (r.formaPagamento === 'Boleto' ? 'Boleto' : nome.banco(r.banco)) },
        colStatus
      ]
    },

    instituicoes: {
      titulo: 'Financeiras e hospitais',
      singular: 'instituição',
      novo: 'Nova instituição',
      descricao: 'Financeiras que recebem a quitação de veículos alienados e hospitais que atendem vítimas.',
      icone: 'bank',
      nomeRegistro: (r) => r.nomeFantasia,
      unico: [{ key: 'cnpj', msg: 'Já existe uma instituição com esse CNPJ.' }],
      secoes: [
        {
          titulo: 'Dados gerais',
          campos: [
            { key: 'tipo', label: 'Tipo de instituição', tipo: 'select', opcoes: ['Financeira', 'Hospital'], required: true, span: 4 },
            { key: 'cnpj', label: 'CNPJ', required: true, rules: 'cnpj', mask: 'cnpj', inputmode: 'numeric', max: 18, span: 4 },
            Object.assign({}, C.status, { span: 4 }),
            { key: 'razaoSocial', label: 'Razão social', required: true, max: 120, span: 6 },
            { key: 'nomeFantasia', label: 'Nome fantasia', required: true, max: 80, span: 6 }
          ]
        },
        { titulo: 'Pagamento', campos: pagamentoCampos },
        { titulo: 'Endereço', campos: [{ key: 'endereco', tipo: 'endereco' }] },
        { titulo: 'Contatos', campos: [{ key: 'contatos', tipo: 'contatos' }, C.observacoes] }
      ],
      filtros: [
        { key: 'nome', label: 'Nome ou razão social', tipo: 'text', match: (r, v) => G.normaliza(r.nomeFantasia + ' ' + r.razaoSocial).indexOf(G.normaliza(v)) >= 0 },
        { key: 'cnpj', label: 'CNPJ', tipo: 'text', mask: 'cnpj', match: (r, v) => G.digitos(r.cnpj).indexOf(G.digitos(v)) >= 0 },
        { key: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Financeira', 'Hospital'] },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'nomeFantasia', label: 'Instituição', sort: true, link: true, sub: (r) => r.razaoSocial },
        { key: 'tipo', label: 'Tipo', sort: true },
        { key: 'cnpj', label: 'CNPJ', sort: true, class: 'nowrap' },
        { key: 'cidade', label: 'Cidade', sort: (r) => r.endereco.cidade, render: (r) => r.endereco.cidade + '/' + r.endereco.uf, csv: (r) => r.endereco.cidade + '/' + r.endereco.uf },
        colStatus
      ],
      emUso: (id) => (db.all('apolices').some((a) => a.alienacao === id) ? 'Essa financeira aparece como credora de veículos segurados. Para tirar de uso, mude o status para Inativo.' : '')
    },

    cartas: {
      titulo: 'Modelos de carta',
      singular: 'modelo de carta',
      novo: 'Novo modelo de carta',
      descricao: 'Textos prontos que o analista emite de dentro do processo, já com os dados do sinistro.',
      icone: 'mail',
      nomeRegistro: (r) => r.titulo,
      unico: [{ key: 'titulo', msg: 'Já existe um modelo com esse título.', normaliza: true }],
      secoes: [
        {
          titulo: 'Identificação',
          campos: [
            { key: 'titulo', label: 'Título do modelo', required: true, max: 80, span: 8 },
            Object.assign({}, C.status, { span: 4 }),
            { key: 'tipo', label: 'Tipo de carta', tipo: 'select', opcoes: ['Autorização', 'Pedido de documentos', 'Quitação', 'Negativa', 'Ressarcimento', 'Outros'], required: true, span: 4 },
            { key: 'assunto', label: 'Assunto', required: true, max: 120, span: 8 }
          ]
        },
        {
          titulo: 'Texto da carta',
          dica: 'Use os campos entre chaves duplas para puxar os dados do processo: {{segurado}}, {{sinistro}}, {{veiculo}}, {{placa}}, {{data_ocorrencia}}, {{franquia}}, {{valor_indenizacao}}, {{documentos_pendentes}}, {{terceiro}} e {{analista}}.',
          campos: [{ key: 'texto', label: 'Texto', tipo: 'textarea', required: true, max: 3000 }]
        },
        { titulo: 'Naturezas', dica: 'Em quais naturezas esse modelo aparece para emissão.', campos: [{ key: 'naturezas', tipo: 'checklist', ref: opcoesNaturezas, label: 'Naturezas', numero: true }] }
      ],
      filtros: [
        { key: 'titulo', label: 'Título', tipo: 'text' },
        { key: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Autorização', 'Pedido de documentos', 'Quitação', 'Negativa', 'Ressarcimento', 'Outros'] },
        { key: 'natureza', label: 'Natureza', tipo: 'select', ref: opcoesNaturezas, match: (r, v) => r.naturezas.indexOf(Number(v)) >= 0 },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'titulo', label: 'Modelo', sort: true, link: true, sub: (r) => r.assunto },
        { key: 'tipo', label: 'Tipo', sort: true },
        { key: 'naturezas', label: 'Naturezas', num: true, sort: (r) => r.naturezas.length, render: (r) => String(r.naturezas.length), csv: (r) => r.naturezas.join(', ') },
        colStatus
      ],
      emUso: usoEmProcessos((p, id) => p.cartas.some((c) => c.modeloId === id), 'Esse modelo já foi usado em cartas emitidas. Para tirar de uso, mude o status para Inativo.')
    },

    usuarios: {
      titulo: 'Usuários',
      singular: 'usuário',
      novo: 'Novo usuário',
      descricao: 'Quem acessa o sistema, com o perfil e as alçadas de cada pessoa.',
      icone: 'user',
      nomeRegistro: (r) => r.nome,
      unico: [{ key: 'matricula', msg: 'Já existe um usuário com essa matrícula.' }, { key: 'cpf', msg: 'Já existe um usuário com esse CPF.' }, { key: 'email', msg: 'Já existe um usuário com esse e-mail.', normaliza: true }],
      secoes: [
        {
          titulo: 'Dados do usuário',
          campos: [
            { key: 'matricula', label: 'Matrícula', required: true, rules: 'matricula', mask: 'upper', max: 7, span: 4, dica: 'Uma letra e 6 números, como T204518.' },
            { key: 'nome', label: 'Nome completo', required: true, max: 80, span: 8, autocomplete: 'off' },
            { key: 'cpf', label: 'CPF', required: true, rules: 'cpf', mask: 'cpf', inputmode: 'numeric', max: 14, span: 4 },
            { key: 'email', label: 'E-mail corporativo', required: true, rules: 'email', tipo: 'email', max: 80, span: 8 },
            { key: 'tipo', label: 'Vínculo', tipo: 'radio', opcoes: ['Funcionário', 'Terceiro'], required: true, span: 6, padrao: 'Funcionário' },
            simNao('graduado', 'É analista graduado?', 'nao', 6)
          ]
        },
        {
          titulo: 'Perfil e alçadas',
          dica: 'A alçada é o valor máximo que a pessoa pode autorizar sozinha. Acima disso, outra pessoa com alçada maior precisa aprovar.',
          campos: [
            { key: 'perfil', label: 'Perfil de acesso', tipo: 'select', ref: opcoesRef('perfis', (r) => r.nome, true), required: true, span: 4, numero: true },
            { key: 'cargo', label: 'Cargo', tipo: 'select', opcoes: ['Supervisor de sinistros', 'Analista de sinistros', 'Analista de sinistros sênior', 'Especialista de pagamentos', 'Assistente de atendimento'], required: true, span: 4 },
            Object.assign({}, C.status, { span: 4 }),
            { key: 'alcadaAnalise', label: 'Alçada de análise (R$)', mask: 'money', inputmode: 'decimal', max: 14, span: 6, opcional: true, dinheiro: true, dica: 'Valor máximo de orçamento que pode autorizar.' },
            { key: 'alcadaPagamento', label: 'Alçada de pagamento (R$)', mask: 'money', inputmode: 'decimal', max: 14, span: 6, opcional: true, dinheiro: true, dica: 'Valor máximo de pagamento que pode liberar.' }
          ]
        }
      ],
      filtros: [
        { key: 'matricula', label: 'Matrícula', tipo: 'text', mask: 'upper' },
        { key: 'nome', label: 'Nome', tipo: 'text' },
        { key: 'perfil', label: 'Perfil', tipo: 'select', ref: opcoesRef('perfis', (r) => r.nome), numero: true },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'nome', label: 'Nome', sort: true, link: true, sub: (r) => r.cargo },
        { key: 'matricula', label: 'Matrícula', sort: true },
        { key: 'perfil', label: 'Perfil', sort: (r) => nome.perfil(r.perfil), render: (r) => nome.perfil(r.perfil), csv: (r) => nome.perfil(r.perfil) },
        { key: 'alcadaPagamento', label: 'Alçada de pagamento', num: true, sort: true, render: (r) => (r.alcadaPagamento ? G.fmt.money(r.alcadaPagamento) : 'Sem alçada'), csv: (r) => r.alcadaPagamento },
        colStatus
      ],
      emUso: usoEmProcessos((p, id) => p.analistaId === id, 'Essa pessoa tem processos na caixa de entrada. Devolva os processos para a fila ou mude o status para Inativo.')
    },

    perfis: {
      titulo: 'Perfis de acesso',
      singular: 'perfil de acesso',
      novo: 'Novo perfil de acesso',
      descricao: 'Defina o que cada perfil vê e pode fazer em cada funcionalidade.',
      icone: 'users',
      nomeRegistro: (r) => r.nome,
      unico: [{ key: 'nome', msg: 'Já existe um perfil com esse nome.', normaliza: true }],
      secoes: [
        {
          titulo: 'Dados do perfil',
          campos: [
            { key: 'nome', label: 'Nome do perfil', required: true, max: 60, span: 8 },
            C.status,
            { key: 'descricao', label: 'Para que serve', tipo: 'textarea', max: 300, opcional: true }
          ]
        },
        { titulo: 'Funcionalidades e permissões', dica: 'Marque o que o perfil pode fazer em cada funcionalidade. Quem não tem "Consultar" não vê a funcionalidade.', campos: [{ key: 'permissoes', tipo: 'permissoes' }] }
      ],
      filtros: [
        { key: 'nome', label: 'Nome do perfil', tipo: 'text' },
        { key: 'tela', label: 'Funcionalidade', tipo: 'select', ref: opcoesRef('telas', (r) => r.nome, true), match: (r, v) => !!(r.permissoes[v] && r.permissoes[v].length) },
        { key: 'usuario', label: 'Usuário do perfil', tipo: 'text', match: (r, v) => db.all('usuarios').some((u) => u.perfil === r.id && G.normaliza(u.nome + ' ' + u.matricula).indexOf(G.normaliza(v)) >= 0) },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'nome', label: 'Perfil', sort: true, link: true, sub: (r) => r.descricao },
        { key: 'telas', label: 'Funcionalidades', num: true, sort: (r) => Object.keys(r.permissoes).filter((k) => r.permissoes[k].length).length, render: (r) => String(Object.keys(r.permissoes).filter((k) => r.permissoes[k].length).length), csv: (r) => Object.keys(r.permissoes).filter((k) => r.permissoes[k].length).length },
        { key: 'usuarios', label: 'Usuários', num: true, sort: (r) => db.all('usuarios').filter((u) => u.perfil === r.id).length, render: (r) => String(db.all('usuarios').filter((u) => u.perfil === r.id).length), csv: (r) => db.all('usuarios').filter((u) => u.perfil === r.id).length },
        colStatus
      ],
      emUso: (id) => {
        const n = db.all('usuarios').filter((u) => u.perfil === id).length;
        return n ? 'Esse perfil tem ' + G.fmt.plural(n, 'usuário', 'usuários') + '. Mova essas pessoas para outro perfil antes de excluir.' : '';
      }
    },

    naturezas: {
      titulo: 'Naturezas',
      singular: 'natureza',
      novo: 'Nova natureza',
      descricao: 'O tipo de evento de cada processo. Define a cobertura usada, a fila e os documentos exigidos.',
      icone: 'tag',
      nomeRegistro: (r) => r.numero + ' · ' + r.descricao,
      unico: [{ key: 'numero', msg: 'Já existe uma natureza com esse número.' }],
      secoes: [
        {
          titulo: 'Dados da natureza',
          campos: [
            { key: 'numero', label: 'Número', tipo: 'number', required: true, min: 1, max: 999, inputmode: 'numeric', span: 3 },
            { key: 'descricao', label: 'Descrição', required: true, max: 80, span: 6 },
            Object.assign({}, C.status, { span: 3 }),
            { key: 'grupo', label: 'Grupo', tipo: 'select', opcoes: GRUPOS_NATUREZA, required: true, span: 4 },
            { key: 'cobertura', label: 'Cobertura usada', tipo: 'select', opcoes: Object.keys(COBERTURAS).map((k) => ({ value: k, label: COBERTURAS[k] })), required: true, span: 5 },
            { key: 'prazoDias', label: 'Prazo para indenizar (dias)', tipo: 'number', required: true, min: 1, max: 90, inputmode: 'numeric', span: 3, dica: 'A regra da Susep é de até 30 dias.' }
          ]
        },
        { titulo: 'Documentos exigidos', dica: 'O que precisa chegar antes de indenizar. Aparece como checklist dentro do processo.', campos: [{ key: 'documentos', tipo: 'checklist', ref: opcoesRef('tiposDocumento', (r) => r.nome, true), label: 'Documentos exigidos', numero: true }] }
      ],
      filtros: [
        { key: 'descricao', label: 'Descrição', tipo: 'text' },
        { key: 'grupo', label: 'Grupo', tipo: 'select', opcoes: GRUPOS_NATUREZA },
        { key: 'cobertura', label: 'Cobertura', tipo: 'select', opcoes: Object.keys(COBERTURAS).map((k) => ({ value: k, label: COBERTURAS[k] })) },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'descricao', label: 'Natureza', sort: (r) => r.numero, link: true, linkText: (r) => r.numero + ' · ' + r.descricao, sub: (r) => COBERTURAS[r.cobertura] },
        { key: 'grupo', label: 'Grupo', sort: true },
        { key: 'documentos', label: 'Documentos', num: true, sort: (r) => r.documentos.length, render: (r) => String(r.documentos.length), csv: (r) => r.documentos.map(nome.tipoDocumento).join(', ') },
        { key: 'prazoDias', label: 'Prazo', num: true, sort: true, render: (r) => G.fmt.plural(r.prazoDias, 'dia', 'dias') },
        colStatus
      ],
      emUso: (id) => {
        const r = db.get('naturezas', id);
        const n = r ? db.all('processos').filter((p) => p.natureza === r.numero).length : 0;
        return n ? 'Essa natureza aparece em ' + G.fmt.plural(n, 'processo', 'processos') + '. Para tirar de uso, mude o status para Inativo.' : '';
      }
    },

    posicoes: {
      titulo: 'Posições do processo',
      singular: 'posição',
      novo: 'Nova posição',
      descricao: 'Em que pé está cada processo. Cada posição tem um prazo, que alimenta os alertas da caixa de entrada.',
      icone: 'flag',
      nomeRegistro: (r) => r.descricao,
      unico: [{ key: 'numero', msg: 'Já existe uma posição com esse número.' }, { key: 'descricao', msg: 'Já existe uma posição com essa descrição.', normaliza: true }],
      secoes: [{
        titulo: 'Dados da posição',
        campos: [
          { key: 'numero', label: 'Número', tipo: 'number', required: true, min: 1, max: 99, inputmode: 'numeric', span: 3 },
          { key: 'descricao', label: 'Descrição', required: true, max: 60, span: 6 },
          Object.assign({}, C.status, { span: 3 }),
          { key: 'prazoDias', label: 'Prazo na posição (dias)', tipo: 'number', required: true, min: 0, max: 60, inputmode: 'numeric', span: 4, dica: 'Use 0 para posições sem prazo.' },
          simNao('encerra', 'Encerra o processo?', 'nao', 8),
          { key: 'orientacao', label: 'Orientação para o analista', tipo: 'textarea', max: 300, opcional: true }
        ]
      }],
      filtros: [
        { key: 'descricao', label: 'Descrição', tipo: 'text' },
        { key: 'encerra', label: 'Encerra o processo', tipo: 'select', opcoes: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }] },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'descricao', label: 'Posição', sort: (r) => r.numero, link: true, linkText: (r) => r.numero + ' · ' + r.descricao, sub: (r) => r.orientacao },
        { key: 'prazoDias', label: 'Prazo', num: true, sort: true, render: (r) => (r.prazoDias ? G.fmt.plural(r.prazoDias, 'dia', 'dias') : 'Sem prazo') },
        { key: 'encerra', label: 'Encerra?', sort: true, render: (r) => (r.encerra === 'sim' ? 'Sim' : 'Não') },
        { key: 'processos', label: 'Processos abertos', num: true, sort: (r) => db.all('processos').filter((p) => p.status === 'Aberto' && p.posicao === r.numero).length, render: (r) => String(db.all('processos').filter((p) => p.status === 'Aberto' && p.posicao === r.numero).length) },
        colStatus
      ],
      emUso: (id) => {
        const r = db.get('posicoes', id);
        return r && db.all('processos').some((p) => p.posicao === r.numero) ? 'Existem processos nessa posição. Para tirar de uso, mude o status para Inativo.' : '';
      }
    },

    tiposDocumento: {
      titulo: 'Tipos de documento',
      singular: 'tipo de documento',
      novo: 'Novo tipo de documento',
      descricao: 'Os documentos que chegam nos processos e que as naturezas podem exigir.',
      icone: 'file',
      nomeRegistro: (r) => r.nome,
      unico: [{ key: 'nome', msg: 'Já existe um tipo de documento com esse nome.', normaliza: true }],
      secoes: [{
        titulo: 'Dados do documento',
        campos: [
          { key: 'nome', label: 'Nome', required: true, max: 80, span: 8 },
          Object.assign({}, C.status, { span: 4 }),
          { key: 'origem', label: 'Quem costuma enviar', tipo: 'select', opcoes: ['Segurado', 'Oficina', 'Reguladora', 'Financeira', 'Despachante'], required: true, span: 6 },
          simNao('exigeOriginal', 'Exige o documento original?', 'nao', 6),
          { key: 'descricao', label: 'Orientação para o segurado', tipo: 'textarea', max: 300, opcional: true, dica: 'Aparece no pedido de documentos.' }
        ]
      }],
      filtros: [
        { key: 'nome', label: 'Nome', tipo: 'text' },
        { key: 'origem', label: 'Quem envia', tipo: 'select', opcoes: ['Segurado', 'Oficina', 'Reguladora', 'Financeira', 'Despachante'] },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: STATUS }
      ],
      colunas: [
        { key: 'nome', label: 'Documento', sort: true, link: true, sub: (r) => (r.exigeOriginal === 'sim' ? 'Exige original' : '') },
        { key: 'origem', label: 'Quem envia', sort: true },
        { key: 'naturezas', label: 'Exigido em', num: true, sort: (r) => db.all('naturezas').filter((n) => n.documentos.indexOf(r.id) >= 0).length, render: (r) => G.fmt.plural(db.all('naturezas').filter((n) => n.documentos.indexOf(r.id) >= 0).length, 'natureza', 'naturezas') },
        colStatus
      ],
      emUso: (id) => {
        if (db.all('naturezas').some((n) => n.documentos.indexOf(id) >= 0)) return 'Esse documento é exigido por naturezas. Tire das naturezas primeiro ou mude o status para Inativo.';
        return db.all('processos').some((p) => p.documentos.some((d) => d.tipoId === id)) ? 'Esse tipo de documento já foi anexado em processos. Para tirar de uso, mude o status para Inativo.' : '';
      }
    }
  };

  Object.assign(window.GSRE, {
    db, schemas, nome, natureza, posicao, apolice, chaveApolice, numeroProcesso, veiculoTexto, prazo, saldo, totaisOrcamento,
    documentosAguardados, newsPendentes, jornada, grupoDaNatureza, ordenaFila, filaDoUsuario, motivoNaFila, registra, atribui, mudaPosicao, abreSinistro,
    pegaProximo, verificaPrazoCaixa, motivoNaoLibera,
    UFS, STATUS, COBERTURAS, GRUPOS_NATUREZA, CATEGORIAS_PARECER, TIPOS_NEWS, BANCOS
  });
})();
