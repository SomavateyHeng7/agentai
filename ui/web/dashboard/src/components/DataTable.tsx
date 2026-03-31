import { ReactNode } from 'react';

interface DataTableProps {
  headers: string[];
  rows: ReactNode[][];
}

export const DataTable = ({ headers, rows }: DataTableProps) => (
  <div className="overflow-auto rounded-xl border border-ink/10">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-ink/10 bg-shell text-left text-ink/60">
          {headers.map((header) => (
            <th key={header} className="px-3 py-2">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-ink/5">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
