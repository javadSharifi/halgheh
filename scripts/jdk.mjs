// Prints a JDK 21 home, so `pnpm android:*` works on any machine (macOS, Linux, CI) without hardcoding Homebrew paths.
// It never guesses: a candidate is accepted only when `java -version` really reports 21.
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Major version of the JDK at `home`, or null. `java -version` writes to stderr and exits 0, so stderr is the stream to read. */
function majorOf(home) {
  if (!home || !existsSync(`${home}/bin/java`)) return null;
  const r = spawnSync(`${home}/bin/java`, ['-version'], { encoding: 'utf8' });
  const text = `${r.stderr ?? ''}${r.stdout ?? ''}`;
  return Number(/version "(\d+)/.exec(text)?.[1] ?? 0) || null;
}

const candidates = [];
if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);
try {
  candidates.push(execFileSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
} catch {
  /* not macOS, or no such JDK installed */
}
for (const p of [
  '/opt/homebrew/opt/openjdk@21',
  '/usr/local/opt/openjdk@21',
  `${process.env.HOME ?? ''}/.sdkman/candidates/java/21-tem`,
  '/usr/lib/jvm/temurin-21-jdk-amd64',
  '/usr/lib/jvm/java-21-openjdk-amd64',
  '/usr/lib/jvm/java-21-openjdk',
  `${process.env.HOME ?? ''}/.gradle/jdks`, // last resort: a toolchain Gradle already downloaded
]) {
  if (p && existsSync(p)) candidates.push(p);
}

for (const home of candidates) {
  if (majorOf(home) === 21) {
    process.stdout.write(home);
    process.exit(0);
  }
}

process.stderr.write('No JDK 21 found. Install one, or set JAVA_HOME to a JDK 21 before running this.\n');
process.exit(1);
