import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

import { createTypedContext, NO_PROVIDER } from "./createTypedContext";

describe("createTypedContext", () => {
  it("should create a context with the given display name", () => {
    const [Context] = createTypedContext<{ value: string }>("TestContext");
    expect(Context).toBeDefined();
    expect(Context.displayName).toBe("TestContext");
  });

  it("should return context and hook as a tuple", () => {
    const result = createTypedContext<{ value: string }>("TestContext");
    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(typeof result[1]).toBe("function");
  });

  it("should throw when used outside provider", () => {
    const [, useTestContext] = createTypedContext<{ value: string }>(
      "TestContext"
    );

    const ErrorBoundary = class extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; errorMessage: string }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, errorMessage: "" };
      }
      static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMessage: error.message };
      }
      render() {
        if (this.state.hasError) {
          return <div>{this.state.errorMessage}</div>;
        }
        return this.props.children;
      }
    };

    const ThrowWrapper = () => {
      useTestContext();
      return null;
    };
    render(
      <ErrorBoundary>
        <ThrowWrapper />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(
        "useTestContext must be used within a TestContextProvider"
      )
    ).toBeInTheDocument();
  });

  it("should return context value when used within provider", () => {
    const [Context, useTestContext] = createTypedContext<{ value: string }>(
      "TestContext"
    );

    const TestComponent = () => {
      const ctx = useTestContext();
      return <div data-testid="context-value">{ctx?.value}</div>;
    };

    render(
      <Context.Provider value={{ value: "test-value" }}>
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("test-value");
  });

  it("should return undefined context value within provider", () => {
    const [Context, useTestContext] =
      createTypedContext<string>("StringContext");

    const TestComponent = () => {
      const ctx = useTestContext();
      return <div data-testid="context-value">{String(ctx)}</div>;
    };

    render(
      <Context.Provider value={undefined}>
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("undefined");
  });

  it("should return null context value within provider", () => {
    const [Context, useTestContext] = createTypedContext<string | null>(
      "NullableContext"
    );

    const TestComponent = () => {
      const ctx = useTestContext();
      return (
        <div data-testid="context-value">
          {ctx === null ? "null" : "not null"}
        </div>
      );
    };

    render(
      <Context.Provider value={null}>
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("null");
  });

  it("should use correct article (an) for context names starting with vowel", () => {
    const [, useAuthContext] = createTypedContext<string>("AuthContext");

    const ErrorBoundary = class extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; errorMessage: string }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, errorMessage: "" };
      }
      static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMessage: error.message };
      }
      render() {
        if (this.state.hasError) {
          return <div>{this.state.errorMessage}</div>;
        }
        return this.props.children;
      }
    };

    const ThrowWrapper = () => {
      useAuthContext();
      return null;
    };
    render(
      <ErrorBoundary>
        <ThrowWrapper />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(
        "useAuthContext must be used within an AuthContextProvider"
      )
    ).toBeInTheDocument();
  });

  it("should use correct article (a) for context names starting with consonant", () => {
    const [, useUserContext] = createTypedContext<string>("UserContext");

    const ErrorBoundary = class extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; errorMessage: string }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, errorMessage: "" };
      }
      static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMessage: error.message };
      }
      render() {
        if (this.state.hasError) {
          return <div>{this.state.errorMessage}</div>;
        }
        return this.props.children;
      }
    };

    const ThrowWrapper = () => {
      useUserContext();
      return null;
    };
    render(
      <ErrorBoundary>
        <ThrowWrapper />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(
        "useUserContext must be used within a UserContextProvider"
      )
    ).toBeInTheDocument();
  });

  it("should export NO_PROVIDER symbol", () => {
    expect(typeof NO_PROVIDER).toBe("symbol");
    expect(NO_PROVIDER.toString()).toBe("Symbol(NO_PROVIDER)");
  });

  it("should handle boolean false as valid context value", () => {
    const [Context, useBoolContext] =
      createTypedContext<boolean>("BoolContext");

    const TestComponent = () => {
      const ctx = useBoolContext();
      return (
        <div data-testid="context-value">
          {ctx === false ? "false" : "not false"}
        </div>
      );
    };

    render(
      <Context.Provider value={false}>
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("false");
  });

  it("should handle number 0 as valid context value", () => {
    const [Context, useNumberContext] =
      createTypedContext<number>("NumberContext");

    const TestComponent = () => {
      const ctx = useNumberContext();
      return (
        <div data-testid="context-value">{ctx === 0 ? "zero" : "not zero"}</div>
      );
    };

    render(
      <Context.Provider value={0}>
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("zero");
  });

  it("should handle empty string as valid context value", () => {
    const [Context, useEmptyContext] =
      createTypedContext<string>("EmptyContext");

    const TestComponent = () => {
      const ctx = useEmptyContext();
      return (
        <div data-testid="context-value">
          {ctx === "" ? "empty" : "not empty"}
        </div>
      );
    };

    render(
      <Context.Provider value="">
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("empty");
  });

  it("should return context when provider value is an object", () => {
    const [Context, useObjContext] = createTypedContext<{ count: number }>(
      "ObjContext"
    );

    const TestComponent = () => {
      const ctx = useObjContext();
      return <div data-testid="context-value">{ctx?.count}</div>;
    };

    render(
      <Context.Provider value={{ count: 42 }}>
        <TestComponent />
      </Context.Provider>
    );

    expect(screen.getByTestId("context-value").textContent).toBe("42");
  });
});