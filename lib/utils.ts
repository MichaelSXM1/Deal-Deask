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

export function getHoursLeft(ddDeadline: string) {
  const endOfDeadline = new Date(`${ddDeadline}T23:59:59`);
  const msPerHour = 1000 * 60 * 60;
  return Math.round((endOfDeadline.getTime() - Date.now()) / msPerHour);
}

export function getDaysLeft(ddDeadline: string) {
  return Math.ceil(getHoursLeft(ddDeadline) / 24);
}
