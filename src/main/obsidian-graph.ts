import { promises as fs, type Dirent } from "fs";
import * as os from "os";
import * as path from "path";

export type ObsidianNode = {
  id: string;
  label: string;
  path: string;
  tags: string[];
  links: string[];
};

export type ObsidianGraphData = {
  vaultPath: string;
  nodeCount: number;
  edgeCount: number;
  nodes: ObsidianNode[];
};

const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
const TAG_REGEX = /(^|\s)#([a-zA-Z0-9_\-/]+)/g;

function normalizeName(raw: string): string {
  return raw.trim().replace(/\.md$/i, "").toLowerCase();
}

function makeDefaultVaultPath(): string {
  return path.join(os.homedir(), "Documents", "Obsidian Vault");
}

async function walkMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: Dirent[] = [];
    try {
      entries = (await fs.readdir(current, { withFileTypes: true })) as Dirent[];
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }

  return out;
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const regex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags);
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    const value = (match[2] || "").trim();
    if (value) tags.add(value.toLowerCase());
    match = regex.exec(content);
  }
  return Array.from(tags);
}

function extractLinks(content: string): string[] {
  const links = new Set<string>();
  const regex = new RegExp(WIKILINK_REGEX.source, WIKILINK_REGEX.flags);
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    const value = normalizeName(match[1] || "");
    if (value) links.add(value);
    match = regex.exec(content);
  }
  return Array.from(links);
}

export async function readObsidianGraph(vaultPath?: string): Promise<ObsidianGraphData> {
  const resolvedVault = vaultPath && vaultPath.trim().length > 0 ? vaultPath : makeDefaultVaultPath();
  const files = await walkMarkdownFiles(resolvedVault);

  const nodes: ObsidianNode[] = [];
  const byNormalizedName = new Map<string, ObsidianNode>();

  for (const file of files) {
    let content = "";
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    const relative = path.relative(resolvedVault, file).split("\\").join("/");
    const basename = path.basename(file, ".md");
    const id = normalizeName(basename);

    const node: ObsidianNode = {
      id,
      label: basename,
      path: relative,
      tags: extractTags(content),
      links: extractLinks(content),
    };
    nodes.push(node);
    if (!byNormalizedName.has(id)) byNormalizedName.set(id, node);
  }

  for (const node of nodes) {
    node.links = node.links.filter((ref) => byNormalizedName.has(ref));
  }

  let edgeCount = 0;
  const dedupe = new Set<string>();
  for (const node of nodes) {
    for (const link of node.links) {
      const a = node.id < link ? node.id : link;
      const b = node.id < link ? link : node.id;
      const key = `${a}::${b}`;
      if (!dedupe.has(key)) {
        dedupe.add(key);
        edgeCount += 1;
      }
    }
  }

  return {
    vaultPath: resolvedVault,
    nodeCount: nodes.length,
    edgeCount,
    nodes,
  };
}
