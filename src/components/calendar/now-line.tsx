export function NowLine({ top }: { top: number }) {
  return (
    <div
      className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
      style={{ top }}
    >
      <span className="size-2 rounded-full bg-slot-next shrink-0 -ml-1 ring-4 ring-slot-next-tint" />
      <span className="h-px flex-1 bg-slot-next/60" />
    </div>
  );
}
