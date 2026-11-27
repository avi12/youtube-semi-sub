export interface SnackbarRequest {
  message: string;
  actionLabel: string;
  onAction: () => void;
  timeoutMs: number;
}

let current = $state.raw<SnackbarRequest | null>(null);

export function showSnackbar(request: SnackbarRequest) {
  current = request;
}

export function dismissSnackbar() {
  current = null;
}

export function getSnackbar() {
  return current;
}
