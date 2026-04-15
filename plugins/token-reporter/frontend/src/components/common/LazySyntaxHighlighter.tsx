import React from 'react';
import {PrismLight} from 'react-syntax-highlighter';
import type {SyntaxHighlighterProps} from 'react-syntax-highlighter';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import xml from 'react-syntax-highlighter/dist/esm/languages/prism/xml-doc';
import {ansiDarkTheme} from '../../styles/syntax-theme';

PrismLight.registerLanguage('tsx', tsx);
PrismLight.registerLanguage('typescript', typescript);
PrismLight.registerLanguage('ts', typescript);
PrismLight.registerLanguage('javascript', javascript);
PrismLight.registerLanguage('js', javascript);
PrismLight.registerLanguage('json', json);
PrismLight.registerLanguage('bash', bash);
PrismLight.registerLanguage('shell', bash);
PrismLight.registerLanguage('zsh', bash);
PrismLight.registerLanguage('python', python);
PrismLight.registerLanguage('py', python);
PrismLight.registerLanguage('rust', rust);
PrismLight.registerLanguage('rs', rust);
PrismLight.registerLanguage('go', go);
PrismLight.registerLanguage('java', java);
PrismLight.registerLanguage('css', css);
PrismLight.registerLanguage('scss', scss);
PrismLight.registerLanguage('yaml', yaml);
PrismLight.registerLanguage('yml', yaml);
PrismLight.registerLanguage('markdown', markdown);
PrismLight.registerLanguage('md', markdown);
PrismLight.registerLanguage('sql', sql);
PrismLight.registerLanguage('xml', xml);
PrismLight.registerLanguage('html', xml);

interface Props {
  language: string;
  code: string;
}

export const LazySyntaxHighlighter: React.FC<Props> = ({language, code}) => (
  <PrismLight
    style={ansiDarkTheme as unknown as SyntaxHighlighterProps['style']}
    language={language}
    PreTag="div"
    customStyle={{
      margin: 0,
      padding: '10px 12px',
      borderRadius: '4px',
      fontSize: '11px',
      lineHeight: '1.5',
      background: 'var(--bg-inset)',
    }}
  >
    {code}
  </PrismLight>
);
