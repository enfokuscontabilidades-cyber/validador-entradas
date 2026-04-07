"use client";

import React, { useMemo, useState } from "react";
import {
  Upload,
  FileText,
  Receipt,
  Users,
  Building2,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  Package,
  Boxes,
} from "lucide-react";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const number = new Intl.NumberFormat("pt-BR");

function parseSpedLine(line: string) {
  if (!line.startsWith("|")) return null;
  return line.split("|").slice(1, -1);
}

function toNumber(v: any) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(String(v).replace(",", "."));
}

function docTypeFromCfop(cfop: string, indOper?: string) {
  const prefix = (cfop || "")[0];
  if (["1", "2", "3"].includes(prefix)) return "Entrada";
  if (["5", "6", "7"].includes(prefix)) return "Saída";
  if (indOper === "0") return "Entrada";
  if (indOper === "1") return "Saída";
  return "Não identificado";
}

function participantType(code: string) {
  return code?.startsWith("CLI") ? "Cliente" : code?.startsWith("FOR") ? "Fornecedor" : "Participante";
}

function ufType(cfop: string) {
  const prefix = (cfop || "")[0];
  const second = (cfop || "")[1];
  if (["5", "1"].includes(prefix)) return second === "1" ? "Interna" : second === "2" ? "Interestadual" : "Outra";
  if (["6", "2"].includes(prefix)) return "Interestadual";
  if (["7", "3"].includes(prefix)) return "Exterior";
  return "Outra";
}

function summarizeBy<T>(items: T[], keyFn: (item: T) => string, valueFn: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || "(vazio)";
    const value = valueFn(item);
    map.set(key, (map.get(key) || 0) + value);
  }
  return Array.from(map.entries())
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total);
}

