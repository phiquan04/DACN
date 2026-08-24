import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
          <p className="text-lg font-semibold text-on-surface">Đã xảy ra lỗi ngoài dự kiến</p>
          <p className="max-w-sm text-sm text-on-surface-variant">
            Ứng dụng gặp sự cố khi hiển thị trang này. Vui lòng tải lại trang để tiếp tục.
          </p>
          <button
            onClick={this.handleReload}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-brand-600"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
