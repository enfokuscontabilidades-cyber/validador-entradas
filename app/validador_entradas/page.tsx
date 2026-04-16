"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Upload, AlertTriangle, CheckCircle2, Search, Download,
  Filter, Trash2, FileText, FileX, ChevronDown, ChevronRight,
  Tag, ArrowUpRight, ArrowDownLeft, Info,
} from "lucide-react";
import * as XLSX from "xlsx";

// ══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════════════════════

type StatusValidacao = "OK" | "ALERTA";
type PerfilEmpresa = "geral" | "supermercado" | "restaurante" | "construcao";
type ClassificacaoManual =
  | "revenda" | "insumo" | "uso_consumo" | "imobilizado" | "combustivel"
  | "desconhece" | "nao_recebido" | "servico" | null;

type AnaliseSugestao = {
  tipo: "uso_consumo" | "imobilizado" | "combustivel" | null;
  motivo: string;
  confianca: "alta" | "media" | "baixa" | null;
};

type DadosEmpresa = {
  nome: string; cnpj: string; ie: string; uf: string;
  periodoInicial: string; periodoFinal: string;
  ehIndustrial: boolean; // IND_ATIV=0 no registro 0000
};

type LinhaEntrada = {
  id: string;
  numero_nota: string; fornecedor: string; data: string;
  codigo_produto: string; cst_icms: string; ncm: string;
  descricao: string; cfop: string;
  valor_contabil: number; base_icms: number; aliquota_icms: number; valor_icms: number;
  // Composição do valor contábil (rateio de frete/desconto/despesas/IPI)
  valor_produto: number;       // vProd original sem rateio
  valor_desconto: number;      // desconto rateado
  valor_frete: number;         // frete rateado
  valor_despesas: number;      // outras despesas rateadas
  valor_ipi_item: number;      // IPI do item
  valor_total_nota?: number;   // total da nota (para referência)
  status: StatusValidacao; avisos: string[];
  sugestao: AnaliseSugestao; classificacao: ClassificacaoManual;
  fonte: "sped" | "xml" | "c190" | "xml_proprio";
  cancelada?: boolean;
};

type LinhaSaida = {
  id: string;
  numero_nota: string; destinatario: string; data: string;
  codigo_produto: string; descricao: string; ncm: string; cfop: string;
  cst_icms: string; cst_pis: string; cst_cofins: string;
  valor_contabil: number;
  valor_produto: number;    // vProd original
  valor_desconto: number;   // desconto rateado
  valor_frete: number;      // frete rateado
  valor_despesas: number;   // outras despesas rateadas
  valor_ipi_item: number;   // IPI do item
  base_icms: number; aliquota_icms: number; valor_icms: number;
  base_st: number; valor_st: number; valor_ipi: number;
  base_pis: number; aliquota_pis: number; valor_pis: number;
  base_cofins: number; aliquota_cofins: number; valor_cofins: number;
  valor_ibs: number; valor_cbs: number;
  cbenef: string; cbenef_descricao: string;
  alertas_saida: string[]; status: StatusValidacao;
  cancelada?: boolean;
};

// Nota de saída agrupada
type NotaSaida = {
  chave: string; numero_nota: string; destinatario: string; data: string;
  total_itens: number; total_contabil: number;
  total_icms: number; total_pis: number; total_cofins: number;
  total_ibs: number; total_cbs: number;
  status: StatusValidacao; itens: LinhaSaida[];
  tem_cbenef: boolean; alertas: string[];
};

type Filtros = {
  somenteAlertas: boolean; cfop: string; ncm: string; busca: string; classificacao: string;
};

type Item0200 = { descricao: string; ncm: string };
type Participante0150 = { nome: string };

type NotaEntrada = {
  chave: string; numero_nota: string; fornecedor: string; data: string;
  total_itens: number; total_contabil: number; total_base_icms: number; total_valor_icms: number;
  status: StatusValidacao; itens: LinhaEntrada[]; sugestoes: string[]; avisos: string[];
  classificacaoPredominante: ClassificacaoManual;
};

// ══════════════════════════════════════════════════════════════════════════════
// TABELA CBenef — Goiás (IN 1518/2022-GSE)
// ══════════════════════════════════════════════════════════════════════════════

const CBENEF_GO: Record<string, string> = {
  "GO800001":"NÃO INCIDÊNCIA - Exportação de mercadoria ao exterior",
  "GO800002":"NÃO INCIDÊNCIA - Petróleo/combustível/energia elétrica para outro Estado (comercialização/industrialização)",
  "GO800003":"NÃO INCIDÊNCIA - Ouro como ativo financeiro ou instrumento cambial",
  "GO800004":"NÃO INCIDÊNCIA - Livro, jornal, periódico e papel para impressão",
  "GO800005":"NÃO INCIDÊNCIA - Mercadoria sujeita ao ISS dos municípios",
  "GO800006":"NÃO INCIDÊNCIA - Remessa a sucessor legal sem saída física",
  "GO800007":"NÃO INCIDÊNCIA - Alienação fiduciária em garantia",
  "GO800008":"NÃO INCIDÊNCIA - Arrendamento mercantil (exceto venda do bem ao arrendatário)",
  "GO800012":"NÃO INCIDÊNCIA - Alienação de ativo imobilizado",
  "GO800013":"NÃO INCIDÊNCIA - Saída de bem em comodato",
  "GO800016":"NÃO INCIDÊNCIA - Saída interna para industrialização ou outro tratamento",
  "GO800021":"NÃO INCIDÊNCIA - Saída para demonstração (inclusive a consumidor final)",
  "GO800022":"NÃO INCIDÊNCIA - Saída para mostruário ou treinamento",
  "GO811001":"ISENÇÃO - Saída para exposição ou feira de amostra",
  "GO811004":"ISENÇÃO - Fornecimento de refeição sem finalidade lucrativa",
  "GO811010":"ISENÇÃO - Hortifrutícola, pintos de um dia, ovos em estado natural",
  "GO811015":"ISENÇÃO - Saída interna varejista de leite pasteurizado tipo especial",
  "GO811020":"ISENÇÃO - Energia elétrica residencial até 50 KW/h mensais",
  "GO811021":"ISENÇÃO - Transporte urbano/metropolitano com tarifa reduzida",
  "GO811024":"ISENÇÃO - Transporte rodoviário de passageiro por táxi",
  "GO811026":"ISENÇÃO - Amostra de produto de diminuto valor comercial",
  "GO811053":"ISENÇÃO - Mercadoria da cesta básica (saída interna)",
  "GO811064":"ISENÇÃO - Equipamentos/acessórios para portadores de deficiência física",
  "GO811082":"ISENÇÃO - Operação/prestação internas para Administração Pública Estadual Direta",
  "GO811128":"ISENÇÃO - Etanol anidro combustível para armazenagem dutoviária",
  "GO811130":"ISENÇÃO - Gorjeta em bares/restaurantes/hotéis",
  "GO811131":"ISENÇÃO - Energia elétrica pelo sistema de compensação (geração distribuída)",
  "GO811133":"ISENÇÃO - Produtos para geração de energia solar (operação interna)",
  "GO821001":"REDUÇÃO DE BASE - Saída de mercadoria usada cuja entrada não foi onerada pelo ICMS",
  "GO821002":"REDUÇÃO DE BASE - Saída interna de leite pasteurizado tipo especial",
  "GO821003":"REDUÇÃO DE BASE - Saída tributada interna de GLP",
  "GO821005":"REDUÇÃO DE BASE - Saída interna para comercialização, produção ou industrialização",
  "GO821007":"REDUÇÃO DE BASE - Fornecimento de refeições por bares, restaurantes e similares",
  "GO821008":"REDUÇÃO DE BASE - Produto de informática, telecomunicação ou automação (saída interna)",
  "GO821010":"REDUÇÃO DE BASE - Arroz e feijão industrializados em GO",
  "GO821011":"REDUÇÃO DE BASE - Areia natural/artificial, saibro, material britado (operação interna)",
  "GO821017":"REDUÇÃO DE BASE - Bem para ativo imobilizado de estabelecimento industrial ou agropecuário",
  "GO821019":"REDUÇÃO DE BASE - Mercadorias da cesta básica (operação interna)",
  "GO821025":"REDUÇÃO DE BASE - Saída interestadual de carnes e comestíveis de abate bovino/suíno",
  "SEM CBENEF":"Item sem benefício fiscal (CST/situação exige informação do cBenef)",
};

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════════════════════

const PERFIS_EMPRESA_LABEL: Record<PerfilEmpresa, string> = {
  geral:"Empresa geral", supermercado:"Supermercado",
  restaurante:"Bar / Restaurante", construcao:"Construção civil",
};

const CLASSIFICACAO_LABEL: Record<NonNullable<ClassificacaoManual>, string> = {
  revenda:"Revenda", insumo:"Insumo", uso_consumo:"Uso e Consumo", imobilizado:"Imobilizado",
  combustivel:"Combustível", desconhece:"Desconhece NF",
  nao_recebido:"Não recebido no mês", servico:"Serviço",
};

const CLASSIFICACAO_COR: Record<NonNullable<ClassificacaoManual>, string> = {
  revenda:"#34d399", insumo:"#4ade80", uso_consumo:"#fb923c", imobilizado:"#a78bfa",
  combustivel:"#f472b6", desconhece:"#ef4444", nao_recebido:"#facc15", servico:"#60a5fa",
};

const NCM_UC = ["1006","0713","1701","1507","1511","1512","1517","2201","2202","2203","2204","2205","2206","2207","2208","0901","0902","1905","2101","2106","3003","3004","3005","3303","3304","3305","3306","3307","3401","3402","3808","3924","4818","4823","9603","9608"];
const NCM_IMOB = ["7321","8210","8414","8415","8418","8421","8422","8428","8436","8450","8467","8470","8471","8472","8479","8508","8509","8516","8517","8518","8528","8539","8709","8716","9018","9403","9405"];
const NCM_COMB = ["2710","2711","220710","220720","382600"];

// ══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════════════════

function gid() { return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
function ntx(v: unknown) { return v==null?"":String(v).trim(); }
function ncfop(v: unknown) { return ntx(v).replace(/\D/g,"").slice(0,4); }
// Para valores do SPED (formato pt-BR: ponto=milhar, vírgula=decimal)
function nnum(v: unknown): number {
  if (v==null||v==="") return 0;
  if (typeof v==="number") return Number.isFinite(v)?v:0;
  const n=Number(String(v).trim().replace(/R\$/gi,"").replace(/\s/g,"").replace(/\./g,"").replace(/,/g,"."));
  return Number.isFinite(n)?n:0;
}
// Para valores do XML NF-e (formato XML/americano: ponto=decimal, sem separador de milhar)
function nnumXml(v: unknown): number {
  if (v==null||v==="") return 0;
  if (typeof v==="number") return Number.isFinite(v)?v:0;
  // XML da NF-e sempre usa ponto como decimal (ex: "1234.56", "310592.72")
  // Não tem separador de milhar, então só limpa espaços e símbolos
  const s=String(v).trim().replace(/R\$/gi,"").replace(/\s/g,"");
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}
function fmoe(v: number) { return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0); }
function fperc(v: number) { return `${(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`; }
function fc(p: string[], i: number) { return ntx(p[i]??""); }
function fdata(v: string) {
  const l=ntx(v).replace(/\D/g,"");
  if (l.length!==8) return ntx(v);
  return `${l.slice(0,2)}/${l.slice(2,4)}/${l.slice(4,8)}`;
}
function fcnpj(v: string) {
  const l=ntx(v).replace(/\D/g,"");
  if (l.length!==14) return v;
  return `${l.slice(0,2)}.${l.slice(2,5)}.${l.slice(5,8)}/${l.slice(8,12)}-${l.slice(12,14)}`;
}
function ncm2(ncm: string, lst: string[]) {
  const l=ntx(ncm).replace(/\D/g,"");
  return l?(lst.find(p=>l.startsWith(p))||null):null;
}

// Helper: pega o texto do primeiro elemento filho com esse localName dentro do nó
function tagTxt(node: Element|null|undefined, tagName: string): string {
  if (!node) return "";
  // Busca direta sem namespace (funciona com e sem namespace no DOMParser)
  const found = node.getElementsByTagName(tagName)[0];
  return found?.textContent?.trim()||"";
}

// ══════════════════════════════════════════════════════════════════════════════
// CFOP
// ══════════════════════════════════════════════════════════════════════════════

// Descrição resumida do CFOP para exibição no resumo
const DESC_CFOP: Record<string,string> = {
  "1101":"Compra para industrialização","1102":"Compra para comercialização",
  "1111":"Compra para industrialização de prod. sob encomenda","1116":"Compra para uso e consumo",
  "1117":"Compra para ativo imobilizado","1118":"Compra de embalagem",
  "1120":"Compra para industrialização em zona franca",
  "1122":"Compra para comercialização em zona franca",
  "1201":"Devolução de venda de prod. industrializado",
  "1202":"Devolução de venda de mercadoria",
  "1401":"Compra de combustível","1403":"Compra p/ comercialização de combustível",
  "1556":"Compra de material de uso e consumo","1551":"Compra de bem para ativo imobilizado",
  "1553":"Compra de embalagem p/ ativo imobilizado","1603":"Importação de combustível",
  "2101":"Compra para industrialização (interestadual)","2102":"Compra para comercialização (interestadual)",
  "2111":"Compra para industrialização de prod. sob encomenda (interestadual)",
  "2116":"Compra para uso e consumo (interestadual)","2117":"Compra para ativo imobilizado (interestadual)",
  "2122":"Compra para comercialização em zona franca (interestadual)",
  "2201":"Devolução de venda interestadual (ind.)","2202":"Devolução de venda interestadual (com.)",
  "2401":"Compra de combustível (interestadual)",
  "2556":"Compra de material de uso e consumo (interestadual)",
  "2551":"Compra de bem para ativo imobilizado (interestadual)",
  "3101":"Importação para industrialização","3102":"Importação para comercialização",
  "3556":"Importação de material de uso e consumo","3551":"Importação de bem para ativo imobilizado",
  "5101":"Venda de prod. industrializado","5102":"Venda de mercadoria adquirida para comercialização",
  "5103":"Venda de prod. industrializado utilizado no processo produtivo",
  "5104":"Venda de mercadoria utilizada no processo produtivo",
  "5116":"Venda de prod. industrializado originada de encomenda",
  "5117":"Venda de mercadoria adquirida originada de encomenda",
  "5118":"Venda de prod. de ativo imobilizado","5120":"Venda de prod. em zona franca",
  "5122":"Venda de prod. em zona franca — recebido de terceiro",
  "5152":"Transferência de mercadoria para comercialização",
  "5201":"Devolução de compra para industrialização","5202":"Devolução de compra para comercialização",
  "5401":"Venda de combustível — substituição tributária",
  "5403":"Venda de combustível — diferimento",
  "5405":"Venda de combustível — contribuinte substituído",
  "5501":"Remessa para industrialização por conta de terceiro",
  "5502":"Retorno de mercadoria remetida para industrialização",
  "5601":"Transferência de ativo imobilizado","5605":"Transferência de saldo credor ICMS",
  "6101":"Venda de prod. industrializado (interestadual)","6102":"Venda de mercadoria (interestadual)",
  "6108":"Venda de mercadoria adquirida — ST (interestadual)",
  "6116":"Venda de prod. industrializado — encomenda (interestadual)",
  "6117":"Venda de mercadoria — encomenda (interestadual)",
  "6118":"Venda de ativo imobilizado (interestadual)",
  "6152":"Transferência de mercadoria para comercialização (interestadual)",
  "6201":"Devolução de compra para industrialização (interestadual)",
  "6202":"Devolução de compra para comercialização (interestadual)",
  "6401":"Venda de combustível — ST (interestadual)",
  "7101":"Exportação de prod. industrializado","7102":"Exportação de mercadoria",
};
function descCFOP(cfop:string):string { return DESC_CFOP[cfop]||`CFOP ${cfop}`; }

