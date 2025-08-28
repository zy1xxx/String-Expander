# String Expander

**Expand Newlines** 是一个 VS Code 扩展，可以快速将选中文本中的 `\n` 转换为实际换行，并在临时文件中显示结果。适合快速查看json文件中的字符串内容。

---

## 功能

- 将选中的字符串中的 `\n` 展开为换行
- 支持临时文件保存，自动复用已打开的文件
- 可以通过快捷键`ctrl+alt+e`或编辑器右键菜单执行
- 临时文件路径为`/tmp/expanded_string_${username}.txt`

---

## 安装

从 [Visual Studio Marketplace](https://marketplace.visualstudio.com/) 安装  
   或者手动安装 `.vsix` 文件：
   ```bash
   code --install-extension string-expander-0.0.1.vsix
   ```
 
## 示例

选中文本：

```
Hello\nWorld\nVS Code
```

执行命令后，临时文件内容：

```
Hello
World
VS Code
```