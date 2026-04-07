"use client";

import React, { useMemo, useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Search, Download, Filter, Trash2, FileText } from "lucide-react";
import * as XLSX from "xlsx";

type StatusValidacao = "OK" | "ALERTA";
type PerfilEmpresa = "geral" | "supermercado" | "restaurante" | "construcao";

type AnaliseSugestao = {
  tipo: "uso_consumo" | "imobilizado" | "combustivel" | null;
  motivo: string;
  confianca: "alta" | "media" | "baixa" | null;
};

type LinhaEntrada = {
  id: string;
  numero_nota: string;
  fornecedor: string;
  data: string;
  ncm: string;
  descricao: string;
  cfop: string;
  valor_contabil: number;
  base_icms: number;
  valor_icms: number;
  status: StatusValidacao;
  avisos: string[];
  sugestao: AnaliseSugestao;
};

type Filtros = {
  somenteAlertas: boolean;
  cfop: string;
  ncm: string;
  busca: string;
};

type Item0200 = {
  descricao: string;
  ncm: string;
};

type Participante0150 = {
  nome: string;
};

type NotaAgrupada = {
  chave: string;
  numero_nota: string;
  fornecedor: string;
  total_itens: number;
  total_contabil: number;
  total_base_icms: number;
  total_valor_icms: number;
  status: StatusValidacao;
  itens: LinhaEntrada[];
  sugestoes: string[];
  avisos: string[];
};

const PERFIS_EMPRESA_LABEL: Record<PerfilEmpresa, string> = {
  geral: "Empresa geral",
  supermercado: "Supermercado",
  restaurante: "Bar / restaurante",
  construcao: "Empresa de construção",
};

const NCM_TIPI_USO_CONSUMO = [
  "1006", "0713", "1701", "1507", "1511", "1512", "1517",
  "2201", "2202", "2203", "2204", "2205", "2206", "2207", "2208",
  "0901", "0902", "1905", "2101", "2106", "3003", "3004", "3005",
  "3303", "3304", "3305", "3306", "3307", "3401", "3402", "3808",
  "3924", "4818", "4823", "9603", "9608",
];

const NCM_TIPI_IMOBILIZADO = [
  "7321", "8210", "8414", "8415", "8418", "8421", "8422", "8428",
  "8436", "8450", "8467", "8470", "8471", "8472", "8479", "8508",
  "8509", "8516", "8517", "8518", "8528", "8539", "8709", "8716",
  "9018", "9403", "9405",
];

const NCM_TIPI_COMBUSTIVEIS = ["2710", "2711", "220710", "220720", "382600"];

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function normalizarCFOP(valor: unknown): string {
  return normalizarTexto(valor).replace(/\D/g, "").slice(0, 4);
}

function normalizarNumero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function extrairCampo(partes: string[], indice: number): string {
  return normalizarTexto(partes[indice] ?? "");
}

function classificarFamiliaCFOP(cfop: string): "revenda" | "industrializacao" | "uso_consumo" | "imobilizado" | "outro" {
  const codigo = normalizarCFOP(cfop);
  const finais = codigo.slice(2);

  if (["55", "56"].includes(finais)) return "uso_consumo";
  if (["51"].includes(finais)) return "imobilizado";
  if (["01"].includes(finais)) return "industrializacao";
  if (["02"].includes(finais)) return "revenda";

  return "outro";
}

function cfopEhUsoConsumo(cfop: string): boolean {
  return classificarFamiliaCFOP(cfop) === "uso_consumo";
}

function cfopEhImobilizado(cfop: string): boolean {
  return classificarFamiliaCFOP(cfop) === "imobilizado";
}

function cfopEhCombustivel(cfop: string): boolean {
  const codigo = normalizarCFOP(cfop);
  const finais = codigo.slice(2);
  return ["53", "54", "56", "59", "60", "61", "62", "63", "64", "65", "66", "67"].includes(finais);
}

