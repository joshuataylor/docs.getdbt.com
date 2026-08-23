/**
 * Rehype plugin that resolves raw `<br>` elements before the HTML is converted
 * to markdown by @signalwire/docusaurus-plugin-llms-txt.
 *
 * Authored `<br />` in the source docs survives conversion as a literal
 * `<br />` tag in the generated markdown, e.g. prose ending in
 * "...using the `{{ config() }}` macro.<br />". That is noise in a plain-text
 * consumer.
 *
 * Table cells are the exception: GFM has no other way to break a line inside a
 * cell, so a `<br>` in a `<td>`/`<th>` is the correct representation and is left
 * alone. Everywhere else the `<br>` is replaced with a newline text node, which
 * the markdown conversion renders as an ordinary break rather than raw HTML.
 *
 * Runs in the conversion pipeline only (beforeDefaultRehypePlugins); the
 * rendered site is unaffected.
 */
import { visitParents } from "unist-util-visit-parents";

const CELL_TAGS = new Set(["td", "th"]);

export default function rehypeBrToBreak() {
  return (tree) => {
    visitParents(tree, "element", (node, ancestors) => {
      if (node.tagName !== "br") {
        return;
      }

      const inTableCell = ancestors.some(
        (ancestor) => ancestor.type === "element" && CELL_TAGS.has(ancestor.tagName)
      );
      if (inTableCell) {
        return;
      }

      const parent = ancestors[ancestors.length - 1];
      const index = parent.children.indexOf(node);
      if (index === -1) {
        return;
      }
      parent.children[index] = { type: "text", value: "\n" };
    });
  };
}
