"use client";

import React from "react";
import MarkdownToJsx from "markdown-to-jsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const detectLang = require("lang-detector") as (text: string) => string;

interface MarkdownProps {
  content: string;
  isThinking?: boolean;
}

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Inline code component (for single backticks)
const InlineCode = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  return (
    <code
      className="!px-1.5 !py-0.5 !text-sm !font-mono !bg-purple-100 dark:!bg-purple-900/30 !text-purple-800 dark:!text-purple-200 !rounded !border !border-purple-200 dark:!border-purple-700 !not-prose"
      style={{
        backgroundColor: "rgb(243 232 255)", // Force purple-100 as fallback
        color: "rgb(107 33 168)", // Force purple-800 as fallback
        padding: "2px 6px",
        borderRadius: "4px",
        border: "1px solid rgb(196 181 253)", // Force purple-200 as fallback
      }}
      {...props}
    >
      {children}
    </code>
  );
};

// Helper function to extract text content from React nodes
const extractTextContent = (node: React.ReactNode): string => {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractTextContent(props.children);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join("");
  }
  return "";
};

// Code block component (for triple backticks) - with language detection
const CodeBlock = ({ children, className, ...props }: CodeBlockProps) => {
  const [copied, setCopied] = React.useState(false);

  // Extract the actual code content from children
  let codeContent = children;
  let codeClassName = className;

  // If children is a React element (code element), extract its props
  if (React.isValidElement(children) && children.type === "code") {
    const codeProps = children.props as {
      children?: React.ReactNode;
      className?: string;
    };
    codeContent = codeProps.children;
    codeClassName = codeProps.className || className;
  }

  // Ensure codeContent is a string by extracting text content
  const codeString = extractTextContent(codeContent);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract language from className or auto-detect
  let language = "text";

  if (codeClassName) {
    const match = codeClassName.match(/language-(\w+)/);
    if (match) {
      language = match[1];
    }
  }

  // If no language specified, try to auto-detect (only for code blocks)
  if (language === "text" && codeString.trim()) {
    try {
      const detected = detectLang(codeString);
      if (detected && detected !== "Unknown") {
        // Map detected languages to Prism language names
        const languageMap: { [key: string]: string } = {
          JavaScript: "javascript",
          C: "c",
          "C++": "cpp",
          Python: "python",
          Java: "java",
          HTML: "html",
          CSS: "css",
          Ruby: "ruby",
          Go: "go",
          PHP: "php",
        };
        language = languageMap[detected] || detected.toLowerCase();
      }
    } catch (error) {
      // If detection fails, keep default 'text'
      console.warn("Language detection failed:", error);
    }
  }

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 px-4 py-2 text-sm">
        <span className="text-gray-300 dark:text-gray-400 font-mono">
          {language}
        </span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 text-gray-400 hover:text-white dark:text-gray-500 dark:hover:text-gray-200 transition-colors"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 8px 8px",
          background: "#1e1e1e",
          fontSize: "14px",
          fontFamily: 'Consolas, "Courier New", monospace',
          lineHeight: "1.5",
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
};

