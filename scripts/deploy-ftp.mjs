import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { Client } from 'ssh2';
import { readSitemapUrls, submitUrls, urlsForHtmlFiles } from './indexnow.mjs';
import { assertProductionBuild, emptiedDirectories, isContentHashedAsset, planStaleFiles } from './lib/deploy-plan.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(projectRoot, '.ftp-deploy.local');
const distPath = path.join(projectRoot, 'dist');
const deploymentManifestName = '.gametraveller-deploy-manifest.json';

function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('FTP configuration must be a JSON object.');
  if (!['sftp', 'ftps', 'ftp'].includes(config.protocol)) throw new Error('Protocol must be "sftp", "ftps" or "ftp".');
  if (typeof config.host !== 'string' || !config.host.trim()) throw new Error('Server host is missing.');
  if (/[\r\n/@?#]/.test(config.host)) throw new Error('Enter only the server hostname, without a scheme or path.');
  const parsedHost = new URL(`ftp://${config.host.trim()}/`);
  if (!parsedHost.hostname || parsedHost.username || parsedHost.password || parsedHost.pathname !== '/') {
    throw new Error('Host must be a hostname without a scheme or path.');
  }
  const port = Number(config.port ?? (config.protocol === 'sftp' ? 22 : 21));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be a number from 1 to 65535.');
  if (typeof config.username !== 'string' || !config.username.trim()) throw new Error('Server username is missing.');
  if (typeof config.password !== 'string' || !config.password) throw new Error('Server password is missing.');
  if (typeof config.remoteDir !== 'string' || !config.remoteDir.trim()) {
    throw new Error('Remote directory is missing.');
  }
  if (config.protocol !== 'sftp' && !config.remoteDir.startsWith('/')) {
    throw new Error('FTP remote directory must be an absolute path, such as /public_html/gametraveller.');
  }
  const remoteParts = config.remoteDir.split('/').filter(Boolean);
  if (remoteParts.some(part => part === '.' || part === '..') || /[\r\n\\]/.test(config.remoteDir)) {
    throw new Error('Remote directory contains an invalid path segment.');
  }
  const hostFingerprint = config.hostFingerprint ?? '';
  if (typeof hostFingerprint !== 'string' || (hostFingerprint && !/^SHA256:[A-Za-z0-9+/]{43}$/.test(hostFingerprint))) {
    throw new Error('Host fingerprint must be empty or an OpenSSH SHA256 fingerprint.');
  }
  return { ...config, host: config.host.trim(), port, hostFingerprint, remoteParts };
}

function curlQuote(value) {
  if (/[\r\n]/.test(value)) throw new Error('FTP credentials cannot contain line breaks.');
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function ask(question, defaultValue = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    return (await rl.question(`${question}${suffix}: `)).trim() || defaultValue;
  } finally {
    rl.close();
  }
}

async function askSecret(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run setup in an interactive terminal so the password can be entered without echoing it.');
  }

  process.stdout.write(`${question}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (buffer) => {
      for (const char of buffer.toString('utf8')) {
        if (char === '\u0003') return finish(new Error('Setup cancelled.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ') {
          value += char;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function writeConfig(config) {
  await fs.writeFile(configPath, `${JSON.stringify({
    host: config.host,
    port: config.port,
    protocol: config.protocol,
    username: config.username,
    password: config.password,
    remoteDir: config.remoteDir,
    hostFingerprint: config.hostFingerprint ?? '',
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(configPath, 0o600).catch(() => {});
}

async function setup() {
  console.log('Deployment settings (password input is masked).');
  const protocol = (await ask('Protocol: sftp, ftps or ftp', 'sftp')).toLowerCase();
  const host = await ask('Server hostname');
  const port = Number(await ask('Port', protocol === 'sftp' ? '22' : '21'));
  const username = await ask('Username');
  const isOneComSftp = protocol === 'sftp' && host.trim().endsWith('.service.one');
  // Siden ligger på /gametraveler/ (én l) siden 26. oktober 2026, som base i vite.config.ts
  const defaultDir = isOneComSftp ? 'webroots/www/gametraveler'
    : protocol === 'sftp' ? 'gametraveler' : '/public_html/gametraveler';
  const remoteDir = await ask('Remote directory', defaultDir);
  const password = await askSecret('Password');
  const confirmation = await askSecret('Repeat password');
  if (password !== confirmation) throw new Error('The passwords did not match. No settings were saved.');

  const config = validateConfig({ host, port, protocol, username, password, remoteDir, hostFingerprint: '' });
  await writeConfig(config);
  console.log('Deployment settings saved locally in .ftp-deploy.local (ignored by Git).');
  console.log('Run npm run deploy:ftp after building the site.');
}

async function readConfig() {
  let text;
  try {
    text = await fs.readFile(configPath, 'utf8');
  } catch {
    throw new Error('Deployment settings are not configured. Run npm run deploy:ftp:setup first.');
  }
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    throw new Error('Could not read .ftp-deploy.local as JSON. Run npm run deploy:ftp:setup again.');
  }
  return validateConfig(config);
}

async function listFiles(directory, relative = '') {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(directory, childRelative));
    else if (entry.isFile()) files.push(childRelative);
  }
  return files;
}

function remoteUrl(config, relativePath) {
  const parts = [...config.remoteParts, ...relativePath.split(path.sep)];
  const encodedPath = parts.map(encodeURIComponent).join('/');
  return `ftp://${config.host}:${config.port}/${encodedPath}`;
}

function runCurl(args) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let errorText = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { errorText += chunk; });
    child.on('error', error => reject(new Error(`Could not start curl: ${error.message}`)));
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`curl upload failed (exit ${code}). ${errorText.trim()}`));
    });
  });
}

