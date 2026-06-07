import React from 'react';
import { Copy, Check } from 'lucide-react';

// Render a LaTeX equation dynamically using window.katex if available
function MathNode({ formula, displayMode = false }) {
  if (window.katex) {
    try {
      const html = window.katex.renderToString(formula, {
        displayMode,
        throwOnError: false,
        trust: true
      });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error("KaTeX error:", err);
      return <code className="text-rose-400 font-mono">{formula}</code>;
    }
  }
  // Fallback to stylized plain text if CDN is slow/offline
  return (
    <span className={`font-mono text-slate-300 italic px-1 bg-white/5 rounded ${displayMode ? 'block text-center my-2 py-1' : 'inline'}`}>
      {formula}
    </span>
  );
}

// Simple copy code utility
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/5 bg-slate-950/60 font-mono text-[11px] text-slate-300 select-text">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-white/5 text-[9px] font-bold text-slate-500 select-none">
        <span>{lang ? lang.toUpperCase() : 'CODE'}</span>
        <button onClick={handleCopy} className="hover:text-white transition flex items-center gap-1 cursor-pointer">
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto select-text leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Parse inline formatting: bold, inline code, and inline LaTeX
function parseInline(text) {
  if (!text) return "";

  // Split by inline math ($...$), inline code (`...`), and bold (**...**)
  // Using a regex capture group to keep the delimiters for tokenizing
  const regex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|`[^`]+`|\*\*[^*]+?\*\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const formula = part.slice(2, -2);
      return <MathNode key={index} formula={formula} displayMode={true} />;
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const formula = part.slice(1, -1);
      return <MathNode key={index} formula={formula} displayMode={false} />;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[11px] text-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-extrabold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  // Pre-process LaTeX equations that might be formatted with escaped parentheses or brackets
  // e.g., \[ formula \] or \( formula \)
  let processed = content
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$') // Replace \[ ... \] with $$ ... $$
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$1$');     // Replace \( ... \) with $ ... $

  // Split content into blocks by double newlines or blocks of markdown code/equations
  const blocks = [];
  const lines = processed.split('\n');
  let currentBlockType = 'paragraph'; // 'paragraph', 'code', 'math'
  let accumulator = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block detection
    if (line.trim().startsWith('```')) {
      if (currentBlockType === 'code') {
        // End of code block
        blocks.push({ type: 'code', content: accumulator.join('\n'), lang: codeLang });
        accumulator = [];
        currentBlockType = 'paragraph';
      } else {
        // Start of code block
        if (accumulator.length > 0) {
          blocks.push({ type: 'paragraph', content: accumulator.join('\n') });
          accumulator = [];
        }
        currentBlockType = 'code';
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    // Math block detection
    if (line.trim().startsWith('$$') && line.trim().endsWith('$$') && line.trim().length > 2) {
      if (accumulator.length > 0) {
        blocks.push({ type: 'paragraph', content: accumulator.join('\n') });
        accumulator = [];
      }
      blocks.push({ type: 'math', content: line.trim().slice(2, -2) });
      continue;
    }

    if (currentBlockType === 'code') {
      accumulator.push(line);
    } else {
      if (line.trim() === '') {
        if (accumulator.length > 0) {
          blocks.push({ type: 'paragraph', content: accumulator.join('\n') });
          accumulator = [];
        }
      } else {
        accumulator.push(line);
      }
    }
  }

  // Push final block
  if (accumulator.length > 0) {
    blocks.push({
      type: currentBlockType,
      content: accumulator.join('\n'),
      lang: codeLang
    });
  }

  return (
    <div className="space-y-2 select-text leading-relaxed break-words">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return <CodeBlock key={idx} code={block.content} lang={block.lang} />;
        }

        if (block.type === 'math') {
          return (
            <div key={idx} className="my-3 flex justify-center text-center overflow-x-auto p-2 bg-white/5 border border-white/5 rounded-2xl">
              <MathNode formula={block.content} displayMode={true} />
            </div>
          );
        }

        // Paragraph, lists or headings
        const contentStr = block.content;

        if (contentStr.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs font-black font-orbitron text-slate-100 uppercase tracking-wide mt-3 mb-1 border-l-2 border-emerald-500 pl-2">
              {parseInline(contentStr.slice(4))}
            </h4>
          );
        }
        if (contentStr.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-sm font-black font-orbitron text-slate-100 uppercase tracking-wider mt-4 mb-1 border-l-2 border-emerald-500 pl-2">
              {parseInline(contentStr.slice(3))}
            </h3>
          );
        }
        if (contentStr.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-base font-black font-orbitron text-slate-100 uppercase tracking-widest mt-5 mb-2 border-l-4 border-emerald-500 pl-3">
              {parseInline(contentStr.slice(2))}
            </h2>
          );
        }

        // List detection
        if (contentStr.startsWith('- ') || contentStr.startsWith('* ')) {
          const listLines = contentStr.split('\n');
          return (
            <ul key={idx} className="list-disc pl-4 space-y-1 my-2 text-slate-300">
              {listLines.map((li, lidx) => (
                <li key={lidx} className="leading-relaxed">
                  {parseInline(li.startsWith('- ') || li.startsWith('* ') ? li.slice(2) : li)}
                </li>
              ))}
            </ul>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-slate-300 select-text">
            {parseInline(contentStr)}
          </p>
        );
      })}
    </div>
  );
}