function famCFOP(cfop: string): "revenda"|"industrializacao"|"uso_consumo"|"imobilizado"|"outro" {
  const f=ncfop(cfop).slice(2);
  if (["55","56"].includes(f)) return "uso_consumo";
  if (["51"].includes(f)) return "imobilizado";
  if (["01"].includes(f)) return "industrializacao";
  if (["02"].includes(f)) return "revenda";
  return "outro";
}
const cfopUC=(c:string)=>famCFOP(c)==="uso_consumo";
const cfopImob=(c:string)=>famCFOP(c)==="imobilizado";
const cfopComb=(c:string)=>["53","54","56","59","60","61","62","63","64","65","66","67"].includes(ncfop(c).slice(2));
const cfopSaida=(c:string)=>{ const p=ncfop(c)[0]; return p==="5"||p==="6"||p==="7"; };

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE PRODUTO
// ══════════════════════════════════════════════════════════════════════════════

function analisarProduto(desc: string, perfil: PerfilEmpresa, ncm: string): AnaliseSugestao {
  const t=desc.toLowerCase();
  const nc=ncm2(ncm,NCM_COMB); if(nc) return {tipo:"combustivel",motivo:`NCM compatível com combustível (prefixo ${nc})`,confianca:"alta"};
  const nu=ncm2(ncm,NCM_UC);
  if(nu){
    const bl=(perfil==="supermercado"&&["1006","0713","1701","1507","1511","1512","1517","2201","2202","0901","1905","2106","3401","3402","4818","3303","3304","3305","3306","3307"].includes(nu))||(perfil==="restaurante"&&["1006","0713","1701","1507","1511","1512","1517","2201","2202","2203","2204","2205","2206","2208","0901","1905","2101","2106","3924"].includes(nu));
    if(!bl) return {tipo:"uso_consumo",motivo:`NCM compatível com uso e consumo (prefixo ${nu})`,confianca:"alta"};
  }
  const ni=ncm2(ncm,NCM_IMOB); if(ni) return {tipo:"imobilizado",motivo:`NCM compatível com máquina/equipamento (prefixo ${ni})`,confianca:"alta"};
  const pc=["gasolina","diesel","etanol","alcool","álcool","gnv","gás","oleo diesel","óleo diesel","combustivel","combustível","lubrificante"];
  const fcc=pc.find(p=>t.includes(p)); if(fcc) return {tipo:"combustivel",motivo:`descrição contém "${fcc}"`,confianca:"media"};
  const pi=["máquina","maquina","equipamento","compressor","freezer","geladeira","balança","balanca","empilhadeira","motor","forno","coifa","exaustor","notebook","computador","impressora","servidor","monitor","scanner","leitor","betoneira","andaime","furadeira","parafusadeira","serra","cortadora","misturador","microondas","liquidificador","batedeira","fogão","fogao","ar condicionado","inversor","nobreak","estabilizador"];
  const fi=pi.find(p=>t.includes(p)); if(fi) return {tipo:"imobilizado",motivo:`descrição contém "${fi}"`,confianca:"media"};
  const pu=["arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua","refrigerante","suco","cerveja","vinho","whisky","vodka","gin","leite","biscoito","guardanapo","detergente","sabão","sabao","desinfetante","papel higiênico","papel higienico","copo descartável","copo descartavel","papel sulfite","caneta","lapis","lápis","borracha","grampeador","clips","vassoura","rodo","saco de lixo","água sanitária","agua sanitaria","produto de limpeza","material de limpeza","medicamento","remedio","remédio","shampoo","condicionador","sabonete","creme dental","pasta de dente","escova de dente","absorvente","fralda","papel toalha","alcool em gel","álcool em gel","protetor solar","hidratante","desodorante","algodão","algodao","curativo","gaze","esparadrapo"];
  const fu=pu.find(p=>t.includes(p)); if(!fu) return {tipo:null,motivo:"",confianca:null};
  const eS=["arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua","refrigerante","suco","cerveja","vinho","leite","biscoito","detergente","sabão","sabao","desinfetante","papel higienico","papel higiênico","shampoo","condicionador","sabonete","creme dental","pasta de dente","desodorante","absorvente","fralda","papel toalha","protetor solar","hidratante"];
  if(perfil==="supermercado"&&eS.some(p=>t.includes(p))) return {tipo:null,motivo:"",confianca:null};
  const eR=["arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua","refrigerante","suco","cerveja","vinho","whisky","vodka","gin","leite","guardanapo","embalagem","descartável","descartavel"];
  if(perfil==="restaurante"&&eR.some(p=>t.includes(p))) return {tipo:null,motivo:"",confianca:null};
  return {tipo:"uso_consumo",motivo:`descrição contém "${fu}"`,confianca:"media"};
}

// ══════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO — ALERTAS INTELIGENTES
// ══════════════════════════════════════════════════════════════════════════════

function temCreditoPossivel(cst: string, base: number, valor: number): boolean {
  return ["00","10","20","51","70","90"].includes(cst.replace(/\D/g,"")) && (base>0||valor>0);
}

function validarItem(item: Omit<LinhaEntrada,"status"|"avisos">, ehIndustrial=false): {status:StatusValidacao;avisos:string[]} {
  const alertas: string[] = [];
  const avisos_info: string[] = []; // informativos sem gerar ALERTA
  const cfop=ncfop(item.cfop), fam=famCFOP(cfop), sug=item.sugestao.tipo;
  const cred=temCreditoPossivel(item.cst_icms,item.base_icms,item.valor_icms);

  // ── Regras para itens com sugestão automática ────────────────────────────
  // UC ↔ Imobilizado: linha tênue — CFOP de um aceita o outro SEM alerta
  // Regra: só gera alerta se o CFOP é claramente incompatível com qualquer
  //        das naturezas possíveis, OU se há crédito indevido.

  if (sug==="combustivel") {
    const cfopOk = cfopComb(cfop) || cfopUC(cfop);
    if (!cfopOk) {
      alertas.push(`Possível combustível (${item.sugestao.motivo}). CFOP ${cfop} incompatível — verificar CFOP de combustível/lubrificante.`);
    } else {
      avisos_info.push(`Possível combustível: ${item.sugestao.motivo}.`);
    }
    if (cred) alertas.push("Combustível com crédito de ICMS. Verificar se crédito é permitido para este combustível e atividade.");
  }

  if (sug==="imobilizado") {
    const cfopOk = cfopImob(cfop) || cfopUC(cfop); // UC aceito (linha tênue)
    if (!cfopOk) {
      alertas.push(`Possível imobilizado (${item.sugestao.motivo}). CFOP ${cfop} incompatível — verificar 1551/2551 (imobilizado).`);
    } else {
      avisos_info.push(`Possível imobilizado: ${item.sugestao.motivo}.`);
    }
    // Crédito de ICMS em imobilizado: só alerta se houver crédito efetivo
    if (cred) alertas.push("Imobilizado com crédito de ICMS. Verificar aproveitamento via CIAP (1/48 por mês).");
  }

  if (sug==="uso_consumo") {
    const cfopOk = cfopUC(cfop) || cfopImob(cfop); // imob aceito (linha tênue)
    if (!cfopOk) {
      alertas.push(`Possível uso e consumo (${item.sugestao.motivo}). CFOP ${cfop} incompatível — verificar 1556/2556 (UC).`);
    } else {
      avisos_info.push(`Possível uso e consumo: ${item.sugestao.motivo}.`);
    }
    // Crédito de ICMS em UC: alerta pois a regra geral veda (LC 87/96)
    if (cred) alertas.push("UC com crédito de ICMS. Regra geral não permite aproveitamento (LC 87/96). Verificar exceção aplicável.");
  }

  // ── Sem sugestão automática: verifica o CFOP diretamente ────────────────
  if (!sug) {
    if (fam==="uso_consumo" && cred) alertas.push(`CFOP ${cfop} é de uso e consumo com crédito de ICMS. Verificar aproveitamento.`);
    if (fam==="imobilizado" && cred) alertas.push(`CFOP ${cfop} é de imobilizado com crédito de ICMS. Verificar via CIAP.`);
    if (cfopComb(cfop) && cred)      alertas.push(`CFOP ${cfop} é de combustível com crédito de ICMS. Verificar se crédito é permitido.`);
  }

  // ── CFOP de industrialização em empresa não-industrial ───────────────────
  if (!ehIndustrial && fam==="industrializacao") {
    alertas.push(`CFOP ${cfop} é de industrialização, mas a empresa não é industrial (IND_ATIV≠0 no SPED). Verificar se o lançamento está correto.`);
  }

  // Se há só informativos e nenhum alerta real → OK com aviso informativo
  if (alertas.length > 0) return {status:"ALERTA", avisos:[...alertas, ...avisos_info]};
  if (avisos_info.length > 0) return {status:"OK", avisos:avisos_info};
  return {status:"OK", avisos:["Sem inconsistências."]};
}

