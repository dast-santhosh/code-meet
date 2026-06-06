import React, { useRef, useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import useAppStore from '../store';

export default function CodeEditor({ yText, readOnly = false, value = "", onChange = null, showLineNumbers = true }) {
  const editorRef = useRef(null);
  const bindingRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const { editorTheme, editorFontSize, editorFontFamily } = useAppStore();

  // Handle editor mounting
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define custom Violet Theme
    monaco.editor.defineTheme('violet', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'c084fc', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'd946ef', fontStyle: 'bold' },
        { token: 'string', foreground: '22d3ee' },
        { token: 'number', foreground: 'fb7185' },
        { token: 'identifier', foreground: 'fae8ff' },
      ],
      colors: {
        'editor.background': '#120324',
        'editor.foreground': '#fae8ff',
        'editor.lineHighlightBackground': '#2a1152',
        'editorCursor.foreground': '#d946ef',
        'editorLineNumber.foreground': '#a855f7',
        'editorLineNumber.activeForeground': '#d946ef',
        'editor.selectionBackground': '#d946ef33',
      }
    });

    setIsMounted(true);
  };

  // Manage collaborative Monaco-Yjs binding reactively
  useEffect(() => {
    if (!editorRef.current || !isMounted) return;

    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    if (!readOnly && yText) {
      const model = editorRef.current.getModel();
      bindingRef.current = new MonacoBinding(
        yText,
        model,
        new Set([editorRef.current])
      );
    }
  }, [yText, readOnly, isMounted]);

  // Perform Live Syntax Linting on Keystroke (without compilation)
  const handleEditorChange = (code, event) => {
    if (onChange) onChange(code);
    
    if (editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      
      // We only run the linter if it's the main editor in write mode
      if (!readOnly && model) {
        const markers = [];
        const lines = code.split('\n');
        
        let openParentheses = 0;
        let openBrackets = 0;
        let openBraces = 0;
        let indentExpected = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;
          const trimmed = line.trim();

          // 1. Check for missing indentation after colon (headers like def, if, else, for, while)
          if (indentExpected) {
            const currentIndent = line.length - line.trimStart().length;
            if (trimmed.length > 0 && currentIndent === 0) {
              markers.push({
                startLineNumber: lineNum,
                startColumn: 1,
                endLineNumber: lineNum,
                endColumn: line.length + 1,
                message: "IndentationError: expected an indented block after colons (':')",
                severity: 8, // Error severity in Monaco (8 = Error, 4 = Warning)
                source: "Python Linter"
              });
            }
            indentExpected = false;
          }

          if (trimmed.endsWith(':')) {
            indentExpected = true;
          }

          // 2. Scan parenthesis/bracket matching
          for (let char of line) {
            if (char === '(') openParentheses++;
            else if (char === ')') openParentheses--;
            else if (char === '[') openBrackets++;
            else if (char === ']') openBrackets--;
            else if (char === '{') openBraces++;
            else if (char === '}') openBraces--;
          }

          if (openParentheses < 0) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "SyntaxError: unmatched ')'",
              severity: 8,
              source: "Python Linter"
            });
            openParentheses = 0;
          }
          if (openBrackets < 0) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "SyntaxError: unmatched ']'",
              severity: 8,
              source: "Python Linter"
            });
            openBrackets = 0;
          }
          if (openBraces < 0) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "SyntaxError: unmatched '}'",
              severity: 8,
              source: "Python Linter"
            });
            openBraces = 0;
          }

          // 3. Flags JavaScript leaks (common beginner mistakes in python)
          if (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "SyntaxError: JavaScript variables (const, let, var) are not valid in Python",
              severity: 8,
              source: "Python Linter"
            });
          }
          if (trimmed.startsWith('function ')) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "SyntaxError: Use 'def' keyword to define functions in Python instead of 'function'",
              severity: 8,
              source: "Python Linter"
            });
          }
          if (trimmed.includes('console.log(')) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "SyntaxError: Use 'print()' to print statements in Python instead of 'console.log()'",
              severity: 8,
              source: "Python Linter"
            });
          }
          if (trimmed.includes(' true') || trimmed.includes('=true') || trimmed.includes(' false') || trimmed.includes('=false')) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "Warning: Booleans must start with capital letters in Python (True / False)",
              severity: 4, // Warning
              source: "Python Linter"
            });
          }
          if (trimmed.includes('null')) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
              message: "Warning: Use 'None' in Python instead of 'null'",
              severity: 4,
              source: "Python Linter"
            });
          }
        }

        // Apply markers to highlight lines red
        window.monaco?.editor.setModelMarkers(model, "python-syntax-linter", markers);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }
    };
  }, []);

  // Determine Monaco Theme string based on selected app preference
  const getMonacoTheme = () => {
    if (editorTheme === 'violet') return 'violet';
    if (editorTheme === 'hc-black') return 'hc-black';
    if (editorTheme === 'light') return 'light';
    return 'vs-dark';
  };

  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl border border-white/5 bg-slate-950/20">
      <MonacoEditor
        language="python"
        theme={getMonacoTheme()}
        value={(!yText || readOnly) ? value : undefined}
        options={{
          fontSize: editorFontSize,
          fontFamily: editorFontFamily,
          readOnly: readOnly,
          minimap: { enabled: false },
          automaticLayout: true,
          fontLigatures: true,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          lineNumbers: showLineNumbers ? "on" : "off"
        }}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
      />
    </div>
  );
}
