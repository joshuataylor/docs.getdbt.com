/**
 * Rehype plugin that turns embedded `<iframe>` players into a link before the
 * HTML is converted to markdown by @signalwire/docusaurus-plugin-llms-txt.
 *
 * The converter drops `<iframe>` as non-content, so Loom/Wistia/YouTube embeds
 * vanish from the generated markdown with nothing in their place -- e.g.
 * `guides/refactoring-legacy-sql` loses 7 videos, and `about-user-access` ends
 * on an orphan "## Learn more" heading with no body. Replace each `iframe[src]`
 * with a paragraph holding a link to the embed so the reference survives.
 *
 * The label uses the iframe's `title` when present, otherwise a host-derived
 * name ("Loom video", "YouTube video", ...), falling back to "Embedded video".
 *
 * Runs in the conversion pipeline only (beforeDefaultRehypePlugins); the
 * rendered site is unaffected.
 */
import { visit, SKIP } from "unist-util-visit";

function labelFor(src, title) {
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }
  if (/loom\.com/.test(src)) return "Loom video";
  if (/wistia\./.test(src)) return "Wistia video";
  if (/youtube\.com|youtu\.be/.test(src)) return "YouTube video";
  if (/vimeo\.com/.test(src)) return "Vimeo video";
  return "Embedded video";
}

export default function rehypeIframeToLink() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "iframe" || parent === undefined) {
        return;
      }
      const src = node.properties?.src;
      if (typeof src !== "string" || src === "") {
        return;
      }

      const label = labelFor(src, node.properties?.title);
      const link = {
        type: "element",
        tagName: "p",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "a",
            properties: { href: src },
            children: [{ type: "text", value: label }],
          },
        ],
      };
      parent.children[index] = link;
      return [SKIP, index];
    });
  };
}
