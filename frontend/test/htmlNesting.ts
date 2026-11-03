/** Elements the HTML parser won't let sit inside a `<p>`: meeting one ends
 * the paragraph early. React builds the DOM directly, so a test render
 * keeps the nesting, but the browser parses the server's HTML and
 * reshapes it before hydration. A `TextLink` (a `<p>` of its own unless
 * `inline`) inside a `Text` came out as an empty `<a>` followed by a stray
 * paragraph, which axe reports as a link with no name. */
const ENDS_A_PARAGRAPH = [
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
];

/** The outer HTML of every element inside a `<p>` that the parser would
 * pull out of it. Empty when the markup survives a round trip through
 * the browser's parser. */
export function elementsThatEndAParagraph(container: Element): string[] {
  return Array.from(container.querySelectorAll(ENDS_A_PARAGRAPH.map((tag) => `p ${tag}`).join(', '))).map((element) =>
    element.outerHTML.slice(0, 200),
  );
}
