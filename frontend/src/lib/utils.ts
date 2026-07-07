/**
 * Utility functions.
 */

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'online': return 'text-green-600';
    case 'offline': return 'text-red-600';
    case 'unknown': return 'text-yellow-500';
    case 'maintenance': return 'text-blue-500';
    default: return 'text-gray-400';
  }
}

export function vendorColor(vendor: string): string {
  switch (vendor) {
    case 'cisco_ios':
    case 'cisco_xr':
    case 'cisco_nxos': return 'text-sky-500';
    case 'juniper_junos': return 'text-lime-500';
    case 'arista_eos': return 'text-red-500';
    case 'aruba_os':
    case 'hp_procurve': return 'text-amber-500';
    case 'linux': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
