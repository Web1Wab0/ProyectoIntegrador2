"use client";

import { useEffect } from "react";
import { useToast, type ToastType } from "./toast-provider";

type Props = {
  type: ToastType;
  message: string;
  title?: string;
};

export default function Notice({ type, message, title }: Props) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!message) return;
    showToast({ type, message, title });
  }, [message, showToast, title, type]);

  return null;
}
