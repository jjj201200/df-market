// Custom Prism theme type matching react-syntax-highlighter's expected shape
interface PrismThemeStyle {
  types: string[];
  style: {
    color?: string;
    fontStyle?: string;
    fontWeight?: string;
    opacity?: number;
  };
}

interface PrismTheme {
  plain: {
    color: string;
    backgroundColor: string;
  };
  styles: PrismThemeStyle[];
}

/**
 * Claude Code Dark Mode (ANSI colors only) syntax highlighting theme.
 * Colors are sourced from the project's palette.scss to stay consistent.
 */
export const ansiDarkTheme: PrismTheme = {
  plain: {
    color: '#c9d1d9', // --gray-12
    backgroundColor: '#0d1117', // --gray-1
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#6e7681', // --gray-9
        fontStyle: 'italic',
      },
    },
    {
      types: ['punctuation'],
      style: {
        color: '#b1bac4', // --gray-11
      },
    },
    {
      types: ['namespace'],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: {
        color: '#7ee787', // --green-11
      },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: {
        color: '#a5d6ff', // --blue-12
      },
    },
    {
      types: ['operator', 'entity', 'url', 'variable'],
      style: {
        color: '#ffaa5c', // --orange-11
      },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: {
        color: '#ff7b72', // --red-10
      },
    },
    {
      types: ['function', 'class-name'],
      style: {
        color: '#d2a8ff', // --purple-10
      },
    },
    {
      types: ['regex', 'important'],
      style: {
        color: '#f0c75e', // --amber-11
      },
    },
    {
      types: ['parameter', 'interpolation'],
      style: {
        color: '#79c0ff', // --blue-11
      },
    },
    {
      types: ['literal-property'],
      style: {
        color: '#56d364', // --green-8
      },
    },
  ],
};
