/// <reference types="vite/client" />

import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

declare global {
  const __APP_VERSION__: string;

  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    msCrypto?: Crypto;
    webkitAudioContext?: typeof AudioContext;
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }

  interface Navigator {
    connection?: {
      saveData?: boolean;
      type?: string;
      effectiveType?: string;
    };
  }

  interface HTMLInputElement {
    webkitdirectory: boolean;
    directory: boolean;
  }
}
