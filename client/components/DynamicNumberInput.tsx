import { useEffect, useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";

type DynamicNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: boolean;
  emptyOnZeroFocus?: boolean;
};

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

function formatValue(value: number, decimals: boolean) {
  if (!Number.isFinite(value)) return "";
  if (decimals) {
    const normalized = Number(value.toFixed(2));
    return Number.isInteger(normalized) ? String(normalized) : String(normalized);
  }
  return String(Math.trunc(value));
}

export default function DynamicNumberInput({
  value,
  onValueChange,
  min,
  max,
  decimals = false,
  emptyOnZeroFocus = true,
  onFocus,
  onBlur,
  className,
  ...props
}: DynamicNumberInputProps) {
  const [focused, setFocused] = useState(false);
  const formattedValue = useMemo(() => formatValue(value, decimals), [value, decimals]);
  const [draft, setDraft] = useState(formattedValue);

  useEffect(() => {
    if (!focused) setDraft(formattedValue);
  }, [focused, formattedValue]);

  const commit = (raw: string) => {
    const normalizedRaw = raw.replace(",", ".").trim();

    let nextValue: number;
    if (!normalizedRaw || normalizedRaw === "." || normalizedRaw === "-") {
      nextValue = min !== undefined ? min : 0;
    } else {
      const parsed = decimals ? Number.parseFloat(normalizedRaw) : Number.parseInt(normalizedRaw, 10);
      nextValue = Number.isFinite(parsed) ? parsed : (min !== undefined ? min : 0);
    }

    nextValue = clamp(nextValue, min, max);
    onValueChange(nextValue);
    setDraft(formatValue(nextValue, decimals));
  };

  const handleChange = (raw: string) => {
    const normalized = raw.replace(",", ".");
    const pattern = decimals ? /^\d*(?:\.\d*)?$/ : /^\d*$/;
    if (!pattern.test(normalized)) return;

    setDraft(normalized);

    if (!normalized || normalized === ".") return;

    const parsed = decimals ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) return;
    onValueChange(clamp(parsed, min, max));
  };

  return (
    <input
      {...props}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      value={focused ? draft : formattedValue}
      className={className}
      onFocus={(event) => {
        setFocused(true);
        const nextDraft = emptyOnZeroFocus && value === 0 ? "" : formatValue(value, decimals);
        setDraft(nextDraft);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        commit(draft);
        setFocused(false);
        onBlur?.(event);
      }}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}
