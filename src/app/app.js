import 'regenerator-runtime/runtime';
import React from 'react';
import {Provider} from 'react-redux';
import {render} from 'react-dom';
import DashboardAddons from 'hub-dashboard-addons';

import createStore from './redux/index';
import {initWidget, startConfiguration, reloadStatuses} from './redux/actions';
import WidgetContainer from './container/widget-container';
import {initTranslations} from './translations';

DashboardAddons.registerWidget((dashboardApi, registerWidgetApi) => {
  try {
    initTranslations(DashboardAddons.locale);
  } catch (e) {
    initTranslations();
  }

  const store = createStore(dashboardApi, registerWidgetApi);

  registerWidgetApi({
    onConfigure: () => store.dispatch(startConfiguration(false)),
    onRefresh: () => store.dispatch(reloadStatuses())
  });

  store.dispatch(initWidget());

  render(
    <Provider store={store}>
      <WidgetContainer dashboardApi={dashboardApi}/>
    </Provider>,
    document.getElementById('app-container')
  );
});
