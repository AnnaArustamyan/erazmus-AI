import Markdown from 'react-markdown'

interface MessageContentProps {
  text: string
  /** Assistant replies are markdown; user messages stay plain text. */
  markdown?: boolean
}

export function MessageContent({ text, markdown = false }: MessageContentProps) {
  if (!markdown) {
    return <div className="whitespace-pre-wrap break-words">{text}</div>
  }

  return (
    <div className="chat-md break-words">
      <Markdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}
