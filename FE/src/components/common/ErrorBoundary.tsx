// ===== ERROR BOUNDARY COMPONENT =====

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

// Error Boundary component cho từng phần của app
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Nếu có custom fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            reset={this.handleReset}
          />
        );
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 text-white">
          <div className="pointer-events-none absolute -left-16 top-12 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-8 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />

          <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center">
            <div className="relative w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
              <div className="absolute -right-16 -top-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

              <div className="relative flex flex-col items-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/50 bg-orange-500/15 text-3xl font-bold text-orange-200">
                  !
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-200">
                  Load Error
                </p>
                <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                  Không thể tải trang
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-200/90 sm:text-base">
                  Đã xảy ra lỗi trong quá trình tải nội dung. Vui lòng thử lại
                  hoặc quay về trang chủ để tiếp tục.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
                  >
                    Thử lại
                  </button>
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/")}
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:border-white/40 hover:text-white"
                  >
                    Về trang chủ
                  </button>
                </div>

                {process.env.NODE_ENV === "development" && this.state.error && (
                  <div className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left text-xs text-slate-200">
                    <div className="font-semibold text-orange-200">
                      {this.state.error.message}
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-slate-300">
                        Stack trace
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 text-[11px] text-slate-200">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC để wrap component với ErrorBoundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>,
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
};
