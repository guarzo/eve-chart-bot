import * as Sentry from '@sentry/node';
import { httpIntegration } from '@sentry/node';
import { logger } from './logger';

/**
 * Initialize Sentry error monitoring
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV ?? 'development';

  if (!dsn) {
    logger.debug('SENTRY_DSN not set, error monitoring disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      integrations: [
        httpIntegration({
          breadcrumbs: true,
          spans: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    });

    logger.info('Sentry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Capture an error in Sentry
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (error instanceof Error) {
    Sentry.withScope(scope => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureMessage(String(error), {
      level: 'error',
      extra: context,
    });
  }
}

/**
 * Capture a message in Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureMessage(message, level);
  });
}

export { Sentry };
