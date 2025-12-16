const API_VER = 'latest';

export default class TeamcityService {
  constructor(dashboardApi, teamcityToken) {
    this.dashboardApi = dashboardApi;
    this.teamcityToken = teamcityToken || null;
  }

  async getProjects(teamcityService) {
    return await this._fetchTeamcity(teamcityService, 'projects', {
      fields: 'project(id,name,parentProjectId,archived)'
    });
  }

  async getSubProjects(teamcityService, project) {
    return await this._fetchTeamcity(teamcityService, 'projects', {
      locator: `affectedProject:(id:${project.id})`,
      fields: 'project(id,name,parentProjectId,archived)'
    });
  }

  async getBuildTypesOfProject(teamcityService, project) {
    return await this._fetchTeamcity(teamcityService, 'buildTypes', {
      locator: `affectedProject:(id:${project.id})`,
      fields: 'buildType(id,name,projectId)'
    });
  }

  async getBuildStatuses(teamcityService, project, buildTypes, hideChildProjects) {
    let locator;
    if (buildTypes.length > 0) {
      locator = buildTypes.map(it => `item(id:${it.id})`).join(',');
    } else if (hideChildProjects) {
      locator = `project:(id:${project.id})`;
    } else {
      locator = `affectedProject:(id:${project.id}),project:(archived:false)`;
    }

    return await this._fetchTeamcity(teamcityService, 'buildTypes', {
      locator,
      fields: 'count,nextHref,buildType(' +
        'id,webUrl,name,' +
        'builds(' +
        '$locator:(running:false,canceled:false,count:1),' +
        'build(number,webUrl,startDate,finishDate,status,statusText)' +
        '),' +
        'investigations(investigation(state,' +
        'assignee(name,username),' +
        'assignment(user(name,username),timestamp,text),' +
        'resolution(type))' +
        '),' +
        'project(archived,id,name)' +
        ')'
    });
  }

  async getPaths(teamcityService, project) {
    const [projectResponse, buildTypeResponse] = await Promise.all([
      this.getSubProjects(teamcityService, project),
      this.getBuildTypesOfProject(teamcityService, project)
    ]);

    const projects = projectResponse.project;

    const projectMap = {};
    projects.forEach(it => (projectMap[it.id] = it));

    const paths = {};
    buildTypeResponse.buildType.forEach(buildType => {
      const path = [buildType.name];
      for (let cur = projectMap[buildType.projectId]; cur; cur = projectMap[cur.parentProjectId]) {
        path.unshift(cur.name);
      }
      paths[buildType.id] = path.join(' :: ');
    });

    return paths;
  }

  async getBuildTypes(teamcityService, buildTypes) {
    return await Promise.all(buildTypes.map(({id}) =>
      this._fetchTeamcity(teamcityService, `buildTypes/${id}`, {
        fields: 'id,name'
      })
    ));
  }

  async getBranches(teamcityService, buildTypeId) {
    return await this._fetchTeamcity(
      teamcityService,
      `buildTypes/${buildTypeId}/branches`,
      {fields: 'branch(name,internalName,default,unspecified)'}
    );
  }

  async getLatestBuildForBranch(teamcityService, buildTypeId, branch) {
    const branchName = (branch && (branch.internalName || branch.name)) || '<default>';
    const branchLocator = `branch:(name:${branchName},default:any)`;

    const locator = [
      `buildType:(id:${buildTypeId})`,
      branchLocator,
      'state:finished',
      'running:false',
      'canceled:false',
      'count:1',
      'defaultFilter:false'
    ].join(',');

    return await this._fetchTeamcity(teamcityService, 'builds', {
      locator,
      fields: 'build(id,number,webUrl,startDate,finishDate,status,statusText,branchName,defaultBranch,unspecifiedBranch)'
    });
  }

  async _fetchTeamcity(teamcityService, path, query) {
    const host = window.__yt_host__ || this.dashboardApi;
    if (!host || typeof host.fetchApp !== 'function') {
      throw new Error('Host API missing fetchApp(). Ensure YTApp.register() ran and window.__yt_host__ is set.');
    }

    const baseUrl =
      (teamcityService && (teamcityService.homeUrl || teamcityService.baseUrl || teamcityService.url)) || '';

    const token = this.teamcityToken;

    const isMaskedSecret = value =>
      typeof value === 'string' && /^<\*+>$/.test(value.trim());

    // If the token is masked (e.g. "<***>") after reload, DO NOT forward it.
    // The proxy will use ctx.settings.teamcityToken instead.
    const auth = token && !isMaskedSecret(token) ? token : null;

    return await host.fetchApp('teamcity-proxy/request', {
      method: 'POST',
      body: {
        baseUrl,
        apiPath: path,
        query,
        auth
      }
    });
  }

  async getBuildTypeStatusForBranch(teamcityService, buildTypeId, branch) {
  // TeamCity uses <default> as internalName for the default branch. :contentReference[oaicite:1]{index=1}
  const internalName = branch && (branch.internalName || branch.name);
  const branchLocator = internalName
    ? `branch:(name:${internalName},default:any)`
    : 'branch:(default:any)';

  return await this._fetchTeamcity(teamcityService, `buildTypes/${buildTypeId}`, {
    fields:
      'id,webUrl,name,' +
      'builds(' +
        `$locator:(running:false,canceled:false,count:1,${branchLocator}),` +
        'build(number,webUrl,startDate,finishDate,status,statusText,branchName,defaultBranch,unspecifiedBranch)' +
      '),' +
      'investigations(investigation(state,' +
        'assignee(name,username),' +
        'assignment(user(name,username),timestamp,text),' +
        'resolution(type))' +
      '),' +
      'project(archived,id,name)'
  });
}
}
