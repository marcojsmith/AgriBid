import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Renders an HTML table wrapped in a responsive container that enables horizontal scrolling.
 *
 * @param className - Additional CSS classes to apply to the table element.
 * @param props - Other props forwarded to the underlying `table` element.
 * @returns The table element wrapped in a div that provides horizontal overflow handling.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

/**
 * Renders a table header (`thead`) element with default row-border styling and any passed props.
 *
 * @returns The rendered `thead` element with `data-slot="table-header"` and merged class names.
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

/**
 * Renders a table body (`tbody`) element with default layout classes and any additional classes or props.
 *
 * Includes a `data-slot="table-body"` attribute for styling hooks.
 *
 * @returns The rendered `tbody` element with combined classes and forwarded props
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

/**
 * Renders a table footer (<tfoot>) with preset styling and optional additional classes.
 *
 * @param className - Additional CSS classes to merge with the component's default footer classes.
 * @returns The rendered `<tfoot>` element
 */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders a table row with preset row styles and optional additional classes.
 *
 * @param className - Additional CSS class names to append to the component's default row styles
 * @returns The rendered table row element with default hover, selection and border styles; all other props are forwarded to the `<tr>` element
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders a styled table header cell (`th`) with checkbox-aware spacing and baseline header typography.
 *
 * @param className - Additional CSS classes to merge with the component's default header classes
 * @param props - Any other props are forwarded to the underlying `th` element
 * @returns A `th` element configured for use as a table header cell
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Table cell element that applies base spacing, alignment, and checkbox-aware adjustments.
 *
 * @param className - Additional CSS classes to merge with the component's default classes
 * @returns A `td` element with default padding, middle alignment, no wrapping, and adjusted right padding/checkbox translation when it contains a checkbox; includes any provided classes
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders a table caption element with default muted styling and a data-slot attribute for styling hooks.
 *
 * @returns A `caption` element with the component's default classes merged with any provided `className` and all other passed props applied.
 */
function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}