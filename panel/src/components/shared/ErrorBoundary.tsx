import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: React.ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <h3 className="text-base font-semibold tracking-wide">
              Falha ao renderizar{this.props.label ? ` · ${this.props.label}` : ""}
            </h3>
            <p className="text-sm text-muted-foreground font-mono break-all">
              {this.state.error.message || "Erro desconhecido"}
            </p>
            <Button size="sm" variant="outline" onClick={this.reset} className="mt-2">
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
