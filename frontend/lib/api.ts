const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface Project {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  property_address: string;
  contract_price: number;
  staging_date: string;
  notes?: string;
  contract_status: string;
  docusign_status: string;
  project_status: string;
  created_at: string;
}

export interface Approval {
  id: string;
  project_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  status: string;
  created_at: string;
  approval_message?: string;
}

export function parseIntakeMessage(message: string) {
  return request<Record<string, unknown>>('/api/intake/parse', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function createProject(data: {
  client_name: string;
  client_phone: string;
  client_email: string;
  property_address: string;
  contract_price: number;
  staging_date: string;
  notes?: string;
}) {
  return request<{ id: string }>('/api/intake/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getProjects() {
  return request<Project[]>('/api/intake/');
}

export function getPendingApprovals() {
  return request<Approval[]>('/api/approvals/');
}

export function getApproval(id: string) {
  return request<Approval>(`/api/approvals/${id}`);
}

export function approveAction(id: string, notes?: string) {
  return request<unknown>(`/api/approvals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved', notes }),
  });
}

export function rejectAction(id: string, notes?: string) {
  return request<unknown>(`/api/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ status: 'rejected', notes }),
  });
}

export function generateContract(projectId: string) {
  return request<unknown>(`/api/contracts/generate/${projectId}`, {
    method: 'POST',
  });
}

export function completeProject(projectId: string) {
  return request<unknown>(`/api/complete/${projectId}`, {
    method: 'POST',
  });
}