function parseSped(content: string) {
  const lines = content.split(/\r?\n/);

  const result: {
    company: null | {
      periodoInicial: string;
      periodoFinal: string;
      nome: string;
      cnpj: string;
      uf: string;
      ie: string;
    };
    participants: Record<string, { nome: string; cnpj: string; cpf: string; uf: string }>;
    products: Record<string, { descricao: string; ncm: string }>;
    docs: Array<{
      indOper: string;
      codPart: string;
      numDoc: string;
      dtDoc: string;
      vlDoc: number;
      base: number;
      icms: number;
      participante?: string;
      docRole?: string;
      cfops?: string;
      tipo?: string;
      ufOperacao?: string;
    }>;
    c170: Array<{
      indOper: string;
      codPart: string;
      numDoc: string;
      dtDoc: string;
      participante: string;
      docRole: string;
      codItem: string;
      descricao: string;
      ncm: string;
      cfop: string;
      qtd: number;
      vlItem: number;
      vlBcIcms: number;
      vlIcms: number;
      tipo: string;
      ufOperacao: string;
    }>;
    c190: Array<{
      indOper: string;
      numDoc: string;
      dtDoc: string;
      codPart: string;
      participante: string;
      docRole: string;
      cfop: string;
      vlOpr: number;
      base: number;
      icms: number;
      tipo: string;
      ufOperacao: string;
    }>;
    e110: null | {
      vlTotDebitos: number;
      vlAjDebitos: number;
      vlTotAjDebitos: number;
      vlEstornosCred: number;
      vlTotCreditos: number;
      vlAjCreditos: number;
      vlTotAjCreditos: number;
      vlEstornosDeb: number;
      vlSldCredorAnterior: number;
      vlSldApurado: number;
      vlTotDed: number;
      vlIcmsRecolher: number;
      vlSldCredorTransportar: number;
      debEsp: number;
    };
  } = {
    company: null,
    participants: {},
    products: {},
    docs: [],
    c170: [],
    c190: [],
    e110: null,
  };

  let currentDoc: null | {
    indOper: string;
    codPart: string;
    numDoc: string;
    dtDoc: string;
    vlDoc: number;
    base: number;
    icms: number;
  } = null;

  for (const line of lines) {
    const row = parseSpedLine(line);
    if (!row) continue;

    const reg = row[0];

    if (reg === "0000") {
      result.company = {
        periodoInicial: row[3],
        periodoFinal: row[4],
        nome: row[5],
        cnpj: row[6],
        uf: row[8],
        ie: row[9],
      };
    }

    if (reg === "0150") {
      result.participants[row[1]] = {
        nome: row[2],
        cnpj: row[4],
        cpf: row[5],
        uf: row[8],
      };
    }

    if (reg === "0200") {
  result.products[row[1]?.trim()] = {
    descricao: row[2],
    ncm: row[7] || "Sem NCM",
  };
}

    if (reg === "C100") {
  currentDoc = {
    indOper: row[1],
    codPart: row[3],
    numDoc: row[7],
    dtDoc: row[9],
    vlDoc: toNumber(row[11]),
    base: toNumber(row[20]),
    icms: toNumber(row[21]),
  };

  result.docs.push(currentDoc);
}

    if (reg === "C170" && currentDoc) {
      const participant = result.participants[currentDoc.codPart];
      const product = result.products[row[2]];
      const cfop = row[10];
      result.c170.push({
        indOper: currentDoc.indOper,
        codPart: currentDoc.codPart,
        numDoc: currentDoc.numDoc,
        dtDoc: currentDoc.dtDoc,
        participante: participant?.nome || currentDoc.codPart || "Sem participante",
        docRole: participantType(currentDoc.codPart),
        codItem: row[2],
        descricao: product?.descricao || row[2],
        ncm: product?.ncm || "Sem NCM",
        cfop,
        qtd: toNumber(row[4]),
        vlItem: toNumber(row[6]),
        vlBcIcms: toNumber(row[12]),
        vlIcms: toNumber(row[14]),
        tipo: docTypeFromCfop(cfop, currentDoc.indOper),
        ufOperacao: ufType(cfop),
      });
    }

    if (reg === "C190" && currentDoc) {
      const participant = result.participants[currentDoc.codPart];
      const cfop = row[2];
      result.c190.push({
        indOper: currentDoc.indOper,
        numDoc: currentDoc.numDoc,
        dtDoc: currentDoc.dtDoc,
        codPart: currentDoc.codPart,
        participante: participant?.nome || currentDoc.codPart || "Sem participante",
        docRole: participantType(currentDoc.codPart),
        cfop,
        vlOpr: toNumber(row[4]),
        base: toNumber(row[5]),
        icms: toNumber(row[6]),
        tipo: docTypeFromCfop(cfop, currentDoc.indOper),
        ufOperacao: ufType(cfop),
      });
    }

    if (reg === "E110") {
      result.e110 = {
        vlTotDebitos: toNumber(row[1]),
        vlAjDebitos: toNumber(row[2]),
        vlTotAjDebitos: toNumber(row[3]),
        vlEstornosCred: toNumber(row[4]),
        vlTotCreditos: toNumber(row[5]),
        vlAjCreditos: toNumber(row[6]),
        vlTotAjCreditos: toNumber(row[7]),
        vlEstornosDeb: toNumber(row[8]),
        vlSldCredorAnterior: toNumber(row[9]),
        vlSldApurado: toNumber(row[10]),
        vlTotDed: toNumber(row[11]),
        vlIcmsRecolher: toNumber(row[12]),
        vlSldCredorTransportar: toNumber(row[13]),
        debEsp: toNumber(row[14]),
      };
    }
  }

  const docsCfopMap = new Map<string, string[]>();
  for (const item of result.c190) {
    if (!docsCfopMap.has(item.numDoc)) docsCfopMap.set(item.numDoc, []);
    docsCfopMap.get(item.numDoc)!.push(item.cfop);
  }

  const docsAggMap = new Map<
  string,
  {
    indOper: string;
    numDoc: string;
    dtDoc: string;
    codPart: string;
    participante: string;
    tipo: string;
    ufOperacao: string;
    cfops: string[];
    vlDoc: number;
    base: number;
    icms: number;
  }
>();

for (const item of result.c190) {
  const key = `${item.numDoc}|${item.dtDoc}|${item.indOper}`;

  if (!docsAggMap.has(key)) {
    docsAggMap.set(key, {
      indOper: item.indOper,
      numDoc: item.numDoc,
      dtDoc: item.dtDoc,
      codPart: item.codPart,
      participante: item.participante,
      tipo: item.tipo,
      ufOperacao: item.ufOperacao,
      cfops: [],
      vlDoc: 0,
      base: 0,
      icms: 0,
    });
  }

  const current = docsAggMap.get(key)!;
  current.cfops.push(item.cfop);
  current.vlDoc += item.vlOpr;
  current.base += item.base;
  current.icms += item.icms;

  if (current.ufOperacao !== item.ufOperacao) {
    current.ufOperacao = "Mista";
  }
}

result.docs = Array.from(docsAggMap.values()).map((doc) => ({
  ...doc,
  cfops: Array.from(new Set(doc.cfops)).join(", "),
}));

  return result;
}

