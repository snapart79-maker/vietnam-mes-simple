import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트합니다.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="bg-red-600 p-4">
              <h1 className="text-white text-xl font-bold flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                시스템 오류 발생 (System Error)
              </h1>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4 font-medium">
                애플리케이션 실행 중 예기치 않은 오류가 발생했습니다.
              </p>
              
              {this.state.error && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Error Message</h3>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 font-mono text-sm break-all">
                    {this.state.error.toString()}
                  </div>
                </div>
              )}

              {this.state.errorInfo && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Component Stack</h3>
                  <div className="bg-gray-800 rounded p-3 overflow-auto max-h-64">
                    <pre className="text-green-400 font-mono text-xs whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                >
                  페이지 새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
