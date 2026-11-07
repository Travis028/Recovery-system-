import { Component } from 'react';
import ServerError from '@/pages/ServerError';

/**
 * Catches errors thrown while rendering a screen and shows the error page instead of a
 * blank window. resetKey (the current path) clears the error when the user navigates away.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error, info) {
    console.error('Screen failed to render', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ServerError error={this.state.error} embedded={this.props.embedded} />;
    return this.props.children;
  }
}
