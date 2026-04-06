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

function summarizeBy<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number
) {
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
    participants: Record<string, string>;
    docs: Array<{
      indOper: string;
      codPart: string;
      numDoc: string;
      dtDoc: string;
      vlDoc: number;
      base: number;
      icms: number;
      participante?: string;
      cfops?: string;
      tipo?: string;
    }>;
    c190: Array<{
      indOper: string;
      numDoc: string;
      dtDoc: string;
      codPart: string;
      participante: string;
      cfop: string;
      vlOpr: number;
      base: number;
      icms: number;
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
    docs: [],
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
      result.participants[row[1]] = row[2];
    }

    if (reg === "C100") {
      currentDoc = {
        indOper: row[1],
        codPart: row[3],
        numDoc: row[7],
        dtDoc: row[9],
        vlDoc: toNumber(row[11]),
        base: toNumber(row[21]),
        icms: toNumber(row[22]),
      };

      result.docs.push(currentDoc);
    }

    if (reg === "C190" && currentDoc) {
      result.c190.push({
        indOper: currentDoc.indOper,
        numDoc: currentDoc.numDoc,
        dtDoc: currentDoc.dtDoc,
        codPart: currentDoc.codPart,
        participante:
          result.participants[currentDoc.codPart] ||
          currentDoc.codPart ||
          "Sem participante",
        cfop: row[2],
        vlOpr: toNumber(row[4]),
        base: toNumber(row[5]),
        icms: toNumber(row[6]),
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

  result.docs = result.docs.map((doc) => {
    const cfops = docsCfopMap.get(doc.numDoc) || [];
    const firstCfop = cfops[0] || "";

    const tipo = ["1", "2", "3"].includes(firstCfop[0])
      ? "Entrada"
      : ["5", "6", "7"].includes(firstCfop[0])
      ? "Saída"
      : doc.indOper === "0"
      ? "Entrada"
      : doc.indOper === "1"
      ? "Saída"
      : "Não identificado";

    return {
      ...doc,
      participante:
        result.participants[doc.codPart] || doc.codPart || "Sem participante",
      cfops: cfops.join(", "),
      tipo,
    };
  });

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

function SimpleTable(props: {
  title: string;
  rows: Array<{ key: string; total: number }>;
}) {
  const { title, rows } = props;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">CFOP</th>
                <th className="px-4 py-3 font-medium">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.key}-${idx}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">{row.key}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {money.format(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-6 text-sm text-slate-500">Sem dados.</div>
      )}
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
                <td className="px-4 py-3 text-slate-700">{row.dtDoc}</td>
                <td className="px-4 py-3 text-slate-700">
                  {money.format(row.vlDoc)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {money.format(row.base)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {money.format(row.icms)}
                </td>
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

  const resumo = useMemo(() => {
    if (!data) return null;

    const entrada = data.c190.filter((i) => ["1", "2", "3"].includes(i.cfop?.[0]));
    const saida = data.c190.filter((i) => ["5", "6", "7"].includes(i.cfop?.[0]));

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
      cfopEntrada: summarizeBy(entrada, (i) => i.cfop, (i) => i.vlOpr),
      cfopSaida: summarizeBy(saida, (i) => i.cfop, (i) => i.vlOpr),
      e110: data.e110,
    };
  }, [data]);

  const docsFiltered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.docs;

    return data.docs.filter((doc) =>
      [doc.numDoc, doc.participante, doc.dtDoc, doc.tipo, doc.cfops].some((v) =>
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
              <p className="text-sm uppercase tracking-[0.2em] text-slate-300">
                Análise tributária
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Analisador SPED</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Leitura do SPED Fiscal com separação entre entradas e saídas,
                resumo por CFOP e apuração do ICMS pelo bloco E110.
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

        {!data || !resumo ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Upload className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              Envie o arquivo TXT do SPED
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
              Após o envio, o sistema vai mostrar CFOP de entrada, CFOP de saída,
              documentos classificados e dados do bloco E110.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Receipt}
                title="Documentos"
                value={number.format(data.docs.length)}
                subtitle={`Registros C190: ${number.format(data.c190.length)}`}
              />
              <StatCard
                icon={Users}
                title="Participantes"
                value={number.format(Object.keys(data.participants).length)}
                subtitle={data.company?.nome || "Empresa não identificada"}
              />
              <StatCard
                icon={ArrowDownCircle}
                title="Entradas"
                value={money.format(resumo.entrada.valor)}
                subtitle={`ICMS: ${money.format(resumo.entrada.icms)}`}
              />
              <StatCard
                icon={ArrowUpCircle}
                title="Saídas"
                value={money.format(resumo.saida.valor)}
                subtitle={`ICMS: ${money.format(resumo.saida.icms)}`}
              />
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
                    <div className="font-medium text-slate-800">
                      {data.company?.nome || "-"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">CNPJ:</span>
                    <div className="font-medium text-slate-800">
                      {data.company?.cnpj || "-"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Período inicial:</span>
                    <div className="font-medium text-slate-800">
                      {data.company?.periodoInicial || "-"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Período final:</span>
                    <div className="font-medium text-slate-800">
                      {data.company?.periodoFinal || "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Apuração do ICMS
                </h2>
                <div className="mt-4 grid gap-4 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">Leitura por CFOP</div>
                    <div className="mt-1">
                      Entradas: {money.format(resumo.entrada.valor)}
                    </div>
                    <div>Base entradas: {money.format(resumo.entrada.base)}</div>
                    <div>ICMS entradas: {money.format(resumo.entrada.icms)}</div>
                    <div className="mt-3">
                      Saídas: {money.format(resumo.saida.valor)}
                    </div>
                    <div>Base saídas: {money.format(resumo.saida.base)}</div>
                    <div>ICMS saídas: {money.format(resumo.saida.icms)}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">Bloco E110</div>
                    {resumo.e110 ? (
                      <>
                        <div className="mt-1">
                          Total débitos: {money.format(resumo.e110.vlTotDebitos)}
                        </div>
                        <div>
                          Total créditos: {money.format(resumo.e110.vlTotCreditos)}
                        </div>
                        <div>
                          Saldo apurado: {money.format(resumo.e110.vlSldApurado)}
                        </div>
                        <div>
                          ICMS a recolher: {money.format(resumo.e110.vlIcmsRecolher)}
                        </div>
                        <div>
                          Saldo credor a transportar:{" "}
                          {money.format(resumo.e110.vlSldCredorTransportar)}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1">Bloco E110 não localizado no arquivo.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SimpleTable title="CFOP de entrada" rows={resumo.cfopEntrada} />
              <SimpleTable title="CFOP de saída" rows={resumo.cfopSaida} />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Documentos fiscais
                </h2>
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