function fingerprintForHostKey(key) {
  const hash = crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
  return `SHA256:${hash}`;
}

function connectSftp(config) {
  const connection = new Client();
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    connection.on('error', fail);
    connection.once('ready', () => {
      connection.sftp((error, sftp) => {
        if (error) return fail(error);
        if (settled) return;
        settled = true;
        resolve({ connection, sftp });
      });
    });

    connection.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 20000,
      hostVerifier: (key, callback) => {
        const fingerprint = fingerprintForHostKey(key);
        if (config.hostFingerprint) {
          const matches = fingerprint === config.hostFingerprint;
          if (!matches) console.error(`SFTP host key changed. Received ${fingerprint}; expected ${config.hostFingerprint}.`);
          callback(matches);
          return;
        }

        if (!process.stdin.isTTY) {
          console.error(`First connection fingerprint: ${fingerprint}`);
          console.error('Run the upload from an interactive terminal to confirm and save this host key.');
          callback(false);
          return;
        }

        process.stdout.write(`First SFTP connection to ${config.host}. Host fingerprint: ${fingerprint}\n`);
        ask('Type YES to trust and save this fingerprint').then(answer => {
          if (answer !== 'YES') {
            callback(false);
            return;
          }
          config.hostFingerprint = fingerprint;
          writeConfig(config).then(() => callback(true)).catch(() => callback(false));
        }).catch(() => callback(false));
      },
    });
  });
}

function sftpCall(sftp, method, ...args) {
  return new Promise((resolve, reject) => {
    sftp[method](...args, (error, result) => error ? reject(error) : resolve(result));
  });
}

function isMissingSftpPath(error) {
  return error?.code === 'ENOENT'
    || Number(error?.code) === 2
    || /no such file|not found/i.test(error?.message ?? '');
}

function normalizeManifestPath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/')) {
    throw new Error('The remote deployment manifest contains an invalid path.');
  }
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..') || path.posix.normalize(value) !== value) {
    throw new Error('The remote deployment manifest contains an invalid path.');
  }
  if (value === deploymentManifestName) throw new Error('The remote deployment manifest cannot list itself as a site file.');
  return value;
}

