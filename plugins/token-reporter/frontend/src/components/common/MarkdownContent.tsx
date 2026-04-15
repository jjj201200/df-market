import React from 'react';
import ReactMarkdown from 'react-markdown';
import type {Components} from 'react-markdown';
import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import type {SyntaxHighlighterProps} from 'react-syntax-highlighter';
import {ansiDarkTheme} from '../../styles/syntax-theme';
import '../../styles/markdown.scss';

interface MarkdownContentProps {
  children: string;
  className?: string;
}

// Box / Text inspired by Ink's component model
const Box: React.FC<{className?: string; children: React.ReactNode}> = ({className, children}) => (
  <div className={className}>{children}</div>
);

const Text: React.FC<{className?: string; children: React.ReactNode}> = ({className, children}) => (
  <span className={className}>{children}</span>
);

export const MarkdownContent: React.FC<MarkdownContentProps> = ({children, className}) => {
  const components: Components = {
    // Block containers
    div: ({children}) => <Box>{children}</Box>,
    p: ({children}) => <Text className="md-p">{children}</Text>,

    // Code blocks
    pre: ({children}) => <Box className="md-pre">{children}</Box>,
    code: ({className, children}) => {
      const match = /language-(\w+)/.exec(String(className || ''));
      const code = String(children).replace(/\n$/, '');
      if (match) {
        return (
          <SyntaxHighlighter
            style={ansiDarkTheme as unknown as SyntaxHighlighterProps['style']}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '10px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              lineHeight: '1.5',
              background: '#0d1117',
            }}
          >
            {code}
          </SyntaxHighlighter>
        );
      }
      return <code className="md-inline-code">{code}</code>;
    },

    // Tables
    table: ({children}) => <table className="md-table">{children}</table>,
    thead: ({children}) => <thead>{children}</thead>,
    tbody: ({children}) => <tbody>{children}</tbody>,
    tr: ({children}) => <tr>{children}</tr>,
    th: ({children}) => <th>{children}</th>,
    td: ({children}) => <td>{children}</td>,

    // Lists
    ul: ({children}) => <ul className="md-ul">{children}</ul>,
    ol: ({children}) => <ol className="md-ol">{children}</ol>,
    li: ({children}) => <li>{children}</li>,

    // Inline
    strong: ({children}) => <strong>{children}</strong>,
    em: ({children}) => <em>{children}</em>,
    a: ({children, href}) => (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),

    // Blockquote
    blockquote: ({children}) => <blockquote>{children}</blockquote>,

    // Headings
    h1: ({children}) => <h1>{children}</h1>,
    h2: ({children}) => <h2>{children}</h2>,
    h3: ({children}) => <h3>{children}</h3>,
    h4: ({children}) => <h4>{children}</h4>,
    h5: ({children}) => <h5>{children}</h5>,
    h6: ({children}) => <h6>{children}</h6>,

    // Horizontal rule
    hr: () => <hr />,
  };

  return (
    <div className={`md-content ${className ?? ''}`}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
};
