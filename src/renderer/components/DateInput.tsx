import { useState, useEffect } from "react";
import { formatDateForForm, parseFormDate } from "../lib/date";

type Props = Readonly<{
  value: string; // YYYY-MM-DD or ""
  onChange: (iso: string) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
}>;

/** Controlled date input that displays and accepts dd/mm/yyyy. */
export default function DateInput({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  id,
  name,
  required,
  className,
}: Props) {
  const [local, setLocal] = useState(() =>
    value ? formatDateForForm(value) : ""
  );

  useEffect(() => {
    if (value) {
      setLocal(formatDateForForm(value));
    } else {
      setLocal("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocal(raw);
    const parsed = parseFormDate(raw);
    if (parsed !== "") {
      onChange(parsed);
    } else if (raw.trim() === "") {
      onChange("");
    }
  };

  return (
    <input
      type="text"
      id={id}
      name={name}
      value={local}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="off"
    />
  );
}