function sugerirClass(l: Omit<LinhaEntrada,"classificacao">, ehIndustrial=false): ClassificacaoManual {
  if (l.sugestao.tipo==="uso_consumo") return "uso_consumo";
  if (l.sugestao.tipo==="imobilizado") return "imobilizado";
  if (l.sugestao.tipo==="combustivel") return "combustivel";
  const f=famCFOP(l.cfop);
  if (f==="industrializacao") return ehIndustrial?"insumo":"revenda";
  if (f==="revenda") return "revenda";
  if (f==="uso_consumo") return "uso_consumo";
  if (f==="imobilizado") return "imobilizado";
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSER SPED
// ══════════════════════════════════════════════════════════════════════════════

function parseSped(txt: string): {itens:LinhaEntrada[];empresa:DadosEmpresa|null} {
  const lines=txt.split(/\r?\n/).filter(Boolean);
  const cad=new Map<string,Item0200>(), part=new Map<string,Participante0150>();
  let emp: DadosEmpresa|null=null;
  let ehInd = false; // será definido quando 0000 for lido

  type RC190={cfop:string;cst_icms:string;aliquota_icms:number;valor_contabil:number;base_icms:number;valor_icms:number};
  type NA={
    numero_nota:string; fornecedor:string; data:string; temC170:boolean; c190:RC190[];
    // Totais do C100 para rateio proporcional entre itens
    vl_nf:number;    // VL_DOC    — valor total da nota fiscal (inclui IPI pago)
    vl_merc:number;  // VL_MERC   — valor das mercadorias (soma dos VL_ITEM antes do IPI/frete)
    vl_desc:number;  // VL_DESC   — desconto total da nota
    vl_abat:number;  // VL_ABAT_NT— abatimento
    vl_frete:number; // VL_FRT    — frete total
    vl_seg:number;   // VL_SEG    — seguro
    vl_desp:number;  // VL_OUT_DA — outras despesas acessórias
    vl_ipi:number;   // VL_IPI    — IPI destacado no campo próprio (0 quando IPI não aproveitável)
    itensC170: Array<{id:string; vl_item:number; vl_desc_item:number; vl_ipi_item:number}>;
  };
  let na: NA|null=null;
  const itens: LinhaEntrada[]=[];

  /**
   * Rateio de frete, despesas, desconto e IPI implícito entre os itens C170.
   *
   * Problema tratado — IPI não aproveitável como crédito:
   *   Quando o IPI não pode ser creditado (UC, imobilizado, etc.), o contribuinte
   *   lança VL_IPI=0 no C170 e no campo VL_IPI do C100, mas o VL_DOC inclui o IPI
   *   que foi efetivamente pago. Resultado: VL_DOC > VL_MERC + outros encargos.
   *   A diferença é exatamente o IPI pago mas não creditado.
   *
   * IPI implícito = VL_DOC - VL_MERC - VL_FRT - VL_SEG - VL_OUT_DA
   *                        + VL_DESC + VL_ABAT_NT - VL_IPI_explicito
   *
   * Fórmula final por item:
   *   valor_contabil = VL_ITEM
   *                  + frete_rateado
   *                  + seguro_rateado
   *                  + despesas_rateadas
   *                  + IPI_item_C170          (IPI lançado no item, pode ser 0)
   *                  + IPI_implicito_rateado   (IPI pago sem crédito, rateado por VL_ITEM)
   *                  - desconto_item           (VL_DESC do C170)
   *                  - desconto_nota_extra_rateado (excedente do VL_DESC C100)
   */
  function ratearItensNota(): void {
    if (!na || !na.itensC170.length) return;

    // Base de rateio: soma dos VL_ITEM (mercadoria bruta de cada produto)
    const totalVlItem = na.itensC170.reduce((s, i) => s + i.vl_item, 0);
    if (totalVlItem <= 0) return;

    // ── IPI implícito ──────────────────────────────────────────────────────────
    // VL_MERC = soma dos VL_ITEM menos descontos por item.
    // IPI implícito = diferença entre o VL_DOC e tudo que já é explicado pelos
    // outros campos. Quando positivo, há IPI pago que não foi creditado.
    const ipiImplicito = Math.max(0, Math.round((
      na.vl_nf
      - na.vl_merc   // mercadoria (= soma VL_ITEM dos C170 já com desconto por item)
      - na.vl_frete
      - na.vl_seg
      - na.vl_desp
      + na.vl_desc   // desconto reduz o valor total (sinal positivo aqui pois foi subtraído do total)
      + na.vl_abat
      - na.vl_ipi    // IPI já explicado no campo próprio (geralmente 0 neste cenário)
      - na.itensC170.reduce((s, i) => s + i.vl_ipi_item, 0) // IPI lançado nos itens
    ) * 100) / 100);

    // ── Desconto extra da nota (parte não coberta pelos descontos por item) ────
    const descPorItemTotal = na.itensC170.reduce((s, i) => s + i.vl_desc_item, 0);
    const descNotaExtra = Math.max(0, Math.round((na.vl_desc - descPorItemTotal) * 100) / 100);

    const freteTotal = na.vl_frete;
    const segTotal   = na.vl_seg;
    const despTotal  = na.vl_desp;

    for (const regI of na.itensC170) {
      const idx = itens.findIndex(i => i.id === regI.id);
      if (idx < 0) continue;
      const item = itens[idx];

      const prop = regI.vl_item / totalVlItem;

      const freteRat     = Math.round(freteTotal    * prop * 100) / 100;
      const segRat       = Math.round(segTotal      * prop * 100) / 100;
      const despRat      = Math.round(despTotal      * prop * 100) / 100;
      const descExtra    = Math.round(descNotaExtra  * prop * 100) / 100;
      const ipiImplRat   = Math.round(ipiImplicito   * prop * 100) / 100;

      // Desconto total do item = desconto próprio (C170 p[8]) + parcela extra da nota
      const descTotal = (item.valor_desconto || 0) + descExtra;

      // IPI total do item = IPI do C170 + IPI implícito rateado
      const ipiTotal = (item.valor_ipi_item || 0) + ipiImplRat;

      itens[idx] = {
        ...item,
        valor_frete:      freteRat + segRat, // seguro agrupado no frete por simplicidade
        valor_despesas:   despRat,
        valor_desconto:   descTotal,
        valor_ipi_item:   ipiTotal,           // IPI real = lançado + implícito
        valor_total_nota: na!.vl_nf,
        // valor_contabil final = produto + encargos + IPI real - descontos
        valor_contabil: Math.round(
          (item.valor_produto + freteRat + segRat + despRat + ipiTotal - descTotal) * 100
        ) / 100,
      };
    }
  }

  function flush(): void {
    // Aplica rateio nos itens C170 da nota que está sendo fechada
    if (na && na.itensC170.length > 0) ratearItensNota();

    // Se a nota não tinha C170, usa os registros C190 (resumo por CFOP)
    if (!na || na.temC170 || !na.c190.length) return;
    for (const r of na.c190) {
      const b = {
        id:gid(), numero_nota:na.numero_nota, fornecedor:na.fornecedor, data:na.data,
        codigo_produto:"", cst_icms:r.cst_icms, ncm:"",
        descricao:`CFOP ${r.cfop} (resumo por CFOP – sem itens detalhados)`,
        cfop:r.cfop,
        valor_produto:r.valor_contabil, valor_desconto:0, valor_frete:0,
        valor_despesas:0, valor_ipi_item:0, valor_total_nota:na.vl_nf,
        valor_contabil:r.valor_contabil,
        base_icms:r.base_icms, aliquota_icms:r.aliquota_icms, valor_icms:r.valor_icms,
        sugestao:{tipo:null,motivo:"",confianca:null} as AnaliseSugestao,
        classificacao:null as ClassificacaoManual, fonte:"c190" as const,
      };
      const res=validarItem(b,ehInd); itens.push({...b,...res});
    }
  }

  for (const l of lines) {
    const p=l.split("|"), r=p[1]; if(!r) continue;

    if (r==="0000") {
      ehInd = fc(p,15)==="0";
      emp={nome:fc(p,6),cnpj:fc(p,7),ie:fc(p,10),uf:fc(p,9),periodoInicial:fdata(fc(p,4)),periodoFinal:fdata(fc(p,5)),
        ehIndustrial:ehInd}; // IND_ATIV=0 → industrial/equiparado
      continue;
    }
    if (r==="0150") { const c=fc(p,2); if(c) part.set(c,{nome:fc(p,3)}); continue; }
    if (r==="0200") { const c=fc(p,2); if(c) cad.set(c,{descricao:fc(p,3),ncm:fc(p,8)}); continue; }

    if (r==="C100") {
      flush(); // fecha a nota anterior antes de abrir a nova
      const io=fc(p,2), cp=fc(p,4);
      const nd=fc(p,8)||fc(p,7);
      const dd=fdata(fc(p,10)||fc(p,11));
      // Só processa notas de ENTRADA (IND_OPER=0)
      na = io==="0" ? {
        numero_nota : nd||"Sem número",
        fornecedor  : part.get(cp)?.nome||cp||"Fornecedor não localizado",
        data        : dd,
        temC170     : false,
        c190        : [],
        // ── Campos do C100 para rateio ──────────────────────────────────
        // Layout: |C100|IND_OPER(2)|IND_EMIT(3)|COD_PART(4)|COD_MOD(5)|COD_SIT(6)|
        //         SER(7)|NUM_DOC(8)|CHV_NFE(9)|DT_DOC(10)|DT_E_S(11)|VL_DOC(12)|
        //         IND_PGTO(13)|VL_DESC(14)|VL_ABAT_NT(15)|VL_MERC(16)|IND_FRT(17)|
        //         VL_FRT(18)|VL_SEG(19)|VL_OUT_DA(20)|VL_BC_ICMS(21)|VL_ICMS(22)|
        //         VL_BC_ICMS_ST(23)|VL_ICMS_ST(24)|VL_IPI(25)|VL_PIS(26)|VL_COFINS(27)
        vl_nf    : nnum(p[12]), // VL_DOC
        vl_merc  : nnum(p[16]), // VL_MERC
        vl_desc  : nnum(p[14]), // VL_DESC
        vl_abat  : nnum(p[15]), // VL_ABAT_NT
        vl_frete : nnum(p[18]), // VL_FRT
        vl_seg   : nnum(p[19]), // VL_SEG
        vl_desp  : nnum(p[20]), // VL_OUT_DA
        vl_ipi   : nnum(p[25]), // VL_IPI explícito (0 quando IPI não aproveitável como crédito)
        itensC170: [],
      } : null;
      continue;
    }

    if (r==="C170" && na) {
      na.temC170 = true;
      // Layout: |C170|NUM_ITEM(2)|COD_ITEM(3)|DESCR_COMPL(4)|QTD(5)|UNID(6)|
      //         VL_ITEM(7)|VL_DESC(8)|IND_MOV(9)|CST_ICMS(10)|CFOP(11)|COD_NAT(12)|
      //         VL_BC_ICMS(13)|ALIQ_ICMS(14)|VL_ICMS(15)|VL_BC_ICMS_ST(16)|ALIQ_ST(17)|
      //         VL_ICMS_ST(18)|IND_APUR(19)|CST_IPI(20)|COD_ENQ(21)|VL_BC_IPI(22)|
      //         ALIQ_IPI(23)|VL_IPI(24)|CST_PIS(25)|...
      const codItem   = fc(p,3);
      const descComp  = fc(p,4); // DESCR_COMPL (complemento de descrição)
      const cstIcms   = fc(p,10);
      const cfop      = ncfop(p[11]);
      const i0        = cad.get(codItem);

      const vlItem    = nnum(p[7]);  // VL_ITEM   — valor bruto do produto
      const vlDescIt  = nnum(p[8]);  // VL_DESC   — desconto do item
      const vlIpiIt   = nnum(p[24]); // VL_IPI    — IPI do item
      const vBcIcms   = nnum(p[13]);
      const aliqIcms  = nnum(p[14]);
      const vlIcms    = nnum(p[15]);

      const itemId = gid();
      na.itensC170.push({id:itemId, vl_item:vlItem, vl_desc_item:vlDescIt, vl_ipi_item:vlIpiIt});

      // Descrição: usa o cadastro 0200 quando disponível
      const descFinal = i0?.descricao
        || (descComp||codItem||"Descrição não localizada");

      // valor_contabil provisório (será recalculado em ratearItensNota com frete/despesas)
      const vcProv = Math.round((vlItem - vlDescIt + vlIpiIt) * 100) / 100;

      const b: Omit<LinhaEntrada,"status"|"avisos"> = {
        id:itemId, numero_nota:na.numero_nota, fornecedor:na.fornecedor, data:na.data,
        codigo_produto:codItem, cst_icms:cstIcms, ncm:i0?.ncm||"",
        descricao:descFinal, cfop,
        valor_produto:vlItem, valor_desconto:vlDescIt, valor_frete:0,
        valor_despesas:0, valor_ipi_item:vlIpiIt, valor_total_nota:na.vl_nf,
        valor_contabil:vcProv,
        base_icms:vBcIcms, aliquota_icms:aliqIcms, valor_icms:vlIcms,
        sugestao:{tipo:null,motivo:"",confianca:null} as AnaliseSugestao,
        classificacao:null as ClassificacaoManual, fonte:"sped" as const,
      };
      const cl2=sugerirClass(b,ehInd), res=validarItem(b,ehInd);
      itens.push({...b,...res,classificacao:cl2});
      continue;
    }

    if (r==="C190" && na) {
      // C190: resumo por CFOP — só usado se não houver C170
      // Layout: |C190|CST_ICMS(2)|CFOP(3)|ALIQ_ICMS(4)|VL_OPR(5)|VL_BC_ICMS(6)|VL_ICMS(7)|...
      const cfop=ncfop(p[3]);
      if (cfop) na.c190.push({
        cfop, cst_icms:fc(p,2), aliquota_icms:nnum(p[4]),
        valor_contabil:nnum(p[5]), base_icms:nnum(p[6]), valor_icms:nnum(p[7]),
      });
    }
  }

  flush(); // processa a última nota
  return {itens, empresa:emp};
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSER XML NF-e — CORRIGIDO
// Usa getElementsByTagName com escopo no nó do det/imposto para evitar
// captura de valores de elementos filhos aninhados incorretos.
// ══════════════════════════════════════════════════════════════════════════════

function parseDataXml(s: string): string {
  if(!s) return "";
  try{const d=new Date(s);if(!isNaN(d.getTime()))return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;}catch{}
  return s.slice(0,10).split("-").reverse().join("/");
}

// Lê o primeiro elemento com localName=tag dentro de um nó, ignorando namespace
function gtxt(node: Element|null|undefined, tag: string): string {
  if (!node) return "";
  const els = node.getElementsByTagName(tag);
  if (els.length > 0) return els[0].textContent?.trim()||"";
  // fallback: tenta sem namespace
  const all = Array.from(node.getElementsByTagName("*"));
  const found = all.find(el => el.localName === tag);
  return found?.textContent?.trim()||"";
}

// Lê o nó filho imediato do grupo ICMS (ex: <ICMS00>, <ICMS10>, <ICMSSN500>, etc.)
function getIcmsNode(imposto: Element|null): Element|null {
  if (!imposto) return null;
  const icmsGrupo = imposto.getElementsByTagName("ICMS")[0];
  if (!icmsGrupo) return null;
  // O primeiro elemento filho é o grupo real (ICMS00, ICMS10, ICMS20, etc.)
  return icmsGrupo.firstElementChild as Element|null;
}

// Lê o nó filho do grupo PIS/COFINS
function getPisCofinsNode(imposto: Element|null, grupo: "PIS"|"COFINS"): Element|null {
  if (!imposto) return null;
  const grp = imposto.getElementsByTagName(grupo)[0];
  if (!grp) return null;
  return grp.firstElementChild as Element|null;
}

// Detecta se um XML é um evento de cancelamento e retorna a chave NF-e cancelada
// Eventos de cancelamento: tpEvento="110111" (cancNFe) ou arquivo cancNFe
function detectarCancelamento(txt: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    if (doc.querySelector("parsererror")) return null;

    // Formato 1: procEventoNFe / eventoCancNFe
    const tpEvento = doc.getElementsByTagName("tpEvento")[0]?.textContent?.trim();
    if (tpEvento === "110111") {
      // chave está em chNFe dentro do evento
      const chNFe = doc.getElementsByTagName("chNFe")[0]?.textContent?.trim()
        || doc.getElementsByTagName("chave")[0]?.textContent?.trim();
      return chNFe || null;
    }

    // Formato 2: cancNFe direto (arquivo de cancelamento antigo)
    const cancNFe = doc.getElementsByTagName("cancNFe")[0];
    if (cancNFe) {
      const chNFe = gtxt(cancNFe, "chNFe") || gtxt(cancNFe, "chave");
      return chNFe || null;
    }

    // Formato 3: retCancNFe
    const retCanc = doc.getElementsByTagName("retCancNFe")[0];
    if (retCanc) {
      const chNFe = gtxt(retCanc, "chNFe");
      return chNFe || null;
    }

    return null;
  } catch {
    return null;
  }
}

// Extrai a chave NF-e do XML de NF-e (infNFe Id ou chNFe no protNFe)
function extrairChaveNFe(txt: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    // infNFe Id="NFe..." — a chave é o Id sem o prefixo "NFe"
    const infNFe = doc.getElementsByTagName("infNFe")[0];
    if (infNFe) {
      const id = infNFe.getAttribute("Id") || "";
      if (id.startsWith("NFe")) return id.slice(3);
      if (id.length === 44) return id;
    }
    // protNFe > chNFe
    const chNFe = doc.getElementsByTagName("chNFe")[0]?.textContent?.trim();
    if (chNFe && chNFe.length === 44) return chNFe;
    return null;
  } catch { return null; }
}

type XmlResult={itensEntrada:LinhaEntrada[];itensSaida:LinhaSaida[]; chaveNFe?: string};

function parseXml(txt: string, perfil: PerfilEmpresa): XmlResult {
  const entradas: LinhaEntrada[]=[], saidas: LinhaSaida[]=[];
  try{
    const doc=new DOMParser().parseFromString(txt,"text/xml");

    // Detecta erro de parse
    if (doc.querySelector("parsererror")) return {itensEntrada:[],itensSaida:[]};

    const ide=doc.getElementsByTagName("ide")[0];
    const emit=doc.getElementsByTagName("emit")[0];
    const dest=doc.getElementsByTagName("dest")[0];

    const nNF=gtxt(ide,"nNF")||"Sem número";
    const dhEmi=gtxt(ide,"dhEmi")||gtxt(ide,"dEmi")||"";
    const data=parseDataXml(dhEmi);
    const tpNF=gtxt(ide,"tpNF"); // "0"=entrada, "1"=saída
    const xEmit=gtxt(emit,"xNome")||"Emitente";
    const xDest=gtxt(dest,"xNome")||"Destinatário";

    // Totais da nota para rateio proporcional
    const totalNode=doc.getElementsByTagName("ICMSTot")[0]||null;
    const vNFtotal=nnumXml(gtxt(totalNode,"vNF"));         // valor total da nota
    const vDescNota=nnumXml(gtxt(totalNode,"vDesc"));      // desconto total da nota
    const vFreteNota=nnumXml(gtxt(totalNode,"vFrete"));    // frete total da nota
    const vOutroNota=nnumXml(gtxt(totalNode,"vOutro"));    // outras despesas total
    const vIPINota=nnumXml(gtxt(totalNode,"vIPI"));        // IPI total da nota
    // Soma dos vProd de todos os itens (para calcular proporção no rateio)
    let somaProd=0;
    const detListPre=doc.getElementsByTagName("det");
    for(let pi=0;pi<detListPre.length;pi++) somaProd+=nnumXml(gtxt(detListPre[pi].getElementsByTagName("prod")[0],"vProd"));

    const detList=doc.getElementsByTagName("det");
    for(let di=0;di<detList.length;di++){
      const det=detList[di];
      const prod=det.getElementsByTagName("prod")[0];
      const imp=det.getElementsByTagName("imposto")[0];
      if(!prod) continue;

      const codProd=gtxt(prod,"cProd");
      const xProd=gtxt(prod,"xProd");
      const ncm=gtxt(prod,"NCM");
      const cfop=gtxt(prod,"CFOP").slice(0,4);
      const vProd=nnumXml(gtxt(prod,"vProd"));
      // Campos de composição do valor por item (quando emitidos na NF-e)
      const vDescItem=nnumXml(gtxt(prod,"vDesc"));    // desconto do item
      const vFreteItem=nnumXml(gtxt(prod,"vFrete"));  // frete do item
      const vOutroItem=nnumXml(gtxt(prod,"vOutro"));  // outras despesas do item
      const vIPIItem=nnumXml(gtxt(det.getElementsByTagName("IPI")[0]||null,"vIPI")); // IPI do item
      const cbenef=gtxt(prod,"cBenef");
      const cbenefDesc=cbenef?(CBENEF_GO[cbenef]||`Código ${cbenef} — consultar tabela CBenef da UF`):"";

      // ICMS — lê o nó filho do grupo ICMS (ICMS00, ICMS20, ICMSSN500, etc.)
      const icmsNode=getIcmsNode(imp||null);
      const cst=gtxt(icmsNode,"CST")||gtxt(icmsNode,"CSOSN");
      const vBC=nnumXml(gtxt(icmsNode,"vBC"));
      const pICMS=nnumXml(gtxt(icmsNode,"pICMS"));
      const vICMS=nnumXml(gtxt(icmsNode,"vICMS"));
      // ST: vBCST e vICMSST ficam no mesmo nó ICMS10/ICMS70/ICMS90
      const vBCST=nnumXml(gtxt(icmsNode,"vBCST"));
      const vST=nnumXml(gtxt(icmsNode,"vICMSST"));

      // IPI — o grupo IPI tem seu próprio elemento
      const ipiGrp=imp?.getElementsByTagName("IPI")[0]||null;
      const vIPI=nnumXml(gtxt(ipiGrp,"vIPI"));

      // PIS
      const pisNode=getPisCofinsNode(imp||null,"PIS");
      const cstPis=gtxt(pisNode,"CST");
      const vBCPis=nnumXml(gtxt(pisNode,"vBC"));
      const pPIS=nnumXml(gtxt(pisNode,"pPIS"));
      const vPIS=nnumXml(gtxt(pisNode,"vPIS")||gtxt(pisNode,"vPISAliq")||gtxt(pisNode,"vPISQtde"));

      // COFINS
      const cofNode=getPisCofinsNode(imp||null,"COFINS");
      const cstCof=gtxt(cofNode,"CST");
      const vBCCof=nnumXml(gtxt(cofNode,"vBC"));
      const pCOF=nnumXml(gtxt(cofNode,"pCOFINS"));
      const vCOF=nnumXml(gtxt(cofNode,"vCOFINS")||gtxt(cofNode,"vCOFINSAliq")||gtxt(cofNode,"vCOFINSQtde"));

      // IBS / CBS (Reforma Tributária)
      const ibsGrp=imp?.getElementsByTagName("IBS")[0]||null;
      const cbsGrp=imp?.getElementsByTagName("CBS")[0]||null;
      const ibsCbsGrp=imp?.getElementsByTagName("ibsCbs")[0]||null;
      const vIBS=nnumXml(gtxt(ibsGrp,"vIBS")||gtxt(ibsCbsGrp,"vIBS"));
      const vCBS=nnumXml(gtxt(cbsGrp,"vCBS")||gtxt(ibsCbsGrp,"vCBS"));

      // Determina se é saída: tpNF=1 OU CFOP começa com 5/6/7
      const ehSaida=tpNF==="1"||cfopSaida(cfop);

      if(ehSaida){
        const alertas: string[]=[];
        if(vICMS>0&&vBC===0) alertas.push("ICMS destacado sem base de cálculo.");
        if(cst==="00"&&pICMS===0) alertas.push("CST 00 com alíquota zero — verificar.");
        if(cbenef&&cbenef!=="SEM CBENEF"&&!CBENEF_GO[cbenef]) alertas.push(`CBenef ${cbenef} não localizado na tabela GO — verificar se é de outro estado.`);
        if(cst==="90"&&!cbenef) alertas.push("CST 90 sem CBenef — verificar benefício fiscal aplicável.");
        // Rateio proporcional para itens de saída
        const propSaida = somaProd > 0 ? vProd / somaProd : 0;
        const frRatSaida = vFreteItem > 0 ? vFreteItem : Math.round(vFreteNota * propSaida * 100) / 100;
        const despRatSaida = vOutroItem > 0 ? vOutroItem : Math.round(vOutroNota * propSaida * 100) / 100;
        const descRatSaida = vDescItem > 0 ? vDescItem : Math.round(vDescNota * propSaida * 100) / 100;
        const ipiSaida = vIPIItem > 0 ? vIPIItem : vIPI; // usa o já lido do grupo IPI
        const vContabilSaida = vProd + frRatSaida + despRatSaida + ipiSaida - descRatSaida;

        saidas.push({
          id:gid(),numero_nota:nNF,destinatario:xDest,data,
          codigo_produto:codProd,descricao:xProd,ncm,cfop,
          cst_icms:cst,cst_pis:cstPis,cst_cofins:cstCof,
          valor_contabil:vContabilSaida,
          valor_produto:vProd, valor_desconto:descRatSaida, valor_frete:frRatSaida,
          valor_despesas:despRatSaida, valor_ipi_item:ipiSaida,
          base_icms:vBC,aliquota_icms:pICMS,valor_icms:vICMS,
          base_st:vBCST,valor_st:vST,valor_ipi:vIPI,
          base_pis:vBCPis,aliquota_pis:pPIS,valor_pis:vPIS,
          base_cofins:vBCCof,aliquota_cofins:pCOF,valor_cofins:vCOF,
          valor_ibs:vIBS,valor_cbs:vCBS,
          cbenef,cbenef_descricao:cbenefDesc,
          alertas_saida:alertas,
          status:alertas.length?"ALERTA":"OK",
        });
      } else {
        // Rateio proporcional para itens de entrada
        const propEntr = somaProd > 0 ? vProd / somaProd : 0;
        const frRatEntr = vFreteItem > 0 ? vFreteItem : Math.round(vFreteNota * propEntr * 100) / 100;
        const despRatEntr = vOutroItem > 0 ? vOutroItem : Math.round(vOutroNota * propEntr * 100) / 100;
        const descRatEntr = vDescItem > 0 ? vDescItem : Math.round(vDescNota * propEntr * 100) / 100;
        const ipiEntr = vIPIItem;
        const vContabilEntr = vProd + frRatEntr + despRatEntr + ipiEntr - descRatEntr;
        const fornecedor=tpNF==="0"?xEmit:xDest;
        const sugestao=analisarProduto(xProd,perfil,ncm);
        const b={id:gid(),numero_nota:nNF,fornecedor,data,codigo_produto:codProd,cst_icms:cst,ncm,descricao:xProd,cfop,
          valor_contabil:vContabilEntr,
          valor_produto:vProd, valor_desconto:descRatEntr, valor_frete:frRatEntr,
          valor_despesas:despRatEntr, valor_ipi_item:ipiEntr,
          valor_total_nota:vNFtotal,
          base_icms:vBC,aliquota_icms:pICMS,valor_icms:vICMS,
          sugestao,classificacao:null as ClassificacaoManual,fonte:"xml" as const};
        const cl=sugerirClass(b), res=validarItem(b);
        entradas.push({...b,...res,classificacao:cl});
      }
    }
  }catch(e){console.error("Erro parseXml:",e);}
  // Tenta extrair a chave NF-e para cruzamento com cancelamentos
  const chaveNFe = extrairChaveNFe(txt) || undefined;
  return {itensEntrada:entradas,itensSaida:saidas,chaveNFe};
}

