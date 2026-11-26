export type CrashWebViewMessageEvent = {
  nativeEvent: {
    data: string;
  };
};

export type CrashWebViewHandle = {
  postMessage: (message: string) => void;
};

export type CrashWebViewProps = {
  html: string;
  onMessage: (event: CrashWebViewMessageEvent) => void;
  onLoad: () => void;
};
