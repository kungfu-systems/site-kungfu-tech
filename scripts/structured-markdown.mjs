const TABLE_STYLE_TOKEN = /^ML(?:Indigo|Panel|PaperSoft)$/;
const TABLE_HEADER_LABELS = new Set(["Approach", "Decision", "Layer", "Mechanism", "Surface"]);

function tableCells(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("|") || /^[-*+]\s+/.test(trimmed)) return null;
  const cells = trimmed.split("|").map((cell) => cell.trim());
  return cells.length >= 2 && cells.every(Boolean) ? cells : null;
}

function cleanCell(cell) {
  return cell.replace(/^MLWhite/, "").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function plainCell(cell) {
  return cleanCell(cell).replace(/[*_`]/g, "").trim();
}

function appendText(current, continuation) {
  const separator = /^[,.;:!?)]/.test(continuation) ? "" : " ";
  return cleanCell(`${current}${separator}${continuation}`);
}

function isHeader(cells) {
  return TABLE_HEADER_LABELS.has(plainCell(cells[0]));
}

function isParagraphStart(line) {
  const trimmed = line.trim();
  return /^(?:[*_`]|[A-Z0-9])/.test(trimmed);
}

export function renderStructuredTables(sourceMarkdown) {
  const lines = sourceMarkdown.split("\n");
  const output = [];

  for (let index = 0; index < lines.length;) {
    if (TABLE_STYLE_TOKEN.test(lines[index].trim())) {
      const next = lines.slice(index + 1).find((line) => line.trim() && !TABLE_STYLE_TOKEN.test(line.trim()));
      if (next && isHeader(tableCells(next) || [])) {
        index += 1;
        continue;
      }
    }

    const first = tableCells(lines[index]);
    if (!first) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const width = first.length;
    const sourceHeader = isHeader(first);
    const rows = [];
    let pending = null;
    let cursor = index + 1;
    if (!sourceHeader) rows.push(first.map(cleanCell));

    while (cursor < lines.length && lines[cursor].trim() !== "" && !/^#{2,6}\s+/.test(lines[cursor])) {
      const trimmed = lines[cursor].trim();
      if (TABLE_STYLE_TOKEN.test(trimmed)) {
        cursor += 1;
        continue;
      }

      const cells = tableCells(lines[cursor])?.map(cleanCell) || null;
      if (cells) {
        if (cells.length === width) {
          if (pending) break;
          rows.push(cells);
        } else if (cells.length < width) {
          if (!pending) {
            pending = cells;
          } else {
            pending[pending.length - 1] = appendText(pending.at(-1), cells[0]);
            pending.push(...cells.slice(1));
          }
          if (pending.length === width) {
            rows.push(pending);
            pending = null;
          }
        } else {
          break;
        }
        cursor += 1;
        continue;
      }

      if (pending) {
        pending[pending.length - 1] = appendText(pending.at(-1), trimmed);
        cursor += 1;
        continue;
      }
      if (rows.length > 0 && !isParagraphStart(trimmed)) {
        rows[rows.length - 1][width - 1] = appendText(rows.at(-1)[width - 1], trimmed);
        cursor += 1;
        continue;
      }
      break;
    }

    const qualifies = !pending && (sourceHeader ? rows.length > 0 : rows.length >= 3);
    if (!qualifies) {
      output.push(...lines.slice(index, cursor));
      index = cursor;
      continue;
    }

    const header = sourceHeader
      ? first.map(cleanCell)
      : width === 2
        ? ["Responsibility", "Meaning"]
        : ["Item", "Status", "Responsibility"];
    const escapeCell = (cell = "") => cell.replaceAll("|", "\\|");
    output.push(
      `| ${header.map(escapeCell).join(" | ")} |`,
      `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
      ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
      "",
    );
    index = cursor;
  }

  return output.join("\n");
}
