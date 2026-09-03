import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/noto-sans-sc/wght.css';
import 'katex/dist/katex.min.css';
import './globals.css';
import { Providers } from '@/src/components/providers';

export const metadata: Metadata = {
  title: 'AI First Principles · 核心教程深度扩展版',
  description: '从数据、参数与梯度一路学习到可运行的 Mini GPT。',
};

const preferenceBootstrap = `
(() => {
  const fallback = { theme: 'system', fontSize: 'default', lineWidth: 'default', focusMode: false };
  let preferences = fallback;
  try {
    const serialized = window.localStorage.getItem('ai-first-principles:learning-state');
    if (serialized) {
      const envelope = JSON.parse(serialized);
      const candidate = envelope && (envelope.schemaVersion === 0 || envelope.schemaVersion === 1)
        ? envelope.preferences
        : undefined;
      if (candidate && typeof candidate === 'object') {
        preferences = {
          theme: ['light', 'dark', 'system'].includes(candidate.theme) ? candidate.theme : fallback.theme,
          fontSize: ['compact', 'default', 'large'].includes(candidate.fontSize) ? candidate.fontSize : fallback.fontSize,
          lineWidth: ['narrow', 'default', 'wide'].includes(candidate.lineWidth) ? candidate.lineWidth : fallback.lineWidth,
          focusMode: typeof candidate.focusMode === 'boolean' ? candidate.focusMode : fallback.focusMode,
        };
      }
    }
  } catch {}
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.dataset.fontSize = preferences.fontSize;
  root.dataset.lineWidth = preferences.lineWidth;
  root.dataset.focusMode = String(preferences.focusMode);
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceBootstrap }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
