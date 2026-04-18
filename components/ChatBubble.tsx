type Role = "user" | "assistant";

export function ChatBubble({ role, text }: { role: Role; text: string }) {
  const isUser = role === "user";
  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={[
          "max-w-[85%] rounded-3xl px-5 py-4 text-xl leading-relaxed shadow-sm",
          isUser
            ? "bg-meemaw-primary text-white rounded-br-md"
            : "bg-white text-meemaw-ink rounded-bl-md border border-gray-100",
        ].join(" ")}
      >
        {text}
      </div>
    </div>
  );
}
