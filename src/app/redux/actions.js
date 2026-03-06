import {createAction} from 'redux-act';
import {i18n} from 'hub-dashboard-addons/dist/localization';

import TeamcityService from '../teamcity/teamcity-service';
import {asFlattenBuildTypeTree, asFlattenProjectTree} from '../teamcity/teamcity-convert';

import {fixedConfig} from './config-fix';

function parseKvObjectString(value) {
  // Parses "{a=b, c=d}" into {a:"b", c:"d"}
  if (typeof value !== 'string') return null;

  const s = value.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;

  const inner = s.slice(1, -1).trim();
  if (!inner) return {};

  const obj = {};
  inner.split(/,\s*/).forEach(part => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    obj[key] = val;
  });

  return obj;
}

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;

  // 1) Normal JSON
  try {
    return JSON.parse(value);
  } catch (e) {
    // ignore
  }

  // 2) YouTrack sometimes returns "Map-toString" format, e.g. "{id=..., homeUrl=https://...}"
  const kv = parseKvObjectString(value);
  if (kv) {
    // Special-case TeamCity service format so downstream code can use it immediately
    if (kv.homeUrl || kv.baseUrl || kv.url) {
      return {
        id: kv.id,
        name: kv.name,
        homeUrl: kv.homeUrl || kv.baseUrl || kv.url
      };
    }

    // Project format: "{id=..., name=..., path=...}"
    if (kv.id && (kv.name || kv.path)) {
      return {
        id: kv.id,
        name: kv.name,
        path: kv.path
      };
    }

    return kv;
  }

  return fallback;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export const setInitialSettings = createAction('Set initial settings');
export const openConfiguration = createAction('Open configuration mode');
export const updateRefreshPeriod = createAction('Update refresh period');
export const updateTitle = createAction('Update title');

export const startedTeamcityServicesLoading =
  createAction('Started loading list of TeamCity services');
export const finishedTeamcityServicesLoading =
  createAction('Finished loading list of TeamCity services');
export const failedTeamcityServicesLoading =
  createAction('Failed to load list of TeamCity services');
export const selectTeamcityService =
  createAction('Select TeamCity service');

export const startedProjectsLoading =
  createAction('Started loading list of projects');
export const finishedProjectsLoading =
  createAction('Finished loading list of projects');
export const failedProjectsLoading =
  createAction('Failed to load list of projects');
export const selectProject =
  createAction('Select project');

export const startedBuildTypesLoading =
  createAction('Started loading list of build types');
export const finishedBuildTypesLoading =
  createAction('Finished loading list of build types');
export const failedBuildTypesLoading =
  createAction('Failed to load list of build types');
export const selectBuildType =
  createAction('Add selected build type');
export const deselectBuildType =
  createAction('Remove selected build type');

export const updateShowGreenBuilds =
  createAction('Toggle show green builds checkbox');
export const updateHideChildProjects =
  createAction('Toggle hide child projects');

export const applyConfiguration = createAction('Apply configuration');
export const closeConfiguration = createAction('Close configuration mode');

export const startedStatusLoading =
  createAction('Started loading project builds statuses');
export const finishedStatusLoading =
  createAction('Finished loading project builds statuses');
export const failedStatusLoading =
  createAction('Failed to load project builds statuses');

// Branches
export const startedBranchesLoading =
  createAction('Started loading branches');
export const finishedBranchesLoading =
  createAction('Finished loading branches');
export const failedBranchesLoading =
  createAction('Failed to load branches');
export const selectBranch = createAction('Select branch');
export const deselectBranch = createAction('Deselect branch');

// eslint-disable-next-line complexity
function branchKey(branch) {
  return (branch && (branch.internalName || branch.name)) || '<default>';
}

function branchLabel(branch) {
  return (branch && branch.name) ? branch.name : i18n('Default');
}

function normalizeBuildType(bt) {
  if (!bt) return null;
  // support either {id,name,path} or id-string (defensive)
  if (typeof bt === 'string') return {id: bt, name: bt, path: bt};
  return {id: bt.id, name: bt.name, path: bt.path};
}

function normalizeSelectedPair(pair) {
  if (!pair) return null;
  const bt = normalizeBuildType(pair.buildType);
  if (!bt || !bt.id) return null;
  return {buildType: bt, branch: pair.branch || null};
}

