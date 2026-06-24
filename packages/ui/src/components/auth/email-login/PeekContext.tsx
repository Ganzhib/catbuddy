import { createContext, useContext, useState, type ReactNode } from 'react'

interface PeekContextValue {
  peeking: boolean
  setPeeking: (v: boolean) => void
}

const PeekCtx = createContext<PeekContextValue>({ peeking: false, setPeeking: () => {} })

export function usePeek() {
  return useContext(PeekCtx)
}

export function PeekProvider({ children }: { children: ReactNode }) {
  const [peeking, setPeeking] = useState(false)
  return (
    <PeekCtx.Provider value={{ peeking, setPeeking }}>
      {children}
    </PeekCtx.Provider>
  )
}
