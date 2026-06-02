type NoticeType = "success" | "warning" | "error";

type Props = {
  type: NoticeType;
  message: string;
};

export default function Notice({ type, message }: Props) {
  const styles = {
    success:
      "bg-[rgba(0,100,122,0.10)] text-[var(--secondary)]",
    warning:
      "bg-[rgba(217,119,6,0.10)] text-[var(--warning)]",
    error:
      "bg-[rgba(220,38,38,0.10)] text-[var(--danger)]",
  };

  return (
    <div className={`rounded-2xl p-4 text-sm font-medium ${styles[type]}`}>
      {message}
    </div>
  );
}