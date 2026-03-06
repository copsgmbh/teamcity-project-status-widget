import {applyMiddleware, compose, createStore} from 'redux';
import thunkMiddleware from 'redux-thunk';
import {createReducer} from 'redux-act';

import copyAndRemove from '../copy-and-remove';

import {
  applyConfiguration,
  closeConfiguration,
  deselectBuildType,
  failedBuildTypesLoading,
  failedStatusLoading,
  failedProjectsLoading,
  failedTeamcityServicesLoading,
  finishedBuildTypesLoading,
  finishedStatusLoading,
  finishedProjectsLoading,
  finishedTeamcityServicesLoading,
  openConfiguration,
  selectBuildType,
  selectProject,
  selectTeamcityService,
  setInitialSettings,
  startedBuildTypesLoading,
  startedStatusLoading,
  startedProjectsLoading,
  startedTeamcityServicesLoading,
  updateHideChildProjects,
  updateRefreshPeriod,
  updateShowGreenBuilds,
  updateTitle,

  // Branch selection
  startedBranchesLoading,
  finishedBranchesLoading,
  failedBranchesLoading,
  selectBranch,
  deselectBranch,

} from './actions';

// eslint-disable-next-line no-magic-numbers
const DEFAULT_PERIOD = 300;

const reduce = createReducer({
  [setInitialSettings]: (state, {
    title,
    teamcityService,
    project,
    buildTypes,
    selectedBranches,
    showGreenBuilds,
    hideChildProjects,
    refreshPeriod,
    buildStatuses,
    buildPaths
  }) => ({
    ...state,
    isInitializing: false,
    title,
    teamcityService,
    project,
    buildTypes,
    selectedBranches: selectedBranches || [],
    showGreenBuilds,
    hideChildProjects,
    refreshPeriod: refreshPeriod || DEFAULT_PERIOD,
    buildStatuses: buildStatuses || [],
    buildPaths: buildPaths || {}
  }),

  [openConfiguration]: (state, isInitialConfiguration) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isConfiguring: true,
      title: state.title,
      refreshPeriod: state.refreshPeriod,
      selectedTeamcityService: state.teamcityService,
      selectedProject: state.project,
      selectedBuildTypes: state.buildTypes || [],
      showGreenBuilds: state.showGreenBuilds,
      hideChildProjects: state.hideChildProjects,

      selectedBranches: state.selectedBranches || [],

      isInitialConfiguration
    }
  }),

  [updateTitle]: (state, title) => ({
    ...state,
    configuration: {
      ...state.configuration,
      title
    }
  }),

  [startedTeamcityServicesLoading]: state => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingServices: true
    }
  }),

  [finishedTeamcityServicesLoading]: (state, services) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingServices: false,
      teamcityServices: services,
      serviceLoadErrorMessage: null,
      selectedTeamcityService: state.configuration.selectedTeamcityService || services[0]
    }
  }),

  [failedTeamcityServicesLoading]: (state, serviceLoadErrorMessage) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingServices: false,
      teamcityServices: [],
      serviceLoadErrorMessage
    }
  }),

  [selectTeamcityService]: (state, selectedService) => ({
    ...state,
    configuration: {
      ...state.configuration,
      selectedTeamcityService: selectedService
    }
  }),

  [startedProjectsLoading]: state => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingProjects: true
    }
  }),

  [finishedProjectsLoading]: (state, projects) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingProjects: false,
      projects,
      projectLoadErrorMessage: null
    }
  }),

  [failedProjectsLoading]: (state, projectLoadErrorMessage) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingProjects: false,
      projects: [],
      projectLoadErrorMessage
    }
  }),

  [selectProject]: (state, selectedProject) => ({
    ...state,
    configuration: {
      ...state.configuration,
      selectedProject,
      projectsAndBuildTypes: [],
      selectedBuildTypes: [],
      buildTypeLoadErrorMessage: null,

      // Reset branches when project changes
      branchesByBuildType: {},
      selectedBranches: [],
      isLoadingBranches: false,
      branchLoadErrorMessage: null
    }
  }),

  [startedBuildTypesLoading]: state => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingBuildTypes: true
    }
  }),

  [finishedBuildTypesLoading]: (state, projectsAndBuildTypes) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingBuildTypes: false,
      projectsAndBuildTypes,
      buildTypeLoadErrorMessage: null
    }
  }),

  [failedBuildTypesLoading]: (state, buildTypeLoadErrorMessage) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingBuildTypes: false,
      projectsAndBuildTypes: [],
      buildTypeLoadErrorMessage
    }
  }),

  [selectBuildType]: (state, selectedBuildType) => ({
    ...state,
    configuration: {
      ...state.configuration,
      selectedBuildTypes: [
        ...state.configuration.selectedBuildTypes,
        selectedBuildType
      ]
    }
  }),

  [deselectBuildType]: (state, unselectedBuildType) => ({
    ...state,
    configuration: {
      ...state.configuration,
      selectedBuildTypes: copyAndRemove(
        state.configuration.selectedBuildTypes,
        unselectedBuildType,
        (a, b) => a.id === b.id
      )
    }
  }),

  [updateShowGreenBuilds]: (state, showGreenBuilds) => ({
    ...state,
    configuration: {
      ...state.configuration,
      showGreenBuilds
    }
  }),

  [updateHideChildProjects]: (state, hideChildProjects) => ({
    ...state,
    configuration: {
      ...state.configuration,
      hideChildProjects
    }
  }),

  [updateRefreshPeriod]: (state, refreshPeriod) => ({
    ...state,
    configuration: {
      ...state.configuration,
      refreshPeriod
    }
  }),

  [applyConfiguration]: state => ({
    ...state,
    refreshPeriod: state.configuration.refreshPeriod,
    title: state.configuration.title,
    teamcityService: state.configuration.selectedTeamcityService,
    project: state.configuration.selectedProject,
    buildTypes: state.configuration.selectedBuildTypes,

    selectedBranches: state.configuration.selectedBranches || [],

    showGreenBuilds: state.configuration.showGreenBuilds,
    hideChildProjects: state.configuration.hideChildProjects
  }),

  [closeConfiguration]: state => ({
    ...state,
    configuration: {
      ...state.configuration,
      isConfiguring: false
    }
  }),

  [startedStatusLoading]: state => ({
    ...state,
    isLoadingBuildStatuses: true
  }),

  [finishedStatusLoading]: (state, {buildStatuses, buildPaths}) => ({
    ...state,
    buildStatuses,
    buildPaths,
    isLoadingBuildStatuses: false,
    buildStatusLoadErrorMessage: null
  }),

  [failedStatusLoading]: (state, buildStatusLoadErrorMessage) => ({
    ...state,
    buildStatuses: [],
    isLoadingBuildStatuses: false,
    buildStatusLoadErrorMessage
  }),

