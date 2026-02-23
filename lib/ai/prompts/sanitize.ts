/**
 * Sanitize user-supplied text for safe inclusion in AI prompts.
 *
 * Removes ASCII control characters (which cause API errors or garbled output)
 * and escapes triple-backtick sequences that would break code-fence delimiters.
 *
 * HTML entity escaping (&amp; / &lt; / &gt;) is intentionally absent: these
 * strings are sent to an LLM, not rendered as HTML. Escaping would cause the
 * model to see literal entity sequences (e.g. "Tom &amp; Jerry") and reproduce
 * them verbatim, distorting generated content.
 */
export function sanitizePromptInput(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/```/g, "\\`\\`\\`");
}

/**
 * Like sanitizePromptInput, but also escapes < and > to prevent user-supplied
 * content from injecting false XML closing tags when embedded inside
 * XML-delimited prompt sections such as <company_context>…</company_context>.
 *
 * Only use this variant when the text is placed directly inside an XML-like
 * delimiter in the prompt. For all other text (voice profiles, edit text,
 * topic strings, etc.) use sanitizePromptInput.
 */
export function sanitizeXmlContent(input: string): string {
  return sanitizePromptInput(input)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
