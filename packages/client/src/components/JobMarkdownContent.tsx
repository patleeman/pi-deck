import { memo, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check } from 'lucide-react';
import type { JobTask } from '@pi-web-ui/shared';

interface JobMarkdownContentProps {
  content: string;
  tasks: JobTask[];
  onToggleTask: (task: JobTask) => void;
  className?: string;
}

// Custom dark theme matching design
const codeTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#161b22',
    margin: 0,
    padding: '12px',
    borderRadius: '4px',
    fontSize: '13px',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: '13px',
  },
};

/**
 * Strip YAML frontmatter from markdown content for rendering.
 */
function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) return content;
  // Skip the closing '---' and any blank line after it
  let bodyStart = endIndex + 4;
  while (bodyStart < content.length && content[bodyStart] === '\n') {
    bodyStart++;
  }
  return content.slice(bodyStart);
}

export const JobMarkdownContent = memo(function JobMarkdownContent({
  content,
  tasks,
  onToggleTask,
  className = '',
}: JobMarkdownContentProps) {
  // Track which source line we're on. We use a line counter that maps
  // rendered list items back to their source lines by matching text.
  const tasksByText = useMemo(() => {
    const map = new Map<string, JobTask[]>();
    for (const task of tasks) {
      const existing = map.get(task.text) || [];
      existing.push(task);
      map.set(task.text, existing);
    }
    return map;
  }, [tasks]);

  // Track consumed tasks to handle duplicate text
  const consumedTasks = useMemo(() => new Set<number>(), [tasks]);

  const findTaskForText = useCallback((text: string): JobTask | null => {
    const candidates = tasksByText.get(text);
    if (!candidates) return null;
    for (const task of candidates) {
      if (!consumedTasks.has(task.line)) {
        consumedTasks.add(task.line);
        return task;
      }
    }
    return null;
  }, [tasksByText, consumedTasks]);

  const strippedContent = useMemo(() => stripFrontmatter(content), [content]);

  const components = useMemo(() => ({
    pre({ children, ...props }: any) {
      return <div className="my-2" {...props}>{children}</div>;
    },

    code({ node, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');
      const isBlock = language || codeString.includes('\n');

      if (isBlock) {
        if (language) {
          return (
            <SyntaxHighlighter
              style={codeTheme as any}
              language={language}
              PreTag="div"
              {...props}
            >
              {codeString}
            </SyntaxHighlighter>
          );
        }
        return (
          <pre className="bg-[#161b22] p-3 rounded overflow-x-auto text-[13px]">
            <code className="text-pi-text">{children}</code>
          </pre>
        );
      }

      return (
        <code
          className="bg-[#161b22] px-1.5 py-0.5 rounded text-[13px] text-pi-text"
          {...props}
        >
          {children}
        </code>
      );
    },

    a({ href, children, ...props }: any) {
      const external = href && /^(https?:|mailto:|tel:)/i.test(href);
      return (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className="text-pi-accent hover:underline"
          {...props}
        >
          {children}
        </a>
      );
    },

    p({ children, ...props }: any) {
      return <p className="mb-2 last:mb-0" {...props}>{children}</p>;
    },

    h1({ children, ...props }: any) {
      return <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-pi-text" {...props}>{children}</h1>;
    },
    h2({ children, ...props }: any) {
      return <h2 className="text-base font-semibold mb-2 mt-4 first:mt-0 text-pi-text border-b border-pi-border/30 pb-1" {...props}>{children}</h2>;
    },
    h3({ children, ...props }: any) {
      return <h3 className="text-[14px] font-semibold mb-1 mt-3 first:mt-0 text-pi-text" {...props}>{children}</h3>;
    },
    h4({ children, ...props }: any) {
      return <h4 className="text-[13px] font-semibold mb-1 mt-2 first:mt-0 text-pi-muted" {...props}>{children}</h4>;
    },

    ul({ children, ...props }: any) {
      return <ul className="pl-1 mb-2 space-y-0.5" {...props}>{children}</ul>;
    },
    ol({ children, ...props }: any) {
      return <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props}>{children}</ol>;
    },

    // The key component — list items that may be checkboxes
    li({ children, node, ...props }: any) {
      // react-markdown with remarkGfm parses `- [x]` / `- [ ]` as task list items
      // The node has a `checked` property for task list items
      const checked = node?.properties?.checked;
      const isTaskItem = checked === true || checked === false;

      if (isTaskItem) {
        // Extract the text content to match against our task list
        const textContent = extractText(children);
        const task = findTaskForText(textContent);

        return (
          <li className="list-none flex items-start gap-2 py-0.5" {...props}>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (task) onToggleTask(task);
              }}
              className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                checked
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'border-pi-border hover:border-pi-accent'
              }`}
            >
              {checked && <Check className="w-3 h-3" />}
            </button>
            <span className={`text-[13px] sm:text-[12px] flex-1 ${
              checked ? 'text-pi-muted line-through' : 'text-pi-text'
            }`}>
              {/* Render children but skip the default checkbox input */}
              {filterCheckboxInput(children)}
            </span>
          </li>
        );
      }

      // Regular list item
      return (
        <li className="text-pi-text pl-1 list-disc ml-4" {...props}>
          {children}
        </li>
      );
    },

    blockquote({ children, ...props }: any) {
      return (
        <blockquote
          className="border-l-2 border-pi-border pl-3 my-2 text-pi-muted italic"
          {...props}
        >
          {children}
        </blockquote>
      );
    },

    hr({ ...props }: any) {
      return <hr className="border-pi-border my-3" {...props} />;
    },

    table({ children, ...props }: any) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full border-collapse text-[13px]" {...props}>
            {children}
          </table>
        </div>
      );
    },
    th({ children, ...props }: any) {
      return (
        <th className="border border-pi-border px-3 py-1.5 bg-pi-surface text-left font-semibold" {...props}>
          {children}
        </th>
      );
    },
    td({ children, ...props }: any) {
      return (
        <td className="border border-pi-border px-3 py-1.5" {...props}>
          {children}
        </td>
      );
    },

    // Override the default input to hide it (we render our own checkbox)
    input({ ...props }: any) {
      // Don't render default checkbox inputs — we handle them in the li component
      if (props.type === 'checkbox') return null;
      return <input {...props} />;
    },
  }), [findTaskForText, onToggleTask]);

  return (
    <div className={`job-markdown-content text-pi-text text-[14px] sm:text-[13px] leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {strippedContent}
      </ReactMarkdown>
    </div>
  );
});

/**
 * Extract plain text from React children (for matching against task text).
 */
function extractText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map(extractText).join('');
  }
  if (children?.props?.children) {
    return extractText(children.props.children);
  }
  return '';
}

/**
 * Filter out the default checkbox <input> element from children.
 * react-markdown renders `- [x] text` as <li><input type="checkbox" checked /> text</li>
 * We want to keep the text but use our own checkbox button.
 */
function filterCheckboxInput(children: any): any {
  if (!Array.isArray(children)) return children;
  return children.filter((child: any) => {
    if (child?.type === 'input' && child?.props?.type === 'checkbox') return false;
    return true;
  });
}
