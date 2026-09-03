import type { ReactNode } from 'react';

import type { InlineNode, SourceRef } from '@/src/content/schema';
import { SourcePageLink } from './source-page-link';

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The labelled table scroller must be keyboard-focusable. */

export type DataTableProps = {
  id: string;
  caption?: string;
  headers: InlineNode[][];
  rows: InlineNode[][][];
  source: SourceRef;
  renderInline: (nodes: InlineNode[]) => ReactNode;
};

export function DataTable({
  id,
  caption,
  headers,
  rows,
  source,
  renderInline,
}: DataTableProps) {
  const accessibleCaption =
    caption ?? `Data table from PDF page ${source.pdfPage}`;

  return (
    <figure id={id} className="data-table-block content-block">
      <p className="table-scroll-hint">
        Scroll horizontally to view all columns.
      </p>
      <section
        className="table-scroll"
        aria-label={accessibleCaption}
        tabIndex={0}
      >
        <table>
          <caption className={caption ? undefined : 'sr-only'}>
            {accessibleCaption}
          </caption>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index} scope="col">
                  {renderInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <SourcePageLink source={source} label="Table source" />
    </figure>
  );
}