/* Branch loading + selection */
  [startedBranchesLoading]: state => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingBranches: true
    }
  }),

  [finishedBranchesLoading]: (state, branchesByBuildType) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingBranches: false,
      branchesByBuildType,
      branchLoadErrorMessage: null
    }
  }),

  [failedBranchesLoading]: (state, branchLoadErrorMessage) => ({
    ...state,
    configuration: {
      ...state.configuration,
      isLoadingBranches: false,
      branchesByBuildType: {},
      branchLoadErrorMessage
    }
  }),

  [selectBranch]: (state, pair) => ({
    ...state,
    configuration: {
      ...state.configuration,
      selectedBranches: [
        ...state.configuration.selectedBranches,
        pair
      ]
    }
  }),

  [deselectBranch]: (state, pair) => ({
    ...state,
    configuration: {
      ...state.configuration,
      selectedBranches: state.configuration.selectedBranches.filter(it => {
        const a = it;
        const b = pair;

        const aKey = `${a.buildType.id}::${(a.branch && (a.branch.internalName || a.branch.name)) || '<default>'}`;
        const bKey = `${b.buildType.id}::${(b.branch && (b.branch.internalName || b.branch.name)) || '<default>'}`;

        return aKey !== bKey;
      })
    }
  })
}, {
  isInitializing: true,
  title: null,
  teamcityService: {},
  project: null,
  buildTypes: [],
  selectedBranches: [],

  showGreenBuilds: false,
  hideChildProjects: false,
  refreshPeriod: DEFAULT_PERIOD,

  buildStatuses: [],
  buildPaths: {},
  isLoadingBuildStatuses: false,
  buildStatusLoadErrorMessage: null,

  configuration: {
    isConfiguring: false,
    isInitialConfiguration: false,

    title: '',
    refreshPeriod: null,

    teamcityServices: [],
    isLoadingServices: false,
    selectedTeamcityService: null,
    serviceLoadErrorMessage: null,

    projects: [],
    isLoadingProjects: false,
    selectedProject: null,
    projectLoadErrorMessage: null,

    projectsAndBuildTypes: [],
    isLoadingBuildTypes: false,
    selectedBuildTypes: [],
    buildTypeLoadErrorMessage: null,

    branchesByBuildType: {},
    isLoadingBranches: false,
    branchLoadErrorMessage: null,
    selectedBranches: [],

    showGreenBuilds: false,
    hideChildProjects: false
  }
});

export default (dashboardApi, registerWidgetApi) => {
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  return createStore(
    reduce,
    composeEnhancers(
      applyMiddleware(
        thunkMiddleware.withExtraArgument({dashboardApi, registerWidgetApi})
      )
    )
  );
};
