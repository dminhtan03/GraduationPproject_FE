// ===== ERROR BOUNDARY COMPONENT =====

import React from "react";
import { Button, Result, Typography } from "antd";

const { Paragraph, Text } = Typography;

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
        <div className="min-h-[400px] flex items-center justify-center">
          <Result
            status="error"
            title="Có lỗi xảy ra"
            subTitle="Component gặp lỗi không mong muốn. Vui lòng thử lại."
            extra={[
              <Button type="primary" key="retry" onClick={this.handleReset}>
                Thử lại
              </Button>,
              <Button key="home" onClick={() => (window.location.href = "/")}>
                Về trang chủ
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="text-left mt-4">
                <Paragraph>
                  <Text code>{this.state.error.message}</Text>
                </Paragraph>
                <details>
                  <summary className="cursor-pointer text-sm text-gray-500 mb-2">
                    Stack trace
                  </summary>
                  <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC để wrap component với ErrorBoundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
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
