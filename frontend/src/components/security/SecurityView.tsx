import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Globe,
  Radio,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  XCircle,
  Loader2,
  Sliders,
  Server,
  Zap,
} from 'lucide-react';
import {
  securityService,
  SecurityOverview,
  FirewallRule,
  SecurityEvent,
  IntegrityResult,
} from '../../services/security';
import { fileService } from '../../services/files';
import { FileItem } from '../../types';

export const SecurityView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'waf' | 'policies' | 'events' | 'integrity'>('waf');
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // New Rule Form Modal state
  const [newRuleModalOpen, setNewRuleModalOpen] = useState(false);
  const [ipCidr, setIpCidr] = useState('');
  const [ruleAction, setRuleAction] = useState<'ALLOW' | 'BLOCK'>('BLOCK');
  const [ruleDesc, setRuleDesc] = useState('');
  const [submittingRule, setSubmittingRule] = useState(false);

  // Policy toggles
  const [rateLimiter, setRateLimiter] = useState(true);
  const [geoBlocking, setGeoBlocking] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  // Integrity Inspector state
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, r, ev, fl] = await Promise.all([
        securityService.getOverview(),
        securityService.listRules(),
        securityService.listEvents(),
        fileService.listFiles(),
      ]);
      setOverview(ov);
      setRules(r);
      setEvents(ev);
      setRateLimiter(ov.rate_limiter_active);
      setGeoBlocking(ov.geo_fencing_active);
      setFilesList(fl);
      if (fl.length > 0 && !selectedFileId) {
        setSelectedFileId(fl[0].id);
      }
    } catch (err) {
      console.error('Failed to load security telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipCidr.trim()) return;
    setSubmittingRule(true);
    try {
      const created = await securityService.createRule({
        ip_or_cidr: ipCidr.trim(),
        action: ruleAction,
        description: ruleDesc.trim() || 'Manual Firewall Rule',
      });
      setRules((prev) => [created, ...prev]);
      setIpCidr('');
      setRuleDesc('');
      setNewRuleModalOpen(false);
      loadData();
    } catch (err) {
      alert('Failed to create rule. Verify IP/CIDR syntax.');
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await securityService.deleteRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      loadData();
    } catch (err) {
      alert('Failed to delete rule.');
    }
  };

  const handleSavePolicies = async () => {
    setPolicySaving(true);
    try {
      const res = await securityService.updateConfig({
        rate_limiter_enabled: rateLimiter,
        geo_blocking_enabled: geoBlocking,
      });
      setRateLimiter(res.rate_limiter_enabled);
      setGeoBlocking(res.geo_blocking_enabled);
      loadData();
    } catch (err) {
      alert('Failed to update policies.');
    } finally {
      setPolicySaving(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!selectedFileId) return;
    setVerifying(true);
    setIntegrityResult(null);
    try {
      const result = await securityService.verifyFileIntegrity(selectedFileId);
      setIntegrityResult(result);
    } catch (err) {
      alert('Integrity check failed.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* ── Header & Status Card ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              EDGE WAF & CLOUD SECURITY ACTIVE
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
              CloudVault Security & Networking Center
            </h2>
            <p className="text-slate-300 text-sm max-w-xl">
              Real-time Web Application Firewall (WAF), IP subnet access controls, anti-DDoS token-bucket rate limiting, and SHA-256 cryptographic storage integrity checks.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shrink-0">
            <div>
              <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Blocked Threats</p>
              <p className="text-3xl font-black text-white">{overview?.total_blocked_requests ?? 0}</p>
            </div>
            <div className="h-10 w-[1px] bg-white/20 mx-1" />
            <div>
              <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Your Client IP</p>
              <p className="text-sm font-mono font-bold text-emerald-300">{overview?.current_client_ip || '127.0.0.1'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'waf', label: 'IP Access Rules (WAF)', icon: Shield },
          { id: 'policies', label: 'Cloud Shield Policies', icon: Sliders },
          { id: 'events', label: 'Intrusion & Security Events', icon: Radio },
          { id: 'integrity', label: 'SHA-256 Integrity Inspector', icon: FileCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}

        <button
          onClick={loadData}
          title="Refresh Telemetry"
          className="ml-auto p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── TAB 1: IP Access Rules (WAF) ── */}
      {activeTab === 'waf' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Configured IP & CIDR Rules</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grant or deny access based on explicit IP addresses or entire CIDR subnets.
              </p>
            </div>
            <button
              onClick={() => setNewRuleModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Firewall Rule
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">IP / CIDR Block</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                        No active firewall rules configured. All traffic allowed.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {rule.ip_or_cidr}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                              rule.action === 'BLOCK'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {rule.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                          {rule.description}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Revoke Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Cloud Shield Policies ── */}
      {activeTab === 'policies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rate Limiting */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Anti-DDoS Token Bucket Rate Limiting</h4>
                <p className="text-xs text-slate-400">Protects API endpoints against high-volume brute-force attacks.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Enforces a leaky-bucket algorithm per client IP address. Allows burst traffic up to 100 requests with a 5 req/sec steady recharge rate. Excess requests receive HTTP 429.
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Status: {rateLimiter ? 'Enforcing (Active)' : 'Disabled'}
              </span>
              <button
                onClick={() => setRateLimiter(!rateLimiter)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rateLimiter ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rateLimiter ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Geo-Fencing */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Regional Geo-Fencing</h4>
                <p className="text-xs text-slate-400">Restrict access to specific ISO regional countries.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Simulates Cloudflare WAF edge geo-filtering. Currently allows requests originating from:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(overview?.allowed_countries || ['US', 'IN', 'GB', 'DE', 'CA']).map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                  {c}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Status: {geoBlocking ? 'Geo-Lock Active' : 'Global Access'}
              </span>
              <button
                onClick={() => setGeoBlocking(!geoBlocking)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  geoBlocking ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    geoBlocking ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={handleSavePolicies}
              disabled={policySaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
            >
              {policySaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Protection Policies
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: Intrusion & Security Events ── */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Live Security Event Stream</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audit feed of blocked requests, rate-limit triggers, and cryptographic verification checks.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {events.length} events logged
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Client IP</th>
                    <th className="px-5 py-3">Security Action</th>
                    <th className="px-5 py-3">Trigger Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                        No security threats detected in recent window.
                      </td>
                    </tr>
                  ) : (
                    events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 font-medium">
                        <td className="px-5 py-3 text-slate-400 font-mono text-[11px]">
                          {new Date(evt.timestamp * 1000).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {evt.client_ip}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              evt.action_taken.includes('BLOCK') || evt.action_taken.includes('TAMPER')
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : evt.action_taken.includes('RATE')
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {evt.action_taken}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {evt.reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: SHA-256 Integrity Inspector ── */}
      {activeTab === 'integrity' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-600" />
              Cryptographic Object Integrity & Antivirus Verification
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Validates that the file binary stored in your S3/storage backend has not been tampered with or corrupted since original upload.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="flex-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {filesList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({(f.size_bytes / 1024).toFixed(1)} KB)
                </option>
              ))}
            </select>

            <button
              onClick={handleVerifyIntegrity}
              disabled={verifying || !selectedFileId}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Run Integrity Check
            </button>
          </div>

          {integrityResult && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                {integrityResult.integrity_status === 'MATCHED_AND_VERIFIED' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-500" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {integrityResult.integrity_status === 'MATCHED_AND_VERIFIED'
                      ? 'Integrity Verified — 100% Match'
                      : 'Integrity Verification Failed'}
                  </h4>
                  <p className="text-xs text-slate-400">Target File: {integrityResult.file_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-400 text-[10px] font-sans font-bold uppercase">Computed SHA-256 Digest</p>
                  <p className="text-indigo-600 dark:text-indigo-400 break-all mt-1">{integrityResult.computed_checksum}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-400 text-[10px] font-sans font-bold uppercase">Encryption Standard</p>
                  <p className="text-slate-800 dark:text-slate-200 font-sans font-bold mt-1">{integrityResult.encryption_at_rest}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add Rule Modal ── */}
      {newRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Add Network Firewall Rule
            </h3>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">IP Address or CIDR Subnet</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.1.100 or 10.0.0.0/16"
                  value={ipCidr}
                  onChange={(e) => setIpCidr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Policy Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleAction('BLOCK')}
                    className={`py-2 rounded-xl font-bold transition-all ${
                      ruleAction === 'BLOCK'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    BLOCK (Deny)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleAction('ALLOW')}
                    className={`py-2 rounded-xl font-bold transition-all ${
                      ruleAction === 'ALLOW'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    ALLOW (Permit)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Description / Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Known Tor Exit Node or Office Static IP"
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setNewRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRule}
                  className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm"
                >
                  {submittingRule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Deploy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
