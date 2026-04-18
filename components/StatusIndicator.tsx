export type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

export function StatusIndicator({ status }: { status: Status }) {
  const label: Record<Status, string> = {
    idle: "Tap the button and tell me what's wrong",
    listening: "I'm listening…",
    thinking: "Let me think…",
    speaking: "",
    error: "Something went wrong. Tap to try again.",
  };

  const color: Record<Status, string> = {
    idle: "text-gray-500",
    listening: "text-meemaw-primary",
    thinking: "text-meemaw-accent",
    speaking: "text-meemaw-success",
    error: "text-meemaw-danger",
  };

  if (status === "speaking") {
    return (
      <div className="flex items-center justify-center gap-1 h-8 text-meemaw-success">
        <span className="wave-bar h-6" />
        <span className="wave-bar h-6" />
        <span className="wave-bar h-6" />
        <span className="wave-bar h-6" />
        <span className="wave-bar h-6" />
      </div>
    );
  }

  return (
    <p
      className={`text-center text-lg font-medium ${color[status]}`}
      aria-live="polite"
    >
      {label[status]}
    </p>
  );
}
