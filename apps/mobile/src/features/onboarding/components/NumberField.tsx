import { TextField } from "@/design-system";

export function NumberField({
  label,
  value,
  unit,
  onChangeText,
}: {
  label: string;
  value: string;
  unit: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <TextField
      keyboardType="decimal-pad"
      label={label}
      onChangeText={onChangeText}
      placeholder="0"
      suffix={unit}
      value={value}
    />
  );
}
