const { existsSync } = require("node:fs");
const path = require("node:path");

function pythonCandidates(rootDir, {
  env = process.env,
  platform = process.platform,
  exists = existsSync,
} = {}) {
  if (env.PC_MONITOR_PYTHON) {
    return [{ command: env.PC_MONITOR_PYTHON, prefixArgs: [] }];
  }

  const paths = platform === "win32" ? path.win32 : path.posix;
  const environments = [
    env.VIRTUAL_ENV,
    paths.join(rootDir, ".venv"),
    paths.join(rootDir, "venv"),
  ].filter(Boolean);

  for (const directory of environments) {
    const command = platform === "win32"
      ? paths.join(directory, "Scripts", "python.exe")
      : paths.join(directory, "bin", "python");
    if (exists(command)) return [{ command, prefixArgs: [] }];
  }

  return platform === "win32"
    ? [{ command: "py", prefixArgs: ["-3"] }, { command: "python", prefixArgs: [] }]
    : [{ command: "python3", prefixArgs: [] }, { command: "python", prefixArgs: [] }];
}

module.exports = { pythonCandidates };
