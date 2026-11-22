import api from './api';

export interface FirewallRule {
  id: string;
  ip_or_cidr: string;
  action: 'ALLOW' | 'BLOCK';
  description: string;
  created_at: number;
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  client_ip: string;
  action_taken: string;
  reason: string;
  country_code?: string;
}

export interface SecurityOverview {
  status: string;
  current_client_ip: string;
  total_rules: number;
  total_blocked_requests: number;
  rate_limiter_active: boolean;
  geo_fencing_active: boolean;
  allowed_countries: string[];
  active_monitored_ips: number;
  recent_event_count: number;
}

export interface IntegrityResult {
  file_id: string;
  file_name: string;
  stored_checksum: string | null;
  computed_checksum: string | null;
  integrity_status: 'MATCHED_AND_VERIFIED' | 'CORRUPTED' | 'MISSING_BINARY';
  malware_scan: string;
  encryption_at_rest: string;
}

export const securityService = {
  async getOverview(): Promise<SecurityOverview> {
    const res = await api.get<SecurityOverview>('/security/overview');
    return res.data;
  },

  async listRules(): Promise<FirewallRule[]> {
    const res = await api.get<FirewallRule[]>('/security/rules');
    return res.data;
  },

  async createRule(rule: { ip_or_cidr: string; action: 'ALLOW' | 'BLOCK'; description: string }): Promise<FirewallRule> {
    const res = await api.post<FirewallRule>('/security/rules', rule);
    return res.data;
  },

  async deleteRule(ruleId: string): Promise<void> {
    await api.delete(`/security/rules/${ruleId}`);
  },

  async listEvents(): Promise<SecurityEvent[]> {
    const res = await api.get<SecurityEvent[]>('/security/events');
    return res.data;
  },

  async updateConfig(cfg: {
    rate_limiter_enabled?: boolean;
    geo_blocking_enabled?: boolean;
    allowed_countries?: string[];
  }): Promise<any> {
    const res = await api.patch('/security/config', cfg);
    return res.data;
  },

  async verifyFileIntegrity(fileId: string): Promise<IntegrityResult> {
    const res = await api.post<IntegrityResult>(`/security/verify-integrity/${fileId}`);
    return res.data;
  },
};
