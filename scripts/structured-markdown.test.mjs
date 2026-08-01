import assert from "node:assert/strict";
import test from "node:test";
import { renderStructuredTables } from "./structured-markdown.mjs";

test("renders an explicit four-column paper table and leaves following prose outside", () => {
  const rendered = renderStructuredTables(`**Approach** | **Primary continuity** | **Body or environment** | **Successor production**
Language-model agent | Session | External tools | Completes work
Semantic autopoiesis | Subject and facts | Ordinary infrastructure | Admits successors
An agent can be intelligent without being a persistent subject.`);

  assert.match(rendered, /^\| \*\*Approach\*\* \| \*\*Primary continuity\*\* \| \*\*Body or environment\*\* \| \*\*Successor production\*\* \|/);
  assert.match(rendered, /\| Semantic autopoiesis \| Subject and facts \| Ordinary infrastructure \| Admits successors \|\n\nAn agent/);
  assert.doesNotMatch(rendered, /\| Item \| Status \| Responsibility \|/);
});

test("reconstructs wrapped table rows and removes publication style tokens", () => {
  const rendered = renderStructuredTables(`MLIndigo
MLWhite**Layer** | MLWhite**Machine substrate** | MLWhite**Functional role**
MLPanel
Executable organs | Qualified KFX extensions; admitted CLIs, adapters,
services, and workflows | Perform specialized action
MLPaperSoft
Body and metabolism | Servers and caches | Supply persistence
KFX remains independently qualified.`);

  assert.match(rendered, /\| \*\*Layer\*\* \| \*\*Machine substrate\*\* \| \*\*Functional role\*\* \|/);
  assert.match(rendered, /\| Executable organs \| Qualified KFX extensions; admitted CLIs, adapters, services, and workflows \| Perform specialized action \|/);
  assert.doesNotMatch(rendered, /ML(?:Indigo|White|Panel|PaperSoft)/);
  assert.match(rendered, /\n\nKFX remains independently qualified\.$/);
});

test("does not reinterpret a two-line piecewise expression as a table", () => {
  const source = `admit(S_t, C_t, E_t, W_t), | if qualification succeeds,
S_t, | otherwise.`;
  assert.equal(renderStructuredTables(source), source);
});
