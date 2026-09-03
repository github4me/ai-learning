import type * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      math: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      mtext: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

export {};
