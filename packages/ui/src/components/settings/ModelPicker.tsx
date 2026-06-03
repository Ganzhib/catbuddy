import { Input } from "@/components/ui/input";

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
}

interface ModelPickerProps {
  value: string;
  options: ModelOption[];
  onChange: (model: string) => void;
  disabled?: boolean;
}

/**
 * 模型名自由输入 — 不再使用预置选项下拉框。
 * 保留 options 接口兼容性，但始终渲染为文本输入框。
 */
export function ModelPicker({ value, onChange, disabled }: ModelPickerProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="model-name"
      className="h-8 w-full max-w-[280px] rounded-full text-[13px] sm:w-[280px]"
    />
  );
}