// Versjon 2 har i tillegg «retired»: filer med hash som ikke lenger er i bygget, men står én publisering til
function parseDeploymentManifest(text) {
  if (text === null) return null;
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new Error('The remote deployment manifest is invalid; no remote files were changed.');
  }
  const isFileMap = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (![1, 2].includes(manifest?.version) || !isFileMap(manifest.files) || (manifest.retired !== undefined && !isFileMap(manifest.retired))) {
    throw new Error('The remote deployment manifest has an unsupported format; no remote files were changed.');
  }

  for (const [relativePath, metadata] of [...Object.entries(manifest.files), ...Object.entries(manifest.retired ?? {})]) {
    normalizeManifestPath(relativePath);
    if (!metadata || !/^[a-f0-9]{64}$/.test(metadata.sha256) || !Number.isInteger(metadata.size) || metadata.size < 0) {
      throw new Error('The remote deployment manifest contains invalid file metadata.');
    }
  }
  return manifest;
}

async function readSftpText(sftp, remotePath) {
  let stats;
  try {
    stats = await sftpCall(sftp, 'stat', remotePath);
  } catch (error) {
    if (isMissingSftpPath(error)) return null;
    throw error;
  }
  if (!stats.isFile()) throw new Error('The remote deployment manifest path is not a file.');

  const chunks = [];
  try {
    for await (const chunk of sftp.createReadStream(remotePath)) chunks.push(Buffer.from(chunk));
  } catch (error) {
    if (isMissingSftpPath(error)) return null;
    throw error;
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function remoteFileMatches(sftp, remotePath, expectedSize) {
  try {
    const stats = await sftpCall(sftp, 'stat', remotePath);
    return stats.isFile() && stats.size === expectedSize;
  } catch (error) {
    if (isMissingSftpPath(error)) return false;
    throw error;
  }
}

async function uploadSftpFile(sftp, localPath, remotePath) {
  await pipeline(
    createReadStream(localPath),
    sftp.createWriteStream(remotePath, { flags: 'w', mode: 0o644 }),
  );
}

async function ensureSftpDirectory(sftp, directory, ensuredDirectories = new Set()) {
  const absolute = directory.startsWith('/');
  let current = absolute ? '/' : '';
  for (const part of directory.split('/').filter(Boolean)) {
    current = path.posix.join(current, part);
    if (ensuredDirectories.has(current)) continue;
    try {
      await sftpCall(sftp, 'mkdir', current);
    } catch (error) {
      const existing = await sftpCall(sftp, 'stat', current).catch(() => null);
      if (!existing?.isDirectory()) throw error;
    }
    ensuredDirectories.add(current);
  }
}

async function uploadSftp(config, files) {
  const { connection, sftp } = await connectSftp(config);
  let uploadedPaths = [];
  try {
    const currentDirectory = await sftpCall(sftp, 'realpath', '.');
    const remoteRoot = config.remoteDir.startsWith('/')
      ? path.posix.normalize(config.remoteDir)
      : path.posix.join(currentDirectory, config.remoteDir);
    console.log(`Connected using SFTP; preparing ${config.host}:${remoteRoot}.`);
    const ensuredDirectories = new Set();
    await ensureSftpDirectory(sftp, remoteRoot, ensuredDirectories);

    const manifestPath = path.posix.join(remoteRoot, deploymentManifestName);
    const previousManifest = parseDeploymentManifest(await readSftpText(sftp, manifestPath));
    const previousFiles = previousManifest?.files ?? {};
    const previousRetired = previousManifest?.retired ?? {};
    const currentFiles = {};
    const changedFiles = [];
    const checkBatchSize = 20;
    console.log(`Checking ${files.length} local files against the remote site.`);
    if (!previousManifest) console.log('No prior manifest found; existing content-hashed assets are reused.');

    for (let start = 0; start < files.length; start += checkBatchSize) {
      const batch = files.slice(start, start + checkBatchSize);
      const records = await Promise.all(batch.map(async relative => {
        const relativePath = normalizeManifestPath(relative.split(path.sep).join('/'));
        const localPath = path.join(distPath, relative);
        const stats = await fs.stat(localPath);
        const sha256 = await hashFile(localPath);
        const remotePath = path.posix.join(remoteRoot, relativePath);
        const metadata = { sha256, size: stats.size };
        currentFiles[relativePath] = metadata;

        // En fil som sto igjen fra forrige publisering («retired») og er tilbake i bygget, ligger der fortsatt
        const known = previousFiles[relativePath] ?? previousRetired[relativePath];
        if (known?.sha256 === sha256
          && known.size === stats.size
          && await remoteFileMatches(sftp, remotePath, stats.size)) {
          return null;
        }
        if (!previousManifest && isContentHashedAsset(relativePath)
          && await remoteFileMatches(sftp, remotePath, stats.size)) return null;
        return { relativePath, localPath, remotePath };
      }));
      changedFiles.push(...records.filter(Boolean));
      const checkedCount = Math.min(start + batch.length, files.length);
      if (checkedCount % 100 === 0 || checkedCount === files.length) {
        console.log(`Checked ${checkedCount}/${files.length} files.`);
      }
    }

    // HTML og app.js/app.css peker på andre filer, så de lastes opp sist, når det de peker på er på plass
    const isEntry = relativePath => relativePath.toLowerCase().endsWith('.html') || ['app.js', 'app.css'].includes(relativePath);
    const htmlFiles = changedFiles.filter(file => isEntry(file.relativePath));
    const otherFiles = changedFiles.filter(file => !isEntry(file.relativePath));
    // app.js/app.css først (gamle sider fungerer med nye), deretter undersidene, og forsiden til slutt
    const entryOrder = relativePath => ['app.css', 'app.js'].includes(relativePath) ? 0 : relativePath === 'index.html' ? 2 : 1;
    htmlFiles.sort((a, b) => entryOrder(a.relativePath) - entryOrder(b.relativePath) || a.relativePath.localeCompare(b.relativePath));
    const orderedFiles = [...otherFiles, ...htmlFiles];
    uploadedPaths = orderedFiles.map(file => file.relativePath);
    const directories = new Set([remoteRoot]);
    for (const file of orderedFiles) directories.add(path.posix.dirname(file.remotePath));
    const sortedDirectories = [...directories].sort((a, b) => a.split('/').length - b.split('/').length);
    const directoryDepths = [...new Set(sortedDirectories.map(directory => directory.split('/').length))];
    let preparedDirectoryCount = 0;
    for (const depth of directoryDepths) {
      const sameDepth = sortedDirectories.filter(directory => directory.split('/').length === depth);
      for (let start = 0; start < sameDepth.length; start += 20) {
        const batch = sameDepth.slice(start, start + 20);
        await Promise.all(batch.map(directory => ensureSftpDirectory(sftp, directory, ensuredDirectories)));
        preparedDirectoryCount += batch.length;
        if (preparedDirectoryCount % 100 === 0 || preparedDirectoryCount === sortedDirectories.length) {
          console.log(`Prepared ${preparedDirectoryCount}/${sortedDirectories.length} remote folders.`);
        }
      }
    }

    console.log(`Uploading ${orderedFiles.length} new or changed files; ${files.length - orderedFiles.length} are unchanged.`);
    const uploadBatchSize = 10;
    const batches = Math.ceil(orderedFiles.length / uploadBatchSize);
    for (let start = 0; start < orderedFiles.length; start += uploadBatchSize) {
      const batch = orderedFiles.slice(start, start + uploadBatchSize);
      await Promise.all(batch.map(file => uploadSftpFile(sftp, file.localPath, file.remotePath)));
      console.log(`Uploaded batch ${Math.floor(start / uploadBatchSize) + 1}/${batches}.`);
    }

    const { deletePaths, retired } = planStaleFiles({ previousFiles, previousRetired, currentFiles });
    for (const relativePath of deletePaths) {
      const remotePath = path.posix.join(remoteRoot, normalizeManifestPath(relativePath));
      await sftpCall(sftp, 'unlink', remotePath).catch(error => {
        if (!isMissingSftpPath(error)) throw error;
      });
    }
    // Tomme mapper etter slettede sider ga 403 (place/x/ uten index.html). rmdir feiler på mapper som ikke er
    // tomme, så filer scriptet ikke kjenner blir stående; den feilen er forventet og ignoreres.
    const removeDirectory = relativeDir => sftpCall(sftp, 'rmdir', path.posix.join(remoteRoot, relativeDir)).then(() => 1, () => 0);
    let removedDirectories = 0;
    for (const relativeDir of emptiedDirectories(deletePaths, Object.keys(currentFiles))) removedDirectories += await removeDirectory(relativeDir);
    // Tomme mapper fra publiseringer før dette ble ryddet (place/prussia/): undermapper av place/, game/ osv.
    // som ikke finnes i bygget
    const localDirectories = new Set(Object.keys(currentFiles).map(relativePath => path.posix.dirname(relativePath)));
    const sections = new Set([...localDirectories].filter(dir => dir.includes('/')).map(dir => dir.split('/')[0]));
    for (const section of sections) {
      const entries = await sftpCall(sftp, 'readdir', path.posix.join(remoteRoot, section)).catch(() => []);
      for (const entry of entries) {
        if (entry.filename === '.' || entry.filename === '..') continue;
        const relativeDir = `${section}/${entry.filename}`;
        if (entry.attrs.isDirectory() && !localDirectories.has(relativeDir)) removedDirectories += await removeDirectory(relativeDir);
      }
    }

    const manifestChanged = !previousManifest
      || previousManifest.version !== 2
      || JSON.stringify(previousFiles) !== JSON.stringify(currentFiles)
      || JSON.stringify(previousRetired) !== JSON.stringify(retired);
    if (manifestChanged) {
      const manifestText = `${JSON.stringify({ version: 2, files: currentFiles, retired }, null, 2)}\n`;
      await pipeline(
        Readable.from([manifestText]),
        sftp.createWriteStream(manifestPath, { flags: 'w', mode: 0o644 }),
      );
    }
    console.log(`Removed ${deletePaths.length} obsolete files and ${removedDirectories} empty folders; kept ${Object.keys(retired).length} assets of the previous deployment for open tabs.`);
  } finally {
    connection.end();
  }
  console.log('Incremental SFTP deployment complete. Unmanaged remote files were left in place.');
  return uploadedPaths;
}

async function upload() {
  const config = await readConfig();
  const stat = await fs.stat(distPath).catch(() => null);
  if (!stat?.isDirectory()) throw new Error('dist/ is missing. Run npm run build first.');
  assertProductionBuild(await fs.readFile(path.join(distPath, 'index.html'), 'utf8'));

  const files = await listFiles(distPath);
  if (!files.length) throw new Error('dist/ contains no files.');

  if (config.protocol === 'sftp') {
    const uploadedPaths = await uploadSftp(config, files);
    // Siden er allerede ute, så en feil mot IndexNow skal ikke se ut som en feilet publisering
    try {
      await submitUrls(urlsForHtmlFiles(uploadedPaths, await readSitemapUrls()));
    } catch (error) {
      console.warn(`IndexNow submission skipped: ${error.message}`);
    }
    return;
  }

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gametraveller-ftp-'));
  const curlConfigPath = path.join(tempDirectory, 'credentials.conf');
  const configLines = [
    `user = ${curlQuote(`${config.username}:${config.password}`)}`,
  ];
  await fs.writeFile(curlConfigPath, `${configLines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(curlConfigPath, 0o600).catch(() => {});

  const batchSize = 20;
  const batches = Math.ceil(files.length / batchSize);
  console.log(`Uploading ${files.length} files from dist/ to ${config.host}${config.remoteDir} using ${config.protocol.toUpperCase()}.`);
  try {
    for (let start = 0; start < files.length; start += batchSize) {
      const batch = files.slice(start, start + batchSize);
      const args = ['--config', curlConfigPath, '--silent', '--show-error', '--fail', '--ftp-create-dirs', '--connect-timeout', '20', '--max-time', '300'];
      if (config.protocol === 'ftps') args.push('--ssl-reqd');
      for (const relative of batch) {
        args.push('--upload-file', path.join(distPath, relative), remoteUrl(config, relative));
      }
      await runCurl(args);
      console.log(`Uploaded batch ${Math.floor(start / batchSize) + 1}/${batches}.`);
    }
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
  console.log('Upload complete. Existing remote files were left in place.');
}

async function main() {
  const command = process.argv[2];
  if (command === 'setup') return setup();
  if (command === 'upload') return upload();
  console.log('Usage: node scripts/deploy-ftp.mjs <setup|upload>');
  process.exitCode = command ? 1 : 0;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
