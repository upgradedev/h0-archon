"use client"

import { useEffect, useState } from "react"

/**
 * Returns true after the component has mounted on the client.
 * Used to gate recharts ResponsiveContainer rendering until the
 * parent element has a settled layout, avoiding a first-paint
 * 0-width measurement race during entry animations.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return mounted
}
