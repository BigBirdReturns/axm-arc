'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { Worker } = require('node:worker_threads');

function workerProbe() {
  return new Promise((resolve) => {
    const worker = new Worker(
      'const { parentPort } = require("node:worker_threads"); parentPort.postMessage(6 * 7);',
      { eval: true },
    );
    let settled = false;
    worker.once('message', (value) => {
      settled = true;
      resolve({ ok: value === 42, value, error: null });
    });
    worker.once('error', (error) => {
      if (!settled) resolve({ ok: false, value: null, error: error.code || error.message });
    });
  });
}

function networkProbe(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(2000, () => finish({ denied: true, connected: false, error: 'timeout' }));
    socket.once('connect', () => finish({ denied: false, connected: true, error: null }));
    socket.once('error', (error) => finish({ denied: true, connected: false, error: error.code || error.message }));
  });
}

async function main() {
  let inputText = '';
  for await (const chunk of process.stdin) inputText += chunk;
  const input = JSON.parse(inputText);

  let allowedWrite = false;
  let allowedReadBack = false;
  let externalReadDenied = false;
  let externalReadError = null;
  let externalWriteDenied = false;
  let externalWriteError = null;

  const allowedPath = path.join(input.workDirectory, 'allowed.txt');
  try {
    fs.writeFileSync(allowedPath, 'allowed', 'utf8');
    allowedWrite = true;
    allowedReadBack = fs.readFileSync(allowedPath, 'utf8') === 'allowed';
  } catch {
    allowedWrite = false;
  }

  try {
    fs.readFileSync(input.externalFile, 'utf8');
  } catch (error) {
    externalReadDenied = true;
    externalReadError = error.code || error.message;
  }

  try {
    fs.writeFileSync(input.externalFile, 'forbidden', 'utf8');
  } catch (error) {
    externalWriteDenied = true;
    externalWriteError = error.code || error.message;
  }

  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  });
  const childProcessDenied = Boolean(child.error) || child.status !== 0;
  const childProcessError = child.error?.code || child.error?.message || null;

  const worker = await workerProbe();
  const network = await networkProbe(input.loopbackPort);

  const result = {
    format: 'axm-windows-capability-probe-result/1',
    inputReceived: input.message === 'release-after-kernel-attestation',
    allowedWrite,
    allowedReadBack,
    externalReadDenied,
    externalReadError,
    externalWriteDenied,
    externalWriteError,
    networkDenied: network.denied,
    networkConnected: network.connected,
    networkError: network.error,
    childProcessDenied,
    childProcessError,
    childProcessStatus: child.status,
    workerThreadSucceeded: worker.ok,
    workerValue: worker.value,
    workerError: worker.error,
    secretPresent: Object.prototype.hasOwnProperty.call(process.env, 'AXM_WINDOWS_PROBE_SECRET'),
    environmentKeys: Object.keys(process.env).sort(),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

// Triggered after registering the profile-derived environment workflow.
