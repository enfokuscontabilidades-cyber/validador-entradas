"use client";

import React, { useMemo, useState } from "react";
import {
  Upload,
  FileText,
  Users,
  Building2,
  Boxes,
  GitCompareArrows,
  FileWarning,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  Wallet,
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
  return Number(String(v).replace(/\./g, "").replace(",", "."));
}

function onlyDigits(v: string | undefined | null) {
  return String(v || "").replace(/\D/g, "");
}

function baseCnpj(cnpj: string | undefined | null) {
  const digits = onlyDigits(cnpj);
  return digits.slice(0, 8);
}

function branchCnpj(cnpj: string | undefined | null) {
  const digits = onlyDigits(cnpj);
  return digits.slice(8, 12);
}

function isMatrix(cnpj: string | undefined | null) {
  return branchCnpj(cnpj) === "0001";
}

function isSameGroup(cnpjA: string | undefined | null, cnpjB: string | undefined | null) {
  return baseCnpj(cnpjA) !== "" && baseCnpj(cnpjA) === baseCnpj(cnpjB);
}

function isDateLike(value: string | undefined | null) {
  return /^\d{8}$/.test(String(value || "").trim());
}

function isCnpjLike(value: string | undefined | null) {
  return /^\d{14}$/.test(onlyDigits(value));
}

function isUfLike(value: string | undefined | null) {
  return /^[A-Z]{2}$/.test(String(value || "").trim().toUpperCase());
}

function parseContribHeader0000(row: string[]) {
  const cnpjIdx = row.findIndex((v) => isCnpjLike(v));

  if (cnpjIdx === -1) {
    return {
      periodoInicial: "",
      periodoFinal: "",
      nome: "",
      cnpj: "",
      uf: "",
    };
  }

  const cnpj = row[cnpjIdx] || "";
  const uf = isUfLike(row[cnpjIdx + 1]) ? row[cnpjIdx + 1] : "";
  const nome = row[cnpjIdx - 1] || "";

  const beforeCnpj = row.slice(0, cnpjIdx);
  const dateFields = beforeCnpj.filter((v) => isDateLike(v));
  const periodoInicial = dateFields.length >= 2 ? dateFields[dateFields.length - 2] : "";
  const periodoFinal = dateFields.length >= 1 ? dateFields[dateFields.length - 1] : "";

  return {
    periodoInicial,
    periodoFinal,
    nome,
    cnpj,
    uf,
  };
}

function docTypeFromCfop(cfop: string, indOper?: string) {
  const prefix = (cfop || "")[0];
  if (["1", "2", "3"].includes(prefix)) return "Entrada";
  if (["5", "6", "7"].includes(prefix)) return "Saída";
  if (indOper === "0") return "Entrada";
  if (indOper === "1") return "Saída";
  return "Não identificado";
}

function ufType(cfop: string) {
  const prefix = (cfop || "")[0];
  if (["1", "5"].includes(prefix)) return "Interna";
  if (["2", "6"].includes(prefix)) return "Interestadual";
  if (["3", "7"].includes(prefix)) return "Exterior";
  return "Outra";
}

function normalizeKey(parts: Array<string | number | undefined | null>) {
  return parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join("|")
    .toUpperCase();
}

function buildDocKey(doc: {
  chave?: string;
  numDoc?: string;
  dtDoc?: string;
  codPart?: string;
  vlDoc?: number;
}) {
  if (doc.chave && String(doc.chave).trim()) {
    return normalizeKey([doc.chave]);
  }
  return normalizeKey([doc.numDoc, doc.dtDoc, doc.codPart, doc.vlDoc]);
}

type Participant = {
  nome: string;
  cnpj: string;
  cpf: string;
  uf?: string;
};

type Product = {
  descricao: string;
  ncm: string;
};

type Company = {
  periodoInicial: string;
  periodoFinal: string;
  nome: string;
  cnpj: string;
  uf?: string;
  ie?: string;
};

type FiscalDoc = {
  key: string;
  indOper: string;
  codPart: string;
  participante: string;
  numDoc: string;
  chave: string;
  dtDoc: string;
  vlDoc: number;
  base: number;
  icms: number;
  tipo: string;
  cfops: string;
  ufOperacao: string;
  sourceCnpj: string;
  sourceLabel: string;
};

type FiscalItem = {
  key: string;
  tipo: string;
  codPart: string;
  participante: string;
  numDoc: string;
  dtDoc: string;
  cfop: string;
  codItem: string;
  descricao: string;
  ncm: string;
  qtd: number;
  vlItem: number;
  vlBcIcms: number;
  vlIcms: number;
  ufOperacao: string;
  sourceCnpj: string;
  sourceLabel: string;
};

