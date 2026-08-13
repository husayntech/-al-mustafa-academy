/**
 * Cleans pasted/copied HTML before it is saved or rendered.
 * Removes browser copy/paste artifacts (<!--StartFragment-->/<!--EndFragment-->),
 * MS Office comment boilerplate, stray comment blocks, Word XML namespace tags,
 * and invisible zero-width spaces — these otherwise show up as raw text errors
 * inside plain inputs and pollute saved content.
 *
 * Pure module (no React / DOM imports) so the server can share it too.
 */
export function cleanHtmlMarkup(html: string): string {
  if (!html) return html;
  let out = html;
  // Chrome/Firefox copy-paste fragment markers
  out = out.replace(/<!--StartFragment-->/g, "");
  out = out.replace(/<!--EndFragment-->/g, "");
  // MS Office conditional comments, e.g. <!--[if gte mso 9]>...<![endif]-->
  out = out.replace(/<!--\[if[\s\S]*?\]>/g, "");
  out = out.replace(/<!\[endif\]-->/g, "");
  // Any other stray comment blocks (invisible in the browser but leak into saved text)
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Word XML namespace tags (<xml>, <o:p>, <w:…>, <v:…>, <m:…>)
  out = out.replace(/<\/?(?:xml|o:p|v:|w:|m:)[^>]*>/gi, "");
  // Invisible zero-width spaces inserted by some editors/selections
  out = out.replace(/\u200b/g, "");
  return out.trim();
}

/**
 * Prepares short tagline strings (header/footer motos) for compact display.
 *
 * Rich-text editors often wrap taglines in blockquote/ol/li containers and add
 * empty &nbsp; spans, <br> noise, and oversized inline font-size/color styles.
 * Those artifacts inflate vertical spacing (e.g. a 100px+ gap between the
 * school name and its tagline). This strips the block-level wrappers and inline
 * styles so the tagline renders at the size the surrounding footer styles
 * define — with no phantom vertical gaps.
 */
export function cleanTaglineHtml(html: string): string {
  if (!html) return html;
  let out = cleanHtmlMarkup(html);
  // Unwrap block-level containers, keeping their inner content
  out = out.replace(/<\/?(?:blockquote|ol|ul|li|p|div)\b[^>]*>/gi, "");
  // Remove <br> elements (replaced with a space)
  out = out.replace(/<br\s*\/?>/gi, " ");
  // Collapse spans that only contain &nbsp;/whitespace, loop for nesting
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<span\b[^>]*>(?:&nbsp;|\s)*<\/span>/gi, "");
  } while (out !== prev);
  // Strip inline style attributes so footer typography controls the size
  out = out.replace(/\sstyle="[^"]*"/gi, "");
  out = out.replace(/\sstyle='[^']*'/gi, "");
  // Replace any remaining &nbsp; entities and collapse whitespace
  out = out.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  return out;
}
