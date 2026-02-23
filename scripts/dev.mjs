import { spawn } from 'node:child_process';

const processes = [
  { name: 'mobile', command: 'pnpm', args: ['dev:mobile'] },
  { name: 'backend', command: 'pnpm', args: ['dev:backend'] },
];

let shuttingDown = false;
const children = [];

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const processDef of processes) {
  const child = spawn(processDef.command, processDef.args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    stopAll();

    if (signal) {
      process.exitCode = 1;
      console.error(`${processDef.name} exited with signal ${signal}`);
      return;
    }

    process.exitCode = code ?? 1;
    if (code && code !== 0) {
      console.error(`${processDef.name} exited with code ${code}`);
    }
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    stopAll();
    process.exitCode = 1;
    console.error(`Failed to start ${processDef.name}:`, error.message);
  });

  children.push(child);
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));