type FiscalC190 = {
  key: string;
  indOper: string;
  codPart: string;
  participante: string;
  numDoc: string;
  dtDoc: string;
  chave: string;
  cfop: string;
  vlOpr: number;
  base: number;
  icms: number;
  tipo: string;
  ufOperacao: string;
  sourceCnpj: string;
  sourceLabel: string;
};

type E110 = {
  vlTotDebitos: number;
  vlTotCreditos: number;
  vlSldApurado: number;
  vlIcmsRecolher: number;
  vlSldCredorTransportar: number;
};

type FiscalParsed = {
  company: Company | null;
  participants: Record<string, Participant>;
  products: Record<string, Product>;
  docs: FiscalDoc[];
  c170: FiscalItem[];
  c190: FiscalC190[];
  e110: E110 | null;
};

type ContribDoc = {
  key: string;
  indOper: string;
  codPart: string;
  participante: string;
  numDoc: string;
  chave: string;
  dtDoc: string;
  vlDoc: number;
  tipo: string;
  cfops: string;
  ufOperacao: string;
};

type ContribItem = {
  key: string;
  tipo: string;
  codPart: string;
  participante: string;
  numDoc: string;
  dtDoc: string;
  cfop: string;
  codItem: string;
  descricao: string;
  ncm: string;
  qtd: number;
  vlItem: number;
  ufOperacao: string;
};

type ContribParsed = {
  company: Company | null;
  participants: Record<string, Participant>;
  products: Record<string, Product>;
  docs: ContribDoc[];
  c170: ContribItem[];
  isZeroed: boolean;
  debug: {
    reg0000: number;
    reg0150: number;
    reg0200: number;
    regC100: number;
    regC170: number;
  };
};

