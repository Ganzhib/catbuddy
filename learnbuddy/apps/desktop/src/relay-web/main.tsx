import ReactDOM from 'react-dom/client'
import { RelayChatApp } from '@learnbuddy/ui/relay-web/RelayChatApp'
import '@learnbuddy/ui/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

ReactDOM.createRoot(root).render(<RelayChatApp />)
