import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: shows a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fullscreen-message wa-stack wa-align-items-center wa-gap-m">
        <wa-icon name="triangle-exclamation" className="fullscreen-icon"></wa-icon>
        <h1 className="wa-heading-l">Da ist etwas schiefgelaufen</h1>
        <p className="wa-body-m wa-color-text-quiet">Deine gespeicherten Daten sind davon nicht betroffen.</p>
        <wa-button variant="brand" size="l" onClick={() => window.location.reload()}>
          Neu laden
        </wa-button>
      </div>
    );
  }
}
