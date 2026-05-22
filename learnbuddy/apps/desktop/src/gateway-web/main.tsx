import ReactDOM from 'react-dom/client'
import { GatewayChatApp } from '@learnbuddy/ui/gateway-web/GatewayChatApp'
import '@learnbuddy/ui/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

ReactDOM.createRoot(root).render(<GatewayChatApp />)
