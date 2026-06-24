import { useEffect, useRef, useState } from 'react'

interface TextTypeProps {
  texts?: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  showCursor?: boolean
  cursorCharacter?: string
  cursorBlinkDuration?: number
  className?: string
}

export function TextType({
  texts = [''],
  typingSpeed = 75,
  deletingSpeed = 50,
  pauseDuration = 1500,
  showCursor = true,
  cursorCharacter = '_',
  cursorBlinkDuration = 0.5,
  className = '',
}: TextTypeProps) {
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [textIndex, setTextIndex] = useState(0)
  const [showCursorState, setShowCursorState] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const currentText = texts[textIndex] || ''

    const handleTyping = () => {
      if (isDeleting) {
        // 删除模式
        setDisplayText((prev) => prev.slice(0, -1))
        if (displayText.length <= 1) {
          setIsDeleting(false)
          setTextIndex((prev) => (prev + 1) % texts.length)
        }
        timeoutRef.current = setTimeout(handleTyping, deletingSpeed)
      } else {
        // 输入模式
        const nextChar = currentText[displayText.length]
        if (nextChar !== undefined) {
          setDisplayText((prev) => prev + nextChar)
          timeoutRef.current = setTimeout(handleTyping, typingSpeed)
        } else {
          // 完成输入，暂停后删除
          timeoutRef.current = setTimeout(() => {
            setIsDeleting(true)
            handleTyping()
          }, pauseDuration)
        }
      }
    }

    timeoutRef.current = setTimeout(handleTyping, typingSpeed)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [displayText, isDeleting, textIndex, texts, typingSpeed, deletingSpeed, pauseDuration])

  // 光标闪烁
  useEffect(() => {
    if (!showCursor) return
    const interval = setInterval(() => {
      setShowCursorState((prev) => !prev)
    }, cursorBlinkDuration * 1000)
    return () => clearInterval(interval)
  }, [showCursor, cursorBlinkDuration])

  return (
    <span className={className}>
      {displayText}
      {showCursor && (
        <span
          className="inline-block transition-opacity duration-100"
          style={{ opacity: showCursorState ? 1 : 0 }}
        >
          {cursorCharacter}
        </span>
      )}
    </span>
  )
}
