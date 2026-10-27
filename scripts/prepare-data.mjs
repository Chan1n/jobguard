import { mkdir, writeFile } from "node:fs/promises";
const repos = [
  {
    repo: "Phishing-Database/Phishing.Database",
    file: "phishing-links-ACTIVE.txt",
    name: "Phishing.Database",
    license: "MIT",
  },
  {
    repo: "eset/malware-ioc",
    file: "deceptivedevelopment/samples.sha256",
    name: "ESET DeceptiveDevelopment",
    license: "BSD-2-Clause",
  },
];
await mkdir("data/licenses", { recursive: true });
await mkdir("public/licenses", { recursive: true });
const result = { version: "jobguard-v1", sources: [], urls: [], hashes: [] };
for (const r of repos) {
  const get = async (u) => {
    const a = await fetch(u);
    if (!a.ok) throw Error(`${a.status} ${u}`);
    return a.text();
  };
  const commit = JSON.parse(
    await get(`https://api.github.com/repos/${r.repo}/commits?per_page=1`),
  )[0].sha;
  const raw = await get(
    `https://raw.githubusercontent.com/${r.repo}/${commit}/${r.file}`,
  );
  const license = await get(
    `https://raw.githubusercontent.com/${r.repo}/${commit}/LICENSE`,
  );
  await writeFile(`data/licenses/${r.repo.split("/")[0]}.txt`, license);
  await writeFile(`public/licenses/${r.repo.split("/")[0]}.txt`, license);
  let values = [];
  if (r.repo.startsWith("Phishing")) {
    for (const line of raw.split(/\r?\n/)) {
      try {
        const u = new URL(line.trim());
        if (!["http:", "https:"].includes(u.protocol)) continue;
        u.hash = "";
        values.push(u.href);
      } catch {}
    }
    values = [...new Set(values)].sort().slice(0, 5000);
    result.urls = values;
  } else {
    values = [...new Set(raw.match(/\b[a-fA-F0-9]{64}\b/g) || [])]
      .map((s) => s.toLowerCase())
      .sort();
    result.hashes = values;
  }
  if (!values.length) throw Error(`No data for ${r.repo}`);
  result.sources.push({
    ...r,
    commit,
    downloadedAt: new Date().toISOString(),
    count: values.length,
    sourceUrl: `https://github.com/${r.repo}/blob/${commit}/${r.file}`,
  });
}
await writeFile("data/threats.json", JSON.stringify(result, null, 2) + "\n");
console.log(result.sources);
