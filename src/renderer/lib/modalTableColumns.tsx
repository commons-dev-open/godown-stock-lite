import type { ReactNode } from "react";

export interface ModalFieldDiffRow {
  id: number;
  fieldLabel: string;
  current: ReactNode;
  after: ReactNode;
}

export const MODAL_FIELD_DIFF_COLUMNS = [
  {
    key: "fieldLabel",
    label: "Field",
    render: (r: ModalFieldDiffRow) => (
      <span className="font-medium">{r.fieldLabel}</span>
    ),
  },
  {
    key: "current",
    label: "Current",
    render: (r: ModalFieldDiffRow) => <>{r.current}</>,
  },
  {
    key: "after",
    label: "After update",
    render: (r: ModalFieldDiffRow) => <>{r.after}</>,
  },
];

export interface ModalKVRow {
  id: number;
  fieldLabel: string;
  value: ReactNode;
}

export const MODAL_KV_COLUMNS = [
  {
    key: "fieldLabel",
    label: "Field",
    render: (r: ModalKVRow) => (
      <span className="font-medium">{r.fieldLabel}</span>
    ),
  },
  { key: "value", label: "Value", render: (r: ModalKVRow) => <>{r.value}</> },
];
