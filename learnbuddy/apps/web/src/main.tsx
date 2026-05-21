import ReactDOM from 'react-dom/client'
import App from '@learnbuddy/ui'
import '@learnbuddy/ui/globals.css'
import '@learnbuddy/ui/i18n'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

ReactDOM.createRoot(root).render(<App />)
