import 'regenerator-runtime/runtime';
import React from 'react';
import {Provider} from 'react-redux';
import {render} from 'react-dom';

import createStore from './redux/index';
import {initWidget} from './redux/actions';
import WidgetContainer from './container/widget-container';
import {initTranslations} from './translations';

(async function bootstrap() {
  // Robust host init:
  // - Prefer what index.html may have set
  // - Otherwise register here (avoids race conditions)
  let host = window.__yt_host__;
  if (!host && window.YTApp && typeof window.YTApp.register === 'function') {
    host = await window.YTApp.register();
    window.__yt_host__ = host;
  }

  if (!host) {
    throw new Error(
      'YouTrack host API not initialized. YTApp.register() was not available and window.__yt_host__ is missing.'
    );
  }

  // locale is optional; keep it safe
  try {
    initTranslations((window.YTApp && window.YTApp.locale) || 'en');
  } catch (e) {
    initTranslations();
  }

  // Keep compatibility with your existing thunk extra argument
  const registerWidgetApi = api => {
    window.__widgetApi__ = api;
  };

  const store = createStore(host, registerWidgetApi);
  store.dispatch(initWidget());

  render(
    <Provider store={store}>
      <WidgetContainer dashboardApi={host}/>
    </Provider>,
    document.getElementById('app-container')
  );
})().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e);
  if (window.__yt_host__ && typeof window.__yt_host__.setError === 'function') {
    window.__yt_host__.setError(e);
  }
});
