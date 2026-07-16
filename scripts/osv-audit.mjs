import { execFileSync } from "node:child_process";

const workspaces = JSON.parse(
  execFileSync("pnpm", ["-r", "list", "--prod", "--json", "--depth", "Infinity"], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  }),
);

const packages = new Map();
const collect = (dependencies) => {
  for (const [name, dependency] of Object.entries(dependencies ?? {})) {
    if (typeof dependency.version === "string" && !dependency.version.startsWith("link:")) {
      packages.set(`${name}@${dependency.version}`, {
        package: { ecosystem: "npm", name },
        version: dependency.version,
      });
    }
    collect(dependency.dependencies);
  }
};
for (const workspace of workspaces) collect(workspace.dependencies);

const entries = [...packages.entries()];
const findings = [];
for (let offset = 0; offset < entries.length; offset += 1_000) {
  const batch = entries.slice(offset, offset + 1_000);
  const response = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queries: batch.map(([, query]) => query) }),
  });
  if (!response.ok) throw new Error(`OSV request failed (${response.status})`);
  const payload = await response.json();
  payload.results.forEach((result, index) => {
    for (const vulnerability of result.vulns ?? []) {
      if (!vulnerability.withdrawn) {
        findings.push({ dependency: batch[index][0], id: vulnerability.id });
      }
    }
  });
}

if (findings.length > 0) {
  process.stderr.write("OSV found vulnerabilities in production dependencies:\n");
  for (const finding of findings) {
    process.stderr.write(`- ${finding.dependency}: ${finding.id}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `OSV checked ${entries.length} production packages: no known vulnerabilities.\n`,
  );
}
