type NoticeType = "success" | "warning" | "error";

type Props = {
  type: NoticeType;
  message: string;
};

export default function Notice({ type, message }: Props) {
  const styles = {
    success: "bg-green-900/40 border-green-600 text-green-200",
    warning: "bg-yellow-900/40 border-yellow-600 text-yellow-200",
    error: "bg-red-900/40 border-red-600 text-red-200",
  };

  return (
    <div className={`rounded-lg border p-4 text-sm ${styles[type]}`}>
      {message}
    </div>
  );
}