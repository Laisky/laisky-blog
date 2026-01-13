'use strict';

import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * CodeBlock component for syntax highlighting with copy-to-clipboard functionality.
 *
 * @param {Object} props - Component props
 * @param {string} props.language - Programming language
 * @param {string} props.value - Code content
 * @returns {React.ReactElement} The code block component
 */
export const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for non-secure contexts (like http://IP)
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) {
          throw new Error('Fallback copy failed');
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
        <button className="code-block-copy" onClick={handleCopy} title="Copy to clipboard">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers={true}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: '#858585',
          textAlign: 'right',
          userSelect: 'none',
          opacity: 0.5,
        }}
        customStyle={{
          margin: 0,
          padding: '1.25rem',
          fontSize: '0.75rem',
          lineHeight: '1.6',
          backgroundColor: 'transparent',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'var(--code-font)',
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};
