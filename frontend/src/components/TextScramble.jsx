import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = CHARS,
  className,
  as: Component = 'span',
  trigger = true,
  onScrambleComplete,
  ...props
}) {
  const MotionComponent = motion(Component)
  const [displayText, setDisplayText] = useState(children)
  const [isAnimating, setIsAnimating] = useState(false)
  const text = children

  const scramble = () => {
    if (isAnimating) return
    setIsAnimating(true)
    const steps = duration / speed
    let step = 0
    const interval = setInterval(() => {
      const progress = step / steps
      let scrambled = ''
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') { scrambled += ' '; continue }
        if (progress * text.length > i) {
          scrambled += text[i]
        } else {
          scrambled += characterSet[Math.floor(Math.random() * characterSet.length)]
        }
      }
      setDisplayText(scrambled)
      step++
      if (step > steps) {
        clearInterval(interval)
        setDisplayText(text)
        setIsAnimating(false)
        if (onScrambleComplete) onScrambleComplete()
      }
    }, speed * 1000)
  }

  useEffect(() => {
    if (!trigger) return
    scramble()
  }, [trigger])

  return (
    <MotionComponent className={className} {...props}>
      {displayText}
    </MotionComponent>
  )
}