function uniquePairs(pairs) {
  const seen = new Set();
  const out = [];
  (pairs || []).forEach(p => {
    const pp = normalizeSelectedPair(p);
    if (!pp) return;
    const key = `${pp.buildType.id}::${branchKey(pp.branch)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(pp);
  });
  return out;
}

export const reloadStatuses = () => async (dispatch, getState, {dashboardApi}) => {
  const state = getState();
  const {
    configuration: {isConfiguring},
    teamcityService,
    project,
    buildTypes,
    hideChildProjects
  } = state;

  if (!isConfiguring && teamcityService && project && buildTypes) {
    await dispatch(startedStatusLoading());

    const server = new TeamcityService(dashboardApi);

    try {
      // IMPORTANT:
      // - Use root-state selectedBranches (persisted)
      // - If it’s missing for some reason, fall back to configuration.selectedBranches (defensive)
      const selectedPairsRaw =
        (state.selectedBranches && Array.isArray(state.selectedBranches) ? state.selectedBranches : null) ||
        (state.configuration && Array.isArray(state.configuration.selectedBranches) ? state.configuration.selectedBranches : []);

      const selectedPairs = uniquePairs(selectedPairsRaw);

      // Build a matrix:
      // For every selected buildType, use selected branches for that buildType;
      // if none selected for a buildType, include the default branch entry.
      const buildTypeList = Array.isArray(buildTypes) ? buildTypes : [];
      const pairsToLoad = [];

      buildTypeList.forEach(bt => {
        const btId = bt && bt.id;
        if (!btId) return;

        const matches = selectedPairs.filter(p => p.buildType && p.buildType.id === btId);

        if (matches.length > 0) {
          pairsToLoad.push(...matches);
        } else {
          // default branch for this build type
          pairsToLoad.push({buildType: normalizeBuildType(bt), branch: null});
        }
      });

      // Deduplicate again (in case of duplicates / default overlap)
      const finalPairs = uniquePairs(pairsToLoad);

      let buildStatuses;

      // If the user selected any branches at all, we’ll load by pairs
      // (which also covers default-branch fallbacks).
      if (finalPairs.length > 0) {
        const results = await Promise.all(
          finalPairs.map(async pair => {
            const bt = await server.getBuildTypeStatusForBranch(
              teamcityService,
              pair.buildType.id,
              pair.branch
            );

            bt.__branchKey = branchKey(pair.branch);
            bt.__branchLabel = branchLabel(pair.branch);
            return bt;
          })
        );

        buildStatuses = results;
      } else {
        // Should not happen, but keep the old fallback
        const buildStatusResponse = await server.getBuildStatuses(
          teamcityService,
          project,
          buildTypes,
          hideChildProjects
        );
        buildStatuses = buildStatusResponse.buildType;
      }

      const buildPaths = await server.getPaths(teamcityService, project);

      await dashboardApi.storeCache({buildStatuses, buildPaths});
      await dispatch(finishedStatusLoading({buildStatuses, buildPaths}));
    } catch (e) {
      const error = (e.data && e.data.message) || e.message || e.toString();
      await dispatch(failedStatusLoading(error));
    }
  }
};


export const loadTeamCityServices = () => async (dispatch, getState, {dashboardApi}) => {
  await dispatch(startedTeamcityServicesLoading());
  try {
    const servicesPage = await dashboardApi.fetchHub(
      'api/rest/services', {
        query: {
          query: 'applicationName: TeamCity',
          fields: 'id,name,homeUrl',
          $skip: 0,
          $top: -1
        }
      }
    );
    await dispatch(finishedTeamcityServicesLoading(servicesPage.services || []));
  } catch (e) {
    const error = (e.data && e.data.message) || e.message || e.toString();
    const message = i18n('Cannot load list of TeamCity services: {{ error }}', {error});
    await dispatch(failedTeamcityServicesLoading(message));
  }
};

export const loadProjects = () => async (dispatch, getState, {dashboardApi}) => {
  const {configuration: {selectedTeamcityService}} = getState();
  if (selectedTeamcityService) {
    await dispatch(startedProjectsLoading());
    try {
      const teamcityService = new TeamcityService(dashboardApi);
      const projectsResponse = await teamcityService.getProjects(selectedTeamcityService);
      await dispatch(finishedProjectsLoading(asFlattenProjectTree(projectsResponse)));
    } catch (e) {
      const error = (e.data && e.data.message) || e.message || e.toString();
      const message = i18n('Cannot load list of TeamCity projects: {{ error }}', {error});
      await dispatch(failedProjectsLoading(message));
    }
  }
};

export const loadBuildTypes = () => async (dispatch, getState, {dashboardApi}) => {
  const {configuration: {selectedTeamcityService, selectedProject}} = getState();
  if (selectedTeamcityService && selectedProject) {
    await dispatch(startedBuildTypesLoading());
    try {
      const teamcityService = new TeamcityService(dashboardApi);
      const [projectsResponse, buildTypesResponse] = await Promise.all([
        teamcityService.getSubProjects(selectedTeamcityService, selectedProject),
        teamcityService.getBuildTypesOfProject(selectedTeamcityService, selectedProject)
      ]);
      const projectsAndBuildTypesTree = asFlattenBuildTypeTree(
        selectedProject,
        projectsResponse,
        buildTypesResponse
      );
      await dispatch(finishedBuildTypesLoading(projectsAndBuildTypesTree));
    } catch (e) {
      const error = (e.data && e.data.message) || e.message || e.toString();
      const message = i18n('Cannot load list of TeamCity configurations: {{ error }}', {error});
      await dispatch(failedBuildTypesLoading(message));
    }
  }
};

export const loadBranches = () => async (dispatch, getState, {dashboardApi}) => {
  const {configuration: {selectedTeamcityService, selectedBuildTypes}} = getState();
  if (!selectedTeamcityService || !selectedBuildTypes || selectedBuildTypes.length === 0) {
    return;
  }

  await dispatch(startedBranchesLoading());
  try {
    const teamcityService = new TeamcityService(dashboardApi);

    const responses = await Promise.all(
      selectedBuildTypes.map(bt => teamcityService.getBranches(selectedTeamcityService, bt.id))
    );

    const branchesByBuildType = {};
    selectedBuildTypes.forEach((bt, idx) => {
      branchesByBuildType[bt.id] = (responses[idx] && responses[idx].branch) ? responses[idx].branch : [];
    });

    await dispatch(finishedBranchesLoading(branchesByBuildType));
  } catch (e) {
    const error = (e.data && e.data.message) || e.message || e.toString();
    const message = i18n('Cannot load list of TeamCity branches: {{ error }}', {error});
    await dispatch(failedBranchesLoading(message));
  }
};

export const startConfiguration = isInitialConfiguration =>
  async dispatch => {
    await dispatch(openConfiguration(isInitialConfiguration));
    await dispatch(loadTeamCityServices());
  };

export const saveConfiguration = () => async (dispatch, getState, {dashboardApi}) => {
  const {
    configuration: {
      title,
      selectedTeamcityService,
      selectedProject,
      selectedBuildTypes,
      showGreenBuilds,
      hideChildProjects,
      refreshPeriod,
      selectedBranches
    }
  } = getState();

  const storedTeamcityService = selectedTeamcityService
    ? JSON.stringify({
        id: selectedTeamcityService.id,
        name: selectedTeamcityService.name,
        homeUrl: selectedTeamcityService.homeUrl
      })
    : null;

  const storedProject = selectedProject
    ? JSON.stringify({
        id: selectedProject.id,
        name: selectedProject.name,
        path: selectedProject.path
      })
    : null;

  const storedBuildTypes = JSON.stringify(
    (selectedBuildTypes || []).map(it => ({
      id: it.id,
      name: it.name,
      path: it.path
    }))
  );

  const storedSelectedBranches = JSON.stringify(
    (selectedBranches || []).map(pair => ({
      buildType: {
        id: pair.buildType.id,
        name: pair.buildType.name,
        path: pair.buildType.path
      },
      branch: pair.branch
        ? {
            name: pair.branch.name,
            internalName: pair.branch.internalName,
            default: pair.branch.default,
            unspecified: pair.branch.unspecified
          }
        : null
    }))
  );

  await dashboardApi.storeConfig({
    title,
    refreshPeriod,
    showGreenBuilds,
    hideChildProjects,

    teamcityService: storedTeamcityService,
    project: storedProject,
    buildTypes: storedBuildTypes,
    selectedBranches: storedSelectedBranches
  });

  await dispatch(applyConfiguration());
  await dispatch(closeConfiguration());
  await dispatch(reloadStatuses());
};

export const cancelConfiguration = () => async (dispatch, getState, {dashboardApi}) => {
  const {configuration: {isInitialConfiguration}} = getState();
  await dispatch(closeConfiguration());
  if (isInitialConfiguration) {
    await dashboardApi.removeWidget();
  }
};

export const initWidget = () => async (dispatch, getState, {dashboardApi}) => {
  const config = await fixedConfig(dashboardApi);
  const raw = config || {};

  const title = raw.title;
  const teamcityService = parseJson(raw.teamcityService, null);
  const project = parseJson(raw.project, null);
  const buildTypes = ensureArray(parseJson(raw.buildTypes, []));
  const selectedBranches = ensureArray(parseJson(raw.selectedBranches, []));

  const showGreenBuilds = raw.showGreenBuilds;
  const hideChildProjects = raw.hideChildProjects;
  const refreshPeriod = raw.refreshPeriod;

  const cache = (await dashboardApi.readCache()) || {result: {}};
  const cachedStatuses = ensureArray(cache.result && cache.result.buildStatuses);
  const cachedPaths = (cache.result && cache.result.buildPaths) || {};

  await dispatch(setInitialSettings({
    title,
    teamcityService,
    project,
    buildTypes,
    selectedBranches,
    showGreenBuilds: showGreenBuilds || false,
    hideChildProjects: hideChildProjects || false,
    refreshPeriod,
    buildStatuses: cachedStatuses,
    buildPaths: cachedPaths
  }));

  await dispatch(reloadStatuses());
  if (!config) {
    await dispatch(startConfiguration(true));
  }
};