function parseFiscal(content: string, sourceLabel: string): FiscalParsed {
  const lines = content.split(/\r?\n/);

  const result: FiscalParsed = {
    company: null,
    participants: {},
    products: {},
    docs: [],
    c170: [],
    c190: [],
    e110: null,
  };

  let currentDoc: null | {
    key: string;
    indOper: string;
    codPart: string;
    participante: string;
    numDoc: string;
    chave: string;
    dtDoc: string;
    vlDoc: number;
    base: number;
    icms: number;
    sourceCnpj: string;
    sourceLabel: string;
  } = null;

  for (const line of lines) {
    const row = parseSpedLine(line);
    if (!row) continue;
    const reg = row[0];

    if (reg === "0000") {
      result.company = {
        periodoInicial: row[3] || "",
        periodoFinal: row[4] || "",
        nome: row[5] || "",
        cnpj: row[6] || "",
        uf: row[8] || "",
        ie: row[9] || "",
      };
    }

    if (reg === "0150") {
      result.participants[row[1]?.trim() || ""] = {
        nome: row[2] || "",
        cnpj: row[4] || "",
        cpf: row[5] || "",
        uf: row[8] || "",
      };
    }

    if (reg === "0200") {
      result.products[row[1]?.trim() || ""] = {
        descricao: row[2] || "",
        ncm: row[7] || "Sem NCM",
      };
    }

    if (reg === "C100") {
      const codPart = row[3]?.trim() || "";
      const chave = row[8] || "";
      const participante =
        result.participants[codPart]?.nome || codPart || "Sem participante";
      const sourceCnpj = result.company?.cnpj || "";

      const draftDoc = {
        indOper: row[1] || "",
        codPart,
        participante,
        numDoc: row[7] || "",
        chave,
        dtDoc: row[9] || "",
        vlDoc: toNumber(row[11]),
        base: toNumber(row[20]),
        icms: toNumber(row[21]),
        sourceCnpj,
        sourceLabel,
      };

      currentDoc = {
        ...draftDoc,
        key: buildDocKey(draftDoc),
      };
    }

    if (reg === "C170" && currentDoc) {
      const codItem = row[2]?.trim() || "";
      const product = result.products[codItem];
      const cfop = row[10] || "";

      result.c170.push({
        key: currentDoc.key,
        tipo: docTypeFromCfop(cfop, currentDoc.indOper),
        codPart: currentDoc.codPart,
        participante: currentDoc.participante,
        numDoc: currentDoc.numDoc,
        dtDoc: currentDoc.dtDoc,
        cfop,
        codItem,
        descricao: product?.descricao || codItem,
        ncm: product?.ncm || "Sem NCM",
        qtd: toNumber(row[4]),
        vlItem: toNumber(row[6]),
        vlBcIcms: toNumber(row[12]),
        vlIcms: toNumber(row[14]),
        ufOperacao: ufType(cfop),
        sourceCnpj: currentDoc.sourceCnpj,
        sourceLabel: currentDoc.sourceLabel,
      });
    }

    if (reg === "C190" && currentDoc) {
      const cfop = row[2] || "";

      result.c190.push({
        key: currentDoc.key,
        indOper: currentDoc.indOper,
        codPart: currentDoc.codPart,
        participante: currentDoc.participante,
        numDoc: currentDoc.numDoc,
        dtDoc: currentDoc.dtDoc,
        chave: currentDoc.chave,
        cfop,
        vlOpr: toNumber(row[4]),
        base: toNumber(row[5]),
        icms: toNumber(row[6]),
        tipo: docTypeFromCfop(cfop, currentDoc.indOper),
        ufOperacao: ufType(cfop),
        sourceCnpj: currentDoc.sourceCnpj,
        sourceLabel: currentDoc.sourceLabel,
      });
    }

    if (reg === "E110") {
      result.e110 = {
        vlTotDebitos: toNumber(row[1]),
        vlTotCreditos: toNumber(row[5]),
        vlSldApurado: toNumber(row[10]),
        vlIcmsRecolher: toNumber(row[12]),
        vlSldCredorTransportar: toNumber(row[13]),
      };
    }
  }

  const docsAggMap = new Map<string, Omit<FiscalDoc, "cfops"> & { cfops: string[] }>();

  for (const item of result.c190) {
    const composedKey = `${item.sourceCnpj}|${item.key}`;

    if (!docsAggMap.has(composedKey)) {
      docsAggMap.set(composedKey, {
        key: item.key,
        indOper: item.indOper,
        codPart: item.codPart,
        participante: item.participante,
        numDoc: item.numDoc,
        chave: item.chave,
        dtDoc: item.dtDoc,
        vlDoc: 0,
        base: 0,
        icms: 0,
        tipo: item.tipo,
        ufOperacao: item.ufOperacao,
        sourceCnpj: item.sourceCnpj,
        sourceLabel: item.sourceLabel,
        cfops: [],
      });
    }

    const current = docsAggMap.get(composedKey)!;
    current.vlDoc += item.vlOpr;
    current.base += item.base;
    current.icms += item.icms;
    current.cfops.push(item.cfop);

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

function parseContrib(content: string): ContribParsed {
  const lines = content.split(/\r?\n/);

  const result: ContribParsed = {
    company: null,
    participants: {},
    products: {},
    docs: [],
    c170: [],
    isZeroed: false,
    debug: {
      reg0000: 0,
      reg0150: 0,
      reg0200: 0,
      regC100: 0,
      regC170: 0,
    },
  };

  let currentDoc: null | {
    key: string;
    indOper: string;
    codPart: string;
    participante: string;
    numDoc: string;
    chave: string;
    dtDoc: string;
    vlDoc: number;
  } = null;

  for (const line of lines) {
    const row = parseSpedLine(line);
    if (!row) continue;
    const reg = row[0];

    if (reg === "0000") {
      result.debug.reg0000 += 1;
      const header = parseContribHeader0000(row);
      result.company = {
        periodoInicial: header.periodoInicial,
        periodoFinal: header.periodoFinal,
        nome: header.nome,
        cnpj: header.cnpj,
        uf: header.uf,
      };
    }

    if (reg === "0150") {
      result.debug.reg0150 += 1;
      const cod = row[1]?.trim() || "";
      result.participants[cod] = {
        nome: row[2] || "",
        cnpj: row[4] || "",
        cpf: row[5] || "",
      };
    }

    if (reg === "0200") {
      result.debug.reg0200 += 1;
      const codItem = row[1]?.trim() || "";
      result.products[codItem] = {
        descricao: row[2] || "",
        ncm: row[7] || "Sem NCM",
      };
    }

    if (reg === "C100") {
      result.debug.regC100 += 1;

      const codPart = row[2]?.trim() || row[3]?.trim() || "";
      const participante =
        result.participants[codPart]?.nome || codPart || "Sem participante";

      const numDoc = row[7] || row[8] || row[6] || "";
      const chave = row[8] || row[9] || "";
      const dtDoc = row[9] || row[10] || "";
      const vlDoc = toNumber(row[11]) || toNumber(row[12]) || toNumber(row[10]);

      const draftDoc = {
        indOper: row[1] || "",
        codPart,
        participante,
        numDoc,
        chave,
        dtDoc,
        vlDoc,
      };

      currentDoc = {
        ...draftDoc,
        key: buildDocKey(draftDoc),
      };
    }

    if (reg === "C170" && currentDoc) {
      result.debug.regC170 += 1;

      const codItem = row[2]?.trim() || "";
      const product = result.products[codItem];
      const cfop = row[10] || row[11] || row[9] || "";
      const qtd = toNumber(row[4]) || toNumber(row[5]);
      const vlItem = toNumber(row[6]) || toNumber(row[7]) || toNumber(row[8]);

      result.c170.push({
        key: currentDoc.key,
        tipo: docTypeFromCfop(cfop, currentDoc.indOper),
        codPart: currentDoc.codPart,
        participante: currentDoc.participante,
        numDoc: currentDoc.numDoc,
        dtDoc: currentDoc.dtDoc,
        cfop,
        codItem,
        descricao: product?.descricao || codItem,
        ncm: product?.ncm || "Sem NCM",
        qtd,
        vlItem,
        ufOperacao: ufType(cfop),
      });
    }
  }

  const docsAggMap = new Map<string, Omit<ContribDoc, "cfops"> & { cfops: string[] }>();

  for (const item of result.c170) {
    if (!docsAggMap.has(item.key)) {
      docsAggMap.set(item.key, {
        key: item.key,
        indOper: item.tipo === "Entrada" ? "0" : "1",
        codPart: item.codPart,
        participante: item.participante,
        numDoc: item.numDoc,
        chave: "",
        dtDoc: item.dtDoc,
        vlDoc: 0,
        tipo: item.tipo,
        ufOperacao: item.ufOperacao,
        cfops: [],
      });
    }

    const current = docsAggMap.get(item.key)!;
    current.vlDoc += item.vlItem;
    current.cfops.push(item.cfop);

    if (current.ufOperacao !== item.ufOperacao) {
      current.ufOperacao = "Mista";
    }
  }

  result.docs = Array.from(docsAggMap.values()).map((doc) => ({
    ...doc,
    cfops: Array.from(new Set(doc.cfops)).join(", "),
  }));

  result.isZeroed = result.docs.length === 0 && result.c170.length === 0;

  return result;
}

function mergeFiscalDatasets(datasets: Array<FiscalParsed | null>) {
  const valid = datasets.filter(Boolean) as FiscalParsed[];
  if (!valid.length) return null;

  const company = valid[0].company;
  const participants: Record<string, Participant> = {};
  const products: Record<string, Product> = {};
  const docsMap = new Map<string, FiscalDoc>();
  const c170: FiscalItem[] = [];
  const c190: FiscalC190[] = [];
  let e110: E110 | null = null;

  for (const ds of valid) {
    Object.assign(participants, ds.participants);
    Object.assign(products, ds.products);
    ds.docs.forEach((doc) => docsMap.set(`${doc.sourceCnpj}|${doc.key}`, doc));
    c170.push(...ds.c170);
    c190.push(...ds.c190);
    if (!e110 && ds.e110) e110 = ds.e110;
  }

  return {
    company,
    participants,
    products,
    docs: Array.from(docsMap.values()),
    c170,
    c190,
    e110,
  } as FiscalParsed;
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
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, row: any) => React.ReactNode;
  }>;
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
                <th key={col.key} className="px-4 py-3 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 align-top text-slate-700">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-sm text-slate-500">
                  Sem dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReconciliationTable(props: { rows: any[] }) {
  const { rows } = props;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Cruzamento Fiscal x Contribuições
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Participante</th>
              <th className="px-4 py-3 font-medium">Origem Fiscal</th>
              <th className="px-4 py-3 font-medium">Fiscal</th>
              <th className="px-4 py-3 font-medium">Contribuições</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.tipo}</td>
                  <td className="px-4 py-3">{row.numDoc}</td>
                  <td className="px-4 py-3">{row.dtDoc}</td>
                  <td className="px-4 py-3">{row.participante}</td>
                  <td className="px-4 py-3">{row.fiscalSource}</td>
                  <td className="px-4 py-3">{row.fiscalInfo}</td>
                  <td className="px-4 py-3">{row.contribInfo}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-slate-500">
                  Sem pendências para exibir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocsTable(props: { rows: FiscalDoc[] }) {
  const { rows } = props;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full rounded-3xl border border-slate-200 bg-white text-sm shadow-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Origem</th>
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
          {rows.length ? (
            rows.map((row, idx) => (
              <tr key={`${row.sourceCnpj}-${row.key}-${idx}`} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.sourceLabel}</td>
                <td className="px-4 py-3">{row.tipo}</td>
                <td className="px-4 py-3">{row.numDoc}</td>
                <td className="px-4 py-3">{row.participante}</td>
                <td className="px-4 py-3">{row.cfops}</td>
                <td className="px-4 py-3">{row.ufOperacao}</td>
                <td className="px-4 py-3">{row.dtDoc}</td>
                <td className="px-4 py-3">{money.format(row.vlDoc)}</td>
                <td className="px-4 py-3">{money.format(row.base)}</td>
                <td className="px-4 py-3">{money.format(row.icms)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-sm text-slate-500">
                Sem documentos para exibir.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  const [fiscalMatriz, setFiscalMatriz] = useState<FiscalParsed | null>(null);
  const [fiscalFilial, setFiscalFilial] = useState<FiscalParsed | null>(null);
  const [contribData, setContribData] = useState<ContribParsed | null>(null);

  const [fiscalMatrizFileName, setFiscalMatrizFileName] = useState("");
  const [fiscalFilialFileName, setFiscalFilialFileName] = useState("");
  const [contribFileName, setContribFileName] = useState("");

  const [search, setSearch] = useState("");

  const fiscalData = useMemo(
    () => mergeFiscalDatasets([fiscalMatriz, fiscalFilial]),
    [fiscalMatriz, fiscalFilial]
  );

  const validation = useMemo(() => {
    const matrizCnpj = fiscalMatriz?.company?.cnpj || "";
    const filialCnpj = fiscalFilial?.company?.cnpj || "";
    const contribCnpj = contribData?.company?.cnpj || "";

    const sameGroupMF =
      fiscalMatriz && fiscalFilial ? isSameGroup(matrizCnpj, filialCnpj) : true;

    const matrizEhMatriz = fiscalMatriz ? isMatrix(matrizCnpj) : true;
    const filialEhFilial = fiscalFilial ? !isMatrix(filialCnpj) : true;
    const contribEhMatriz = contribData ? isMatrix(contribCnpj) : true;

    const contribMesmoGrupoMatriz =
      fiscalMatriz && contribData ? isSameGroup(matrizCnpj, contribCnpj) : true;

    const contribMesmoGrupoFilial =
      fiscalFilial && contribData ? isSameGroup(filialCnpj, contribCnpj) : true;

    const periodoMatriz = fiscalMatriz?.company
      ? `${fiscalMatriz.company.periodoInicial}|${fiscalMatriz.company.periodoFinal}`
      : "";

    const periodoFilial = fiscalFilial?.company
      ? `${fiscalFilial.company.periodoInicial}|${fiscalFilial.company.periodoFinal}`
      : "";

    const periodoContrib = contribData?.company
      ? `${contribData.company.periodoInicial}|${contribData.company.periodoFinal}`
      : "";

    const mesmoPeriodoMF =
      fiscalMatriz && fiscalFilial ? periodoMatriz === periodoFilial : true;

    const mesmoPeriodoMC =
      fiscalMatriz && contribData ? periodoMatriz === periodoContrib : true;

    const mesmoPeriodoFC =
      fiscalFilial && contribData ? periodoFilial === periodoContrib : true;

    const isValid =
      (!fiscalMatriz || matrizEhMatriz) &&
      (!fiscalFilial || filialEhFilial) &&
      sameGroupMF &&
      (!contribData || contribEhMatriz) &&
      contribMesmoGrupoMatriz &&
      contribMesmoGrupoFilial &&
      mesmoPeriodoMF &&
      mesmoPeriodoMC &&
      mesmoPeriodoFC;

    return {
      isValid,
      contribZeroed: contribData?.isZeroed || false,
      fiscalOk: !!(fiscalMatriz || fiscalFilial),
      contribOk: !!contribData,
    };
  }, [fiscalMatriz, fiscalFilial, contribData]);

  const analytics = useMemo(() => {
    if (!fiscalData) return null;

    const sales = fiscalData.c190.filter((i) => i.tipo === "Saída");
    const purchases = fiscalData.c190.filter((i) => i.tipo === "Entrada");
    const salesItems = fiscalData.c170.filter((i) => i.tipo === "Saída");
    const purchaseItems = fiscalData.c170.filter((i) => i.tipo === "Entrada");

    const totalSales = sales.reduce((acc, row) => acc + row.vlOpr, 0);
    const totalPurchases = purchases.reduce((acc, row) => acc + row.vlOpr, 0);
    const totalIcmsEntries = purchases.reduce((acc, row) => acc + row.icms, 0);
    const totalIcmsOutputs = sales.reduce((acc, row) => acc + row.icms, 0);
    const totalDocsEntries = fiscalData.docs.filter((d) => d.tipo === "Entrada").length;
    const totalDocsOutputs = fiscalData.docs.filter((d) => d.tipo === "Saída").length;

    const byCustomer = Array.from(
      sales
        .reduce((map, row) => {
          const key = row.codPart;
          if (!map.has(key)) {
            map.set(key, {
              participante: row.participante,
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
        }, new Map<string, any>())
        .values()
    ).sort((a, b) => b.valor - a.valor);

    const bySupplier = Array.from(
      purchases
        .reduce((map, row) => {
          const key = row.codPart;
          if (!map.has(key)) {
            map.set(key, {
              participante: row.participante,
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
        }, new Map<string, any>())
        .values()
    ).sort((a, b) => b.icms - a.icms);

    const fiscalProducts = Array.from(
      [...salesItems, ...purchaseItems]
        .reduce((map, row) => {
          const key = `${row.tipo}||${row.ncm}||${row.descricao}`;
          if (!map.has(key)) {
            map.set(key, {
              origem: "Fiscal",
              tipo: row.tipo,
              ncm: row.ncm,
              descricao: row.descricao,
              quantidade: 0,
              valor: 0,
              icms: 0,
            });
          }
          const current = map.get(key)!;
          current.quantidade += row.qtd;
          current.valor += row.vlItem;
          current.icms += row.vlIcms;
          return map;
        }, new Map<string, any>())
        .values()
    ).sort((a, b) => b.valor - a.valor);

    return {
      totalSales,
      totalPurchases,
      totalIcmsEntries,
      totalIcmsOutputs,
      totalDocsEntries,
      totalDocsOutputs,
      byCustomer,
      bySupplier,
      fiscalProducts,
    };
  }, [fiscalData]);

  const contribProductsAnalytics = useMemo(() => {
    if (!contribData) return [];

    return Array.from(
      contribData.c170
        .filter((i) => i.tipo === "Saída")
        .reduce((map, row) => {
          const key = `${row.ncm}||${row.descricao}`;
          if (!map.has(key)) {
            map.set(key, {
              origem: "Contribuições",
              tipo: row.tipo,
              ncm: row.ncm,
              descricao: row.descricao,
              quantidade: 0,
              valor: 0,
            });
          }
          const current = map.get(key)!;
          current.quantidade += row.qtd;
          current.valor += row.vlItem;
          return map;
        }, new Map<string, any>())
        .values()
    ).sort((a, b) => b.valor - a.valor);
  }, [contribData]);

  const reconciliation = useMemo(() => {
    if (!fiscalData || !contribData) return [];
    if (!validation.isValid) return [];

    const fiscalMap = new Map(
      (fiscalData.docs || []).map((doc) => [`${baseCnpj(doc.sourceCnpj)}|${doc.key}`, doc])
    );

    const contribMap = new Map((contribData.docs || []).map((doc) => [doc.key, doc]));
    const contribBase = baseCnpj(contribData.company?.cnpj);

    const keys = Array.from(
      new Set([
        ...fiscalMap.keys(),
        ...Array.from(contribMap.keys()).map((k) => `${contribBase}|${k}`),
      ])
    );

    return keys.map((composedKey) => {
      const splitIdx = composedKey.indexOf("|");
      const rawKey = composedKey.substring(splitIdx + 1);

      const fiscal = fiscalMap.get(composedKey);
      const contrib = contribMap.get(rawKey);
      const source = fiscal || contrib;

      return {
        status:
          fiscal && contrib
            ? "Nos dois arquivos"
            : fiscal
            ? "Só no Fiscal"
            : "Só no Contribuições",
        tipo: source?.tipo || "-",
        numDoc: source?.numDoc || "-",
        dtDoc: source?.dtDoc || "-",
        participante: source?.participante || "-",
        fiscalSource: fiscal?.sourceLabel || "-",
        fiscalInfo: fiscal
          ? `${fiscal.cfops} • ${money.format(fiscal.vlDoc)}`
          : "Não localizado",
        contribInfo: contrib
          ? `${contrib.cfops} • ${money.format(contrib.vlDoc)}`
          : "Não localizado",
      };
    });
  }, [fiscalData, contribData, validation]);

  const fiscalDocsFiltered = useMemo(() => {
    if (!fiscalData) return [];
    const q = search.trim().toLowerCase();
    if (!q) return fiscalData.docs;

    return fiscalData.docs.filter((doc) =>
      [
        doc.sourceLabel,
        doc.numDoc,
        doc.participante,
        doc.dtDoc,
        doc.tipo,
        doc.cfops,
        doc.ufOperacao,
      ].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [fiscalData, search]);

  const handleFiscalMatrizFile = async (file: File) => {
    setFiscalMatrizFileName(file.name);
    const text = await file.text();
    setFiscalMatriz(parseFiscal(text, "Matriz"));
  };

  const handleFiscalFilialFile = async (file: File) => {
    setFiscalFilialFileName(file.name);
    const text = await file.text();
    setFiscalFilial(parseFiscal(text, "Filial"));
  };

  const handleContribFile = async (file: File) => {
    setContribFileName(file.name);
    const text = await file.text();
    setContribData(parseContrib(text));
  };

  const empresaNome =
    fiscalMatriz?.company?.nome ||
    fiscalFilial?.company?.nome ||
    contribData?.company?.nome ||
    "-";

  const empresaCnpj =
    fiscalMatriz?.company?.cnpj ||
    fiscalFilial?.company?.cnpj ||
    contribData?.company?.cnpj ||
    "-";

  const periodoInicial =
    fiscalMatriz?.company?.periodoInicial ||
    fiscalFilial?.company?.periodoInicial ||
    contribData?.company?.periodoInicial ||
    "-";

  const periodoFinal =
    fiscalMatriz?.company?.periodoFinal ||
    fiscalFilial?.company?.periodoFinal ||
    contribData?.company?.periodoFinal ||
    "-";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-300">
                Análise tributária
              </p>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-3xl font-semibold">Analisador SPED</h1>
                <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                  BETA v0.3
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Validação e cruzamento entre SPED Fiscal da matriz e filial com o SPED
                Contribuições da matriz, tratando documentos da matriz e filial no mesmo
                arquivo de contribuições.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20">
                <Upload className="h-5 w-5" />
                <span>Fiscal Matriz</span>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && handleFiscalMatrizFile(e.target.files[0])
                  }
                />
              </label>

              <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20">
                <Upload className="h-5 w-5" />
                <span>Fiscal Filial</span>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && handleFiscalFilialFile(e.target.files[0])
                  }
                />
              </label>

              <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20">
                <Upload className="h-5 w-5" />
                <span>Contribuições</span>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && handleContribFile(e.target.files[0])
                  }
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-slate-200 md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 px-4 py-2">
              Fiscal Matriz: {fiscalMatrizFileName || "não enviado"}
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-2">
              Fiscal Filial: {fiscalFilialFileName || "não enviado"}
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-2">
              Contribuições: {contribFileName || "não enviado"}
            </div>
          </div>
        </div>

        {!fiscalData ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Upload className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              Envie o SPED Fiscal da matriz e/ou filial
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
              O sistema aceita Fiscal da matriz, Fiscal da filial e um SPED
              Contribuições da matriz para cruzamento.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard
                icon={ArrowUpCircle}
                title="Total de saídas"
                value={money.format(analytics?.totalSales || 0)}
                subtitle={`Documentos: ${number.format(analytics?.totalDocsOutputs || 0)}`}
              />
              <StatCard
                icon={ArrowDownCircle}
                title="Total de entradas"
                value={money.format(analytics?.totalPurchases || 0)}
                subtitle={`Documentos: ${number.format(analytics?.totalDocsEntries || 0)}`}
              />
              <StatCard
                icon={Landmark}
                title="ICMS saídas"
                value={money.format(analytics?.totalIcmsOutputs || 0)}
                subtitle="Débito destacado"
              />
              <StatCard
                icon={Wallet}
                title="ICMS entradas"
                value={money.format(analytics?.totalIcmsEntries || 0)}
                subtitle="Crédito destacado"
              />
              <StatCard
                icon={FileWarning}
                title={
                  fiscalData.e110?.vlIcmsRecolher
                    ? "ICMS a recolher"
                    : "Saldo credor"
                }
                value={money.format(
                  fiscalData.e110?.vlIcmsRecolher ||
                    fiscalData.e110?.vlSldCredorTransportar ||
                    0
                )}
                subtitle={
                  fiscalData.e110?.vlIcmsRecolher
                    ? "Valor apurado para pagamento"
                    : "Valor para transporte"
                }
              />
              <StatCard
                icon={GitCompareArrows}
                title="Cruzamento"
                value={contribData ? number.format(reconciliation.filter((r) => r.status === "Nos dois arquivos").length) : "-"}
                subtitle={
                  contribData
                    ? `Pendências: ${number.format(reconciliation.filter((r) => r.status !== "Nos dois arquivos").length)}`
                    : "Contribuições não enviado"
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Empresa identificada</h2>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <span className="text-slate-500">Nome:</span>
                    <div className="font-medium text-slate-800">{empresaNome}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">CNPJ:</span>
                    <div className="font-medium text-slate-800">{empresaCnpj}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Período:</span>
                    <div className="font-medium text-slate-800">
                      {periodoInicial} a {periodoFinal}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Fiscal:</span>
                    <div className="font-medium text-emerald-700">
                      {validation.fiscalOk ? "OK" : "Não enviado"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Contribuições:</span>
                    <div className="font-medium text-emerald-700">
                      {validation.contribOk ? "OK" : "Não enviado"}
                    </div>
                  </div>
                </div>

                {!validation.isValid ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Os arquivos enviados não passaram na validação interna de grupo e/ou período.
                  </div>
                ) : null}

                {validation.isValid && validation.contribZeroed ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    O SPED Contribuições foi identificado como arquivo sem escrituração de documentos.
                  </div>
                ) : null}

                {validation.isValid && !validation.contribZeroed && contribData ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Arquivos compatíveis para cruzamento.</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <FileWarning className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Apuração do ICMS</h2>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-medium text-slate-800">Bloco E110</div>
                  {fiscalData.e110 ? (
                    <>
                      <div className="mt-2">
                        Total débitos: {money.format(fiscalData.e110.vlTotDebitos)}
                      </div>
                      <div>
                        Total créditos: {money.format(fiscalData.e110.vlTotCreditos)}
                      </div>
                      <div>
                        Saldo apurado: {money.format(fiscalData.e110.vlSldApurado)}
                      </div>
                      <div>
                        ICMS a recolher: {money.format(fiscalData.e110.vlIcmsRecolher)}
                      </div>
                      <div>
                        Saldo credor a transportar:{" "}
                        {money.format(fiscalData.e110.vlSldCredorTransportar)}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">Bloco E110 não localizado.</div>
                  )}
                </div>
              </div>
            </div>

            {contribData ? (
              <SummaryTable
                title="Diagnóstico do SPED Contribuições"
                columns={[
                  { key: "campo", label: "Campo" },
                  { key: "valor", label: "Valor" },
                ]}
                rows={[
                  { campo: "Empresa", valor: contribData.company?.nome || "-" },
                  { campo: "CNPJ", valor: contribData.company?.cnpj || "-" },
                  {
                    campo: "Período inicial",
                    valor: contribData.company?.periodoInicial || "-",
                  },
                  {
                    campo: "Período final",
                    valor: contribData.company?.periodoFinal || "-",
                  },
                  {
                    campo: "Registros 0150",
                    valor: number.format(Object.keys(contribData.participants || {}).length),
                  },
                  {
                    campo: "Registros 0200",
                    valor: number.format(Object.keys(contribData.products || {}).length),
                  },
                  {
                    campo: "Registros C100",
                    valor: number.format(contribData.debug.regC100 || 0),
                  },
                  {
                    campo: "Registros C170",
                    valor: number.format(contribData.debug.regC170 || 0),
                  },
                  {
                    campo: "Docs montados",
                    valor: number.format(contribData.docs.length || 0),
                  },
                ]}
              />
            ) : null}

            {contribData ? <ReconciliationTable rows={reconciliation} /> : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <SummaryTable
                title="Vendas por cliente"
                subtitle="Baseado nos arquivos fiscais da matriz e filial."
                columns={[
                  { key: "participante", label: "Cliente" },
                  { key: "operacao", label: "Operação" },
                  {
                    key: "valor",
                    label: "Valor vendido",
                    render: (v) => money.format(v),
                  },
                  {
                    key: "icms",
                    label: "ICMS",
                    render: (v) => money.format(v),
                  },
                ]}
                rows={analytics?.byCustomer || []}
              />

              <SummaryTable
                title="Compras por fornecedor"
                subtitle="Baseado nos arquivos fiscais da matriz e filial."
                columns={[
                  { key: "participante", label: "Fornecedor" },
                  { key: "operacao", label: "Operação" },
                  {
                    key: "valor",
                    label: "Valor comprado",
                    render: (v) => money.format(v),
                  },
                  {
                    key: "icms",
                    label: "Crédito ICMS",
                    render: (v) => money.format(v),
                  },
                ]}
                rows={analytics?.bySupplier || []}
              />
            </div>

            <SummaryTable
              title="Produtos/NCM do SPED Fiscal"
              subtitle="Agrupamento de compras e vendas por NCM com base no Fiscal da matriz e filial."
              columns={[
                { key: "origem", label: "Origem" },
                { key: "tipo", label: "Tipo" },
                { key: "ncm", label: "NCM" },
                { key: "descricao", label: "Descrição" },
                {
                  key: "quantidade",
                  label: "Qtd",
                  render: (v) => number.format(v),
                },
                {
                  key: "valor",
                  label: "Valor",
                  render: (v) => money.format(v),
                },
                {
                  key: "icms",
                  label: "ICMS",
                  render: (v) => money.format(v),
                },
              ]}
              rows={analytics?.fiscalProducts || []}
            />

            {contribData ? (
              <SummaryTable
                title="Produtos/NCM das saídas no SPED Contribuições"
                subtitle="Segregação de produtos e NCM com base no arquivo de Contribuições."
                columns={[
                  { key: "origem", label: "Origem" },
                  { key: "tipo", label: "Tipo" },
                  { key: "ncm", label: "NCM" },
                  { key: "descricao", label: "Descrição" },
                  {
                    key: "quantidade",
                    label: "Qtd",
                    render: (v) => number.format(v),
                  },
                  {
                    key: "valor",
                    label: "Valor",
                    render: (v) => money.format(v),
                  },
                ]}
                rows={contribProductsAnalytics}
              />
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Documentos fiscais (Matriz + Filial)
                </h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por origem, tipo, documento, participante, CFOP ou data"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none lg:w-96"
                />
              </div>

              <div className="mt-4">
                <DocsTable rows={fiscalDocsFiltered} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}