import { BrandMark } from "@/components/BrandMark";

import { Button } from "@/components/ui/button";

export function EmptyState({
  onNewChat,
}: {
  onNewChat: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <BrandMark className="h-14 w-14 object-contain opacity-90" />
      <div className="space-y-1">
        <p className="text-lg font-medium">No chats yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Start a conversation — your sessions are stored locally on the catbuddy
          workspace and stay available across reloads.
        </p>
      </div>
      <Button onClick={onNewChat}>New chat</Button>
    </div>
  );
}