function StatCard(props: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { title, value, subtitle, icon: Icon } = props;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </div>
  );
}

function SummaryTable(props: {
  title: string;
  subtitle?: string;
  columns: Array<{ key: string; label: string; render?: (value: any, row: any) => React.ReactNode }>;
  rows: any[];
}) {
  const { title, subtitle, columns, rows } = props;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-sm text-slate-500">Sem dados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocsTable(props: {
  rows: Array<{
    numDoc: string;
    participante: string;
    dtDoc: string;
    vlDoc: number;
    base: number;
    icms: number;
    tipo: string;
    cfops: string;
    ufOperacao?: string;
  }>;
}) {
  const { rows } = props;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Documentos</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Participante</th>
              <th className="px-4 py-3 font-medium">CFOP</th>
              <th className="px-4 py-3 font-medium">Operação</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Base ICMS</th>
              <th className="px-4 py-3 font-medium">ICMS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.numDoc}-${idx}`} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">{row.tipo}</td>
                <td className="px-4 py-3 text-slate-800">{row.numDoc}</td>
                <td className="px-4 py-3 text-slate-700">{row.participante}</td>
                <td className="px-4 py-3 text-slate-700">{row.cfops}</td>
                <td className="px-4 py-3 text-slate-700">{row.ufOperacao || "-"}</td>
                <td className="px-4 py-3 text-slate-700">{row.dtDoc}</td>
                <td className="px-4 py-3 text-slate-700">{money.format(row.vlDoc)}</td>
                <td className="px-4 py-3 text-slate-700">{money.format(row.base)}</td>
                <td className="px-4 py-3 text-slate-700">{money.format(row.icms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<ReturnType<typeof parseSped> | null>(null);
  const [fileName, setFileName] = useState("");
  const [search, setSearch] = useState("");

  const analytics = useMemo(() => {
    if (!data) return null;

    const sales = data.c190.filter((i) => i.tipo === "Saída");
    const purchases = data.c190.filter((i) => i.tipo === "Entrada");
    const salesItems = data.c170.filter((i) => i.tipo === "Saída");
    const purchaseItems = data.c170.filter((i) => i.tipo === "Entrada");

    const byCustomer = Array.from(
      sales.reduce((map, row) => {
        const key = row.codPart;
        if (!map.has(key)) {
          map.set(key, {
            participante: row.participante,
            documentoTipo: row.docRole,
            operacao: row.ufOperacao,
            valor: 0,
            base: 0,
            icms: 0,
          });
        }
        const current = map.get(key)!;
        current.valor += row.vlOpr;
        current.base += row.base;
        current.icms += row.icms;
        return map;
      }, new Map<string, any>()).values()
    ).sort((a, b) => b.valor - a.valor);

    const bySupplier = Array.from(
      purchases.reduce((map, row) => {
        const key = row.codPart;
        if (!map.has(key)) {
          map.set(key, {
            participante: row.participante,
            documentoTipo: row.docRole,
            operacao: row.ufOperacao,
            valor: 0,
            base: 0,
            icms: 0,
          });
        }
        const current = map.get(key)!;
        current.valor += row.vlOpr;
        current.base += row.base;
        current.icms += row.icms;
        return map;
      }, new Map<string, any>()).values()
    ).sort((a, b) => b.icms - a.icms);

    const productsFlow = Array.from(
      [...salesItems, ...purchaseItems].reduce((map, row) => {
        const key = `${row.tipo}||${row.ncm}||${row.descricao}`;
        if (!map.has(key)) {
          map.set(key, {
            tipo: row.tipo,
            ncm: row.ncm,
            descricao: row.descricao,
            valor: 0,
            quantidade: 0,
            base: 0,
            icms: 0,
          });
        }
        const current = map.get(key)!;
        current.valor += row.vlItem;
        current.quantidade += row.qtd;
        current.base += row.vlBcIcms;
        current.icms += row.vlIcms;
        return map;
      }, new Map<string, any>()).values()
    ).sort((a, b) => b.valor - a.valor);

    const purchasesByNcm = Array.from(
      purchaseItems.reduce((map, row) => {
        const key = `${row.ncm}||${row.descricao}`;
        if (!map.has(key)) {
          map.set(key, {
            ncm: row.ncm,
            descricao: row.descricao,
            valor: 0,
            icms: 0,
          });
        }
        const current = map.get(key)!;
        current.valor += row.vlItem;
        current.icms += row.vlIcms;
        return map;
      }, new Map<string, any>()).values()
    ).sort((a, b) => b.icms - a.icms);

    return {
      sales,
      purchases,
      byCustomer,
      bySupplier,
      productsFlow,
      purchasesByNcm,
    };
  }, [data]);

  const resumo = useMemo(() => {
    if (!data) return null;

    const entrada = data.c190.filter((i) => i.tipo === "Entrada");
    const saida = data.c190.filter((i) => i.tipo === "Saída");

    const soma = (arr: any[], field: string) =>
      arr.reduce((s, i) => s + (i[field] || 0), 0);

    return {
      entrada: {
        valor: soma(entrada, "vlOpr"),
        base: soma(entrada, "base"),
        icms: soma(entrada, "icms"),
      },
      saida: {
        valor: soma(saida, "vlOpr"),
        base: soma(saida, "base"),
        icms: soma(saida, "icms"),
      },
      e110: data.e110,
    };
  }, [data]);

  const docsFiltered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.docs;

    return data.docs.filter((doc) =>
      [doc.numDoc, doc.participante, doc.dtDoc, doc.tipo, doc.cfops, doc.ufOperacao].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [data, search]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseSped(text);
    setData(parsed);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Análise tributária</p>
              <h1 className="mt-2 text-3xl font-semibold">Analisador SPED</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Leitura do SPED Fiscal com foco em vendas por cliente, compras por fornecedor, produtos por NCM e apuração do ICMS pelo bloco E110.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20">
              <Upload className="h-5 w-5" />
              <span>Enviar arquivo SPED</span>
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
            </label>
          </div>

          {fileName ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm text-slate-200">
              <FileText className="h-4 w-4" />
              Arquivo atual: {fileName}
            </div>
          ) : null}
        </div>

        {!data || !resumo || !analytics ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Upload className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Envie o arquivo TXT do SPED</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
              Após o envio, o sistema vai mostrar vendas por cliente, compras por fornecedor, produtos vendidos e comprados por NCM e a apuração do ICMS.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Receipt} title="Documentos" value={number.format(data.docs.length)} subtitle={`Itens C170: ${number.format(data.c170.length)}`} />
              <StatCard icon={Users} title="Clientes com venda" value={number.format(analytics.byCustomer.length)} subtitle={analytics.byCustomer[0] ? `Maior cliente: ${analytics.byCustomer[0].participante}` : "Sem vendas"} />
              <StatCard icon={ShoppingCart} title="Fornecedores" value={number.format(analytics.bySupplier.length)} subtitle={analytics.bySupplier[0] ? `Maior crédito: ${analytics.bySupplier[0].participante}` : "Sem compras"} />
              <StatCard icon={Boxes} title="Produtos/NCM" value={number.format(analytics.productsFlow.length)} subtitle={data.company?.nome || "Empresa não identificada"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Empresa identificada</h2>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <span className="text-slate-500">Nome:</span>
                    <div className="font-medium text-slate-800">{data.company?.nome || "-"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">CNPJ:</span>
                    <div className="font-medium text-slate-800">{data.company?.cnpj || "-"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Período inicial:</span>
                    <div className="font-medium text-slate-800">{data.company?.periodoInicial || "-"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Período final:</span>
                    <div className="font-medium text-slate-800">{data.company?.periodoFinal || "-"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Apuração do ICMS</h2>
                <div className="mt-4 grid gap-4 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">Leitura por movimentação</div>
                    <div className="mt-1">Entradas: {money.format(resumo.entrada.valor)}</div>
                    <div>Base entradas: {money.format(resumo.entrada.base)}</div>
                    <div>ICMS entradas: {money.format(resumo.entrada.icms)}</div>
                    <div className="mt-3">Saídas: {money.format(resumo.saida.valor)}</div>
                    <div>Base saídas: {money.format(resumo.saida.base)}</div>
                    <div>ICMS saídas: {money.format(resumo.saida.icms)}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">Bloco E110</div>
                    {resumo.e110 ? (
                      <>
                        <div className="mt-1">Total débitos: {money.format(resumo.e110.vlTotDebitos)}</div>
                        <div>Total créditos: {money.format(resumo.e110.vlTotCreditos)}</div>
                        <div>Saldo apurado: {money.format(resumo.e110.vlSldApurado)}</div>
                        <div>ICMS a recolher: {money.format(resumo.e110.vlIcmsRecolher)}</div>
                        <div>Saldo credor a transportar: {money.format(resumo.e110.vlSldCredorTransportar)}</div>
                      </>
                    ) : (
                      <div className="mt-1">Bloco E110 não localizado no arquivo.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SummaryTable
                title="Vendas por cliente"
                subtitle="Mostra para quem o cliente mais vende, se é operação interna ou interestadual e o total movimentado."
                columns={[
                  { key: "participante", label: "Cliente" },
                  { key: "documentoTipo", label: "Tipo cadastro" },
                  { key: "operacao", label: "Operação" },
                  { key: "valor", label: "Valor vendido", render: (v) => money.format(v) },
                  { key: "icms", label: "ICMS", render: (v) => money.format(v) },
                ]}
                rows={analytics.byCustomer}
              />

              <SummaryTable
                title="Compras por fornecedor"
                subtitle="Mostra de quem o cliente mais compra e qual fornecedor gera mais crédito de ICMS."
                columns={[
                  { key: "participante", label: "Fornecedor" },
                  { key: "documentoTipo", label: "Tipo cadastro" },
                  { key: "operacao", label: "Operação" },
                  { key: "valor", label: "Valor comprado", render: (v) => money.format(v) },
                  { key: "icms", label: "Crédito de ICMS", render: (v) => money.format(v) },
                ]}
                rows={analytics.bySupplier}
              />
            </div>

            <SummaryTable
              title="Produtos vendidos e comprados por NCM"
              subtitle="Agrupamento por tipo da operação, NCM e descrição do produto."
              columns={[
                { key: "tipo", label: "Tipo" },
                { key: "ncm", label: "NCM" },
                { key: "descricao", label: "Descrição" },
                { key: "quantidade", label: "Qtd", render: (v) => number.format(v) },
                { key: "valor", label: "Valor", render: (v) => money.format(v) },
                { key: "icms", label: "ICMS", render: (v) => money.format(v) },
              ]}
              rows={analytics.productsFlow}
            />

            <SummaryTable
              title="NCMs que mais geram crédito de ICMS nas compras"
              columns={[
                { key: "ncm", label: "NCM" },
                { key: "descricao", label: "Descrição" },
                { key: "valor", label: "Valor comprado", render: (v) => money.format(v) },
                { key: "icms", label: "Crédito de ICMS", render: (v) => money.format(v) },
              ]}
              rows={analytics.purchasesByNcm}
            />

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Documentos fiscais</h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por tipo, documento, participante, CFOP ou data"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none lg:w-96"
                />
              </div>
              <div className="mt-4">
                <DocsTable rows={docsFiltered as any} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
