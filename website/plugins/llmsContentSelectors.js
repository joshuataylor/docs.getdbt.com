/**
 * Content selectors for @signalwire/docusaurus-plugin-llms-txt: the element of
 * each built HTML page that gets converted to that page's .md file. The first
 * selector that matches wins.
 *
 * This is the plugin's default list with two changes:
 *
 * - `[data-md-root]` comes first. It marks the element to convert on pages
 *   that have no <main> or <article> wrapper. The homepage (src/pages/index.js)
 *   uses it so /index.md -- also served for `Accept: text/markdown` on / by
 *   middleware.js -- carries the whole page instead of only the first card.
 * - The per-card defaults `main .container .col` and `article` are dropped.
 *   Generated index pages (category, tags and doc-id landing pages) have no
 *   `.theme-doc-markdown`, so those selectors matched each DocCard and
 *   extractContent() kept only the first, losing the card list and the h1.
 *   Without them index pages resolve to the wrapper holding the header and
 *   every card: `main .container` for category and doc-id pages, `main` for
 *   tags pages (which have no `.container`). Ordinary doc pages still match
 *   `.theme-doc-markdown` first.
 *
 * routeRules can't do this: in 2.0.0-alpha.2 per-route contentSelectors are
 * resolved but never passed to the HTML converter.
 */
const llmsContentSelectors = [
  "[data-md-root]",
  // Plugin defaults (DEFAULT_CONTENT_SELECTORS in the plugin's constants.js),
  // minus the per-card `main .container .col` and `article`
  ".theme-doc-markdown",
  "main .container",
  "main .theme-doc-wrapper",
  "main",
];

export default llmsContentSelectors;
