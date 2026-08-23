/**
 * Rehype plugin that removes page chrome from the HTML before it is converted
 * to markdown by @signalwire/docusaurus-plugin-llms-txt. Here are the following rules:
 *
 * 1. Heading anchor links (a.hash-link). Docusaurus appends a "Direct link to"
 *    anchor to every heading; converted to markdown it becomes an empty link
 *    wrapping a zero-width space (U+200B, shown as <ZWSP>) on every heading:
 *
 *      ## Usage[<ZWSP>](#usage "Direct link to Usage")
 *
 * 2. aria-hidden elements. aria-hidden="true" marks an element as purely
 *    presentational (decorative icons, visual duplicates), so it carries no
 *    content worth keeping in markdown -- e.g. the availability pill's tooltip
 *    icon rendered a stray U+24D8 after "Available in v2".
 *
 * 3. HTML comment nodes. React SSR emits `<!-- -->` markers between adjacent
 *    JSX expressions, and they survive into the markdown as literal comments,
 *    e.g. every generated category-index card: `## [<icon><!-- --> <!-- -->Title](...)`.
 *
 * 4. Anchors with no href. Site chrome renders JS-driven buttons as bare
 *    anchors (`<a onClick=...>` with no href) -- the guide step-menu toggle
 *    (`quickstartTOC` `<a>Menu ...</a>`), the version switcher, and similar.
 *    They convert to empty links (`[Menu ]()`, `[v2]()`, `[]()`) that point
 *    nowhere. A real content link always carries an href, so an absent/empty
 *    href is a reliable "this is chrome" signal.
 *
 * 5. Zero-width space (U+200B) in text. Rule 1 removes the hash-link anchor
 *    that carried a ZWSP, but a ZWSP left in the heading text itself survives
 *    (e.g. `## Post-migration<ZWSP>`). Strip it from text.
 *
 *    Only U+200B -- deliberately NOT the zero-width joiner (U+200D) or
 *    non-joiner (U+200C). Those are load-bearing: U+200D glues emoji ZWJ
 *    sequences (family, gendered/skin-tone glyphs, e.g. man+ZWJ+man+ZWJ+girl
 *    renders as a single family emoji) and both appear in Indic/Persian text,
 *    so stripping them corrupts real content.
 *
 * Runs in the conversion pipeline only (beforeDefaultRehypePlugins); the
 * rendered site is unaffected.
 */
import { visit, SKIP } from "unist-util-visit";

// Zero-width space -- invisible in the rendered page but visible noise in a
// plain-text consumer. Scoped to U+200B only; see rule 5 for why the joiners
// (U+200C/U+200D) are left alone.
const ZERO_WIDTH = /\u200B/g;

export default function rehypeCleanMarkdown() {
  return (tree) => {
    visit(tree, "comment", (node, index, parent) => {
      if (parent === undefined) {
        return;
      }
      parent.children.splice(index, 1);
      return [SKIP, index];
    });

    visit(tree, "text", (node) => {
      if (typeof node.value === "string" && ZERO_WIDTH.test(node.value)) {
        node.value = node.value.replace(ZERO_WIDTH, "");
      }
    });

    visit(tree, "element", (node, index, parent) => {
      if (parent === undefined) {
        return;
      }

      const className = node.properties?.className;
      const isHashLink =
        node.tagName === "a" &&
        Array.isArray(className) &&
        className.includes("hash-link");

      const ariaHidden = node.properties?.ariaHidden;
      const isAriaHidden = ariaHidden === true || ariaHidden === "true";

      const href = node.properties?.href;
      const isEmptyHrefAnchor =
        node.tagName === "a" && (href === undefined || href === "");

      if (!isHashLink && !isAriaHidden && !isEmptyHrefAnchor) {
        return;
      }

      parent.children.splice(index, 1);
      // Re-visit the node now occupying this index.
      return [SKIP, index];
    });
  };
}
