import api from './api';

export interface ServiceHealth {
  name: string;
  status: string;
  latency_ms?: number;
  port?: number;
  version?: string;
  driver?: string;
  bucket?: string;
}

export interface TelemetrySummary {
  total_requests: number;
  status_2xx: number;
  status_4xx: number;
  status_5xx: number;
  error_rate_pct: number;
}

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  environment: string;
  uptime_seconds: number;
  timestamp: number;
  services: {
    api: ServiceHealth;
    database: ServiceHealth;
    storage: ServiceHealth;
    cache: ServiceHealth;
  };
  telemetry: TelemetrySummary;
  links: {
    prometheus: string;
    grafana: string;
    minio: string;
    swagger: string;
  };
}

export interface StorageRoundtripResult {
  storage_mode: string;
  write_latency_ms: number;
  verify_latency_ms: number;
  delete_latency_ms: number;
  total_roundtrip_ms: number;
  payload_bytes: number;
  status: 'PASSED' | 'FAILED';
}

export interface TargetProbeResult {
  id: string;
  name: string;
  url: string;
  environment: 'cloud' | 'local';
  status: 'healthy' | 'degraded' | 'sleeping' | 'down';
  status_code: number;
  latency_ms: number;
  is_ssl: boolean;
  is_cold_start: boolean;
  server: string;
  error?: string | null;
  timestamp: number;
}

export const systemService = {
  getHealth: async (): Promise<SystemHealthData> => {
    const res = await api.get('/system/health');
    return res.data;
  },

  getFleet: async (): Promise<TargetProbeResult[]> => {
    const res = await api.get('/system/fleet');
    return res.data;
  },

  probeCustomUrl: async (url: string, timeout = 15): Promise<TargetProbeResult> => {
    const res = await api.post('/system/probe', { url, timeout });
    return res.data;
  },

  simulateBurst: async (count = 20): Promise<{ message: string; injected_count: number }> => {
    const res = await api.post(`/system/simulate/burst?count=${count}`);
    return res.data;
  },

  simulateLatency: async (): Promise<{ message: string; measured_duration_ms: number }> => {
    const res = await api.post('/system/simulate/latency');
    return res.data;
  },

  simulateError: async (): Promise<{ message: string; simulated_error: string }> => {
    const res = await api.post('/system/simulate/error');
    return res.data;
  },

  simulateStorageRoundtrip: async (): Promise<StorageRoundtripResult> => {
    const res = await api.post('/system/simulate/storage-roundtrip');
    return res.data;
  },
};
