import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Rendered in place of `children` once they have thrown. A function receives the error
   * and a reset callback, so a fallback can offer a way back without a full page reload.
   */
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /**
   * Changing any entry clears a caught error and re-renders `children`. Pass the identity
   * of whatever is being displayed (a message id, a page key) so moving on from the thing
   * that broke recovers on its own instead of leaving the fallback stuck on screen.
   */
  resetKeys?: unknown[];
  /** Label used in the console group, so nested boundaries are distinguishable in logs. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function keysChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (previous === next) return false;
  if (!previous || !next || previous.length !== next.length) return true;
  return previous.some((key, index) => !Object.is(key, next[index]));
}

/**
 * Contains a render-time throw so it takes down one subtree rather than the whole app.
 *
 * React unmounts the entire tree on an uncaught render error, and this app previously had
 * no boundary anywhere - so one bad field in one assistant block blanked the screen,
 * including the page behind the assistant panel. Wrap the smallest subtree that can fail
 * independently (an individual assistant result), then broader ones (the panel, the app)
 * as a backstop.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.error && keysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The only record of a client-side crash: nothing here is reported to the backend, so
    // the console stack is what a bug report has to be reconstructed from.
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(error, this.reset) : fallback;
  }
}
