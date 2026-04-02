// Empty string → browser calls /api/... relative to its own host.
// Next.js rewrites proxy those to http://localhost:8000/api/... server-side.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
  final_day_of_service?: string;
  extension_requested?: boolean;
  extension_approved?: boolean;
  extension_count?: number;
  days_remaining?: number;
  invoice_status?: string;
  payment_method?: string;
  approval_status?: string;
  followup_status?: string;
}

export interface ClientFolder {
  client_name: string;
  project_id: string;
  file_count: number;
  file_types: string[];
  latest_upload: string;
}

export interface ClientFile {
  id: string;
  project_id: string;
  client_name: string;
  file_type: string;
  file_name: string;
  file_path: string;
  file_url?: string;
  uploaded_at: string;
  notes?: string;
}

export interface Notification {
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  message: string;
  project_id: string;
  client_name: string;
  property_address: string;
  days_remaining: number | null;
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

export function getNotifications() {
  return request<Notification[]>('/api/notifications/');
}

export function getApproachingProjects() {
  return request<Project[]>('/api/extensions/approaching');
}

export function requestExtension(data: { project_id: string; new_end_date: string; extension_notes?: string }) {
  return request<unknown>('/api/extensions/request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function approveExtension(projectId: string, data: { new_end_date: string; notes?: string }) {
  return request<unknown>(`/api/extensions/approve/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getClientFolders() {
  return request<ClientFolder[]>('/api/files/folders');
}

export function getClientFiles(projectId: string) {
  return request<ClientFile[]>(`/api/files/client/${projectId}`);
}

export async function uploadClientFile(
  projectId: string,
  file: File,
  fileType: string,
  clientName: string,
  notes?: string
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('file', file);
  form.append('file_type', fileType);
  form.append('client_name', clientName);
  if (notes) form.append('notes', notes);

  const res = await fetch(`${API_URL}/api/files/upload/${projectId}`, {
    method: 'POST',
    body: form,
    // No Content-Type header — browser sets it with multipart boundary
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload error ${res.status}: ${text}`);
  }
  return res.json();
}

export function deleteClientFile(fileId: string) {
  return request<unknown>(`/api/files/file/${fileId}`, { method: 'DELETE' });
}

// ── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  description?: string;
  quantity_total: number;
  quantity_available: number;
  condition?: string;
  purchase_price?: number;
  estimated_value?: number;
  sku?: string;
  notes?: string;
  created_at: string;
}

export interface ProjectInventory {
  id: string;
  project_id: string;
  inventory_id: string;
  quantity_used: number;
  assigned_at: string;
  returned_at?: string;
  notes?: string;
  inventory?: InventoryItem;
}

export function getInventory() {
  return request<InventoryItem[]>('/api/inventory/');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInventoryItem(data: any) {
  return request<InventoryItem>('/api/inventory/', { method: 'POST', body: JSON.stringify(data) });
}

export async function analyzeInventoryImage(file: File): Promise<{ ai_result: Record<string, unknown>; qr_base64: string; image_path: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/inventory/analyze', { method: 'POST', body: form });
  if (!res.ok) { const t = await res.text(); throw new Error(`Analyze error ${res.status}: ${t}`); }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function confirmInventoryItem(data: any) {
  return request<InventoryItem & { qr_base64: string }>('/api/inventory/confirm', { method: 'POST', body: JSON.stringify(data) });
}

export function getProjectInventory(projectId: string) {
  return request<ProjectInventory[]>(`/api/inventory/project/${projectId}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assignInventory(data: any) {
  return request<unknown>('/api/inventory/assign', { method: 'POST', body: JSON.stringify(data) });
}

export function returnInventory(assignmentId: string) {
  return request<unknown>(`/api/inventory/return/${assignmentId}`, { method: 'POST' });
}

// ── Vendors ──────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  vendor_name: string;
  service_type: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  rate?: number;
  rate_type?: string;
  notes?: string;
  created_at: string;
}

export interface ProjectVendor {
  id: string;
  project_id: string;
  vendor_id: string;
  service_date?: string;
  cost?: number;
  status?: string;
  notes?: string;
  vendors?: Vendor;
}

export function getVendors() {
  return request<Vendor[]>('/api/vendors/');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVendor(data: any) {
  return request<Vendor>('/api/vendors/', { method: 'POST', body: JSON.stringify(data) });
}

export function getProjectVendors(projectId: string) {
  return request<ProjectVendor[]>(`/api/vendors/project/${projectId}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assignVendor(data: any) {
  return request<unknown>('/api/vendors/assign', { method: 'POST', body: JSON.stringify(data) });
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface RevenueAnalytics {
  total_revenue: number;
  revenue_this_month: number;
  revenue_this_year: number;
  avg_contract_value: number;
  revenue_by_month: { month: string; revenue: number }[];
}

export interface ProjectAnalytics {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  avg_staging_duration_days: number;
  by_status: Record<string, number>;
}

export interface PipelineAnalytics {
  pipeline_value: number;
  pending_signatures: number;
  unpaid_invoices: number;
  pending_approvals: number;
}

export function getRevenueAnalytics() {
  return request<RevenueAnalytics>('/api/analytics/revenue');
}

export function getProjectAnalytics() {
  return request<ProjectAnalytics>('/api/analytics/projects');
}

export function getPipelineAnalytics() {
  return request<PipelineAnalytics>('/api/analytics/pipeline');
}
