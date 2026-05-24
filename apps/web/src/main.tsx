import ReactDOM from 'react-dom/client'
import App from '@catbuddy/ui'
import '@catbuddy/ui/globals.css'
import '@catbuddy/ui/i18n'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

ReactDOM.createRoot(root).render(<App />)
