/**
 * Process identity helpers shared by CLI wrappers, the dev launcher and tests.
 */
import { execSync } from 'child_process';

/** Full command line of a process, or '' when it cannot be read. */
export function getProcessArgs(pid) {
  try {
    return execSync(`ps -p ${pid} -o args= 2>/dev/null`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Whether a PID belongs to a token-reporter server process.
 * The server is always spawned as `node <...>/token-reporter/backend/dist/server.js`,
 * so the full command line must contain both the plugin path segment and server.js.
 * Matching on the command name only (`ps -o comm=`) returns "node" for every
 * Node process and would misidentify unrelated ones.
 */
export function isTokenReporterProcess(pid) {
  const args = getProcessArgs(pid);
  if (!args) return false;
  return args.includes('token-reporter') && args.includes('server.js');
}
