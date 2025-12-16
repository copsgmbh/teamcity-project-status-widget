/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const archiver = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const OUT_DIR = path.join(ROOT, 'youtrack-app');
const OUT_ZIP = path.join(ROOT, 'teamcity-project-status-app.zip');

const APP_NAME = 'teamcity-project-status';
const APP_TITLE = 'TeamCity Project Status';
const WIDGET_KEY = 'project-status';

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rimraf(p) {
  await fsp.rm(p, {recursive: true, force: true});
}

async function mkdirp(p) {
  await fsp.mkdir(p, {recursive: true});
}

async function copyDir(src, dst) {
  await mkdirp(dst);
  const entries = await fsp.readdir(src, {withFileTypes: true});
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fsp.copyFile(s, d);
    }
  }
}

async function readPackageVersion() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8'));
  return pkg.version || '1.0.0';
}

function buildWidgetIndexHtml(entryScriptName) {
  return [
    '<!doctype html>',
    '<html>',
    '  <head>',
    '    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />',
    '    <base target="_parent" />',
    '  </head>',
    '  <body class="widget-body">',
    '    <div id="app-container"></div>',
    '',
    '    <script type="module">',
    '      window.__yt_host__ = await YTApp.register();',
    '      const s = document.createElement("script");',
    `      s.src = "./${entryScriptName}";`,
    '      s.defer = true;',
    '      document.body.appendChild(s);',
    '    </script>',
    '  </body>',
    '</html>',
    ''
  ].join('\n');
}

function buildSettingsSchema() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TeamCity Project Status Widget Settings',
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {type: 'string'},
      refreshPeriod: {type: 'integer', minimum: 30},
      showGreenBuilds: {type: 'boolean'},
      hideChildProjects: {type: 'boolean'},

      // Stored as JSON strings (Apps setting limitation)
      teamcityService: {type: 'string'},
      project: {type: 'string'},
      buildTypes: {type: 'string'},

        selectedBranches: { "type": "string" },

        teamcityToken: { "type": "string" }
    }
  };
}


function buildAppManifest(version) {
  return {
    $schema: 'https://json.schemastore.org/youtrack-app.json',
    name: APP_NAME,
    title: APP_TITLE,
    description: 'Dashboard widget that shows the status of selected TeamCity build configurations.',
    version,
    vendor: {
      name: 'Local Development',
      url: 'https://example.invalid',
      email: 'dev@example.invalid'
    },
    widgets: [
      {
        key: WIDGET_KEY,
        name: 'Project Status',
        extensionPoint: 'DASHBOARD_WIDGET',
        indexPath: `${WIDGET_KEY}/index.html`,
        settingsSchemaPath: `${WIDGET_KEY}/settings.json`,
        defaultDimensions: {width: '8fr', height: '4fr'}
      }
    ]
  };
}

async function zipDir(srcDir, outZip) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZip);
    const archive = archiver('zip', {zlib: {level: 9}});

    output.on('close', resolve);
    archive.on('warning', err => (err.code === 'ENOENT' ? console.warn(err) : reject(err)));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

async function copyFile(src, dst) {
  await mkdirp(path.dirname(dst));
  await fsp.copyFile(src, dst);
}

async function main() {
  if (!(await exists(DIST_DIR))) {
    throw new Error(`dist folder not found at ${DIST_DIR}. Run "npm run build" first.`);
  }

  const version = await readPackageVersion();

  await rimraf(OUT_DIR);
  await rimraf(OUT_ZIP);

  const widgetDir = path.join(OUT_DIR, 'widgets', WIDGET_KEY);
  await mkdirp(widgetDir);

  // Copy everything webpack emitted into the widget folder
  await copyDir(DIST_DIR, widgetDir);

  // Prefer main.js, otherwise first .js file in widgetDir
  let entry = 'main.js';
  if (!(await exists(path.join(widgetDir, entry)))) {
    const files = await fsp.readdir(widgetDir);
    const firstJs = files.find(f => f.toLowerCase().endsWith('.js'));
    if (!firstJs) {
      throw new Error(`No .js bundle found in ${widgetDir}. Expected main.js or any .js file.`);
    }
    entry = firstJs;
    console.warn(`main.js not found; using ${entry} as entry script`);
  }

  // Write app manifest at zip root
  await fsp.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(buildAppManifest(version), null, 2),
    'utf8'
  );
 // Copy YouTrack app backend HTTP handler to app root (required for fetchApp proxy)
  const proxySrc = path.join(ROOT, 'teamcity-proxy.js');
  const proxyDst = path.join(OUT_DIR, 'teamcity-proxy.js');

  if (!(await exists(proxySrc))) {
    throw new Error(`Missing ${proxySrc}. Create teamcity-proxy.js at repo root.`);
  }

  await copyFile(proxySrc, proxyDst);

  // Write widget settings schema + widget index.html (overwrite any dist/index.html)
  await fsp.writeFile(
    path.join(widgetDir, 'settings.json'),
    JSON.stringify(buildSettingsSchema(), null, 2),
    'utf8'
  );

  await fsp.writeFile(
    path.join(widgetDir, 'index.html'),
    buildWidgetIndexHtml(entry),
    'utf8'
  );

  await zipDir(OUT_DIR, OUT_ZIP);

  console.log(`Created: ${OUT_ZIP}`);
  console.log('Upload ZIP in YouTrack: Administration → Apps → Upload ZIP');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
