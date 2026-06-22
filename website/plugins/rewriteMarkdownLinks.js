/**
 * Docusaurus plugin that rewrites absolute docs.getdbt.com links in the
 * generated markdown files to repo-relative paths.
 *
 * The @signalwire/docusaurus-plugin-llms-txt plugin emits links as absolute
 * site URLs (relativePaths: false), e.g.
 *   [pre-hooks](https://docs.getdbt.com/reference/resource-configs/pre-hook-post-hook.md)
 *
 * Its built-in relativePaths option only produces root-relative paths
 * (/reference/...md), not document-relative ones, because the current
 * document's location is never threaded into its conversion pipeline. So we
 * post-process the finished .md files here instead, where we have both the
 * source file's path and the full build output to resolve against.
 *
 * For every link of the form https://docs.getdbt.com/<path>.md whose target
 * file actually exists in this build, we replace it with a document-relative
 * path (e.g. ../../reference/resource-configs/pre-hook-post-hook.md). Links to
 * pages not built for this version, non-.md routes (blog, guides, assets,
 * PDFs) and external URLs are left untouched so they remain valid links to the
 * live site.
 *
 * Must be registered AFTER @signalwire/docusaurus-plugin-llms-txt in the
 * plugins array so the .md files exist by the time this postBuild runs.
 */
const fs = require("fs");
const path = require("path");

const SITE_HOST_RE = /https?:\/\/docs\.getdbt\.com\/+([^\s)\]"'<>]*)/g;

/** Recursively collect all .md files under dir. */
function collectMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Rewrite a single matched docs.getdbt.com URL to a document-relative path when
 * its target .md exists in the build, otherwise return the original match.
 */
function rewriteOne(match, rest, fileDir, outDir) {
  // Split the path part from any #anchor or ?query suffix.
  const suffixMatch = rest.match(/[#?]/);
  const pathPart = suffixMatch ? rest.slice(0, suffixMatch.index) : rest;
  const suffix = suffixMatch ? rest.slice(suffixMatch.index) : "";

  if (!pathPart.endsWith(".md")) {
    return match; // non-.md routes (blog, guides, assets, ...) stay absolute
  }

  const targetAbs = path.join(outDir, pathPart);
  if (!fs.existsSync(targetAbs)) {
    return match; // not built for this version -> keep the live-site URL
  }

  let rel = path.relative(fileDir, targetAbs).split(path.sep).join("/");
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return `${rel}${suffix}`;
}

/** @returns {import('@docusaurus/types').Plugin} */
module.exports = function rewriteMarkdownLinks() {
  return {
    name: "rewrite-markdown-links",
    async postBuild({ outDir }) {
      const files = collectMarkdownFiles(outDir);
      let changedFiles = 0;
      let changedLinks = 0;

      for (const file of files) {
        const fileDir = path.dirname(file);
        const original = fs.readFileSync(file, "utf8");
        const updated = original.replace(SITE_HOST_RE, (match, rest) => {
          const result = rewriteOne(match, rest, fileDir, outDir);
          if (result !== match) {
            changedLinks += 1;
          }
          return result;
        });

        if (updated !== original) {
          fs.writeFileSync(file, updated);
          changedFiles += 1;
        }
      }

      console.log(
        `[rewrite-markdown-links] rewrote ${changedLinks} links across ` +
          `${changedFiles} files (of ${files.length} scanned)`
      );
    },
  };
};
