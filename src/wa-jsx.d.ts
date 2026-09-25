import type { CustomCssProperties, CustomElements } from '@awesome.me/webawesome/dist/custom-elements-jsx.d.ts';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements extends CustomElements {}
  }
  interface CSSProperties extends CustomCssProperties {}
}
