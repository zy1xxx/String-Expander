import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const username = os.userInfo().username;
const docPath = path.join("/tmp", `expanded_string_${username}.txt`);

// 尝试多次解析 JSON：支持被多层字符串化的 JSON（例如选中的是一个字符串字面量）
function tryParsePossiblyNestedJson(input: string): any | undefined {
  let cur = input.trim();
  // try up to a few attempts: 1) raw parse, 2) strip surrounding quotes and parse, 3) repeat if result is string
  try {
    let parsed = JSON.parse(cur);
    // 如果解析结果仍是字符串（可能是 "\"{...}\"" 这种），尝试再解析内部字符串若其看起来像 JSON
    for (let i = 0; i < 5 && typeof parsed === "string"; i++) {
      const maybe = parsed.trim();
      if ((maybe.startsWith("{") && maybe.endsWith("}")) || (maybe.startsWith("[") && maybe.endsWith("]")) || maybe.startsWith('"') || maybe.startsWith("'")) {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          break;
        }
      } else {
        break;
      }
    }
    return parsed;
  } catch {
    // 若最外层被单引号包起来（JS 风格），把外层单引号换成双引号再试
    if ((cur.startsWith("'") && cur.endsWith("'")) || (cur.startsWith("`") && cur.endsWith("`"))) {
      try {
        const attempt = '"' + cur.slice(1, -1).replace(/"/g, '\\"') + '"';
        return tryParsePossiblyNestedJson(attempt);
      } catch {
        return undefined;
      }
    }
    // 若最外层是被双引号包住的字符串（例如 "\"{...}\""），尝试去掉一层引号再试
    if (cur.startsWith('"') && cur.endsWith('"')) {
      const stripped = cur.slice(1, -1);
      // 递归尝试（避免无限循环）
      return tryParsePossiblyNestedJson(stripped);
    }
    return undefined;
  }
}

// 将对象/数组以“可读形式”打印，保留字符串内的真实换行（便于查看）
function formatExpanded(obj: any, indentStr = "  "): string {
  function repeat(n: number) {
    return " ".repeat(n);
  }

  function format(value: any, depth: number): string {
    const base = repeat(depth * indentStr.length);
    const childBase = repeat((depth + 1) * indentStr.length);

    if (typeof value === "string") {
      // 把字符串中的双引号转义（避免断裂），但保留真实换行
      const parts = value.split("\n");
      if (parts.length === 1) {
        return `"${value.replace(/"/g, '\\"')}"`;
      } else {
        // 多行字符串：首行与后续每行都按缩进对齐
        let out = '"';
        out += parts[0] + "\n";
        for (let i = 1; i < parts.length; i++) {
          out += childBase + parts[i] + (i < parts.length - 1 ? "\n" : "");
        }
        out += '"';
        return out;
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      let arrOut = "[\n";
      for (let i = 0; i < value.length; i++) {
        arrOut += childBase + format(value[i], depth + 1) + (i < value.length - 1 ? ",\n" : "\n");
      }
      arrOut += base + "]";
      return arrOut;
    } else if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value);
      if (entries.length === 0) return "{}";
      let objOut = "{\n";
      for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
        objOut += childBase + JSON.stringify(k) + ": " + format(v, depth + 1) + (i < entries.length - 1 ? ",\n" : "\n");
      }
      objOut += base + "}";
      return objOut;
    } else {
      return JSON.stringify(value);
    }
  }

  return format(obj, 0);
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("stringExpander.expandNewlines", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const selection = editor.selection;
    const raw = editor.document.getText(selection);

    if (!raw) {
      vscode.window.showWarningMessage("请先选中一段字符串！");
      return;
    }

    // 先尝试把选中内容按 JSON 解析（支持嵌套字符串化）
    const parsed = tryParsePossiblyNestedJson(raw);

    let output: string;
    if (parsed !== undefined) {
      if (typeof parsed === "string") {
        // 已经解析出一个字符串 → 展开字符串内的转义序列（\\n、\\t 等）
        output = parsed.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      } else {
        // 解析出对象/数组 → 使用自定义打印器以保留字符串中的真实换行（更可读）
        // 先把对象中的被转义的 \"\\n\" 等转换为真实换行（有时 JSON 内字段仍含 \\n）
        // 为此，递归将字符串里的 \\n -> \n, \\t -> \t（但不改变原始非字符串值）
        function normalizeStrings(obj: any): any {
          if (typeof obj === "string") {
            return obj.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
          } else if (Array.isArray(obj)) {
            return obj.map(normalizeStrings);
          } else if (typeof obj === "object" && obj !== null) {
            const o: any = {};
            for (const [k, v] of Object.entries(obj)) {
              o[k] = normalizeStrings(v);
            }
            return o;
          }
          return obj;
        }
        const normalized = normalizeStrings(parsed);
        output = formatExpanded(normalized);
      }
    } else {
      // 不是 JSON → 直接替换文本中的 \n \t 等（两字符形式）
      output = raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    }

    // 写入临时文件并打开（或聚焦）
    fs.writeFileSync(docPath, output, "utf8");

    let existingEditor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === docPath);

    if (existingEditor) {
      const doc = existingEditor.document;
      await vscode.window.showTextDocument(doc, existingEditor.viewColumn, false);
    } else {
      const doc = await vscode.workspace.openTextDocument(docPath);
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, true);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