// ══════════════════════════════════════════════════════════════════════════════
// REGRAS DE NEGÓCIO — ENTRADAS
// ══════════════════════════════════════════════════════════════════════════════

function vinculoUC(linhas: LinhaEntrada[]): LinhaEntrada[] {
  const s=new Set(linhas.filter(l=>l.sugestao.tipo==="uso_consumo").map(l=>l.numero_nota));
  return linhas.map(l=>{
    if(!s.has(l.numero_nota)) return l;
    const av=[...l.avisos];
    if(l.sugestao.tipo!=="uso_consumo"){
      const lp=av.filter(a=>a!=="Sem inconsistências.");
      if(!lp.includes("Provável UC por vínculo com a nota.")) lp.unshift("Provável UC por vínculo com a nota.");
      return {...l,sugestao:{tipo:"uso_consumo",motivo:"outro item da mesma nota identificado como possível UC",confianca:"baixa"},status:"ALERTA",avisos:lp};
    }
    const lp=av.filter(a=>a!=="Sem inconsistências.");
    if(!lp.includes("Nota contém outros itens com indício de UC.")) lp.unshift("Nota contém outros itens com indício de UC.");
    return {...l,avisos:lp};
  });
}

function reproc(linhas: LinhaEntrada[], perfil: PerfilEmpresa, ehInd=false): LinhaEntrada[] {
  const p=linhas.map(l=>{
    const sug=l.fonte==="c190"?l.sugestao:analisarProduto(l.descricao,perfil,l.ncm);
    const u={...l,sugestao:sug};
    const cl=l.classificacao??sugerirClass(u,ehInd), res=validarItem(u,ehInd);
    return {...u,...res,classificacao:cl};
  });
  return vinculoUC(p);
}

function agruparEntradas(linhas: LinhaEntrada[]): NotaEntrada[] {
  const m=new Map<string,NotaEntrada>();
  for(const l of linhas){
    const c=`${l.numero_nota}__${l.fornecedor}`;
    if(!m.has(c)) m.set(c,{chave:c,numero_nota:l.numero_nota,fornecedor:l.fornecedor,data:l.data,total_itens:0,total_contabil:0,total_base_icms:0,total_valor_icms:0,status:"OK",itens:[],sugestoes:[],avisos:[],classificacaoPredominante:null});
    const g=m.get(c)!;
    g.total_itens++;g.total_contabil+=l.valor_contabil;g.total_base_icms+=l.base_icms;g.total_valor_icms+=l.valor_icms;g.itens.push(l);
    if(l.status==="ALERTA") g.status="ALERTA";
    if(l.sugestao.tipo){const t=l.sugestao.tipo==="uso_consumo"?"Possível UC":l.sugestao.tipo==="imobilizado"?"Possível Imobilizado":"Possível Combustível";if(!g.sugestoes.includes(t))g.sugestoes.push(t);}
    const a0=l.avisos[0]||"";if(a0&&a0!=="Sem inconsistências."&&!g.avisos.includes(a0))g.avisos.push(a0);
  }
  for(const n of m.values()){
    const cnt: Record<string,number>={};
    for(const i of n.itens) if(i.classificacao) cnt[i.classificacao]=(cnt[i.classificacao]||0)+1;
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
    n.classificacaoPredominante=(top?.[0] as ClassificacaoManual)||null;
  }
  return Array.from(m.values());
}