export function Markdown({
  content,
  isThinking = false,
}: Readonly<MarkdownProps>) {
  // Base classes for thinking content - make everything fainter
  const thinkingClasses = isThinking
    ? "opacity-70 text-gray-600 dark:text-gray-400"
    : "";

  return (
    <div
      className={`prose prose-gray dark:prose-invert max-w-none prose-code:!bg-transparent prose-code:!text-inherit prose-code:!p-0 prose-code:!rounded-none prose-code:!border-0 dark:prose-headings:text-purple-100 dark:prose-p:text-purple-100 dark:prose-li:text-purple-100 dark:prose-strong:text-purple-100 dark:prose-em:text-purple-100 ${thinkingClasses}`}
    >
      <MarkdownToJsx
        options={{
          overrides: {
            // Handle custom <think> tags by rendering them as spans with thinking styling
            think: {
              component: ({
                children,
                ...props
              }: {
                children?: React.ReactNode;
                [key: string]: unknown;
              }) => (
                <span
                  className="inline-block px-2 py-0.5 mx-1 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-400 font-mono italic opacity-60 whitespace-nowrap"
                  title="Model's thinking process"
                  {...props}
                >
                  💭 {children}
                </span>
              ),
            },

            // Inline code (single backticks) - simple styling, no language detection
            code: {
              component: InlineCode,
            },

            // Code blocks (triple backticks) - full syntax highlighting with language detection
            pre: {
              component: ({ children }: { children: React.ReactNode }) => {
                // Extract the code element from pre and apply CodeBlock styling
                return <CodeBlock>{children}</CodeBlock>;
              },
            },

            // Typography - adjust for thinking content
            p: {
              props: {
                className: isThinking
                  ? "mb-4 leading-7 text-gray-600 dark:text-gray-400"
                  : "mb-4 leading-7 text-purple-950 dark:text-purple-100",
              },
            },

            // Headings - adjust for thinking content
            h1: {
              props: {
                className: isThinking
                  ? "text-3xl font-bold tracking-tight text-gray-600 dark:text-gray-400 mt-8 mb-4 first:mt-0 border-b border-gray-200 dark:border-gray-700 pb-2"
                  : "text-3xl font-bold tracking-tight text-purple-950 dark:text-purple-100 mt-8 mb-4 first:mt-0 border-b border-gray-200 dark:border-gray-700 pb-2",
              },
            },
            h2: {
              props: {
                className: isThinking
                  ? "text-2xl font-semibold tracking-tight text-gray-600 dark:text-gray-400 mt-8 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2"
                  : "text-2xl font-semibold tracking-tight text-purple-950 dark:text-purple-100 mt-8 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2",
              },
            },
            h3: {
              props: {
                className: isThinking
                  ? "text-xl font-semibold tracking-tight text-gray-600 dark:text-gray-400 mt-6 mb-3"
                  : "text-xl font-semibold tracking-tight text-purple-950 dark:text-purple-100 mt-6 mb-3",
              },
            },
            h4: {
              props: {
                className: isThinking
                  ? "text-lg font-semibold tracking-tight text-gray-600 dark:text-gray-400 mt-6 mb-3"
                  : "text-lg font-semibold tracking-tight text-purple-950 dark:text-purple-100 mt-6 mb-3",
              },
            },
            h5: {
              props: {
                className: isThinking
                  ? "text-base font-semibold tracking-tight text-gray-600 dark:text-gray-400 mt-4 mb-2"
                  : "text-base font-semibold tracking-tight text-purple-950 dark:text-purple-100 mt-4 mb-2",
              },
            },
            h6: {
              props: {
                className: isThinking
                  ? "text-sm font-semibold tracking-tight text-gray-600 dark:text-gray-400 mt-4 mb-2"
                  : "text-sm font-semibold tracking-tight text-purple-950 dark:text-purple-100 mt-4 mb-2",
              },
            },

            // Lists - adjust for thinking content
            ul: {
              props: {
                className: isThinking
                  ? "mb-4 pl-6 space-y-2 list-disc marker:text-gray-400 dark:marker:text-gray-500"
                  : "mb-4 pl-6 space-y-2 list-disc marker:text-purple-400 dark:marker:text-purple-500",
              },
            },
            ol: {
              props: {
                className: isThinking
                  ? "mb-4 pl-6 space-y-2 list-decimal marker:text-gray-400 dark:marker:text-gray-500"
                  : "mb-4 pl-6 space-y-2 list-decimal marker:text-purple-400 dark:marker:text-purple-500",
              },
            },
            li: {
              props: {
                className: isThinking
                  ? "leading-7 text-gray-600 dark:text-gray-400"
                  : "leading-7 text-purple-950 dark:text-purple-100",
              },
            },

            // Blockquotes - adjust for thinking content
            blockquote: {
              props: {
                className: isThinking
                  ? "border-l-4 border-gray-400 dark:border-gray-500 pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800/30 italic text-gray-600 dark:text-gray-400"
                  : "border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-950/30 italic text-purple-900 dark:text-purple-200",
              },
            },

            // Links
            a: {
              props: {
                className:
                  "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline underline-offset-2 transition-colors",
              },
            },

            // Tables
            table: {
              props: {
                className:
                  "w-full border-collapse border border-gray-200 dark:border-gray-700 my-4 rounded-lg overflow-hidden",
              },
            },
            thead: {
              props: {
                className: "bg-gray-50 dark:bg-gray-800",
              },
            },
            tbody: {
              props: {
                className: "divide-y divide-gray-200 dark:divide-gray-700",
              },
            },
            tr: {
              props: {
                className:
                  "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
              },
            },
            th: {
              props: {
                className: isThinking
                  ? "px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700"
                  : "px-4 py-3 text-left text-xs font-medium text-purple-900 dark:text-purple-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700",
              },
            },
            td: {
              props: {
                className: isThinking
                  ? "px-4 py-3 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
                  : "px-4 py-3 text-sm text-purple-950 dark:text-purple-100 border-b border-gray-200 dark:border-gray-700",
              },
            },

            // Horizontal rule
            hr: {
              props: {
                className:
                  "my-8 border-0 border-t border-gray-200 dark:border-gray-700",
              },
            },

            // Strong and emphasis - adjust for thinking content
            strong: {
              props: {
                className: isThinking
                  ? "font-semibold text-gray-600 dark:text-gray-400"
                  : "font-semibold text-purple-950 dark:text-purple-100",
              },
            },
            em: {
              props: {
                className: isThinking
                  ? "italic text-gray-600 dark:text-gray-400"
                  : "italic text-purple-950 dark:text-purple-100",
              },
            },

            // Images
            img: {
              props: {
                className: "max-w-full h-auto rounded-lg shadow-sm my-4",
              },
            },

            // Task lists (if supported)
            input: {
              props: {
                className: "mr-2 rounded",
              },
            },
          },
        }}
      >
        {content}
      </MarkdownToJsx>
    </div>
  );
}
