import ReactDOM from 'react-dom/client'
import App from '@learnbuddy/ui'
import '@learnbuddy/ui/globals.css'
import '@learnbuddy/ui/i18n'

if (typeof globalThis.crypto !== 'undefined' && !('randomUUID' in globalThis.crypto)) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    }),
    configurable: true,
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

ReactDOM.createRoot(root).render(<App />)
