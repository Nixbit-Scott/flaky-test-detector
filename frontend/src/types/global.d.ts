declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'set' | 'get',
      targetOrConfigId: string,
      config?: any
    ) => void;
  }
}

export {};