function resumirAviso(aviso: string): string {
  if (aviso.startsWith("Possível uso e consumo:")) return "Possível uso e consumo";
  if (aviso.startsWith("Possível imobilizado:")) return "Possível imobilizado";
  if (aviso.startsWith("Possível combustível:")) return "Possível combustível";
  if (aviso.includes("Provável uso e consumo por vínculo com a nota")) return "Provável uso e consumo por vínculo com a nota";
  if (aviso.includes("Nota contém outros itens com indício de uso e consumo")) return "Nota com itens ligados a uso e consumo";
  if (aviso.includes("CFOP aparentemente incompatível com uso e consumo")) return "CFOP incompatível com uso e consumo";
  if (aviso.includes("CFOP aparentemente incompatível com ativo imobilizado")) return "CFOP incompatível com imobilizado";
  if (aviso.includes("CFOP aparentemente incompatível com combustível")) return "CFOP incompatível com combustível";
  if (aviso.includes("retirar o aproveitamento de crédito de ICMS")) return "Revisar crédito de ICMS";
  if (aviso.includes("aproveitamento deve ocorrer via CIAP")) return "Revisar crédito via CIAP";
  if (aviso.includes("crédito de ICMS é permitido no caso concreto")) return "Revisar crédito de combustível";
  if (aviso.includes("CFOP de uso e consumo com base/valor de ICMS")) return "Uso e consumo com possível crédito indevido";
  if (aviso.includes("CFOP de imobilizado com base/valor de ICMS")) return "Imobilizado com crédito a revisar";
  if (aviso.includes("CFOP de combustível com base/valor de ICMS")) return "Combustível com crédito a revisar";
  return aviso;
}

function ncmComecaCom(ncm: string, prefixos: string[]): string | null {
  const limpo = normalizarTexto(ncm).replace(/\D/g, "");
  if (!limpo) return null;
  const prefixo = prefixos.find((item) => limpo.startsWith(item));
  return prefixo || null;
}

function analisarDescricaoProduto(descricao: string, perfilEmpresa: PerfilEmpresa, ncm: string): AnaliseSugestao {
  const texto = descricao.toLowerCase();

  const ncmCombustivel = ncmComecaCom(ncm, NCM_TIPI_COMBUSTIVEIS);
  if (ncmCombustivel) {
    return {
      tipo: "combustivel",
      motivo: `NCM compatível com combustível (prefixo ${ncmCombustivel})`,
      confianca: "alta",
    };
  }

  const ncmUsoConsumo = ncmComecaCom(ncm, NCM_TIPI_USO_CONSUMO);
  if (ncmUsoConsumo) {
    const bloqueadoPorPerfil =
      (perfilEmpresa === "supermercado" && ["1006", "0713", "1701", "1507", "1511", "1512", "1517", "2201", "2202", "0901", "1905", "2106", "3401", "3402", "4818", "3303", "3304", "3305", "3306", "3307"].includes(ncmUsoConsumo)) ||
      (perfilEmpresa === "restaurante" && ["1006", "0713", "1701", "1507", "1511", "1512", "1517", "2201", "2202", "2203", "2204", "2205", "2206", "2208", "0901", "1905", "2101", "2106", "3924"].includes(ncmUsoConsumo));

    if (!bloqueadoPorPerfil) {
      return {
        tipo: "uso_consumo",
        motivo: `NCM compatível com item típico de uso e consumo (prefixo ${ncmUsoConsumo})`,
        confianca: "alta",
      };
    }
  }

  const ncmImobilizado = ncmComecaCom(ncm, NCM_TIPI_IMOBILIZADO);
  if (ncmImobilizado) {
    return {
      tipo: "imobilizado",
      motivo: `NCM compatível com máquina, equipamento ou eletrodoméstico (prefixo ${ncmImobilizado})`,
      confianca: "alta",
    };
  }

  const palavrasCombustivel = [
    "gasolina", "diesel", "etanol", "alcool", "álcool", "gnv", "gas", "gás", "oleo diesel", "óleo diesel", "combustivel", "combustível", "lubrificante",
  ];
  const encontrouCombustivel = palavrasCombustivel.find((palavra) => texto.includes(palavra));
  if (encontrouCombustivel) {
    return {
      tipo: "combustivel",
      motivo: `descrição contém a palavra-chave "${encontrouCombustivel}"`,
      confianca: "media",
    };
  }

  const palavrasImobilizado = [
    "máquina", "maquina", "equipamento", "compressor", "freezer", "geladeira", "balança", "balanca",
    "empilhadeira", "motor", "forno", "coifa", "exaustor", "notebook", "computador", "impressora",
    "servidor", "monitor", "scanner", "leitor", "betoneira", "andaime", "furadeira", "parafusadeira",
    "serra", "cortadora", "misturador", "microondas", "micro-ondas", "liquidificador", "batedeira",
    "fogão", "fogao", "ar condicionado",
  ];
  const encontrouImobilizado = palavrasImobilizado.find((palavra) => texto.includes(palavra));
  if (encontrouImobilizado) {
    return {
      tipo: "imobilizado",
      motivo: `descrição contém a palavra-chave "${encontrouImobilizado}"`,
      confianca: "media",
    };
  }

  const palavrasUsoConsumo = [
    "arroz", "feijão", "feijao", "açúcar", "acucar", "óleo", "oleo", "café", "cafe", "água", "agua",
    "refrigerante", "suco", "cerveja", "vinho", "whisky", "vodka", "gin", "leite", "biscoito",
    "guardanapo", "detergente", "sabão", "sabao", "desinfetante", "papel higiênico", "papel higienico",
    "copo descartável", "copo descartavel", "papel sulfite", "caneta", "lapis", "lápis", "borracha",
    "grampeador", "clips", "clip", "vassoura", "rodo", "saco de lixo", "água sanitária", "agua sanitaria",
    "produto de limpeza", "material de limpeza", "medicamento", "remedio", "remédio", "farmacia", "farmácia",
    "shampoo", "condicionador", "sabonete", "creme dental", "pasta de dente", "escova de dente", "higiene pessoal",
    "absorvente", "fralda", "papel toalha", "alcool em gel", "álcool em gel", "protetor solar", "hidratante",
    "desodorante", "lenço umedecido", "lenco umedecido", "algodão", "algodao", "curativo", "gaze", "esparadrapo",
  ];
  const encontrouUsoConsumo = palavrasUsoConsumo.find((palavra) => texto.includes(palavra));
  if (!encontrouUsoConsumo) {
    return { tipo: null, motivo: "", confianca: null };
  }

  const excecoesSupermercado = [
    "arroz", "feijão", "feijao", "açúcar", "acucar", "óleo", "oleo", "café", "cafe", "água", "agua",
    "refrigerante", "suco", "cerveja", "vinho", "leite", "biscoito", "detergente", "sabão", "sabao",
    "desinfetante", "papel higienico", "papel higiênico", "shampoo", "condicionador", "sabonete", "creme dental",
    "pasta de dente", "desodorante", "absorvente", "fralda", "papel toalha", "protetor solar", "hidratante",
  ];
  if (perfilEmpresa === "supermercado" && excecoesSupermercado.some((palavra) => texto.includes(palavra))) {
    return { tipo: null, motivo: "", confianca: null };
  }

  const excecoesRestaurante = [
    "arroz", "feijão", "feijao", "açúcar", "acucar", "óleo", "oleo", "café", "cafe", "água", "agua",
    "refrigerante", "suco", "cerveja", "vinho", "whisky", "vodka", "gin", "leite", "guardanapo",
    "embalagem", "descartável", "descartavel",
  ];
  if (perfilEmpresa === "restaurante" && excecoesRestaurante.some((palavra) => texto.includes(palavra))) {
    return { tipo: null, motivo: "", confianca: null };
  }

  return {
    tipo: "uso_consumo",
    motivo: `descrição contém a palavra-chave "${encontrouUsoConsumo}"`,
    confianca: "media",
  };
}

