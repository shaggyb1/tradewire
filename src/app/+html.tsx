import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Font is served from this site, so the browser doesn't contact a font service
const GLOBAL_CSS = `
@font-face { font-family: 'Inter Tight'; src: url('/fonts/InterTight.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
* { font-family: 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif !important; }
body { background-color: #1A1C12; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Personal tool: keep it out of search engines */}
        <meta name="robots" content="noindex, nofollow" />
        <title>TradeWire</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
