import ReactDOM from 'react-dom/client'
import '@catbuddy/ui/globals.css'
import './landing.css'
import '@catbuddy/ui/i18n'
import { WebRoot } from './WebRoot'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

ReactDOM.createRoot(root).render(<WebRoot />)
