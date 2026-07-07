import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <div className="max-w-md w-full space-y-6 glass-card p-8 rounded-2xl border border-white/10 shadow-2xl">
            <div className="mx-auto w-16 h-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full">
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground text-sm">
                We encountered an unexpected error.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-muted/50 rounded-lg text-left overflow-auto max-h-32 text-xs font-mono text-muted-foreground break-words border border-white/5">
                {this.state.error.toString()}
              </div>
            )}

            <Button onClick={this.handleReset} className="w-full h-11 transition-all hover:scale-[1.02]" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
