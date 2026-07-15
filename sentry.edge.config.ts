import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust tracesSampleRate for performance monitoring
  tracesSampleRate: 1.0,

  // Scrub request body/PII to protect privacy
  beforeSend(event) {
    if (event.request) {
      if (event.request.url) {
        try {
          const url = new URL(event.request.url);
          event.request.url = `${url.origin}${url.pathname}`;
        } catch {
          if (typeof event.request.url === 'string') {
            event.request.url = event.request.url.split('?')[0];
          }
        }
      }
      if (event.request.data) {
        delete event.request.data;
      }
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data && breadcrumb.data.url) {
          try {
            const url = new URL(breadcrumb.data.url);
            breadcrumb.data.url = `${url.origin}${url.pathname}`;
          } catch {
            if (typeof breadcrumb.data.url === 'string') {
              breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
            }
          }
        }
        return breadcrumb;
      });
    }
    return event;
  },
});
