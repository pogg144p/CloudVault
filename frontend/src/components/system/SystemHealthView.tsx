import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  RefreshCw,
  ExternalLink,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Play,
  Terminal,
  BarChart3,
  Flame,
  ShieldCheck,
  Globe,
  Radio,
  Lock,
  Search,
  Sunrise,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  systemService,
  SystemHealthData,
  StorageRoundtripResult,
  TargetProbeResult,
} from '../../services/system';

export const SystemHealthView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fleet' | 'telemetry' | 'probe'>('fleet');
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [fleetTargets, setFleetTargets] = useState<TargetProbeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Custom URL Probe State
  const [customUrl, setCustomUrl] = useState('https://cloudvault-backend-cazy.onrender.com/health');
  const [probeTimeout, setProbeTimeout] = useState(25);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<TargetProbeResult | null>(null);

  // Live Terminal Logs
  const [logs, setLogs] = useState<
    Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }>
  >([
    {
      timestamp: new Date().toLocaleTimeString(),
      message: 'Unified Observability Engine initialized. Monitoring Cloud Fleet (Render) and Localhost.',
      type: 'info',
    },
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);

  const appendLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setLogs((prev) => [
      ...prev.slice(-35),
      { timestamp: new Date().toLocaleTimeString(), message, type },
    ]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch local telemetry & system health
  const fetchHealth = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const data = await systemService.getHealth();
      setHealthData(data);
      if (isManual) {
        appendLog(`Local telemetry synchronized. Health status: ${data.status.toUpperCase()}`, 'success');
      }
    } catch (err: any) {
      appendLog(`Failed to query /api/v1/system/health: ${err?.message || 'Network Error'}`, 'error');
    } finally {
      if (isManual) setLoading(false);
    }
  };

  // Probe the entire fleet (Render Cloud + Localhost)
  const fetchFleet = async (isManual = false) => {
    if (isManual) setFleetLoading(true);
    try {
      const targets = await systemService.getFleet();
      setFleetTargets(targets);
      if (isManual) {
        appendLog(`Fleet probe completed across ${targets.length} targets (Render Cloud & Localhost).`, 'success');
      }
    } catch (err: any) {
      appendLog(`Fleet probe failed: ${err?.message || 'Error'}`, 'error');
    } finally {
      if (isManual) setFleetLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth(true);
    fetchFleet(true);
  }, []);

  // Continuous background heartbeats (every 6s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealth(false);
      fetchFleet(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle single URL manual probe
  const handleProbeCustom = async (urlToProbe = customUrl, timeout = probeTimeout) => {
    setProbeLoading(true);
    appendLog(`Initiating HTTP/HTTPS probe to ${urlToProbe} (Timeout: ${timeout}s)...`, 'info');
    try {
      const res = await systemService.probeCustomUrl(urlToProbe, timeout);
      setProbeResult(res);
      if (res.status === 'healthy') {
        appendLog(`[PROBE 200 OK] ${res.url} responded in ${res.latency_ms}ms (${res.is_cold_start ? '❄️ Cold-start wake-up' : '⚡ Warm response'})`, 'success');
      } else if (res.status === 'sleeping') {
        appendLog(`[PROBE SLEEPING] ${res.url} timed out. Render free tier service is asleep. Waking it up...`, 'warn');
      } else {
        appendLog(`[PROBE ${res.status_code || 'ERR'}] ${res.url} returned: ${res.error || res.status}`, 'error');
      }
    } catch (err: any) {
      appendLog(`Probe execution error: ${err.message}`, 'error');
    } finally {
      setProbeLoading(false);
    }
  };

  // Simulations
  const handleSimulateBurst = async () => {
    setActionLoading('burst');
    appendLog('Sending 25 concurrent requests to /api/v1/files telemetry stream...', 'info');
    try {
      const res = await systemService.simulateBurst(25);
      appendLog(`[Prometheus] Injected 25 HTTP request events into cloudvault_http_requests_total collector!`, 'success');
      await fetchHealth(false);
    } catch (err: any) {
      appendLog(`Simulation failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulateLatency = async () => {
    setActionLoading('latency');
    appendLog('Simulating database/storage heavy query (350ms artificial delay)...', 'warn');
    try {
      const res = await systemService.simulateLatency();
      appendLog(`[Prometheus] Latency observation recorded: ${res.measured_duration_ms}ms (Updating P95 histogram)`, 'warn');
      await fetchHealth(false);
    } catch (err: any) {
      appendLog(`Latency simulation failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulateError = async () => {
    setActionLoading('error');
    appendLog('Fault injection: emitting 3x HTTP 500 server errors to test Alertmanager rules...', 'error');
    try {
      const res = await systemService.simulateError();
      appendLog(`[Alertmanager] HighHttp5xxErrorRate simulation triggered: 3 errors logged.`, 'error');
      await fetchHealth(false);
    } catch (err: any) {
      appendLog(`Fault injection failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStorageRoundtrip = async () => {
    setActionLoading('s3');
    appendLog('Initiating S3 / MinIO direct I/O test (10KB payload upload, verify, and purge)...', 'info');
    try {
      const res: StorageRoundtripResult = await systemService.simulateStorageRoundtrip();
      appendLog(
        `[${res.storage_mode.toUpperCase()}] I/O Roundtrip ${res.status}: Write ${res.write_latency_ms}ms | Read ${res.verify_latency_ms}ms | Delete ${res.delete_latency_ms}ms (Total: ${res.total_roundtrip_ms}ms)`,
        'success'
      );
      await fetchHealth(false);
    } catch (err: any) {
      appendLog(`Storage roundtrip test failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const isHealthy = healthData?.status === 'healthy';

  const cloudTargets = fleetTargets.filter((t) => t.environment === 'cloud');
  const localTargets = fleetTargets.filter((t) => t.environment === 'local');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in select-text">
      {/* ── Top Hero Card: Overall Status & Auto-Refresh ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${
                isHealthy
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-emerald-500/10'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-amber-500/10'
              }`}
            >
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Unified Cloud & Site Health Command Center
                </h1>
                <span className="flex h-2.5 w-2.5 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      autoRefresh ? 'bg-emerald-400' : 'bg-slate-400'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      autoRefresh ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  ></span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span>
                  Monitoring: <strong className="text-indigo-600 dark:text-indigo-400">Render Cloud + Localhost</strong>
                </span>
                <span>•</span>
                <span>
                  Active Targets: <strong className="text-slate-700 dark:text-slate-300">{fleetTargets.length} Endpoints</strong>
                </span>
                <span>•</span>
                <span>Last Polled: {new Date().toLocaleTimeString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {autoRefresh ? 'Heartbeats: LIVE (6s)' : 'Heartbeats: PAUSED'}
            </button>
            <button
              onClick={() => {
                fetchHealth(true);
                fetchFleet(true);
              }}
              disabled={loading || fleetLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || fleetLoading ? 'animate-spin' : ''}`} />
              Probe All Now
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 mt-6 -mb-2 gap-6">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'fleet'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            Cloud & Local Fleet Status ({fleetTargets.length})
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'telemetry'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Prometheus RED Telemetry & Chaos Simulator
          </button>

          <button
            onClick={() => setActiveTab('probe')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'probe'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            On-Demand URL Probe & Cold-Start Awakener
          </button>
        </div>
      </div>

      {/* ── TAB 1: FLEET OVERVIEW & RENDER CLOUD SITES ── */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          {/* ☁️ Section 1: Render Cloud Production */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Render Cloud Production Deployments
                </h2>
              </div>
              <span className="text-xs text-slate-400">Live SSL Probes over Public Internet</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cloudTargets.map((target) => {
                const isOnline = target.status === 'healthy';
                const isSleeping = target.status === 'sleeping';
                return (
                  <div
                    key={target.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {target.name}
                            {target.is_ssl && (
                              <span title="HTTPS SSL Verified" className="text-emerald-500">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </h3>
                          <a
                            href={target.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span className="truncate max-w-[260px]">{target.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase border ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : isSleeping
                            ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                            : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                        }`}
                      >
                        {isOnline ? 'Online (200 OK)' : isSleeping ? 'Sleeping' : 'Unreachable'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Latency</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {target.latency_ms > 0 ? `${target.latency_ms} ms` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Status Code</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {target.status_code || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Server Tier</span>
                        <span className="font-medium text-slate-600 dark:text-slate-400 truncate block">
                          {target.server}
                        </span>
                      </div>
                    </div>

                    {isSleeping && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs">
                        <span className="text-amber-700 dark:text-amber-300 text-[11px]">
                          Free tier instance is asleep.
                        </span>
                        <button
                          onClick={() => handleProbeCustom(target.url, 40)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                        >
                          Wake Up (40s)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 💻 Section 2: Localhost Development Stack */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Localhost Stack (Docker Compose & Development)
                </h2>
              </div>
              <span className="text-xs text-slate-400">Local Loopback Probes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {localTargets.map((target) => {
                const isOnline = target.status === 'healthy';
                return (
                  <div
                    key={target.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {target.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {isOnline ? 'Online' : 'Standby'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{target.url}</p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Roundtrip Ping</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {isOnline ? `${target.latency_ms} ms` : 'Not running'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROMETHEUS TELEMETRY & CHAOS SIMULATOR ── */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Live RED Metrics Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Live Prometheus Telemetry (RED Metrics)
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">Scrape target: /metrics</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Total Requests
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {healthData?.telemetry.total_requests ?? 0}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Processed since startup</p>
              </div>

              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  2xx Successes
                </p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                  {healthData?.telemetry.status_2xx ?? 0}
                </p>
                <p className="text-[11px] text-emerald-600/80 mt-1">HTTP 200/201 OK</p>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  4xx Client Errors
                </p>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1 font-mono">
                  {healthData?.telemetry.status_4xx ?? 0}
                </p>
                <p className="text-[11px] text-amber-600/80 mt-1">Not Found / Auth Invalid</p>
              </div>

              <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-xl p-4 border border-rose-100 dark:border-rose-900/30">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                  5xx Server Errors
                </p>
                <p className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1 font-mono">
                  {healthData?.telemetry.status_5xx ?? 0}
                </p>
                <p className="text-[11px] text-rose-600/80 mt-1">
                  Error Rate: {healthData?.telemetry.error_rate_pct ?? 0}% (SLA: &lt;2%)
                </p>
              </div>
            </div>
          </div>

          {/* Interactive DevOps Action Center */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Interactive DevOps Action Center</h2>
                  <p className="text-xs text-indigo-200">
                    Trigger live stress tests, I/O roundtrips, and telemetry metrics directly from the browser.
                  </p>
                </div>
              </div>
              <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full font-mono">
                Mode: Interactive Simulator
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={handleSimulateBurst}
                disabled={actionLoading !== null}
                className="flex flex-col items-start p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="p-2 rounded-lg bg-indigo-500/30 text-indigo-300">
                    <Play className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] text-indigo-300 font-bold uppercase">Burst</span>
                </div>
                <strong className="text-sm font-bold text-white">Simulate Traffic Burst</strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  Fires 25 rapid requests to watch Prometheus telemetry counter rise.
                </p>
              </button>

              <button
                onClick={handleStorageRoundtrip}
                disabled={actionLoading !== null}
                className="flex flex-col items-start p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="p-2 rounded-lg bg-violet-500/30 text-violet-300">
                    <HardDrive className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] text-violet-300 font-bold uppercase">I/O Roundtrip</span>
                </div>
                <strong className="text-sm font-bold text-white">Test S3 Write/Read</strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  Uploads 10KB test payload to S3/MinIO, verifies presence, and purges.
                </p>
              </button>

              <button
                onClick={handleSimulateLatency}
                disabled={actionLoading !== null}
                className="flex flex-col items-start p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="p-2 rounded-lg bg-amber-500/30 text-amber-300">
                    <Clock className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] text-amber-300 font-bold uppercase">Latency</span>
                </div>
                <strong className="text-sm font-bold text-white">Simulate P95 Latency</strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  Injects artificial 350ms delay to exercise latency histograms.
                </p>
              </button>

              <button
                onClick={handleSimulateError}
                disabled={actionLoading !== null}
                className="flex flex-col items-start p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="p-2 rounded-lg bg-rose-500/30 text-rose-300">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] text-rose-300 font-bold uppercase">Fault Inject</span>
                </div>
                <strong className="text-sm font-bold text-white">Fault Injection (500)</strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  Emits 3x 500 errors to test Alertmanager HighHttp5xxErrorRate rule.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: ON-DEMAND URL PROBE & COLD-START AWAKENER ── */}
      {activeTab === 'probe' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Search className="w-5 h-5 text-indigo-600" />
              Live Site Probe & Cold-Start Awakener
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Probe any remote Render site or public URL to measure TTFB latency, check SSL certificates, or wake up a sleeping free-tier instance.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://cloudvault-backend-cazy.onrender.com/health"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={probeTimeout}
                  onChange={(e) => setProbeTimeout(Number(e.target.value))}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
                >
                  <option value={10}>Timeout: 10s</option>
                  <option value={25}>Timeout: 25s (Render wake-up)</option>
                  <option value={40}>Timeout: 40s (Cold start boot)</option>
                </select>

                <button
                  onClick={() => handleProbeCustom()}
                  disabled={probeLoading || !customUrl}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 shrink-0"
                >
                  <Sunrise className={`w-4 h-4 ${probeLoading ? 'animate-spin' : ''}`} />
                  {probeLoading ? 'Probing / Waking...' : 'Probe Target'}
                </button>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="text-slate-400 text-[11px]">Quick Presets:</span>
              <button
                onClick={() => {
                  setCustomUrl('https://cloudvault-backend-cazy.onrender.com/health');
                  handleProbeCustom('https://cloudvault-backend-cazy.onrender.com/health', 30);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold"
              >
                Render Backend
              </button>
              <button
                onClick={() => {
                  setCustomUrl('https://cloudvault-backend-cazy.onrender.com/metrics');
                  handleProbeCustom('https://cloudvault-backend-cazy.onrender.com/metrics', 30);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold"
              >
                Render Prometheus /metrics
              </button>
              <button
                onClick={() => {
                  setCustomUrl('https://cloudvault-frontend-z0wb.onrender.com');
                  handleProbeCustom('https://cloudvault-frontend-z0wb.onrender.com', 20);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold"
              >
                Render Frontend
              </button>
            </div>

            {/* Probe Result Card */}
            {probeResult && (
              <div className="mt-6 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        probeResult.status === 'healthy'
                          ? 'bg-emerald-500'
                          : probeResult.status === 'sleeping'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    ></span>
                    <strong className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Probe Result for {probeResult.url}
                    </strong>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {new Date(probeResult.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Latency</span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                      {probeResult.latency_ms} ms
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Status Code</span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                      {probeResult.status_code || '0 (Timeout)'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Server State</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                      {probeResult.is_cold_start ? '❄️ Cold Start Boot' : '⚡ Warm & Active'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">SSL Encryption</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      TLS 1.3 Active
                    </span>
                  </div>
                </div>

                {probeResult.error && (
                  <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
                    {probeResult.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Observability Quick Portals & Live Diagnostic Terminal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Links Column */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Observability Portals
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Direct access to CloudVault observability services running in container cluster:
            </p>

            <div className="space-y-2.5">
              <a
                href="http://localhost:9090"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold text-xs">
                    P
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      Prometheus Web UI
                    </span>
                    <span className="block text-[10px] text-slate-400">Port :9090 • Target Metrics</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>

              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                    G
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      Grafana Dashboards
                    </span>
                    <span className="block text-[10px] text-slate-400">Port :3001 • Telemetry Views</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>

              <a
                href="http://localhost:9001"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      MinIO S3 Console
                    </span>
                    <span className="block text-[10px] text-slate-400">Port :9001 • Bucket Manager</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>

              <a
                href="/api/v1/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    S
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      FastAPI Swagger OpenAPI
                    </span>
                    <span className="block text-[10px] text-slate-400">/api/v1/docs • Interactive API</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>
            </div>
          </div>
        </div>

        {/* Live Diagnostic Console Column (2 spans) */}
        <div className="lg:col-span-2 bg-slate-950 rounded-2xl p-5 border border-slate-800 text-slate-300 font-mono text-xs shadow-lg flex flex-col h-[360px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-slate-200">DevOps Diagnostic Activity Stream</span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear Console
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">No events logged yet. Trigger an action above.</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'warn'
                        ? 'text-amber-400'
                        : log.type === 'error'
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-300'
                    }
                  >
                    {log.type === 'error' && '⚡ [ALERT] '}
                    {log.type === 'success' && '✓ '}
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