function validarItem(item: Omit<LinhaEntrada, "status" | "avisos">): { status: StatusValidacao; avisos: string[] } {
  const alertas: string[] = [];
  const cfop = normalizarCFOP(item.cfop);
  const familia = classificarFamiliaCFOP(cfop);
  const temCreditoICMS = item.base_icms > 0 || item.valor_icms > 0;

  if (item.sugestao.tipo === "uso_consumo") {
    alertas.push(`Possível uso e consumo: ${item.sugestao.motivo}.`);
    if (!cfopEhUsoConsumo(cfop)) {
      alertas.push("CFOP aparentemente incompatível com uso e consumo. Verifique se o lançamento está em CFOP próprio de uso e consumo, inclusive nas hipóteses de mercadoria importada ou produto industrializado.");
    }
    if (temCreditoICMS) {
      alertas.push("O item sugerido como uso e consumo apresenta base/valor de ICMS. Verificar necessidade de retirar o aproveitamento de crédito de ICMS.");
    }
  }

  if (item.sugestao.tipo === "imobilizado") {
    alertas.push(`Possível imobilizado: ${item.sugestao.motivo}.`);
    if (!cfopEhImobilizado(cfop)) {
      alertas.push("CFOP aparentemente incompatível com ativo imobilizado. Verifique se o lançamento está em CFOP próprio de imobilizado, inclusive nas hipóteses de mercadoria importada ou produto industrializado.");
    }
    if (temCreditoICMS) {
      alertas.push("O item sugerido como imobilizado apresenta base/valor de ICMS. Verificar se o tratamento do crédito está correto e se o aproveitamento deve ocorrer via CIAP.");
    }
  }

  if (item.sugestao.tipo === "combustivel") {
    alertas.push(`Possível combustível: ${item.sugestao.motivo}.`);
    if (!cfopEhCombustivel(cfop)) {
      alertas.push("CFOP aparentemente incompatível com combustível. Verifique se o lançamento está em CFOP próprio de combustível/lubrificante.");
    }
    if (temCreditoICMS) {
      alertas.push("O item sugerido como combustível apresenta base/valor de ICMS. Revisar se o crédito de ICMS é permitido no caso concreto.");
    }
  }

  if (item.sugestao.tipo === null && familia === "uso_consumo" && temCreditoICMS) {
    alertas.push("CFOP de uso e consumo com base/valor de ICMS. Verifique se houve aproveitamento indevido de crédito.");
  }
  if (item.sugestao.tipo === null && familia === "imobilizado" && temCreditoICMS) {
    alertas.push("CFOP de imobilizado com base/valor de ICMS. Verifique se o tratamento do crédito está correto e se o aproveitamento deve ocorrer via CIAP.");
  }
  if (item.sugestao.tipo === null && cfopEhCombustivel(cfop) && temCreditoICMS) {
    alertas.push("CFOP de combustível com base/valor de ICMS. Revisar se o crédito é permitido no caso concreto.");
  }

  return {
    status: alertas.length ? "ALERTA" : "OK",
    avisos: alertas.length ? alertas : ["Sem inconsistências iniciais."],
  };
}

