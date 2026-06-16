import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function generateAvatarUrl(name: string, color: string): string {
  const initial = getInitial(name);
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect fill="${color}" width="36" height="36" rx="4"/><text x="50%" y="55%" fill="white" font-size="16" font-weight="bold" text-anchor="middle">${initial}</text></svg>`
  )}`;
}
