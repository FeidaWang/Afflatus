import { createElement } from 'react';
import { renderToString } from 'preact-render-to-string';
import { App as Home } from '../src/showcase/PremiereApp.jsx';
import { App as Arena } from '../src/features/arena-journal/App.jsx';
export function renderApp(page, locale) {
  return renderToString(createElement(page === 'home' ? Home : Arena,
    page === 'home' ? { language: locale } : { initialLocale: locale }));
}