function parseSpedFiscal(conteudo: string): LinhaEntrada[] {
  const linhasArquivo = conteudo.split(/\r?\n/).filter(Boolean);
  const cadastro0200 = new Map<string, Item0200>();
  const participantes0150 = new Map<string, Participante0150>();

  let notaAtual: {
    numero_nota: string;
    fornecedor: string;
  } | null = null;

  const itens: LinhaEntrada[] = [];

  for (const linha of linhasArquivo) {
    const partes = linha.split("|");
    const registro = partes[1];

    if (!registro) continue;

    if (registro === "0150") {
      const codPart = extrairCampo(partes, 2);
      const nome = extrairCampo(partes, 3);
      if (codPart) participantes0150.set(codPart, { nome });
      continue;
    }

    if (registro === "0200") {
      const codItem = extrairCampo(partes, 2);
      const descricao = extrairCampo(partes, 3);
      const ncm = extrairCampo(partes, 8);
      if (codItem) cadastro0200.set(codItem, { descricao, ncm });
      continue;
    }

    if (registro === "C100") {
      const indOper = extrairCampo(partes, 2);
      const codPart = extrairCampo(partes, 4);
      const numDoc = extrairCampo(partes, 8) || extrairCampo(partes, 7);

      if (indOper === "0") {
        notaAtual = {
          numero_nota: numDoc || "Sem número",
          fornecedor: participantes0150.get(codPart)?.nome || codPart || "Fornecedor não localizado",
        };
      } else {
        notaAtual = null;
      }
      continue;
    }

    if (registro === "C170" && notaAtual) {
      const codItem = extrairCampo(partes, 3) || extrairCampo(partes, 4);
      const descricaoItem = extrairCampo(partes, 5) || extrairCampo(partes, 4);
      const valorItem = normalizarNumero(partes[7] ?? partes[8]);
      const cfop = normalizarCFOP(partes[11] ?? partes[12]);
      const baseICMS = normalizarNumero(partes[13] ?? partes[14]);
      const valorICMS = normalizarNumero(partes[15] ?? partes[14]);

      const item0200 = cadastro0200.get(codItem);
      const descricaoFinal = item0200?.descricao || descricaoItem || codItem || "Descrição não localizada";
      const ncmFinal = item0200?.ncm || "";

      const base = {
        id: gerarId(),
        numero_nota: notaAtual.numero_nota,
        fornecedor: notaAtual.fornecedor,
        data: "",
        ncm: ncmFinal,
        descricao: descricaoFinal,
        cfop,
        valor_contabil: valorItem,
        base_icms: baseICMS,
        valor_icms: valorICMS,
        sugestao: { tipo: null, motivo: "", confianca: null } as AnaliseSugestao,
      };

      const resultado = validarItem(base);
      itens.push({
        ...base,
        status: resultado.status,
        avisos: resultado.avisos,
      });
    }
  }

  return itens;
}

