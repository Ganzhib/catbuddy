import { EmailAuthPanel } from './EmailAuthPanel'
import { EmailLoginLayout } from './EmailLoginLayout'
import { LoginMarketingPanel } from './LoginMarketingPanel'
import { useEmailAuth } from './useEmailAuth'

export function EmailLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const auth = useEmailAuth(onSuccess)

  return (
    <EmailLoginLayout fitKey={`${auth.mode}-${auth.registerStep}-${auth.error ?? ''}-${auth.hint ?? ''}`}>
      <div className="flex h-full w-full flex-col lg:flex-row">
        <LoginMarketingPanel />
        <EmailAuthPanel auth={auth} />
      </div>
    </EmailLoginLayout>
  )
}
