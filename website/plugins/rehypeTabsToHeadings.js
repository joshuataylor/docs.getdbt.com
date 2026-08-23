/**
 * Rehype plugin that restructures Docusaurus tabs for markdown conversion.
 *
 * A `<Tabs>` block renders as:
 *
 *   <div class="tabs-container">
 *     <ul role="tablist"><li role="tab">Models</li><li role="tab">Seeds</li>...</ul>
 *     <div><div role="tabpanel">...</div><div role="tabpanel" hidden>...</div>...</div>
 *   </div>
 *
 * Converted to markdown as-is, the labels become an orphaned bullet list and
 * every panel's content is concatenated with nothing marking where one tab
 * ends and the next begins. Replace the tablist with a heading per panel,
 * carrying that panel's label, so the generated markdown keeps the structure:
 *
 *   ### Models
 *   ...panel content...
 *   ### Seeds
 *   ...
 *
 * The heading level is derived from the nearest preceding heading in document
 * order (+1, capped at h6), so tab headings nest under their enclosing section
 * rather than a fixed `h3`: a `<Tabs>` under an `####` heading yields `#####`
 * tab headings, and tabs nested inside a tab panel go one level deeper again.
 * Labels map to panels by order, which is how Docusaurus renders them. Panels
 * are un-hidden so downstream processing treats them all alike.
 *
 * Runs in the @signalwire/docusaurus-plugin-llms-txt conversion pipeline only
 * (beforeDefaultRehypePlugins); the rendered site is unaffected.
 */
const HEADING = /^h([1-6])$/;

function isElement(node) {
  return node?.type === "element";
}

function textOf(node) {
  if (node.type === "text") {
    return node.value;
  }
  return (node.children || []).map(textOf).join("");
}

// Rewrite a `.tabs-container` node in place: drop the tablist, emit a heading
// (at `level`) per panel, and un-hide the panels. Returns true if it applied.
function transformTabs(node, level) {
  const tablist = node.children?.find(
    (child) => isElement(child) && child.properties?.role === "tablist"
  );
  if (!tablist) {
    return false;
  }

  const labels = (tablist.children || [])
    .filter((child) => isElement(child) && child.properties?.role === "tab")
    .map((child) => textOf(child).trim());

  // Panels sit either directly in the container or one wrapper div down.
  const panels = [];
  for (const child of node.children) {
    if (child === tablist || !isElement(child)) {
      continue;
    }
    if (child.properties?.role === "tabpanel") {
      panels.push(child);
      continue;
    }
    for (const grandchild of child.children || []) {
      if (isElement(grandchild) && grandchild.properties?.role === "tabpanel") {
        panels.push(grandchild);
      }
    }
  }
  if (panels.length === 0) {
    return false;
  }

  const rebuilt = [];
  panels.forEach((panel, index) => {
    const label = labels[index];
    if (label) {
      rebuilt.push({
        type: "element",
        tagName: `h${level}`,
        properties: {},
        children: [{ type: "text", value: label }],
      });
    }
    if (panel.properties) {
      delete panel.properties.hidden;
    }
    rebuilt.push(panel);
  });
  node.children = rebuilt;
  return true;
}

export default function rehypeTabsToHeadings() {
  return (tree) => {
    // Nearest preceding heading level in document order. Default 1 (the implicit
    // page title), so a tabs block before any heading yields h2 sections.
    let lastLevel = 1;

    const walk = (node) => {
      if (isElement(node)) {
        const heading = HEADING.exec(node.tagName);
        if (heading) {
          lastLevel = Number(heading[1]);
        }

        const className = node.properties?.className;
        if (Array.isArray(className) && className.includes("tabs-container")) {
          const level = Math.min(6, lastLevel + 1);
          if (transformTabs(node, level)) {
            // The emitted tab headings become the context for nested tabs; the
            // walk below re-reads them, so descendants derive from `level`.
            for (const child of node.children) {
              walk(child);
            }
            return;
          }
        }
      }

      for (const child of node.children || []) {
        walk(child);
      }
    };

    walk(tree);
  };
}
