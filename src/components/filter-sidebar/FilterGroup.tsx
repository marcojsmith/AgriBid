import type { ComponentProps, ReactNode } from "react";

/**
 * Props for the {@link FilterGroup} component.
 */
interface FilterGroupProps {
  /**
   * Text of the group's label.
   */
  label: string;
  /**
   * Extra attributes for the label element, e.g. `htmlFor` or an `id` that
   * another control points at with `aria-labelledby`.
   */
  labelProps?: ComponentProps<"label">;
  /**
   * The filter control(s) the label describes.
   */
  children: ReactNode;
}

/**
 * Labelled block wrapping one filter control or group of controls.
 *
 * @param props - Component props.
 * @param props.label - Text of the group's label.
 * @param props.labelProps - Extra attributes for the label element.
 * @param props.children - The filter control(s) the label describes.
 * @returns The labelled filter block.
 */
export function FilterGroup({ label, labelProps, children }: FilterGroupProps) {
  return (
    <div className="space-y-2">
      <label
        className="text-xs font-medium text-muted-foreground ml-1"
        {...labelProps}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
