import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#333',
          marginBottom: '12px'
        }}>
          Something went wrong
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '16px'
        }}>
          This part of the app hit an error. The rest of the app is still running.
        </p>
        <pre style={{
          marginTop: '16px',
          overflow: 'auto',
          borderRadius: '8px',
          backgroundColor: '#f0f0f0',
          padding: '12px',
          textAlign: 'left',
          fontSize: '12px',
          color: '#333',
          maxHeight: '200px'
        }}>
          {error.message || String(error)}
        </pre>
        <button
          type="button"
          onClick={resetError}
          style={{
            marginTop: '16px',
            borderRadius: '8px',
            backgroundColor: '#2a5a4e',
            padding: '12px 24px',
            fontSize: '14px',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const errorObj = toError(error);
    console.error(
      'ErrorBoundary caught an error:',
      errorObj,
      info.componentStack,
    );
    // Also display error on page for debugging
    if (typeof window !== 'undefined') {
      (window as any).__lastError = {
        error: errorObj.message,
        stack: errorObj.stack,
        componentStack: info.componentStack
      };
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
