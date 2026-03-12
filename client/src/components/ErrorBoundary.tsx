import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error", error);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <div className="mx-auto max-w-2xl px-6 py-12">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="text-lg font-semibold">Something went wrong</div>
              <div className="mt-2 text-sm text-slate-300">
                The app hit an unexpected error and rendered a safe fallback instead of a blank
                screen.
              </div>
              <div className="mt-4 rounded-lg bg-slate-950/40 p-3 font-mono text-xs text-slate-300">
                {this.state.message}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Reload
                </button>
                <a
                  href="/login"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900"
                >
                  Go to login
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

