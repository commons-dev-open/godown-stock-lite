import { type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  /** Extra block below the label (e.g. conditional "Add new unit" input) */
  extra?: ReactNode;
}

export default function FormField({
  label,
  htmlFor,
  required,
  children,
  extra,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && " *"}
      </label>
      {children}
      {extra != null ? <div className="mt-2">{extra}</div> : null}
    </div>
  );
}
