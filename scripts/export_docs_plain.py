#!/usr/bin/env python3
"""Export docs/*.md to plain text in docs/plain/ for Word and other editors."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "plain"


def md_to_plain(text: str) -> str:
  lines: list[str] = []
  in_code = False
  for raw in text.splitlines():
    line = raw.rstrip()
    if line.strip().startswith("```"):
      in_code = not in_code
      if in_code:
        lines.append("")
      continue
    if in_code:
      lines.append(line)
      continue
    # ATX headings → plain title lines
    m = re.match(r"^(#{1,6})\s+(.*)$", line)
    if m:
      lines.append("")
      lines.append(m.group(2).strip())
      lines.append("-" * min(72, max(8, len(m.group(2).strip()))))
      continue
    # table separator rows
    if re.match(r"^\|?[\s\-:|]+\|?$", line.strip()):
      continue
    # table cells → tab-separated
    if "|" in line and line.strip().startswith("|"):
      cells = [c.strip() for c in line.strip().strip("|").split("|")]
      lines.append("\t".join(cells))
      continue
    # links [text](url) → text (url)
    line = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", line)
    # bold/italic
    line = re.sub(r"\*\*([^*]+)\*\*", r"\1", line)
    line = re.sub(r"\*([^*]+)\*", r"\1", line)
    line = re.sub(r"`([^`]+)`", r"\1", line)
    lines.append(line)
  # collapse 3+ blank lines
  out = "\n".join(lines)
  out = re.sub(r"\n{3,}", "\n\n", out)
  return out.strip() + "\n"


def main() -> None:
  OUT.mkdir(parents=True, exist_ok=True)
  md_files = sorted(DOCS.glob("*.md"))
  combined: list[str] = []

  for path in md_files:
    plain = md_to_plain(path.read_text(encoding="utf-8"))
    out_path = OUT / f"{path.stem}.txt"
    out_path.write_text(plain, encoding="utf-8")
    combined.append(plain)
    print(f"wrote {out_path.relative_to(ROOT)}")

  all_path = OUT / "all-documentation.txt"
  all_path.write_text("\n\n".join(combined), encoding="utf-8")
  print(f"wrote {all_path.relative_to(ROOT)}")


if __name__ == "__main__":
  main()
