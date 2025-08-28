import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// 根据当前用户名生成临时文件路径
const username = os.userInfo().username;
let docPath = path.join("/tmp", `expanded_string_${username}.txt`);

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "stringExpander.expandNewlines",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selection = editor.selection;
      let text = editor.document.getText(selection);

      if (!text) {
        vscode.window.showWarningMessage("请先选中一段字符串！");
        return;
      }

      const expanded = text.replace(/\\n/g, "\n");

      // 写入 /tmp/expanded_string_用户名.txt
      fs.writeFileSync(docPath, expanded, "utf8");

      // 检查文件是否已经被打开
      let existingEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.fsPath === docPath
      );

      if (existingEditor) {
        // 已经打开 → 聚焦
        const doc = existingEditor.document;
        await vscode.window.showTextDocument(doc, existingEditor.viewColumn, false);
      } else {
        // 文件未打开 → 打开新编辑器
        const doc = await vscode.workspace.openTextDocument(docPath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, true);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
