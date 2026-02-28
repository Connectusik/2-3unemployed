import React from 'react';

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled React error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
            <h1 className="text-xl font-bold mb-2">Application Error</h1>
            <p className="text-sm text-black/60 mb-4">
              The interface failed to render. Refresh the page or check server/API logs.
            </p>
            <pre className="text-xs bg-black/5 rounded-lg p-3 overflow-auto text-black/70">
              {this.state.errorMessage}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
