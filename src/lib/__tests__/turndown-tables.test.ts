import { test } from "node:test";
import assert from "node:assert/strict";
import TurndownService from "turndown";
import { tables as gfmTables } from "turndown-plugin-gfm";

function makeTd() {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  td.use(gfmTables);

  // Custom rule: convert tables without <thead> by treating first row as header
  td.addRule("table-without-thead", {
    filter(node: any) {
      return node.nodeName === "TABLE" && !node.querySelector("thead");
    },
    replacement(_content: string, node: any) {
      const rows = node.querySelectorAll("tr");
      if (rows.length === 0) return "";

      const getCells = (tr: any): string[] => {
        const cells = tr.querySelectorAll("td, th");
        const result: string[] = [];
        for (let i = 0; i < cells.length; i++) {
          let text = cells[i].innerHTML
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/\|/g, "\\|")
            .replace(/\n/g, " ")
            .trim();
          result.push(text);
        }
        return result;
      };

      const headerCells = getCells(rows[0]);
      if (headerCells.length === 0) return "";

      const lines: string[] = [];
      lines.push("| " + headerCells.join(" | ") + " |");
      lines.push("| " + headerCells.map(() => "---").join(" | ") + " |");

      for (let i = 1; i < rows.length; i++) {
        const cells = getCells(rows[i]);
        while (cells.length < headerCells.length) cells.push("");
        lines.push(
          "| " + cells.slice(0, headerCells.length).join(" | ") + " |"
        );
      }

      return "\n\n" + lines.join("\n") + "\n\n";
    },
  });

  return td;
}

test("basic table with thead converts to GFM markdown table", () => {
  const html = `<table><thead><tr><th>名称</th><th>类型</th><th>说明</th></tr></thead><tbody><tr><td>foo</td><td>string</td><td>bar</td></tr><tr><td>baz</td><td>int</td><td>qux</td></tr></tbody></table>`;
  const md = makeTd().turndown(html);
  assert.match(md, /\|\s*名称\s*\|\s*类型\s*\|\s*说明\s*\|/);
  assert.match(md, /\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/);
  assert.match(md, /\|\s*foo\s*\|\s*string\s*\|\s*bar\s*\|/);
});

test("table without thead but with th elements converts to markdown table", () => {
  const html = `<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>`;
  const md = makeTd().turndown(html);
  assert.match(md, /\|\s*A\s*\|\s*B\s*\|/);
  assert.match(md, /\|\s*1\s*\|\s*2\s*\|/);
});

test("cell with br tag does not break table row structure", () => {
  const html = `<table><thead><tr><th>key</th><th>value</th></tr></thead><tbody><tr><td>line1<br>line2</td><td>x</td></tr></tbody></table>`;
  const md = makeTd().turndown(html);
  const tableLines = md.split("\n").filter(l => l.trim().startsWith("|"));
  assert.ok(tableLines.length >= 3, "should have at least header + separator + 1 data row");
});

test("table without thead: first row becomes header", () => {
  const html = `<table><tr><td>字段名</td><td>类型</td><td>必选</td><td>说明</td></tr><tr><td>orderId</td><td>String</td><td>是</td><td>订单号</td></tr><tr><td>amount</td><td>Number</td><td>否</td><td>金额</td></tr></table>`;
  const md = makeTd().turndown(html);
  assert.match(md, /\|\s*字段名\s*\|\s*类型\s*\|\s*必选\s*\|\s*说明\s*\|/);
  assert.match(md, /\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/);
  assert.match(md, /\|\s*orderId\s*\|\s*String\s*\|\s*是\s*\|\s*订单号\s*\|/);
});

test("table without thead: pipe in cell content is escaped", () => {
  const html = `<table><tr><td>A|B</td><td>C</td></tr><tr><td>1</td><td>2</td></tr></table>`;
  const md = makeTd().turndown(html);
  assert.match(md, /A\\\|B/);
});

test("table without thead: br in cell replaced with space", () => {
  const html = `<table><tr><td>Header</td></tr><tr><td>line1<br>line2</td></tr></table>`;
  const md = makeTd().turndown(html);
  assert.match(md, /line1 line2/);
});

test("table without thead: rows with fewer cells are padded", () => {
  const html = `<table><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>1</td></tr></table>`;
  const md = makeTd().turndown(html);
  const dataRow = md.split("\n").find(l => l.includes("| 1"));
  assert.ok(dataRow, "should have data row with '1'");
  // Should have 3 pipe-separated cells
  const pipes = dataRow!.match(/\|/g);
  assert.ok(pipes && pipes.length >= 4, "should have at least 4 pipes for 3 columns");
});
