export function EmptyRoom() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-secondary">
          <span className="text-2xl">💬</span>
        </div>
        <p className="text-sm text-text-muted">暂无消息</p>
        <p className="mt-1 text-xs text-text-muted">发送第一条消息开始对话</p>
      </div>
    </div>
  );
}