// Agrupa notas de SAÍDA por nota fiscal
function agruparSaidas(saidas: LinhaSaida[]): NotaSaida[] {
  const m=new Map<string,NotaSaida>();
  for(const s of saidas){
    const c=`${s.numero_nota}__${s.destinatario}`;
    if(!m.has(c)) m.set(c,{chave:c,numero_nota:s.numero_nota,destinatario:s.destinatario,data:s.data,total_itens:0,total_contabil:0,total_icms:0,total_pis:0,total_cofins:0,total_ibs:0,total_cbs:0,status:"OK",itens:[],tem_cbenef:false,alertas:[]});
    const g=m.get(c)!;
    g.total_itens++;g.total_contabil+=s.valor_contabil;g.total_icms+=s.valor_icms;g.total_pis+=s.valor_pis;g.total_cofins+=s.valor_cofins;g.total_ibs+=s.valor_ibs;g.total_cbs+=s.valor_cbs;
    g.itens.push(s);
    if(s.status==="ALERTA") g.status="ALERTA";
    if(s.cbenef&&s.cbenef!=="SEM CBENEF") g.tem_cbenef=true;
    for(const a of s.alertas_saida) if(!g.alertas.includes(a)) g.alertas.push(a);
  }
  return Array.from(m.values());
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO EXCEL
// ══════════════════════════════════════════════════════════════════════════════

function exportExcel(notas: NotaEntrada[], saidas: LinhaSaida[], emp: DadosEmpresa|null) {
  const wb=XLSX.utils.book_new();
  const CC="FF0D3340",CB="FFFFFFFF",CA="FFFFF3CD",CO="FFD4EDDA";
  const CCl: Record<string,string>={revenda:"FFD4EDDA",uso_consumo:"FFFDE8D8",imobilizado:"FFE8E0FA",combustivel:"FFFCE4EF",desconhece:"FFFAD7D7",nao_recebido:"FFFFF9D4",servico:"FFD8EBFD"};
  const h=(v:string):XLSX.CellObject=>({v,t:"s",s:{font:{bold:true,color:{rgb:CB},sz:11,name:"Calibri"},fill:{fgColor:{rgb:CC}},alignment:{horizontal:"center",vertical:"center",wrapText:true},border:{bottom:{style:"medium",color:{rgb:"FF27C7D8"}}}}});
  const c=(v:unknown,b=false,bg?:string,z?:string):XLSX.CellObject=>({v:v as string|number,t:typeof v==="number"?"n":"s",z,s:{font:{bold:b,sz:10,name:"Calibri"},fill:bg?{fgColor:{rgb:bg}}:undefined,alignment:{vertical:"center"},border:{bottom:{style:"thin",color:{rgb:"FFE0EAED"}},right:{style:"thin",color:{rgb:"FFE0EAED"}}}}});
  const wr=(ws:XLSX.WorkSheet,rows:XLSX.CellObject[][])=>rows.forEach((row,r)=>row.forEach((cl,col)=>{ws[XLSX.utils.encode_cell({r,c:col})]=cl;}));

  // Notas Entradas — uma linha por nota+CFOP para mostrar breakdown por CFOP
  const hE=["Nº Nota","Data","Fornecedor","Itens","CFOP","Descrição CFOP","Valor (CFOP)","Base ICMS (CFOP)","ICMS (CFOP)","Valor Total Nota","Classificação","Alertas","Status"];
  const rE:XLSX.CellObject[][]=[hE.map(h)];
  for(const n of notas){
    // Agrupa itens por CFOP dentro da nota
    const cfopMap=new Map<string,{valor:number;base:number;icms:number}>();
    for(const i of n.itens){
      if(!cfopMap.has(i.cfop)) cfopMap.set(i.cfop,{valor:0,base:0,icms:0});
      const g=cfopMap.get(i.cfop)!; g.valor+=i.valor_contabil; g.base+=i.base_icms; g.icms+=i.valor_icms;
    }
    const cfopList=Array.from(cfopMap.entries());
    const cl=n.classificacaoPredominante;
    cfopList.forEach(([cfop,vals],idx)=>{
      rE.push([
        c(idx===0?n.numero_nota:"",idx===0),
        c(idx===0?n.data:""),
        c(idx===0?n.fornecedor:""),
        c(idx===0?n.total_itens:"",false,undefined,"0"),
        c(cfop,true,undefined),
        c(DESC_CFOP[cfop]||`CFOP ${cfop}`),
        c(vals.valor,false,undefined,"#,##0.00"),
        c(vals.base,false,undefined,"#,##0.00"),
        c(vals.icms,false,undefined,"#,##0.00"),
        c(idx===0?n.total_contabil:"",false,undefined,"#,##0.00"),
        c(idx===0?(cl?CLASSIFICACAO_LABEL[cl]:"A classificar"):"",false,idx===0&&cl?CCl[cl]:undefined),
        c(idx===0?n.avisos.filter(a=>a!=="Sem inconsistências.").join(" | "):""),
        c(idx===0?n.status:"",true,idx===0?(n.status==="ALERTA"?CA:CO):undefined),
      ]);
    });
  }
  const wsE=XLSX.utils.aoa_to_sheet(rE.map(r=>r.map(x=>x.v)));wr(wsE,rE);wsE["!cols"]=[{wch:14},{wch:12},{wch:36},{wch:8},{wch:8},{wch:38},{wch:16},{wch:16},{wch:16},{wch:16},{wch:20},{wch:55},{wch:10}];
  XLSX.utils.book_append_sheet(wb,wsE,"Notas Entradas");

  const hI=["Nº Nota","Data","Fornecedor","Cód.","Descrição","NCM","CFOP","CST","Valor Produto","Frete Rateado","Despesas Rateadas","IPI Item","Desconto Rateado","Valor Contábil Total","Base ICMS","Alíq. ICMS","ICMS","Classificação","Sugestão","Confiança","Alertas","Status","Fonte"];
  const rI:XLSX.CellObject[][]=[hI.map(h)];
  for(const n of notas)for(const i of n.itens){const cl=i.classificacao;const st=i.sugestao.tipo?`${i.sugestao.tipo==="uso_consumo"?"UC":i.sugestao.tipo==="imobilizado"?"Imobilizado":"Combustível"} – ${i.sugestao.motivo}`:"";const fl=i.fonte==="xml"?"XML NF-e":i.fonte==="c190"?"C190 (resumo)":"SPED C170";rI.push([c(n.numero_nota,true),c(i.data),c(n.fornecedor),c(i.codigo_produto),c(i.descricao),c(i.ncm),c(i.cfop),c(i.cst_icms),c(i.valor_produto||i.valor_contabil,false,undefined,"#,##0.00"),c(i.valor_frete||0,false,undefined,"#,##0.00"),c(i.valor_despesas||0,false,undefined,"#,##0.00"),c(i.valor_ipi_item||0,false,undefined,"#,##0.00"),c(i.valor_desconto||0,false,undefined,"#,##0.00"),c(i.valor_contabil,false,undefined,"#,##0.00"),c(i.base_icms,false,undefined,"#,##0.00"),c(i.aliquota_icms,false,undefined,'0.00"%"'),c(i.valor_icms,false,undefined,"#,##0.00"),c(cl?CLASSIFICACAO_LABEL[cl]:"A classificar",false,cl?CCl[cl]:undefined),c(st),c(i.sugestao.confianca||""),c(i.avisos.filter(a=>a!=="Sem inconsistências.").join(" | ")),c(i.status,true,i.status==="ALERTA"?CA:CO),c(fl)]);}
  const wsI=XLSX.utils.aoa_to_sheet(rI.map(r=>r.map(x=>x.v)));wr(wsI,rI);wsI["!cols"]=[{wch:12},{wch:12},{wch:36},{wch:12},{wch:44},{wch:12},{wch:8},{wch:8},{wch:14},{wch:14},{wch:12},{wch:14},{wch:22},{wch:45},{wch:10},{wch:55},{wch:10},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsI,"Itens Entradas");

  if(saidas.length>0){
    // Resumo Notas Saídas — uma linha por nota + CFOP
    const hNS=["Nº Nota","Data","Destinatário","CFOP","Descrição CFOP","Valor (CFOP)","Base ICMS (CFOP)","ICMS (CFOP)","Valor Total Nota","ICMS Total Nota","PIS Total","COFINS Total","Alertas","Status"];
    const rNS:XLSX.CellObject[][]=[hNS.map(h)];
    const notasSaidasAgrup=agruparSaidas(saidas);
    for(const n of notasSaidasAgrup){
      const cfopMapS=new Map<string,{valor:number;base:number;icms:number}>();
      for(const i of n.itens){if(!cfopMapS.has(i.cfop))cfopMapS.set(i.cfop,{valor:0,base:0,icms:0});const g=cfopMapS.get(i.cfop)!;g.valor+=i.valor_contabil;g.base+=i.base_icms;g.icms+=i.valor_icms;}
      const cfopListS=Array.from(cfopMapS.entries());
      cfopListS.forEach(([cfop,vals],idx)=>{
        rNS.push([
          c(idx===0?n.numero_nota:"",idx===0),
          c(idx===0?n.data:""),
          c(idx===0?n.destinatario:""),
          c(cfop,true),
          c(DESC_CFOP[cfop]||`CFOP ${cfop}`),
          c(vals.valor,false,undefined,"#,##0.00"),
          c(vals.base,false,undefined,"#,##0.00"),
          c(vals.icms,false,undefined,"#,##0.00"),
          c(idx===0?n.total_contabil:"",false,undefined,"#,##0.00"),
          c(idx===0?n.total_icms:"",false,undefined,"#,##0.00"),
          c(idx===0?n.total_pis:"",false,undefined,"#,##0.00"),
          c(idx===0?n.total_cofins:"",false,undefined,"#,##0.00"),
          c(idx===0?n.alertas.join(" | "):""),
          c(idx===0?n.status:"",true,idx===0?(n.status==="ALERTA"?CA:CO):undefined),
        ]);
      });
    }
    const wsNS=XLSX.utils.aoa_to_sheet(rNS.map(r=>r.map(x=>x.v)));wr(wsNS,rNS);wsNS["!cols"]=[{wch:12},{wch:12},{wch:36},{wch:8},{wch:38},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:14},{wch:14},{wch:50},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsNS,"Resumo Saídas");

    const hS=["Nº Nota","Data","Destinatário","Cód.","Descrição","NCM","CFOP","CST ICMS","CST PIS","CST COFINS","Valor Produto","Frete Rateado","Despesas Rateadas","IPI Item","Desconto Rateado","Valor Contábil Total","Base ICMS","Alíq. ICMS","ICMS","ICMS-ST","IPI","PIS","COFINS","IBS","CBS","CBenef","Benefício Fiscal","Alertas","Status"];
    const rS:XLSX.CellObject[][]=[hS.map(h)];
    for(const s of saidas){rS.push([c(s.numero_nota,true),c(s.data),c(s.destinatario),c(s.codigo_produto),c(s.descricao),c(s.ncm),c(s.cfop),c(s.cst_icms),c(s.cst_pis),c(s.cst_cofins),c(s.valor_produto||s.valor_contabil,false,undefined,"#,##0.00"),c(s.valor_frete||0,false,undefined,"#,##0.00"),c(s.valor_despesas||0,false,undefined,"#,##0.00"),c(s.valor_ipi_item||0,false,undefined,"#,##0.00"),c(s.valor_desconto||0,false,undefined,"#,##0.00"),c(s.valor_contabil,false,undefined,"#,##0.00"),c(s.base_icms,false,undefined,"#,##0.00"),c(s.aliquota_icms,false,undefined,'0.00"%"'),c(s.valor_icms,false,undefined,"#,##0.00"),c(s.valor_st,false,undefined,"#,##0.00"),c(s.valor_ipi,false,undefined,"#,##0.00"),c(s.valor_pis,false,undefined,"#,##0.00"),c(s.valor_cofins,false,undefined,"#,##0.00"),c(s.valor_ibs,false,undefined,"#,##0.00"),c(s.valor_cbs,false,undefined,"#,##0.00"),c(s.cbenef,false,s.cbenef?"FFE8E0FA":undefined),c(s.cbenef_descricao),c(s.alertas_saida.join(" | ")),c(s.status,true,s.status==="ALERTA"?CA:CO)]);}
    const wsS=XLSX.utils.aoa_to_sheet(rS.map(r=>r.map(x=>x.v)));wr(wsS,rS);wsS["!cols"]=[{wch:12},{wch:12},{wch:38},{wch:12},{wch:42},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:14},{wch:14},{wch:12},{wch:14},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:14},{wch:55},{wch:55},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsS,"Notas Saídas");
  }

  // Aba Resumo por CFOP
  const hCE=["CFOP","Descrição","Qtd. Notas","Qtd. Itens","Valor Contábil","Base ICMS","ICMS"];
  const rCE:XLSX.CellObject[][]=[hCE.map(h)];
  const rcfopE=new Map<string,{qtd_notas:Set<string>;qtd_itens:number;valor:number;base:number;icms:number}>();
  for(const n of notas)for(const i of n.itens){if(!rcfopE.has(i.cfop))rcfopE.set(i.cfop,{qtd_notas:new Set(),qtd_itens:0,valor:0,base:0,icms:0});const g=rcfopE.get(i.cfop)!;g.qtd_notas.add(n.numero_nota);g.qtd_itens++;g.valor+=i.valor_contabil;g.base+=i.base_icms;g.icms+=i.valor_icms;}
  Array.from(rcfopE.entries()).sort((a,b)=>b[1].valor-a[1].valor).forEach(([cfop,g])=>{rCE.push([c(cfop,true),c(DESC_CFOP[cfop]||`CFOP ${cfop}`),c(g.qtd_notas.size,false,undefined,"0"),c(g.qtd_itens,false,undefined,"0"),c(g.valor,false,undefined,"#,##0.00"),c(g.base,false,undefined,"#,##0.00"),c(g.icms,false,undefined,"#,##0.00")]);});
  const wsCE=XLSX.utils.aoa_to_sheet(rCE.map(r=>r.map(x=>x.v)));wr(wsCE,rCE);wsCE["!cols"]=[{wch:8},{wch:50},{wch:12},{wch:12},{wch:18},{wch:18},{wch:18}];
  XLSX.utils.book_append_sheet(wb,wsCE,"Resumo CFOP Entradas");
  const hCS=["CFOP","Descrição","Qtd. Notas","Qtd. Itens","Valor Contábil","Base ICMS","ICMS"];
  const rCS:XLSX.CellObject[][]=[hCS.map(h)];
  const rcfopS=new Map<string,{qtd_notas:Set<string>;qtd_itens:number;valor:number;base:number;icms:number}>();
  for(const s of saidas){if(!rcfopS.has(s.cfop))rcfopS.set(s.cfop,{qtd_notas:new Set(),qtd_itens:0,valor:0,base:0,icms:0});const g=rcfopS.get(s.cfop)!;g.qtd_notas.add(s.numero_nota);g.qtd_itens++;g.valor+=s.valor_contabil;g.base+=s.base_icms;g.icms+=s.valor_icms;}
  Array.from(rcfopS.entries()).sort((a,b)=>b[1].valor-a[1].valor).forEach(([cfop,g])=>{rCS.push([c(cfop,true),c(DESC_CFOP[cfop]||`CFOP ${cfop}`),c(g.qtd_notas.size,false,undefined,"0"),c(g.qtd_itens,false,undefined,"0"),c(g.valor,false,undefined,"#,##0.00"),c(g.base,false,undefined,"#,##0.00"),c(g.icms,false,undefined,"#,##0.00")]);});
  const wsCS=XLSX.utils.aoa_to_sheet(rCS.map(r=>r.map(x=>x.v)));wr(wsCS,rCS);wsCS["!cols"]=[{wch:8},{wch:50},{wch:12},{wch:12},{wch:18},{wch:18},{wch:18}];
  XLSX.utils.book_append_sheet(wb,wsCS,"Resumo CFOP Saídas");

  const totN=notas.length,totI=notas.reduce((a,n)=>a+n.total_itens,0),totV=notas.reduce((a,n)=>a+n.total_contabil,0),totIcms=notas.reduce((a,n)=>a+n.total_valor_icms,0);
  const cntCl: Record<string,{qtd:number;valor:number}>={};
  for(const n of notas)for(const i of n.itens){const lb=i.classificacao?CLASSIFICACAO_LABEL[i.classificacao]:"A classificar";if(!cntCl[lb])cntCl[lb]={qtd:0,valor:0};cntCl[lb].qtd++;cntCl[lb].valor+=i.valor_contabil;}
  const rd=[["RELATÓRIO DE VALIDAÇÃO FISCAL — ENFOKUS CONTABILIDADE E FINANÇAS CORPORATIVAS"],[""],["Empresa:",emp?.nome||""],["CNPJ:",emp?.cnpj?fcnpj(emp.cnpj):""],["IE:",emp?.ie||""],["UF:",emp?.uf||""],["Período:",`${emp?.periodoInicial||""} até ${emp?.periodoFinal||""}`],["Gerado em:",new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})],[""],["ENTRADAS"],["Total Notas:",totN],["Total Itens:",totI],["Valor Total (R$):",totV],["ICMS Total (R$):",totIcms],["Notas com Alerta:",notas.filter(n=>n.status==="ALERTA").length],[""],["SAÍDAS"],["Total Itens Saída:",saidas.length],["Valor Total Saída (R$):",saidas.reduce((a,i)=>a+i.valor_contabil,0)],[""],["CLASSIFICAÇÃO DOS ITENS DE ENTRADA"],["Classificação","Qtd. Itens","Valor Total (R$)"],...Object.entries(cntCl).map(([lb,d])=>[lb,d.qtd,d.valor])];
  const wsR=XLSX.utils.aoa_to_sheet(rd);wsR["!cols"]=[{wch:38},{wch:42},{wch:20}];
  if(wsR["A1"])wsR["A1"].s={font:{bold:true,sz:14,color:{rgb:"FF1A6B7A"},name:"Calibri"}};
  XLSX.utils.book_append_sheet(wb,wsR,"Resumo Executivo");

  const per=emp?`_${emp.periodoInicial?.replace(/\//g,"-")}_${emp.periodoFinal?.replace(/\//g,"-")}`:"";
  const ne=emp?.nome?`_${emp.nome.slice(0,20).replace(/[^a-zA-Z0-9]/g,"_")}`:"";
  XLSX.writeFile(wb,`Enfokus_Validacao${ne}${per}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════════════════════

export default function ValidadorPage() {
  const [linhas,setLinhas]=useState<LinhaEntrada[]>([]);
  const [saidas,setSaidas]=useState<LinhaSaida[]>([]);
  const [emp,setEmp]=useState<DadosEmpresa|null>(null);
  const [arq,setArq]=useState("");
  const [erro,setErro]=useState("");
  const [perfil,setPerfil]=useState<PerfilEmpresa>("geral");
  const [expandidas,setExpandidas]=useState<Set<string>>(new Set());
  const [expandidasS,setExpandidasS]=useState<Set<string>>(new Set()); // saídas expandidas
  const [filtros,setFiltros]=useState<Filtros>({somenteAlertas:false,cfop:"",ncm:"",busca:"",classificacao:""});
  const [modulo,setModulo]=useState<"entradas"|"saidas"|"cfop">("entradas");
  const [abaE,setAbaE]=useState<"notas"|"itens">("notas");
  const [buscaS,setBuscaS]=useState("");
  const [soAlerS,setSoAlerS]=useState(false);
  const [infoCanc,setInfoCanc]=useState("");
  const [ehIndustrial,setEhIndustrial]=useState(false);
  const [tema,setTema]=useState<"escuro"|"claro">("escuro");
  const D=tema==="escuro";
  const refSped=useRef<HTMLInputElement|null>(null), refXml=useRef<HTMLInputElement|null>(null);

  async function onSped(e: React.ChangeEvent<HTMLInputElement>) {
    const f=e.target.files?.[0];if(!f)return;
    setErro("");setArq(f.name);
    try{
      const {itens:orig,empresa}=parseSped(await f.text());
      const ind=empresa?.ehIndustrial??false;
      setEmp(empresa);
      setEhIndustrial(ind);
      if(!orig.length){setLinhas([]);setErro("Nenhum item de entrada encontrado. Verifique se o SPED contém C100 com IND_OPER=0.");return;}
      setLinhas(reproc(orig,perfil,ind));
    }
    catch{setLinhas([]);setEmp(null);setErro("Erro ao ler o SPED. Verifique se está em formato .txt.");}
  }

  async function onXml(e: React.ChangeEvent<HTMLInputElement>) {
    const files=e.target.files;if(!files||files.length===0)return;

    // ── PASSO 1: ler todos os textos e separar cancelamentos de NF-e normais ──
    const txts: {nome:string;txt:string}[] = [];
    for(const f of Array.from(files)) txts.push({nome:f.name,txt:await f.text()});

    // Coleta chaves canceladas (arquivos de evento de cancelamento)
    const chavesCanceladas = new Set<string>();
    for(const {txt} of txts){
      const chCanc = detectarCancelamento(txt);
      if(chCanc) chavesCanceladas.add(chCanc);
    }

    // ── PASSO 2: processar NF-e normais, marcando as canceladas ──────────────
    const ne: LinhaEntrada[]=[], ns: LinhaSaida[]=[];
    let qtdCanc = 0;
    for(const {txt} of txts){
      // Pula arquivos de evento (já processamos acima)
      if(detectarCancelamento(txt)) continue;

      const {itensEntrada,itensSaida,chaveNFe}=parseXml(txt,perfil);
      const ehCancelada = !!chaveNFe && chavesCanceladas.has(chaveNFe);
      if(ehCancelada) qtdCanc++;

      if(ehCancelada){
        // Marca todos os itens como cancelados, zerando valores
        ne.push(...itensEntrada.map(i=>({
          ...i,
          valor_contabil:0, valor_produto:0, valor_desconto:0, valor_frete:0,
          valor_despesas:0, valor_ipi_item:0,
          base_icms:0, aliquota_icms:0, valor_icms:0,
          status:"ALERTA" as StatusValidacao,
          avisos:["⚠ NOTA CANCELADA — evento de cancelamento localizado na pasta."],
          cancelada:true,
          classificacao:"nao_recebido" as ClassificacaoManual,
        })));
        ns.push(...itensSaida.map(i=>({
          ...i,
          valor_contabil:0, valor_produto:0, valor_desconto:0, valor_frete:0,
          valor_despesas:0, valor_ipi_item:0,
          base_icms:0, valor_icms:0, valor_st:0, valor_ipi:0,
          valor_pis:0, valor_cofins:0, valor_ibs:0, valor_cbs:0,
          alertas_saida:["⚠ NOTA CANCELADA — evento de cancelamento localizado na pasta."],
          status:"ALERTA" as StatusValidacao,
          cancelada:true,
        })));
      } else {
        ne.push(...itensEntrada);
        ns.push(...itensSaida);
      }
    }

    if(ne.length>0){
      setLinhas(prev=>{
        const numXml=new Set(ne.map(n=>n.numero_nota));
        const fil=prev.filter(l=>!(l.fonte==="c190"&&numXml.has(l.numero_nota)));
        const numSped=new Set(prev.filter(l=>l.fonte==="sped").map(l=>l.numero_nota));
        const add=ne.filter(n=>!numSped.has(n.numero_nota));
        return vinculoUC([...fil,...add]);
      });
    }
    if(ns.length>0){
      setSaidas(prev=>{const ex=new Set(prev.map(i=>`${i.numero_nota}__${i.codigo_produto}`));return [...prev,...ns.filter(i=>!ex.has(`${i.numero_nota}__${i.codigo_produto}`))]});
    }
    if(!ne.length&&!ns.length) setErro("Nenhum item encontrado nos XMLs. Verifique se são NF-e válidas.");
    else { setErro(""); if(qtdCanc>0) setInfoCanc(`${qtdCanc} nota(s) cancelada(s) detectada(s) e marcada(s) com valores zerados.`); }
  }

  function setClass(id:string,cl:ClassificacaoManual){setLinhas(p=>p.map(l=>l.id===id?{...l,classificacao:cl}:l));}
  function setClassNota(chave:string,cl:ClassificacaoManual){const[n,...rf]=chave.split("__");const forn=rf.join("__");setLinhas(p=>p.map(l=>l.numero_nota===n&&l.fornecedor===forn?{...l,classificacao:cl}:l));}
  function limpar(){setLinhas([]);setSaidas([]);setEmp(null);setArq("");setErro("");setInfoCanc("");setEhIndustrial(false);setPerfil("geral");setExpandidas(new Set());setExpandidasS(new Set());setFiltros({somenteAlertas:false,cfop:"",ncm:"",busca:"",classificacao:""});if(refSped.current)refSped.current.value="";if(refXml.current)refXml.current.value="";}
  function changePerfil(p:PerfilEmpresa){setPerfil(p);setLinhas(prev=>reproc(prev,p,ehIndustrial));}
  function toggleE(c:string){setExpandidas(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});}
  function toggleS(c:string){setExpandidasS(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});}

  // Filtro especial: "nao_classificado" = classificacao === null
  const lf=useMemo(()=>linhas.filter(l=>{
    if(filtros.somenteAlertas&&l.status!=="ALERTA")return false;
    if(filtros.cfop&&!l.cfop.includes(filtros.cfop.replace(/\D/g,"")))return false;
    if(filtros.ncm&&!l.ncm.toLowerCase().includes(filtros.ncm.toLowerCase()))return false;
    // "nao_classificado" é o valor especial para itens sem classificação
    if(filtros.classificacao==="nao_classificado"&&l.classificacao!==null)return false;
    else if(filtros.classificacao&&filtros.classificacao!=="nao_classificado"&&l.classificacao!==filtros.classificacao)return false;
    if(filtros.busca){const t=`${l.numero_nota} ${l.fornecedor} ${l.descricao} ${l.ncm} ${l.cfop} ${l.codigo_produto}`.toLowerCase();if(!t.includes(filtros.busca.toLowerCase()))return false;}
    return true;
  }),[linhas,filtros]);

  const res=useMemo(()=>({
    totalNotas:new Set(linhas.map(l=>`${l.numero_nota}__${l.fornecedor}`)).size,
    notasAlerta:new Set(linhas.filter(l=>l.status==="ALERTA").map(l=>`${l.numero_nota}__${l.fornecedor}`)).size,
    totalValor:linhas.reduce((a,l)=>a+l.valor_contabil,0),
    totalIcms:linhas.reduce((a,l)=>a+l.valor_icms,0),
    totalItens:linhas.length,
    naoClassificados:linhas.filter(l=>l.classificacao===null).length,
  }),[linhas]);

  const nf=useMemo(()=>{const n=agruparEntradas(lf);return filtros.somenteAlertas?n.filter(n=>n.status==="ALERTA"):n;},[lf,filtros.somenteAlertas]);

  // Resumo por CFOP — entradas
  const resumoCfopEntradas=useMemo(()=>{
    const m=new Map<string,{cfop:string;descricao:string;qtd_notas:number;qtd_itens:number;valor_contabil:number;base_icms:number;valor_icms:number}>();
    for(const l of linhas){
      if(!m.has(l.cfop)) m.set(l.cfop,{cfop:l.cfop,descricao:descCFOP(l.cfop),qtd_notas:0,qtd_itens:0,valor_contabil:0,base_icms:0,valor_icms:0});
      const g=m.get(l.cfop)!;
      g.qtd_itens++; g.valor_contabil+=l.valor_contabil; g.base_icms+=l.base_icms; g.valor_icms+=l.valor_icms;
    }
    // contar notas únicas por CFOP
    const notasPorCfop=new Map<string,Set<string>>();
    for(const l of linhas){if(!notasPorCfop.has(l.cfop))notasPorCfop.set(l.cfop,new Set());notasPorCfop.get(l.cfop)!.add(l.numero_nota);}
    for(const [cfop,g] of m.entries()) g.qtd_notas=notasPorCfop.get(cfop)?.size||0;
    return Array.from(m.values()).sort((a,b)=>b.valor_contabil-a.valor_contabil);
  },[linhas]);

  // Resumo por CFOP — saídas
  const resumoCfopSaidas=useMemo(()=>{
    const m=new Map<string,{cfop:string;descricao:string;qtd_notas:number;qtd_itens:number;valor_contabil:number;base_icms:number;valor_icms:number}>();
    for(const s of saidas){
      if(!m.has(s.cfop)) m.set(s.cfop,{cfop:s.cfop,descricao:descCFOP(s.cfop),qtd_notas:0,qtd_itens:0,valor_contabil:0,base_icms:0,valor_icms:0});
      const g=m.get(s.cfop)!;
      g.qtd_itens++; g.valor_contabil+=s.valor_contabil; g.base_icms+=s.base_icms; g.valor_icms+=s.valor_icms;
    }
    const notasPorCfop=new Map<string,Set<string>>();
    for(const s of saidas){if(!notasPorCfop.has(s.cfop))notasPorCfop.set(s.cfop,new Set());notasPorCfop.get(s.cfop)!.add(s.numero_nota);}
    for(const [cfop,g] of m.entries()) g.qtd_notas=notasPorCfop.get(cfop)?.size||0;
    return Array.from(m.values()).sort((a,b)=>b.valor_contabil-a.valor_contabil);
  },[saidas]);
  const ifs=useMemo(()=>filtros.somenteAlertas?lf.filter(l=>l.status==="ALERTA"):lf,[lf,filtros.somenteAlertas]);

  // Saídas filtradas e agrupadas
  const saidasFiltradas=useMemo(()=>saidas.filter(i=>{if(soAlerS&&i.status!=="ALERTA")return false;if(buscaS){const t=`${i.numero_nota} ${i.destinatario} ${i.descricao} ${i.ncm} ${i.cfop} ${i.cbenef}`.toLowerCase();if(!t.includes(buscaS.toLowerCase()))return false;}return true;}),[saidas,soAlerS,buscaS]);
  const notasSaida=useMemo(()=>agruparSaidas(saidasFiltradas),[saidasFiltradas]);

  // ── TOKENS DE TEMA ────────────────────────────────────────────────────────
  const T = D ? {
    // ── ESCURO ──────────────────────────────────────────────────────────────
    pageBg:   "radial-gradient(circle at top left,rgba(39,199,216,0.09),transparent 28%),radial-gradient(circle at bottom right,rgba(26,107,122,0.08),transparent 28%),linear-gradient(180deg,#020e17 0%,#031623 60%,#020e17 100%)",
    pageClr:  "#eef6fb",
    cardBg:   "linear-gradient(160deg,rgba(9,30,46,0.95) 0%,rgba(5,18,28,0.98) 100%)",
    cardBrd:  "1px solid rgba(127,221,228,0.10)",
    cardShd:  "0 20px 48px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.025)",
    inpBg:    "rgba(255,255,255,0.055)",
    inpBrd:   "1px solid rgba(127,221,228,0.16)",
    inpClr:   "#eef6fb",
    accent:   "#8fe1e8",
    accentDim:"rgba(143,225,232,0.5)",
    thBg:     "rgba(5,18,28,0.9)",
    thClr:    "#8fe1e8",
    thBrd:    "1px solid rgba(127,221,228,0.1)",
    tdBrd:    "1px solid rgba(127,221,228,0.055)",
    tdSubBrd: "1px solid rgba(127,221,228,0.05)",
    subThClr: "rgba(143,225,232,0.65)",
    bGbg:     "rgba(255,255,255,0.05)",
    bGbrd:    "1px solid rgba(127,221,228,0.16)",
    bGclr:    "#8fe1e8",
    statBg:   "rgba(255,255,255,0.03)",
    statBrd:  "1px solid rgba(127,221,228,0.08)",
    statDim:  "rgba(143,225,232,0.45)",
    ttBg:     "rgba(5,18,28,0.98)",
    ttBrd:    "1px solid rgba(127,221,228,0.2)",
  } : {
    // ── CLARO — contraste elevado ────────────────────────────────────────────
    pageBg:   "linear-gradient(180deg,#eef6f8 0%,#e4f2f5 60%,#eef6f8 100%)",
    pageClr:  "#0a1f28",           // texto principal: azul-petróleo escuro
    cardBg:   "#ffffff",
    cardBrd:  "1px solid #c8e8ed",
    cardShd:  "0 2px 16px rgba(0,0,0,0.07)",
    inpBg:    "#ffffff",
    inpBrd:   "1px solid #7ecdd6",
    inpClr:   "#0a1f28",
    accent:   "#0a6674",           // teal escuro — contraste AAA sobre branco
    accentDim:"#156d7a",           // um pouco mais claro mas ainda legível
    thBg:     "#d4eef2",           // fundo do cabeçalho: teal muito suave
    thClr:    "#083e49",           // cabeçalho: azul-petróleo bem escuro
    thBrd:    "1px solid #a8d8df",
    tdBrd:    "1px solid #daeef1",
    tdSubBrd: "1px solid #e5f4f7",
    subThClr: "#0a5a67",
    bGbg:     "#ffffff",
    bGbrd:    "1px solid #7ecdd6",
    bGclr:    "#0a6674",
    statBg:   "#f0f9fb",
    statBrd:  "1px solid #b8dfe5",
    statDim:  "#2a7a88",
    ttBg:     "#ffffff",
    ttBrd:    "1px solid #a8d8df",
  };

  // ── ESTILOS ────────────────────────────────────────────────────────────────
  const S={
    page:{minHeight:"100vh",background:T.pageBg,color:T.pageClr,padding:"28px 20px 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"} as React.CSSProperties,
    inner:{position:"relative" as const,maxWidth:1440,margin:"0 auto"},
    card:{borderRadius:20,background:T.cardBg,border:T.cardBrd,boxShadow:T.cardShd} as React.CSSProperties,
    inp:{background:T.inpBg,border:T.inpBrd,borderRadius:10,color:T.inpClr,padding:"8px 12px",fontSize:13,outline:"none",width:"100%"} as React.CSSProperties,
    bP:{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:"linear-gradient(135deg,#27c7d8,#1a8fa0)",color:"#020e17",fontWeight:700,fontSize:13,padding:"10px 18px",border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(39,199,216,0.25)"} as React.CSSProperties,
    bG:{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:T.bGbg,border:T.bGbrd,color:T.bGclr,fontWeight:600,fontSize:13,padding:"10px 18px",cursor:"pointer"} as React.CSSProperties,
    bD:{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.18)",color:D?"#fca5a5":"#b91c1c",fontWeight:600,fontSize:13,padding:"10px 18px",cursor:"pointer"} as React.CSSProperties,
    th:{padding:"10px 14px",fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const,color:T.thClr,whiteSpace:"nowrap" as const,background:T.thBg,borderBottom:T.thBrd},
    td:{padding:"10px 14px",fontSize:12,verticalAlign:"middle" as const,borderTop:T.tdBrd,color:T.pageClr},
    thSub:{padding:"7px 10px",fontWeight:700,color:T.subThClr,textAlign:"left" as const,whiteSpace:"nowrap" as const,fontSize:10,textTransform:"uppercase" as const},
    tdSub:{padding:"7px 10px",fontSize:11,verticalAlign:"top" as const,borderTop:T.tdSubBrd,color:T.pageClr},
  };

  function SelCl({val,onChange,mini=false}:{val:ClassificacaoManual;onChange:(v:ClassificacaoManual)=>void;mini?:boolean}) {
    const cor=val?CLASSIFICACAO_COR[val]:T.accentDim;
    const optBg=D?"#031623":"#ffffff";
    return <select value={val||""} onChange={e=>onChange((e.target.value as ClassificacaoManual)||null)} style={{background:val?`${cor}18`:T.inpBg,border:`1px solid ${val?cor+"55":D?"rgba(127,221,228,0.15)":"rgba(39,199,216,0.22)"}`,borderRadius:8,color:cor,padding:mini?"3px 8px":"5px 10px",fontSize:mini?10:11,fontWeight:600,cursor:"pointer",outline:"none",minWidth:mini?120:150}}>
      <option value="" style={{background:optBg,color:T.accent}}>A classificar</option>
      {Object.entries(CLASSIFICACAO_LABEL).map(([v,lb])=><option key={v} value={v} style={{background:optBg,color:T.pageClr}}>{lb}</option>)}
    </select>;
  }

  function Tg({st,cancelada}:{st:StatusValidacao;cancelada?:boolean}) {
    if(cancelada) return <span style={{display:"inline-flex",alignItems:"center",gap:4,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.3)",color:"#c4b5fd",whiteSpace:"nowrap" as const}}>🚫 CANCELADA</span>;
    const ok=st==="OK";
    return <span style={{display:"inline-flex",alignItems:"center",gap:4,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,background:ok?"rgba(34,197,94,0.10)":"rgba(251,191,36,0.10)",border:ok?"1px solid rgba(34,197,94,0.25)":"1px solid rgba(251,191,36,0.25)",color:ok?"#86efac":"#fcd34d",whiteSpace:"nowrap" as const}}>{ok?<CheckCircle2 size={10}/>:<AlertTriangle size={10}/>}{st}</span>;
  }

  const vazio=linhas.length===0&&saidas.length===0;

  // Tooltip de composição do valor contábil
  function ComposicaoValor({item}:{item:{valor_produto:number;valor_desconto:number;valor_frete:number;valor_despesas:number;valor_ipi_item:number;valor_contabil:number}}) {
    const temRateio = item.valor_frete>0 || item.valor_despesas>0 || item.valor_desconto>0 || item.valor_ipi_item>0;
    if (!temRateio) return <span>{fmoe(item.valor_contabil)}</span>;
    return (
      <div style={{position:"relative" as const}} className="comp-valor">
        <span style={{borderBottom:"1px dashed rgba(143,225,232,0.4)",cursor:"help",color:"#8fe1e8"}}>
          {fmoe(item.valor_contabil)}
        </span>
        <div style={{position:"absolute" as const,bottom:"100%",left:0,zIndex:100,background:T.ttBg,border:T.ttBrd,borderRadius:10,padding:"10px 14px",minWidth:240,boxShadow:"0 8px 24px rgba(0,0,0,0.5)",pointerEvents:"none" as const,display:"none"}} className="comp-tooltip">
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6,opacity:0.75}}>Composição do valor</div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:3,fontSize:11}}>
            <div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:T.accentDim}}>Valor produto</span><span style={{color:T.pageClr}}>{fmoe(item.valor_produto)}</span></div>
            {item.valor_frete>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>+ Frete rateado</span><span style={{color:"#34d399"}}>+{fmoe(item.valor_frete)}</span></div>}
            {item.valor_despesas>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>+ Despesas rateadas</span><span style={{color:"#60a5fa"}}>+{fmoe(item.valor_despesas)}</span></div>}
            {item.valor_ipi_item>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>+ IPI</span><span style={{color:"#a78bfa"}}>+{fmoe(item.valor_ipi_item)}</span></div>}
            {item.valor_desconto>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>− Desconto rateado</span><span style={{color:"#fb923c"}}>-{fmoe(item.valor_desconto)}</span></div>}
            <div style={{borderTop:T.thBrd,paddingTop:4,marginTop:2,display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:T.accent,fontWeight:700}}>Total contábil</span><span style={{color:T.pageClr,fontWeight:700}}>{fmoe(item.valor_contabil)}</span></div>
          </div>
        </div>
        <style>{".comp-valor:hover .comp-tooltip{display:block!important}"}</style>
      </div>
    );
  }

  return (
    <main style={S.page}><div style={S.inner}>

      {/* HEADER */}
      <div style={{...S.card,padding:"24px 28px",marginBottom:16}}>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:20,alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            {/* Logo Enfokus */}
            <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:D?"rgba(0,0,0,0.30)":"rgba(13,45,56,0.92)",borderRadius:16,padding:"10px 18px",boxShadow:"0 4px 20px rgba(39,199,216,0.20)"}}>
              <img
                src="/logo-enfokus-white.png"
                alt="Enfokus"
                style={{height:60,width:"auto",maxWidth:220,objectFit:"contain",display:"block"}}
                onError={e=>{(e.target as HTMLImageElement).style.display="none";(e.target as HTMLImageElement).parentElement!.innerHTML='<span style="font-size:28px;font-weight:900;color:#27c7d8;letter-spacing:-1px">E</span>';}}
              />
            </div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase" as const,color:"#27c7d8"}}>Validador Fiscal</div>
                <span style={{fontSize:10,fontWeight:700,background:"linear-gradient(135deg,#27c7d8,#1a8fa0)",color:"#020e17",borderRadius:20,padding:"2px 8px",letterSpacing:"0.04em"}}>v2.0</span>
              </div>
              <h1 style={{margin:0,fontSize:22,fontWeight:700,color:D?"#f4f8fb":T.pageClr,letterSpacing:-0.3}}>Validação de Entradas e Saídas</h1>
              <p style={{margin:"4px 0 0",fontSize:12,color:T.accentDim,lineHeight:1.5}}>Importe SPED Fiscal e/ou XMLs de NF-e para análise completa — entradas, saídas e benefícios fiscais (CBenef GO)</p>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,alignItems:"center"}}>
            <label style={{...S.bP,cursor:"pointer"}}><Upload size={14}/>SPED Fiscal<input ref={refSped} type="file" accept=".txt" style={{display:"none"}} onChange={onSped}/></label>
            <label style={{...S.bG,cursor:"pointer"}}><FileText size={14}/>XMLs NF-e<input ref={refXml} type="file" accept=".xml" multiple style={{display:"none"}} onChange={onXml}/></label>
            <button type="button" onClick={()=>exportExcel(nf,saidas,emp)} disabled={vazio} style={{...S.bG,opacity:vazio?0.35:1,cursor:vazio?"not-allowed":"pointer"}}><Download size={14}/>Exportar Excel</button>
            {/* Botão alternância de tema */}
            <button type="button" onClick={()=>setTema(t=>t==="escuro"?"claro":"escuro")}
              title={D?"Mudar para tema claro":"Mudar para tema escuro"}
              style={{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:D?"rgba(255,255,255,0.06)":"rgba(13,45,56,0.08)",border:D?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(39,199,216,0.22)",color:T.bGclr,fontWeight:600,fontSize:13,padding:"10px 14px",cursor:"pointer",transition:"all 0.2s"}}>
              {D ? "☀️" : "🌙"}<span style={{fontSize:12}}>{D?"Claro":"Escuro"}</span>
            </button>
            <button type="button" onClick={limpar} style={S.bD}><Trash2 size={14}/>Limpar</button>
          </div>
        </div>

        {/* ENTRADAS */}
        <div style={{marginTop:16}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase" as const,color:D?"rgba(143,225,232,0.4)":"rgba(10,102,116,0.4)",marginBottom:8,display:"flex",alignItems:"center",gap:5}}><ArrowDownLeft size={11}/>Entradas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[{lb:"Notas",v:res.totalNotas,sub:`${res.totalItens} itens`,cor:"#8fe1e8"},{lb:"Notas OK",v:res.totalNotas-res.notasAlerta,sub:"sem alertas",cor:"#86efac"},{lb:"Com Alerta",v:res.notasAlerta,sub:"revisar",cor:"#fcd34d"},{lb:"Valor Total",v:fmoe(res.totalValor),sub:"entradas",cor:"#8fe1e8"},{lb:"ICMS",v:fmoe(res.totalIcms),sub:"a conferir",cor:"#a78bfa"}].map(s=>(
              <div key={s.lb} style={{borderRadius:14,background:T.statBg,border:T.statBrd,padding:"12px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.07em",color:T.accent,marginBottom:4,opacity:0.75}}>{s.lb}</div>
                <div style={{fontSize:18,fontWeight:700,color:s.cor,lineHeight:1.2}}>{s.v}</div>
                <div style={{fontSize:10,color:T.statDim,marginTop:2}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
        {/* SAIDAS — aparece apenas quando ha XMLs de saida */}
        {saidas.length>0&&<div style={{marginTop:14}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase" as const,color:"rgba(52,211,153,0.5)",marginBottom:8,display:"flex",alignItems:"center",gap:5}}><ArrowUpRight size={11}/>Saidas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[
              {lb:"Notas",v:new Set(saidas.map(i=>`${i.numero_nota}__${i.destinatario}`)).size,sub:`${saidas.length} itens`,cor:"#34d399"},
              {lb:"Com Alerta",v:saidas.filter(i=>i.status==="ALERTA").length,sub:"verificar",cor:saidas.filter(i=>i.status==="ALERTA").length>0?"#fcd34d":"#86efac"},
              {lb:"Valor Total",v:fmoe(saidas.reduce((a,i)=>a+i.valor_contabil,0)),sub:"saidas",cor:"#34d399"},
              {lb:"ICMS",v:fmoe(saidas.reduce((a,i)=>a+i.valor_icms,0)),sub:"destacado",cor:"#a78bfa"},
              {lb:"PIS + COFINS",v:fmoe(saidas.reduce((a,i)=>a+i.valor_pis+i.valor_cofins,0)),sub:`${saidas.filter(i=>i.cbenef&&i.cbenef!=="SEM CBENEF").length} com CBenef`,cor:"#60a5fa"},
            ].map(s=>(
              <div key={s.lb} style={{borderRadius:14,background:D?"rgba(52,211,153,0.03)":"rgba(52,211,153,0.06)",border:D?"1px solid rgba(52,211,153,0.1)":"1px solid rgba(52,211,153,0.2)",padding:"12px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.07em",color:D?"rgba(52,211,153,0.55)":"rgba(5,100,60,0.7)",marginBottom:4}}>{s.lb}</div>
                <div style={{fontSize:18,fontWeight:700,color:s.cor,lineHeight:1.2}}>{s.v}</div>
                <div style={{fontSize:10,color:D?"rgba(52,211,153,0.35)":"rgba(5,100,60,0.45)",marginTop:2}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>}

        {emp&&<div style={{marginTop:14,display:"flex",flexWrap:"wrap" as const,gap:20,background:D?"rgba(39,199,216,0.04)":"rgba(39,199,216,0.07)",border:D?"1px solid rgba(127,221,228,0.09)":"1px solid rgba(39,199,216,0.18)",borderRadius:14,padding:"12px 18px",fontSize:12}}>
          <div><span style={{color:T.accentDim}}>Empresa: </span><strong style={{color:T.pageClr}}>{emp.nome}</strong></div>
          <div><span style={{color:T.accentDim}}>CNPJ: </span><strong style={{color:T.pageClr}}>{fcnpj(emp.cnpj)}</strong></div>
          <div><span style={{color:T.accentDim}}>IE: </span><strong style={{color:T.pageClr}}>{emp.ie||"—"}</strong></div>
          <div><span style={{color:T.accentDim}}>UF: </span><strong style={{color:T.pageClr}}>{emp.uf}</strong></div>
          <div><span style={{color:T.accentDim}}>Período: </span><strong style={{color:T.pageClr}}>{emp.periodoInicial} até {emp.periodoFinal}</strong></div>
          <div><span style={{color:T.accentDim}}>Tipo: </span><strong style={{color:ehIndustrial?"#4ade80":T.pageClr}}>{ehIndustrial?"Industrial/Equiparado":"Comércio/Serviço"}</strong></div>
          {arq&&<div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,color:T.accentDim}}><FileText size={12}/>{arq}</div>}
        </div>}
        {erro&&<div style={{marginTop:12,background:D?"rgba(239,68,68,0.07)":"rgba(239,68,68,0.07)",border:D?"1px solid rgba(239,68,68,0.18)":"1px solid rgba(200,30,30,0.25)",borderRadius:10,padding:"10px 16px",fontSize:13,color:D?"#fca5a5":"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}><FileX size={15} style={{flexShrink:0,marginTop:1}}/>{erro}</div>}
        {infoCanc&&<div style={{marginTop:10,background:D?"rgba(167,139,250,0.07)":"rgba(130,100,250,0.08)",border:D?"1px solid rgba(167,139,250,0.22)":"1px solid rgba(100,70,200,0.25)",borderRadius:10,padding:"10px 16px",fontSize:13,color:D?"#c4b5fd":"#5b2dcc",display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:16}}>🚫</span>{infoCanc}</div>}
      </div>

      {/* MÓDULOS */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {([["entradas","Entradas",<ArrowDownLeft size={14}/>],["saidas","Saídas",<ArrowUpRight size={14}/>],["cfop","Resumo CFOP",<Tag size={14}/>]] as const).map(([m,lb,ic])=>(
          <button key={m} type="button" onClick={()=>setModulo(m as "entradas"|"saidas")} style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:12,fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:modulo===m?D?"rgba(39,199,216,0.12)":"rgba(39,199,216,0.1)":D?"rgba(255,255,255,0.04)":"rgba(39,199,216,0.04)",color:modulo===m?T.accent:T.accentDim,borderBottom:modulo===m?"2px solid #27c7d8":"2px solid transparent"}}>
            {ic}{lb} {m==="entradas"?`(${linhas.length} itens)`:m==="saidas"?`(${saidas.length} itens)`:``}
          </button>
        ))}
      </div>

      {/* ═══════════════════ ENTRADAS ═══════════════════ */}
      {modulo==="entradas"&&<>
        <div style={{...S.card,padding:"18px 24px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,color:T.accent,fontWeight:700,fontSize:12,letterSpacing:"0.06em",textTransform:"uppercase" as const}}><Filter size={13}/>Filtros e Configurações</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
            <div style={{position:"relative" as const}}><Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#8fe1e8",opacity:0.5}}/><input value={filtros.busca} onChange={e=>setFiltros(f=>({...f,busca:e.target.value}))} placeholder="Nota, fornecedor, descrição..." style={{...S.inp,paddingLeft:30}}/></div>
            <input value={filtros.cfop} onChange={e=>setFiltros(f=>({...f,cfop:e.target.value}))} placeholder="CFOP" style={S.inp}/>
            <input value={filtros.ncm} onChange={e=>setFiltros(f=>({...f,ncm:e.target.value}))} placeholder="NCM" style={S.inp}/>
            {/* Filtro classificação — agora inclui "Não classificado" */}
            <select value={filtros.classificacao} onChange={e=>setFiltros(f=>({...f,classificacao:e.target.value}))} style={S.inp}>
              <option value="">Todas as classificações</option>
              <option value="nao_classificado" style={{background:"#031623",color:"#facc15"}}>⚠ Não classificado ({res.naoClassificados})</option>
              {Object.entries(CLASSIFICACAO_LABEL).map(([v,lb])=><option key={v} value={v} style={{background:"#031623"}}>{lb}</option>)}
            </select>
            <select value={perfil} onChange={e=>changePerfil(e.target.value as PerfilEmpresa)} style={S.inp}>{Object.entries(PERFIS_EMPRESA_LABEL).map(([v,lb])=><option key={v} value={v} style={{background:"#031623"}}>{lb}</option>)}</select>
            <label style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:T.accent,cursor:"pointer",background:D?"rgba(255,255,255,0.04)":"rgba(10,102,116,0.05)",border:D?"1px solid rgba(127,221,228,0.13)":"1px solid rgba(10,102,116,0.18)",borderRadius:10,padding:"8px 12px",whiteSpace:"nowrap" as const}}><input type="checkbox" checked={filtros.somenteAlertas} onChange={e=>setFiltros(f=>({...f,somenteAlertas:e.target.checked}))} style={{accentColor:"#27c7d8"}}/>Só alertas</label>
          </div>
        </div>

        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {(["notas","itens"] as const).map(a=>(
            <button key={a} type="button" onClick={()=>setAbaE(a)} style={{padding:"8px 20px",borderRadius:"12px 12px 0 0",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:abaE===a?D?"rgba(39,199,216,0.12)":"rgba(39,199,216,0.1)":D?"rgba(255,255,255,0.03)":"rgba(39,199,216,0.04)",color:abaE===a?T.accent:T.accentDim,borderBottom:abaE===a?"2px solid #27c7d8":"2px solid transparent"}}>
              {a==="notas"?`Por Nota (${nf.length})`:`Por Produto (${ifs.length})`}
            </button>
          ))}
        </div>

        {/* TABELA NOTAS ENTRADA */}
        {abaE==="notas"&&<div style={{...S.card,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
              <thead><tr><th style={{...S.th,width:32}}></th>{["Nota","Data","Fornecedor","Itens","Valor","Base ICMS","ICMS","Classificação","Sugestões","Alertas","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!nf.length?<tr><td colSpan={12} style={{padding:"60px 20px",textAlign:"center",color:D?"rgba(143,225,232,0.4)":"rgba(10,102,116,0.4)",fontSize:14}}>{linhas.length===0?"Importe um SPED ou XMLs para iniciar.":"Nenhuma nota corresponde aos filtros."}</td></tr>
                :nf.map(nota=>{const exp=expandidas.has(nota.chave);return(
                  <React.Fragment key={nota.chave}>
                    <tr style={{background:nota.itens.some(i=>i.cancelada)?D?"rgba(167,139,250,0.04)":"rgba(167,139,250,0.08)":nota.status==="OK"?D?"rgba(34,197,94,0.025)":"rgba(34,197,94,0.06)":D?"rgba(251,191,36,0.04)":"rgba(251,191,36,0.09)"}}>
                      <td style={{...S.td,textAlign:"center" as const,cursor:"pointer"}} onClick={()=>toggleE(nota.chave)}>{exp?<ChevronDown size={14} color="#8fe1e8"/>:<ChevronRight size={14} color="rgba(143,225,232,0.4)"/>}</td>
                      <td style={{...S.td,fontWeight:700,color:D?"#f4f8fb":T.pageClr}}>{nota.numero_nota}</td>
                      <td style={{...S.td,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{nota.data}</td>
                      <td style={{...S.td,maxWidth:260,color:T.pageClr}}>{nota.fornecedor}</td>
                      <td style={{...S.td,textAlign:"center" as const,color:"#8fe1e8"}}>{nota.total_itens}</td>
                      <td style={S.td}>{fmoe(nota.total_contabil)}</td>
                      <td style={S.td}>{fmoe(nota.total_base_icms)}</td>
                      <td style={S.td}>{fmoe(nota.total_valor_icms)}</td>
                      <td style={S.td}><SelCl val={nota.classificacaoPredominante} onChange={v=>setClassNota(nota.chave,v)}/></td>
                      <td style={S.td}><div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>{nota.sugestoes.length?nota.sugestoes.map((s,i)=><span key={i} style={{background:D?"rgba(39,199,216,0.09)":"rgba(10,102,116,0.10)",border:D?"1px solid rgba(39,199,216,0.18)":"1px solid rgba(10,102,116,0.25)",borderRadius:20,padding:"2px 9px",fontSize:11,color:T.accent}}>{s}</span>):<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</div></td>
                      <td style={S.td}><div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>{nota.avisos.filter(a=>a!=="Sem inconsistências.").slice(0,2).map((a,i)=><span key={i} style={{background:D?"rgba(251,191,36,0.07)":"rgba(180,120,0,0.09)",border:D?"1px solid rgba(251,191,36,0.16)":"1px solid rgba(180,120,0,0.25)",borderRadius:20,padding:"2px 9px",fontSize:11,color:D?"#fcd34d":"#7a5000"}}>{a.slice(0,55)}{a.length>55?"…":""}</span>)}{!nota.avisos.filter(a=>a!=="Sem inconsistências.").length&&<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</div></td>
                      <td style={S.td}><Tg st={nota.status} cancelada={nota.itens.every(i=>i.cancelada)}/></td>
                    </tr>
                    {exp&&<tr style={{background:"rgba(5,18,28,0.6)"}}><td colSpan={12} style={{padding:"0 12px 12px 44px"}}>
                      <div style={{borderRadius:12,background:"rgba(39,199,216,0.03)",border:"1px solid rgba(127,221,228,0.09)",overflow:"hidden",marginTop:6}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr style={{background:"rgba(5,18,28,0.7)"}}>{["Cód.","Descrição","NCM","CFOP","CST","Valor","Base ICMS","Alíq.","ICMS","Classificação","Sugestão","Status"].map(h=><th key={h} style={S.thSub}>{h}</th>)}</tr></thead>
                          <tbody>{nota.itens.map(item=>(
                            <tr key={item.id}>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.6)":T.accentDim}}>{item.codigo_produto||"—"}</td>
                              <td style={{...S.tdSub,maxWidth:260,color:T.pageClr,lineHeight:1.4}}>{item.descricao}</td>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{item.ncm||"—"}</td>
                              <td style={{...S.tdSub,color:T.accent,fontWeight:600}}>{item.cfop}</td>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{item.cst_icms||"—"}</td>
                              <td style={S.tdSub}><ComposicaoValor item={item}/></td>
                              <td style={S.tdSub}>{fmoe(item.base_icms)}</td>
                              <td style={S.tdSub}>{fperc(item.aliquota_icms)}</td>
                              <td style={S.tdSub}>{fmoe(item.valor_icms)}</td>
                              <td style={S.tdSub}><SelCl val={item.classificacao} onChange={v=>setClass(item.id,v)} mini/></td>
                              <td style={S.tdSub}>{item.sugestao.tipo?<div style={{background:D?"rgba(39,199,216,0.07)":"rgba(10,102,116,0.07)",border:D?"1px solid rgba(39,199,216,0.14)":"1px solid rgba(10,102,116,0.2)",borderRadius:7,padding:"4px 8px",lineHeight:1.4}}><div style={{fontWeight:700,color:T.accent,fontSize:10}}>{item.sugestao.tipo==="uso_consumo"?"Possível UC":item.sugestao.tipo==="imobilizado"?"Possível Imobilizado":"Possível Combustível"}</div><div style={{color:T.accentDim,fontSize:10,marginTop:1}}>{item.sugestao.motivo}</div></div>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}><Tg st={item.status} cancelada={item.cancelada}/></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </td></tr>}
                  </React.Fragment>
                );})}
              </tbody>
            </table>
          </div>
        </div>}

        {/* TABELA ITENS ENTRADA */}
        {abaE==="itens"&&<div style={{...S.card,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
              <thead><tr>{["Nota","Data","Fornecedor","Cód.","Descrição","NCM","CFOP","CST","Valor","Base ICMS","Alíq.","ICMS","Classificação","Sugestão","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!ifs.length?<tr><td colSpan={15} style={{padding:"60px 20px",textAlign:"center",color:D?"rgba(143,225,232,0.4)":"rgba(10,102,116,0.4)",fontSize:14}}>{linhas.length===0?"Importe um SPED ou XMLs para iniciar.":"Nenhum item corresponde aos filtros."}</td></tr>
                :ifs.map(item=><tr key={item.id} style={{background:item.cancelada?D?"rgba(167,139,250,0.05)":"rgba(167,139,250,0.08)":item.status==="ALERTA"?D?"rgba(251,191,36,0.03)":"rgba(251,191,36,0.08)":"transparent",opacity:item.cancelada?0.65:1,textDecoration:item.cancelada?"line-through":"none"}}>
                  <td style={{...S.td,fontWeight:700,color:D?"#f4f8fb":T.pageClr}}>{item.numero_nota}</td>
                  <td style={{...S.td,color:"rgba(238,246,251,0.6)"}}>{item.data}</td>
                  <td style={{...S.td,maxWidth:200,color:T.pageClr}}>{item.fornecedor}</td>
                  <td style={{...S.td,color:"rgba(238,246,251,0.6)"}}>{item.codigo_produto||"—"}</td>
                  <td style={{...S.td,maxWidth:280,color:T.pageClr}}>{item.descricao}</td>
                  <td style={S.td}>{item.ncm||"—"}</td>
                  <td style={{...S.td,color:T.accent,fontWeight:600}}>{item.cfop}</td>
                  <td style={S.td}>{item.cst_icms||"—"}</td>
                  <td style={S.td}><ComposicaoValor item={item}/></td>
                  <td style={S.td}>{fmoe(item.base_icms)}</td>
                  <td style={S.td}>{fperc(item.aliquota_icms)}</td>
                  <td style={S.td}>{fmoe(item.valor_icms)}</td>
                  <td style={S.td}><SelCl val={item.classificacao} onChange={v=>setClass(item.id,v)} mini/></td>
                  <td style={S.td}>{item.sugestao.tipo?<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(39,199,216,0.08)",border:"1px solid rgba(39,199,216,0.15)",borderRadius:20,padding:"2px 10px",fontSize:11,color:"#8fe1e8"}}><Tag size={10}/>{item.sugestao.tipo==="uso_consumo"?"UC":item.sugestao.tipo==="imobilizado"?"Imobilizado":"Combustível"}</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                  <td style={S.td}><Tg st={item.status} cancelada={item.cancelada}/></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {ifs.length>0&&<div style={{padding:"12px 20px",fontSize:11,color:T.statDim,borderTop:T.tdBrd,display:"flex",justifyContent:"space-between" as const,background:D?"transparent":"#f5fbfc"}}><span>{ifs.length} itens exibidos — {res.naoClassificados} sem classificação</span><span style={{opacity:0.5}}>Enfokus Validador Fiscal v2.0</span></div>}
        </div>}
      </>}

      {/* ═══════════════════ SAÍDAS ═══════════════════ */}
      {modulo==="saidas"&&<>
        <div style={{...S.card,padding:"18px 24px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,color:T.accent,fontWeight:700,fontSize:12,letterSpacing:"0.06em",textTransform:"uppercase" as const}}><Filter size={13}/>Filtros — Saídas</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr auto",gap:10,alignItems:"end"}}>
            <div style={{position:"relative" as const}}><Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#8fe1e8",opacity:0.5}}/><input value={buscaS} onChange={e=>setBuscaS(e.target.value)} placeholder="Nota, destinatário, descrição, NCM, CBenef..." style={{...S.inp,paddingLeft:30}}/></div>
            <label style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:T.accent,cursor:"pointer",background:D?"rgba(255,255,255,0.04)":"rgba(10,102,116,0.05)",border:D?"1px solid rgba(127,221,228,0.13)":"1px solid rgba(10,102,116,0.18)",borderRadius:10,padding:"8px 12px",whiteSpace:"nowrap" as const}}><input type="checkbox" checked={soAlerS} onChange={e=>setSoAlerS(e.target.checked)} style={{accentColor:"#27c7d8"}}/>Só alertas</label>
          </div>
        </div>



        {/* TABELA NOTAS SAÍDA — agrupada com expansão */}
        <div style={{...S.card,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
              <thead><tr>
                <th style={{...S.th,width:32}}></th>
                {["Nota","Data","Destinatário","Itens","Valor Total","ICMS","PIS","COFINS","IBS","CBS","CBenef","Alertas","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {!notasSaida.length?<tr><td colSpan={14} style={{padding:"60px 20px",textAlign:"center",color:D?"rgba(143,225,232,0.4)":"rgba(10,102,116,0.4)",fontSize:14}}>{saidas.length===0?"Importe XMLs de NF-e de saída para analisar.":"Nenhuma nota corresponde aos filtros."}</td></tr>
                :notasSaida.map(nota=>{const exp=expandidasS.has(nota.chave);const notaCancS=nota.itens.every(i=>i.cancelada);return(
                  <React.Fragment key={nota.chave}>
                    <tr style={{background:notaCancS?D?"rgba(167,139,250,0.04)":"rgba(167,139,250,0.08)":nota.status==="OK"?D?"rgba(34,197,94,0.025)":"rgba(34,197,94,0.06)":D?"rgba(251,191,36,0.04)":"rgba(251,191,36,0.09)"}}>
                      <td style={{...S.td,textAlign:"center" as const,cursor:"pointer"}} onClick={()=>toggleS(nota.chave)}>{exp?<ChevronDown size={14} color="#8fe1e8"/>:<ChevronRight size={14} color="rgba(143,225,232,0.4)"/>}</td>
                      <td style={{...S.td,fontWeight:700,color:D?"#f4f8fb":T.pageClr}}>{nota.numero_nota}</td>
                      <td style={{...S.td,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{nota.data}</td>
                      <td style={{...S.td,maxWidth:240,color:T.pageClr}}>{nota.destinatario}</td>
                      <td style={{...S.td,textAlign:"center" as const,color:"#8fe1e8"}}>{nota.total_itens}</td>
                      <td style={S.td}>{fmoe(nota.total_contabil)}</td>
                      <td style={S.td}>{fmoe(nota.total_icms)}</td>
                      <td style={S.td}>{fmoe(nota.total_pis)}</td>
                      <td style={S.td}>{fmoe(nota.total_cofins)}</td>
                      <td style={S.td}>{nota.total_ibs>0?<span style={{color:"#34d399",fontWeight:600}}>{fmoe(nota.total_ibs)}</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                      <td style={S.td}>{nota.total_cbs>0?<span style={{color:"#60a5fa",fontWeight:600}}>{fmoe(nota.total_cbs)}</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                      <td style={S.td}>{nota.tem_cbenef?<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:8,padding:"3px 9px",fontSize:11,color:"#a78bfa"}}>Sim</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</td>
                      <td style={S.td}><div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>{nota.alertas.length?nota.alertas.slice(0,2).map((a,i)=><span key={i} style={{background:D?"rgba(251,191,36,0.07)":"rgba(180,120,0,0.09)",border:D?"1px solid rgba(251,191,36,0.16)":"1px solid rgba(180,120,0,0.25)",borderRadius:20,padding:"2px 9px",fontSize:11,color:D?"#fcd34d":"#7a5000"}}>{a.slice(0,50)}{a.length>50?"…":""}</span>):<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</div></td>
                      <td style={S.td}><Tg st={nota.status} cancelada={notaCancS}/></td>
                    </tr>
                    {exp&&<tr style={{background:"rgba(5,18,28,0.6)"}}><td colSpan={14} style={{padding:"0 12px 12px 44px"}}>
                      <div style={{borderRadius:12,background:"rgba(39,199,216,0.03)",border:"1px solid rgba(127,221,228,0.09)",overflow:"hidden",marginTop:6}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr style={{background:"rgba(5,18,28,0.7)"}}>{["Cód.","Descrição","NCM","CFOP","CST","CST PIS","Valor","ICMS","Alíq.","ICMS-ST","IPI","PIS","COFINS","IBS","CBS","CBenef","Benefício Fiscal","Status"].map(h=><th key={h} style={S.thSub}>{h}</th>)}</tr></thead>
                          <tbody>{nota.itens.map(item=>(
                            <tr key={item.id} style={{borderTop:"1px solid rgba(127,221,228,0.05)",background:item.cancelada?D?"rgba(167,139,250,0.04)":"rgba(167,139,250,0.08)":"transparent",opacity:item.cancelada?0.7:1,textDecoration:item.cancelada?"line-through":"none"}}>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.6)":T.accentDim}}>{item.codigo_produto||"—"}</td>
                              <td style={{...S.tdSub,maxWidth:240,color:T.pageClr,lineHeight:1.4}}>{item.descricao}</td>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{item.ncm||"—"}</td>
                              <td style={{...S.tdSub,color:T.accent,fontWeight:600}}>{item.cfop}</td>
                              <td style={S.tdSub}>{item.cst_icms||"—"}</td>
                              <td style={S.tdSub}>{item.cst_pis||"—"}</td>
                              <td style={S.tdSub}><ComposicaoValor item={item}/></td>
                              <td style={S.tdSub}>{fmoe(item.valor_icms)}</td>
                              <td style={S.tdSub}>{fperc(item.aliquota_icms)}</td>
                              <td style={S.tdSub}>{item.valor_st>0?fmoe(item.valor_st):<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{item.valor_ipi>0?fmoe(item.valor_ipi):<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{fmoe(item.valor_pis)}</td>
                              <td style={S.tdSub}>{fmoe(item.valor_cofins)}</td>
                              <td style={S.tdSub}>{item.valor_ibs>0?<span style={{color:"#34d399",fontWeight:600}}>{fmoe(item.valor_ibs)}</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{item.valor_cbs>0?<span style={{color:"#60a5fa",fontWeight:600}}>{fmoe(item.valor_cbs)}</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{item.cbenef?<span title={item.cbenef_descricao} style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:7,padding:"2px 8px",fontSize:10,color:"#a78bfa",cursor:"help"}}>{item.cbenef}<Info size={8} style={{opacity:0.7}}/></span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={{...S.tdSub,maxWidth:200}}>{item.cbenef_descricao?<span style={{fontSize:10,color:"rgba(238,246,251,0.6)",lineHeight:1.4}}>{item.cbenef_descricao.slice(0,70)}{item.cbenef_descricao.length>70?"…":""}</span>:<span style={{color:D?"rgba(143,225,232,0.3)":"rgba(10,102,116,0.35)",fontSize:10}}>—</span>}</td>
                              <td style={S.tdSub}><Tg st={item.status} cancelada={item.cancelada}/></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </td></tr>}
                  </React.Fragment>
                );})}
              </tbody>
            </table>
          </div>
          {notasSaida.length>0&&<div style={{padding:"12px 20px",fontSize:11,color:D?"rgba(143,225,232,0.45)":"rgba(10,102,116,0.55)",borderTop:"1px solid rgba(127,221,228,0.07)"}}>{notasSaida.length} notas de saída exibidas — {saidasFiltradas.length} itens no total</div>}
        </div>
      </>}

      {/* ═══════════════════ RESUMO POR CFOP ═══════════════════ */}
      {modulo==="cfop"&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

          {/* CFOP ENTRADAS */}
          <div style={{...S.card,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:S.th.borderBottom,display:"flex",alignItems:"center",gap:8}}>
              <ArrowDownLeft size={14} color={T.accent}/>
              <span style={{fontWeight:700,fontSize:13,color:T.pageClr}}>Entradas por CFOP</span>
              <span style={{marginLeft:"auto",fontSize:11,color:T.accentDim}}>{resumoCfopEntradas.length} CFOPs — {linhas.length} itens</span>
            </div>
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
                <thead><tr>{["CFOP","Descrição","Notas","Itens","Valor Contábil","Base ICMS","ICMS"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!resumoCfopEntradas.length
                    ?<tr><td colSpan={7} style={{padding:"40px",textAlign:"center",color:T.accentDim}}>Importe um SPED para ver o resumo.</td></tr>
                    :resumoCfopEntradas.map(r=>(
                      <tr key={r.cfop} style={{borderTop:S.td.borderTop}}>
                        <td style={{...S.td,fontWeight:700,color:T.accent}}>{r.cfop}</td>
                        <td style={{...S.td,maxWidth:280,color:T.pageClr,fontSize:11,lineHeight:1.4}}>{r.descricao}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_notas}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_itens}</td>
                        <td style={{...S.td,fontWeight:600,color:T.pageClr}}>{fmoe(r.valor_contabil)}</td>
                        <td style={S.td}>{fmoe(r.base_icms)}</td>
                        <td style={S.td}>{fmoe(r.valor_icms)}</td>
                      </tr>
                    ))
                  }
                  {resumoCfopEntradas.length>0&&<tr style={{background:D?"rgba(39,199,216,0.05)":"rgba(10,102,116,0.05)"}}>
                    <td colSpan={4} style={{...S.td,fontWeight:700,color:T.accent,fontSize:11,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Total</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopEntradas.reduce((a,r)=>a+r.valor_contabil,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopEntradas.reduce((a,r)=>a+r.base_icms,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopEntradas.reduce((a,r)=>a+r.valor_icms,0))}</td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* CFOP SAÍDAS */}
          <div style={{...S.card,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:S.th.borderBottom,display:"flex",alignItems:"center",gap:8}}>
              <ArrowUpRight size={14} color="#34d399"/>
              <span style={{fontWeight:700,fontSize:13,color:T.pageClr}}>Saídas por CFOP</span>
              <span style={{marginLeft:"auto",fontSize:11,color:T.accentDim}}>{resumoCfopSaidas.length} CFOPs — {saidas.length} itens</span>
            </div>
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
                <thead><tr>{["CFOP","Descrição","Notas","Itens","Valor Contábil","Base ICMS","ICMS"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!resumoCfopSaidas.length
                    ?<tr><td colSpan={7} style={{padding:"40px",textAlign:"center",color:T.accentDim}}>Importe XMLs de saída para ver o resumo.</td></tr>
                    :resumoCfopSaidas.map(r=>(
                      <tr key={r.cfop} style={{borderTop:S.td.borderTop}}>
                        <td style={{...S.td,fontWeight:700,color:"#34d399"}}>{r.cfop}</td>
                        <td style={{...S.td,maxWidth:280,color:T.pageClr,fontSize:11,lineHeight:1.4}}>{r.descricao}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_notas}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_itens}</td>
                        <td style={{...S.td,fontWeight:600,color:T.pageClr}}>{fmoe(r.valor_contabil)}</td>
                        <td style={S.td}>{fmoe(r.base_icms)}</td>
                        <td style={S.td}>{fmoe(r.valor_icms)}</td>
                      </tr>
                    ))
                  }
                  {resumoCfopSaidas.length>0&&<tr style={{background:D?"rgba(52,211,153,0.05)":"rgba(5,100,60,0.05)"}}>
                    <td colSpan={4} style={{...S.td,fontWeight:700,color:"#34d399",fontSize:11,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Total</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopSaidas.reduce((a,r)=>a+r.valor_contabil,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopSaidas.reduce((a,r)=>a+r.base_icms,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopSaidas.reduce((a,r)=>a+r.valor_icms,0))}</td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>}

    </div></main>
  );
}