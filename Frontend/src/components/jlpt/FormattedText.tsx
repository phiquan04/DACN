const ALLOWED_TAGS = ["u", "b", "i", "mark"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapes the whole string first, then selectively re-enables only a fixed
 * whitelist of plain (no-attribute) tags — so admin-authored `<u>`/`<b>`/`<i>`/
 * `<mark>` markup renders, but nothing else (script tags, attributes, event
 * handlers) can ever get through. */
function sanitizeToHtml(raw: string): string {
  let escaped = escapeHtml(raw);
  for (const tag of ALLOWED_TAGS) {
    escaped = escaped
      .replace(new RegExp(`&lt;${tag}&gt;`, "g"), `<${tag}>`)
      .replace(new RegExp(`&lt;/${tag}&gt;`, "g"), `</${tag}>`);
  }
  return escaped;
}

interface Props {
  text: string;
  className?: string;
}

/** Renders question/passage text that may contain a small set of admin-applied
 * inline formatting tags (bold/italic/underline/highlight) — used both in the
 * review editor's preview and in the actual exam-taking / result views so the
 * formatting an admin sets up is what learners actually see. */
export default function FormattedText({ text, className }: Props) {
  return <span lang="ja" className={className} dangerouslySetInnerHTML={{ __html: sanitizeToHtml(text) }} />;
}