function aplicarRegraNotaComUsoConsumo(linhasBase: LinhaEntrada[]): LinhaEntrada[] {
  const notasComUsoConsumo = new Set(
    linhasBase.filter((linha) => linha.sugestao.tipo === "uso_consumo").map((linha) => linha.numero_nota)
  );

  return linhasBase.map((linha) => {
    if (!notasComUsoConsumo.has(linha.numero_nota)) return linha;

    const avisos = [...linha.avisos];

    if (linha.sugestao.tipo !== "uso_consumo") {
      if (!avisos.includes("Provável uso e consumo por vínculo com a nota.")) {
        avisos.unshift("Provável uso e consumo por vínculo com a nota.");
      }
      return {
        ...linha,
        sugestao: {
          tipo: "uso_consumo",
          motivo: "outro item da mesma nota foi identificado como possível uso e consumo",
          confianca: "baixa",
        },
        status: "ALERTA",
        avisos,
      };
    }

    if (!avisos.includes("Nota contém outros itens com indício de uso e consumo.")) {
      avisos.unshift("Nota contém outros itens com indício de uso e consumo.");
    }

    return {
      ...linha,
      avisos,
    };
  });
}

function agruparNotas(linhasBase: LinhaEntrada[]): NotaAgrupada[] {
  const mapa = new Map<string, NotaAgrupada>();

  for (const linha of linhasBase) {
    const chave = `${linha.numero_nota}__${linha.fornecedor}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        numero_nota: linha.numero_nota,
        fornecedor: linha.fornecedor,
        total_itens: 0,
        total_contabil: 0,
        total_base_icms: 0,
        total_valor_icms: 0,
        status: "OK",
        itens: [],
        sugestoes: [],
        avisos: [],
      });
    }

    const grupo = mapa.get(chave)!;
    grupo.total_itens += 1;
    grupo.total_contabil += linha.valor_contabil;
    grupo.total_base_icms += linha.base_icms;
    grupo.total_valor_icms += linha.valor_icms;
    grupo.itens.push(linha);

    if (linha.status === "ALERTA") {
      grupo.status = "ALERTA";
    }

    if (linha.sugestao.tipo) {
      const texto =
        linha.sugestao.tipo === "uso_consumo"
          ? "Possível uso e consumo"
          : linha.sugestao.tipo === "imobilizado"
          ? "Possível imobilizado"
          : "Possível combustível";
      if (!grupo.sugestoes.includes(texto)) {
        grupo.sugestoes.push(texto);
      }
    }

    const avisosResumidos = linha.avisos.map(resumirAviso);
    for (const aviso of avisosResumidos) {
      if (!grupo.avisos.includes(aviso)) {
        grupo.avisos.push(aviso);
      }
    }
  }

  return Array.from(mapa.values());
}

export default function ValidadorEntradasPage() {
  const [linhas, setLinhas] = useState<LinhaEntrada[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [erroImportacao, setErroImportacao] = useState<string>("");
  const [perfilEmpresa, setPerfilEmpresa] = useState<PerfilEmpresa>("geral");
  const [filtros, setFiltros] = useState<Filtros>({
    somenteAlertas: false,
    cfop: "",
    ncm: "",
    busca: "",
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  function reprocessarLinhas(linhasBase: LinhaEntrada[], perfil: PerfilEmpresa) {
    const processadas = linhasBase.map((linha) => {
      const sugestao = analisarDescricaoProduto(linha.descricao, perfil, linha.ncm);
      const baseAtualizada = { ...linha, sugestao };
      const resultado = validarItem(baseAtualizada);
      return {
        ...baseAtualizada,
        status: resultado.status,
        avisos: resultado.avisos,
      };
    });

    return aplicarRegraNotaComUsoConsumo(processadas);
  }

  async function importarArquivoSped(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setErroImportacao("");
    setNomeArquivo(arquivo.name);

    try {
      const conteudo = await arquivo.text();
      const itensOriginais = parseSpedFiscal(conteudo);
      const itens = reprocessarLinhas(itensOriginais, perfilEmpresa);

      if (!itensOriginais.length) {
        setLinhas([]);
        setErroImportacao("Nenhum item de entrada foi encontrado no SPED. Verifique se o arquivo contém registros C100/C170 de entradas.");
        return;
      }

      setLinhas(itens);
    } catch (error) {
      console.error(error);
      setLinhas([]);
      setErroImportacao("Não foi possível ler o arquivo SPED. Verifique se o arquivo está em formato .txt.");
    }
  }

  function limparTudo() {
    setLinhas([]);
    setNomeArquivo("");
    setErroImportacao("");
    setPerfilEmpresa("geral");
    setFiltros({
      somenteAlertas: false,
      cfop: "",
      ncm: "",
      busca: "",
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function alterarPerfilEmpresa(novoPerfil: PerfilEmpresa) {
    setPerfilEmpresa(novoPerfil);
    setLinhas((anterior) => reprocessarLinhas(anterior, novoPerfil));
  }

  const linhasFiltradas = useMemo(() => {
    return linhas.filter((linha) => {
      if (filtros.somenteAlertas && linha.status !== "ALERTA") return false;
      if (filtros.cfop && !linha.cfop.includes(filtros.cfop.replace(/\D/g, ""))) return false;
      if (filtros.ncm && !linha.ncm.toLowerCase().includes(filtros.ncm.toLowerCase())) return false;

      if (filtros.busca) {
        const texto = `${linha.numero_nota} ${linha.fornecedor} ${linha.descricao} ${linha.ncm} ${linha.cfop}`.toLowerCase();
        if (!texto.includes(filtros.busca.toLowerCase())) return false;
      }

      return true;
    });
  }, [linhas, filtros]);

  const resumo = useMemo(() => {
    const totalNotas = new Set(linhas.map((linha) => `${linha.numero_nota}__${linha.fornecedor}`)).size;
    const notasComAlerta = new Set(
      linhas.filter((linha) => linha.status === "ALERTA").map((linha) => `${linha.numero_nota}__${linha.fornecedor}`)
    ).size;
    const notasOk = totalNotas - notasComAlerta;
    const totalItens = linhas.length;
    const itensComAlerta = linhas.filter((linha) => linha.status === "ALERTA").length;
    const itensOk = totalItens - itensComAlerta;
    return { totalNotas, notasComAlerta, notasOk, totalItens, itensComAlerta, itensOk };
  }, [linhas]);

  const notasFiltradas = useMemo(() => {
    const notas = agruparNotas(linhasFiltradas);
    if (!filtros.somenteAlertas) return notas;
    return notas.filter((nota) => nota.status === "ALERTA");
  }, [linhasFiltradas, filtros.somenteAlertas]);

  function exportarRelatorio() {
    if (!notasFiltradas.length) return;

    const dadosNotas = notasFiltradas.flatMap((nota) => {
      const cfopMap = new Map<string, { valor_contabil: number; base_icms: number; valor_icms: number }>();

      for (const item of nota.itens) {
        const chaveCfop = item.cfop || "SEM CFOP";
        if (!cfopMap.has(chaveCfop)) {
          cfopMap.set(chaveCfop, { valor_contabil: 0, base_icms: 0, valor_icms: 0 });
        }
        const acum = cfopMap.get(chaveCfop)!;
        acum.valor_contabil += item.valor_contabil;
        acum.base_icms += item.base_icms;
        acum.valor_icms += item.valor_icms;
      }

      const linhasCfop = Array.from(cfopMap.entries());

      return linhasCfop.map(([cfop, valores], index) => ({
        numero_nota: index === 0 ? nota.numero_nota : "",
        fornecedor: index === 0 ? nota.fornecedor : "",
        total_itens: index === 0 ? nota.total_itens : "",
        valor_contabil_total: index === 0 ? nota.total_contabil : "",
        base_icms_total: index === 0 ? nota.total_base_icms : "",
        valor_icms_total: index === 0 ? nota.total_valor_icms : "",
        cfop: cfop,
        valor_contabil_cfop: valores.valor_contabil,
        base_icms_cfop: valores.base_icms,
        valor_icms_cfop: valores.valor_icms,
        sugestoes_nota: index === 0 ? nota.sugestoes.join(" | ") : "",
        status: index === 0 ? nota.status : "",
        avisos_nota: index === 0 ? nota.avisos.join(" | ") : "",
      }));
    });

    const dadosItens = notasFiltradas.flatMap((nota) =>
      nota.itens.map((linha) => ({
        numero_nota: nota.numero_nota,
        fornecedor: nota.fornecedor,
        descricao: linha.descricao,
        ncm: linha.ncm,
        cfop: linha.cfop,
        valor_contabil: linha.valor_contabil,
        base_icms: linha.base_icms,
        valor_icms: linha.valor_icms,
        sugestao_item: linha.sugestao.tipo
          ? `${
              linha.sugestao.tipo === "uso_consumo"
                ? "Possível uso e consumo"
                : linha.sugestao.tipo === "imobilizado"
                ? "Possível imobilizado"
                : "Possível combustível"
            } - ${linha.sugestao.motivo}`
          : "",
        confianca_item: linha.sugestao.confianca || "",
        status_item: linha.status,
        avisos_item: Array.from(new Set(linha.avisos.map(resumirAviso))).join(" | "),
      }))
    );

    const workbook = XLSX.utils.book_new();
    const worksheetNotas = XLSX.utils.json_to_sheet(dadosNotas);
    const worksheetItens = XLSX.utils.json_to_sheet(dadosItens);

    XLSX.utils.book_append_sheet(workbook, worksheetNotas, "Notas");
    XLSX.utils.book_append_sheet(workbook, worksheetItens, "Itens");
    XLSX.writeFile(workbook, "relatorio-validacao-entradas.xlsx");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Versão Beta 1.5
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Validador Fiscal de Entradas</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
                Importe o arquivo SPED Fiscal e analise os alertas agrupados por nota fiscal. Ao abrir a nota, você verá os itens vinculados a ela.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90">
                <Upload className="h-4 w-4" />
                Upload do SPED
                <input ref={inputRef} type="file" accept=".txt" className="hidden" onChange={importarArquivoSped} />
              </label>

              <button
                type="button"
                onClick={exportarRelatorio}
                disabled={!notasFiltradas.length}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Exportar relatório
              </button>

              <button
                type="button"
                onClick={limparTudo}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Limpar
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total de notas</p>
              <p className="mt-1 text-2xl font-bold">{resumo.totalNotas}</p>
              <p className="mt-2 text-xs text-slate-500">Itens: {resumo.totalItens}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Notas OK</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{resumo.notasOk}</p>
              <p className="mt-2 text-xs text-emerald-700/80">Itens OK: {resumo.itensOk}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-700">Notas com alerta</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{resumo.notasComAlerta}</p>
              <p className="mt-2 text-xs text-amber-700/80">Itens com alerta: {resumo.itensComAlerta}</p>
            </div>
          </div>

          {nomeArquivo && (
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <FileText className="h-4 w-4" />
              Arquivo carregado: <span className="font-semibold text-slate-800">{nomeArquivo}</span>
            </div>
          )}

          {erroImportacao && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroImportacao}</div>}
        </div>

        <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm xl:col-span-2">
              <span className="font-medium text-slate-700">Perfil da empresa para leitura das palavras-chave</span>
              <select
                value={perfilEmpresa}
                onChange={(e) => alterarPerfilEmpresa(e.target.value as PerfilEmpresa)}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
              >
                {Object.entries(PERFIS_EMPRESA_LABEL).map(([valor, label]) => (
                  <option key={valor} value={valor}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 xl:col-span-2">
              A visão principal está agrupada por <strong>nota fiscal</strong>. Os <strong>alertas e sugestões</strong> são consolidados por nota, e os itens aparecem apenas ao abrir cada nota.
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h2 className="text-lg font-semibold">Filtros</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">Buscar</span>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={filtros.busca}
                  onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
                  placeholder="Nota, fornecedor, descrição..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">CFOP</span>
              <input
                value={filtros.cfop}
                onChange={(e) => setFiltros((f) => ({ ...f, cfop: e.target.value }))}
                placeholder="Ex.: 1556"
                className="rounded-2xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">NCM</span>
              <input
                value={filtros.ncm}
                onChange={(e) => setFiltros((f) => ({ ...f, ncm: e.target.value }))}
                placeholder="Ex.: 8471"
                className="rounded-2xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
              />
            </label>

            <label className="flex items-end">
              <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3">
                <input
                  id="somente-alertas"
                  type="checkbox"
                  checked={filtros.somenteAlertas}
                  onChange={(e) => setFiltros((f) => ({ ...f, somenteAlertas: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="somente-alertas" className="text-sm font-medium text-slate-700">
                  Mostrar apenas alertas
                </label>
              </div>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Nota</th>
                  <th className="px-3 py-3 font-semibold">Fornecedor</th>
                  <th className="px-3 py-3 font-semibold">Qtd. itens</th>
                  <th className="px-3 py-3 font-semibold">Valor contábil</th>
                  <th className="px-3 py-3 font-semibold">Base ICMS</th>
                  <th className="px-3 py-3 font-semibold">Valor ICMS</th>
                  <th className="px-3 py-3 font-semibold">Sugestões da nota</th>
                  <th className="px-3 py-3 font-semibold">Alertas da nota</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {!notasFiltradas.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-500">
                      Importe um arquivo SPED para começar a análise.
                    </td>
                  </tr>
                ) : (
                  notasFiltradas.map((nota) => {
                    const notaOk = nota.status === "OK";
                    return (
                      <React.Fragment key={nota.chave}>
                        <tr className={notaOk ? "border-t border-slate-200 bg-emerald-50/30" : "border-t border-slate-200 bg-amber-50/40"}>
                          <td className="px-3 py-3 align-top text-xs font-semibold">{nota.numero_nota || "-"}</td>
                          <td className="max-w-[260px] px-3 py-3 align-top text-xs leading-5">{nota.fornecedor || "-"}</td>
                          <td className="px-3 py-3 align-top text-xs">{nota.total_itens}</td>
                          <td className="px-3 py-3 align-top text-xs">{formatarMoeda(nota.total_contabil)}</td>
                          <td className="px-3 py-3 align-top text-xs">{formatarMoeda(nota.total_base_icms)}</td>
                          <td className="px-3 py-3 align-top text-xs">{formatarMoeda(nota.total_valor_icms)}</td>
                          <td className="px-3 py-3 align-top">
                            {nota.sugestoes.length ? (
                              <div className="flex flex-col gap-1.5">
                                {nota.sugestoes.map((sugestao, index) => (
                                  <span key={index} className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                                    {sugestao}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Sem sugestão</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {nota.avisos.length ? (
                              <div className="flex flex-col gap-1.5">
                                {nota.avisos.map((aviso, index) => (
                                  <span key={index} className="inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                                    {aviso}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Sem alerta</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span
                              className={notaOk
                                ? "inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                                : "inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"}
                            >
                              {notaOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                              {nota.status}
                            </span>
                          </td>
                        </tr>
                        <tr className="border-t border-slate-100 bg-white">
                          <td colSpan={9} className="px-3 py-3">
                            <details className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                              <summary className="cursor-pointer text-xs font-medium text-slate-700">Abrir itens da nota</summary>
                              <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full border-collapse text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-slate-600">
                                      <th className="px-2 py-2 font-semibold">Descrição do produto</th>
                                      <th className="px-2 py-2 font-semibold">NCM</th>
                                      <th className="px-2 py-2 font-semibold">CFOP</th>
                                      <th className="px-2 py-2 font-semibold">Valor contábil</th>
                                      <th className="px-2 py-2 font-semibold">Base ICMS</th>
                                      <th className="px-2 py-2 font-semibold">Valor ICMS</th>
                                      <th className="px-2 py-2 font-semibold">Sugestão do item</th>
                                      <th className="px-2 py-2 font-semibold">Avisos do item</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {nota.itens.map((linha) => (
                                      <tr key={linha.id} className="border-t border-slate-100 align-top">
                                        <td className="max-w-[260px] px-2 py-2 leading-5">{linha.descricao || "-"}</td>
                                        <td className="px-2 py-2">{linha.ncm || "-"}</td>
                                        <td className="px-2 py-2">{linha.cfop || "-"}</td>
                                        <td className="px-2 py-2">{formatarMoeda(linha.valor_contabil)}</td>
                                        <td className="px-2 py-2">{formatarMoeda(linha.base_icms)}</td>
                                        <td className="px-2 py-2">{formatarMoeda(linha.valor_icms)}</td>
                                        <td className="px-2 py-2">
                                          {linha.sugestao.tipo ? (
                                            <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] leading-5 text-slate-700 ring-1 ring-slate-200">
                                              <div className="font-semibold text-slate-800">
                                                {linha.sugestao.tipo === "uso_consumo"
                                                  ? "Possível uso e consumo"
                                                  : linha.sugestao.tipo === "imobilizado"
                                                  ? "Possível imobilizado"
                                                  : "Possível combustível"}
                                              </div>
                                              <div>{linha.sugestao.motivo}</div>
                                              <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Confiança {linha.sugestao.confianca || "-"}</div>
                                            </div>
                                          ) : (
                                            <span className="text-slate-500">Sem sugestão</span>
                                          )}
                                        </td>
                                        <td className="min-w-[220px] px-2 py-2">
                                          <ul className="space-y-1.5">
                                            {linha.avisos.map((aviso, index) => (
                                              <li key={index} className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">
                                                {resumirAviso(aviso)}
                                              </li>
                                            ))}
                                          </ul>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
