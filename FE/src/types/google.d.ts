// ===== Google Identity Services Types =====

export type GoogleCredentialResponse = { credential?: string };

export type GoogleInitializeConfig = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
};

export type GoogleRenderButtonOptions = {
  theme: "outline" | "filled_blue" | "filled_black";
  size: "large" | "medium" | "small";
  width?: string | number;
};

export type GoogleIdentity = {
  initialize: (config: GoogleInitializeConfig) => void;
  renderButton: (
    element: HTMLElement,
    options: GoogleRenderButtonOptions,
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentity;
      };
    };
  }
}
