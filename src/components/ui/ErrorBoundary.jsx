import React from 'react';
import { withTranslation } from 'react-i18next';
import Card from './Card';
import Button from './Button';

export class ErrorBoundaryBase extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Tool Error:', error, errorInfo);
  }

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <Card variant="tool">
          <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-main">{t('boundary.title')}</h3>
              <p className="text-xs text-text-muted max-w-md">
                {this.state.error?.message || t('boundary.message')}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              {t('boundary.retry')}
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundary = withTranslation('errors')(ErrorBoundaryBase);
export default ErrorBoundary;
