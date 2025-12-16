import TeamcityService from '../teamcity/teamcity-service';

function fixConfigProject(config) {
  const {project} = config;

  // If project is a JSON string, do nothing here; parsing happens in actions.js.
  if (!project || typeof project !== 'object') return false;

  if (project.path) {
    const newProjectPath = project.path.replace(/\b:\b/g, ' :: ');
    if (newProjectPath !== project.path) {
      project.path = newProjectPath;
      return true;
    }
  }
  return false;
}

async function fixBuildTypes(config, dashboardApi) {
  const {teamcityService, buildTypes} = config;

  // Only attempt fix if buildTypes is an array of objects
  if (!teamcityService || !Array.isArray(buildTypes) || buildTypes.length === 0) {
    return false;
  }

  if (buildTypes.some(it => !it.name || !it.path)) {
    const service = new TeamcityService(dashboardApi, null);
    config.buildTypes = await service.getBuildTypes(teamcityService, buildTypes);
    config.buildTypes.forEach(it => {
      it.path = it.name;
    });
    return true;
  }

  return false;
}

export async function fixedConfig(dashboardApi) {
  const config = await dashboardApi.readConfig();
  try {
    const wasFixed = fixConfigProject(config) | (await fixBuildTypes(config, dashboardApi));
    if (wasFixed) {
      await dashboardApi.storeConfig(config);
    }
  } catch (e) {
    // Ignore
  }
  return config;
}
