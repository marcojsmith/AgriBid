/**
 * React Error Boundary for catching unhandled component errors.
 *
 * This component wraps the application and displays a fallback UI
 * when an unhandled error occurs, while also reporting the error
 * to the backend for GitHub issue creation.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportErrorAsync } from "@/lib/error-reporter";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Root-level error boundary to catch unhandled React errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  /**
   * Initialize the error boundary with no error state.
   *
   * @param props - Component props
   */
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  /**
   * Update state when an error is caught.
   *
   * @param error - The error that was thrown
   * @returns New state object
   */
  static getDerivedStateFromError(error: unknown): State {
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = "An unexpected error occurred";
      }
    }
    return {
      hasError: true,
      errorMessage: errorMessage || "An unexpected error occurred",
    };
  }

  /**
   * Log error info after an error is caught.
   *
   * @param error - The error that was thrown
   * @param errorInfo - Component stack trace information
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportErrorAsync(error, {
      additionalInfo: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoBack = (): void => {
    window.history.back();
  };

  /**
   * Render the component or fallback UI.
   *
   * @returns The component tree or error fallback
   */
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
          role="alert"
        >
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>

            <p className="text-gray-600 mb-4">
              We&apos;re sorry for the inconvenience. The error has been
              automatically reported and we&apos;ll look into it.
            </p>

            <div className="mb-4 p-3 bg-gray-100 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-700">
                Error has been logged for investigation
              </p>
            </div>

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium mb-2"
            >
              Reload Page
            </button>

            <button
              type="button"
              onClick={this.handleGoBack}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
