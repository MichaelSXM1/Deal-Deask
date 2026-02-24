import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function getDaysLeft(ddDeadline: string) {
  const endOfDeadline = new Date(`${ddDeadline}T23:59:59`);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((endOfDeadline.getTime() - Date.now()) / msPerDay);
}
