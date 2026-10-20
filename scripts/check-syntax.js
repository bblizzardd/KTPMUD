import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
for (const directory of ['server', 'gateway', 'scripts', 'tests']) {
  for (const name of readdirSync(directory).filter(x => x.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', `${directory}/${name}`], {stdio: 'inherit'});
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log('JavaScript syntax checks passed.');
