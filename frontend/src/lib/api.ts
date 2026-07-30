/**
 * API client for Hermes Switch Manager backend.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }
  return res.json();
}

// ─── Switches ───

export interface SwitchData {
  id: number;
  hostname: string;
  ip_address: string;
  vendor: string;
  device_type: string | null;
  ssh_port: number;
  status: string;
  os_version: string | null;
  serial_number: string | null;
  location: string | null;
  tags: string | null;
  notes: string | null;
  connection_type: string;
  serial_port: string | null;
  serial_baud: number;
  serial_databits: number;
  serial_parity: string;
  serial_stopbits: number;
  serial_timeout: number;
  created_at: string;
  updated_at: string | null;
}

export interface SwitchCreateData {
  hostname: string;
  ip_address: string;
  vendor?: string;
  device_type?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  location?: string;
  tags?: string;
  notes?: string;
  connection_type?: string;
  serial_port?: string;
  serial_baud?: number;
  serial_databits?: number;
  serial_parity?: string;
  serial_stopbits?: number;
  serial_timeout?: number;
  serial_password?: string;
}

export const switchesApi = {
  list: (status?: string, connectionType?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (connectionType) params.set('connection_type', connectionType);
    const qs = params.toString();
    return request<SwitchData[]>(`/api/switches/${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<SwitchData>(`/api/switches/${id}`),
  create: (data: SwitchCreateData) =>
    request<SwitchData>('/api/switches/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<SwitchCreateData>) =>
    request<SwitchData>(`/api/switches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/switches/${id}`, { method: 'DELETE' }),
  sync: (id: number) =>
    request<{ status: string; hostname: string; connection_type?: string }>(`/api/switches/${id}/sync`, { method: 'POST' }),
  health: (id: number) =>
    request<any>(`/api/switches/${id}/health`, { method: 'POST' }),
  commands: (id: number, commands: string[]) =>
    request<any>(`/api/switches/${id}/commands`, { method: 'POST', body: JSON.stringify(commands) }),
  pushConfig: (id: number, commands: string[]) =>
    request<any>(`/api/switches/${id}/push-config`, { method: 'POST', body: JSON.stringify(commands) }),
  applyTemplate: (id: number, templateId: number, variables: Record<string, string> = {}) =>
    request<any>(`/api/switches/${id}/apply-template`, {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, variables }),
    }),
  serialPorts: () =>
    request<{ device: string; description: string; manufacturer: string }[]>('/api/switches/serial/ports'),
  bulkBackup: () =>
    request<{ status: string }>('/api/switches/bulk-backup', { method: 'POST' }),
};

// ─── Configs ───

export interface ConfigBackupData {
  id: number;
  switch_id: number;
  config_type: string;
  running_config: string;
  config_hash: string | null;
  created_at: string;
}

export const configsApi = {
  list: (switchId?: number, limit = 50) =>
    request<ConfigBackupData[]>(`/api/configs/${switchId ? `?switch_id=${switchId}` : ''}&limit=${limit}`),
  get: (id: number) => request<ConfigBackupData>(`/api/configs/${id}`),
  latest: (switchId: number) => request<any>(`/api/configs/${switchId}/latest`),
  diff: (backupIdA: number, backupIdB: number) =>
    request<any>(`/api/configs/diff?backup_id_a=${backupIdA}&backup_id_b=${backupIdB}`, { method: 'POST' }),
};

// ─── Chat ───

export const chatApi = {
  stream: '/api/chat/stream',
  history: (sessionId: string) => request<any[]>(`/api/chat/history/${sessionId}`),
  clear: (sessionId: string) =>
    request<{ message: string }>(`/api/chat/history/${sessionId}`, { method: 'DELETE' }),
};

// ─── Workflows ───

export interface WorkflowData {
  id: number;
  title: string;
  description: string | null;
  status: string;
  switch_ids: string | null;
  created_by: string | null;
  ticket_ref: string | null;
  steps: any[];
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

export const workflowsApi = {
  list: (status?: string) =>
    request<WorkflowData[]>(`/api/workflows/${status ? `?status=${status}` : ''}`),
  get: (id: number) => request<WorkflowData>(`/api/workflows/${id}`),
  create: (data: { title: string; description?: string; switch_ids?: string; created_by?: string; ticket_ref?: string }) =>
    request<WorkflowData>('/api/workflows/', { method: 'POST', body: JSON.stringify(data) }),
  advance: (id: number, approved = false, result?: string) =>
    request<any>(`/api/workflows/${id}/advance`, {
      method: 'POST',
      body: JSON.stringify({ approved, result }),
    }),
  executeStep: (workflowId: number, stepId: number) =>
    request<any>(`/api/workflows/${workflowId}/steps/${stepId}/execute`, { method: 'POST' }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/workflows/${id}`, { method: 'DELETE' }),
};

// ─── Security ───

export interface SecurityFindingData {
  id: number;
  switch_id: number;
  finding_type: string;
  severity: string;
  title: string;
  description: string | null;
  remediation: string | null;
  cve_id: string | null;
  status: string;
  created_at: string;
}

export const securityApi = {
  list: (params?: { switch_id?: number; severity?: string; status?: string; finding_type?: string }) => {
    const q = new URLSearchParams();
    if (params?.switch_id) q.set('switch_id', String(params.switch_id));
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    if (params?.finding_type) q.set('finding_type', params.finding_type);
    return request<SecurityFindingData[]>(`/api/security/findings?${q}`);
  },
  stats: () => request<any>('/api/security/findings/stats'),
  audit: (switchId: number) =>
    request<any>(`/api/security/audit/${switchId}`, { method: 'POST' }),
  auditAll: () =>
    request<any>('/api/security/audit-all', { method: 'POST' }),
  resolve: (findingId: number, status: string) =>
    request<any>(`/api/security/findings/${findingId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};

// ─── Dashboard ───

export interface DashboardStats {
  total_switches: number;
  online_switches: number;
  offline_switches: number;
  total_configs: number;
  open_security_findings: number;
  active_workflows: number;
  total_topologies: number;
}

export const dashboardApi = {
  stats: () => request<DashboardStats>('/api/dashboard/stats'),
  healthSummary: () => request<any[]>('/api/dashboard/health-summary'),
  auditLog: (limit = 50) => request<any[]>(`/api/dashboard/audit-log?limit=${limit}`),
};

// ─── Containerlab ───

export const containerlabApi = {
  list: () => request<any[]>('/api/containerlab/topologies'),
  get: (id: number) => request<any>(`/api/containerlab/topologies/${id}`),
  scan: () => request<any>('/api/containerlab/scan', { method: 'POST' }),
  parse: (filePath: string) =>
    request<any>(`/api/containerlab/parse?file_path=${encodeURIComponent(filePath)}`, { method: 'POST' }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/containerlab/topologies/${id}`, { method: 'DELETE' }),
};

// ─── System Discovery ───

export interface SerialPort {
  device: string;
  description: string;
  manufacturer: string;
  hwid: string;
}

export interface UsbDevice {
  bus: number;
  device: number;
  vendor_id: string;
  product_id: string;
  description: string;
}

export interface DiscoveryData {
  serial_ports: SerialPort[];
  usb_devices: UsbDevice[];
  usb_serial_adapters: { device: string; name: string; type: string }[];
}

export const systemApi = {
  serialPorts: () => request<SerialPort[]>('/api/system/serial-ports'),
  usbDevices: () => request<UsbDevice[]>('/api/system/usb-devices'),
  discovery: () => request<DiscoveryData>('/api/system/discovery'),
};

// ─── Templates ───

export interface TemplateData {
  id: number;
  name: string;
  description: string | null;
  vendor: string;
  category: string;
  template_body: string;
  variables: any;
  tags: string | null;
  is_builtin: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface TemplateCreateData {
  name: string;
  description?: string;
  vendor?: string;
  category?: string;
  template_body: string;
  variables?: any;
  tags?: string;
}

export const templatesApi = {
  list: (vendor?: string, category?: string) => {
    const params = new URLSearchParams();
    if (vendor) params.set('vendor', vendor);
    if (category) params.set('category', category);
    const qs = params.toString();
    return request<TemplateData[]>(`/api/templates/${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<TemplateData>(`/api/templates/${id}`),
  create: (data: TemplateCreateData) =>
    request<TemplateData>('/api/templates/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<TemplateCreateData>) =>
    request<TemplateData>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/templates/${id}`, { method: 'DELETE' }),
  render: (templateId: number, variables: Record<string, string> = {}) =>
    request<any>('/api/templates/render', {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, variables }),
    }),
  apply: (switchId: number, templateId: number, variables: Record<string, string> = {}) =>
    request<any>(`/api/templates/apply/${switchId}`, {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, variables }),
    }),
  seed: () => request<{ message: string }>('/api/templates/seed', { method: 'POST' }),
};

// ─── SSE Stream (for chat) ───
// Uses fetch with streaming since SSE POST requires a custom approach

export async function chatStreamFetch(
  sessionId: string,
  message: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });

  if (!response.ok) {
    onError(new Error(`HTTP ${response.status}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError(new Error('No response body'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) {
            onToken(parsed.token);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }
  onDone();
}
