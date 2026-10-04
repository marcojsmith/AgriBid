/**
 * Route-level error boundary that resets on navigation.
 *
 * Wraps individual routes to catch render errors and display
 * an accessible fallback UI without unmounting the entire app.
 * Automatically resets when the route location changes.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { reportErrorAsync } from "@/lib/error-reporter";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  locationKey?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  prevLocationKey?: string;
}

/**
 * Route-scoped error boundary with automatic reset on navigation.
 */
export class RouteErrorBoundaryBase extends Component<Props, State> {
  /**
   * Initialize the error boundary with no error state.
   *
   * @param props - Component props
   */
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      prevLocationKey: props.locationKey,
    };
  }

  /**
   * Reset error state when location key changes (navigation).
   *
   * @param props - Current component props
   * @param state - Current component state
   * @returns State update to reset error or track location key
   */
  static getDerivedStateFromProps(
    props: Props,
    state: State
  ): Partial<State> | null {
    if (
      props.locationKey !== state.prevLocationKey &&
      state.hasError &&
      props.locationKey !== undefined
    ) {
      return {
        hasError: false,
        errorMessage: "",
        prevLocationKey: props.locationKey,
      };
    }
    if (props.locationKey !== state.prevLocationKey) {
      return { prevLocationKey: props.locationKey };
    }
    return null;
  }

  /**
   * Update state when an error is caught.
   *
   * @param error - The error that was thrown
   * @returns New state object
   */
  static getDerivedStateFromError(error: unknown): Partial<State> {
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
        componentStack: errorInfo.componentStack ?? "No component stack",
      },
    });
  }

  /**
   * Clear error state to allow retry rendering.
   */
  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
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
          className="flex min-h-[40vh] items-center justify-center p-4"
          role="alert"
        >
          <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
            <div className="mb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-destructive"
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

            <h1 className="mb-2 text-xl font-semibold text-card-foreground">
              Something went wrong
            </h1>

            <p className="mb-6 text-sm text-muted-foreground">
              We&apos;re sorry for the inconvenience. This error has been
              automatically reported.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={this.handleRetry} variant="default">
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Go Home</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Route error boundary wrapper that tracks location changes.
 *
 * Uses React Router's location.key to reset the error state
 * when the user navigates to a different route.
 *
 * @param props - Props object
 * @param props.children - Children to wrap with error boundary
 * @returns The wrapped children with error boundary protection
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <RouteErrorBoundaryBase locationKey={location.key}>
      {children}
    </RouteErrorBoundaryBase>
  );
}
