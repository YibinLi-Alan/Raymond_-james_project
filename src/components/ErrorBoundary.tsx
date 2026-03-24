import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/** Catches React errors and shows fallback instead of blank screen */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback ?? (
        <div style={{
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          color: '#e0e0e0',
          backgroundColor: '#1e1e1e',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h2 style={{ marginBottom: 16 }}>Something went wrong</h2>
          <pre style={{
            padding: 16,
            backgroundColor: '#2d2d2d',
            borderRadius: 8,
            overflow: 'auto',
            maxWidth: '80%',
            fontSize: 12,
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: '#4dabf7',
              border: 'none',
              borderRadius: 4,
              color: '#1e1e1e',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
