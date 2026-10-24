import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  School, Download, UploadCloud, FileSpreadsheet, CheckCircle2, 
  AlertCircle, ArrowRight, Copy, Check, Eye, EyeOff, LoaderCircle, Sparkles, Building2, MapPin, UserCheck 
} from 'lucide-react';
import * as authApi from '../api/authService.js';
import AuthShell, { AuthAlert, PasswordInput, PASSWORD_HINT } from '../components/AuthShell.jsx';

/** Generic product name for the first-time setup screen: no school is known yet. */
const SETUP_BRAND = { name: 'School ERP', tag: 'SETUP', foot: '© 2026 School ERP' };

export default function Setup() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState('excel'); // 'excel' | 'form'
  const [file, setFile] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields for direct entry
  const [formData, setFormData] = useState({
    societyName: 'Delhi Public School Educational Society',
    societyCode: 'DPS-HQ',
    domainName: 'dps.edu.in',
    curriculumBoard: 'CBSE',
    contactEmail: 'admin@dps.edu.in',
    contactPhone: '+91-11-23456789',
    branchName: 'DPS North Delhi Campus',
    branchCode: 'DPS-DELHI-NORTH',
    city: 'New Delhi',
    state: 'Delhi',
    address: 'Sector 14, Rohini',
    pincode: '110085',
    adminUsername: 'itadmin',
    adminFirstName: 'Rajesh',
    adminLastName: 'Sharma',
    adminEmail: 'rajesh.it@dps.edu.in',
    adminPhone: '+91-9876543210',
    temporaryPassword: 'Welcome@2026!'
  });

  // Checked once per page load: StrictMode runs effects twice and a changed `navigate` would re-run them
  const statusChecked = useRef(false);
  useEffect(() => {
    document.title = 'School ERP – Initial System Setup';
    if (statusChecked.current) return;
    statusChecked.current = true;
    // Check if system is already initialized
    authApi.getBootstrapStatus().then(status => {
      if (!status.bootstrapRequired && status.initialized) {
        // System already has tenants, redirect to login
        navigate('/login', { replace: true });
      }
    }).catch(() => {
      // Continue allowing setup page to render
    });
  }, [navigate]);

  async function handleDownloadTemplate() {
    setDownloading(true);
    setError('');
    try {
      const blob = await authApi.downloadBootstrapTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'School_ERP_Initial_Setup_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download Excel template. ' + (err.detail || err.message));
    } finally {
      setDownloading(false);
    }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (selected.name.endsWith('.xlsx') || selected.name.endsWith('.csv') || selected.name.endsWith('.xls')) {
        setFile(selected);
        setError('');
      } else {
        setError('Please upload a valid Excel spreadsheet (.xlsx).');
      }
    }
  }

  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  }

  async function handleExcelSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Please choose or drag-and-drop the filled Excel file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await authApi.bootstrapUpload(file);
      setSuccessResult(result);
    } catch (err) {
      setError(err.detail || err.message || 'Failed to process Excel onboarding.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!formData.societyName || !formData.societyCode || !formData.branchName || !formData.branchCode || !formData.adminUsername || !formData.adminEmail) {
      setError('Please fill in all mandatory fields marked with an asterisk.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await authApi.bootstrapJson(formData);
      setSuccessResult(result);
    } catch (err) {
      setError(err.detail || err.message || 'Failed to complete system bootstrap.');
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Success Confirmation Screen
  if (successResult) {
    return (
      <AuthShell brand={SETUP_BRAND}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={18} /> System Initialized Successfully
            </div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem' }}>Welcome to School ERP</h1>
            <p style={{ color: 'var(--muted, #64748b)', margin: 0 }}>
              The root organization <b>{successResult.societyName}</b> and initial campus <b>{successResult.branchName}</b> have been established.
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
              IT Administrator Credentials
            </span>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Username:</span>
              <code style={{ background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                {successResult.username}
              </code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Temporary Password:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <code style={{ background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                  {showPassword ? successResult.temporaryPassword : '••••••••••••'}
                </code>
                <button type="button" onClick={() => setShowPassword(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }} title={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button type="button" onClick={() => copyToClipboard(successResult.temporaryPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : '#2563eb', padding: '2px' }} title="Copy password">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem', display: 'flex', gap: '0.65rem' }}>
            <AlertCircle size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.825rem', color: '#1e40af', lineHeight: '1.4' }}>
              <b>Mandatory First-Login Password Change:</b><br />
              When you sign in for the first time, you will immediately be prompted to replace this temporary password with your permanent administrator password.
            </div>
          </div>

          <button 
            type="button" 
            className="btn primary login-submit" 
            onClick={() => navigate('/login', { state: { prefilledUsername: successResult.username } })}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Proceed to IT Admin Sign In <ArrowRight size={16} />
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell brand={SETUP_BRAND}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Sparkles size={14} /> Zero-State Onboarding
          </div>
          <h1 style={{ margin: '0.2rem 0 0.4rem 0', fontSize: '1.6rem' }}>Initial System Setup</h1>
          <p style={{ color: 'var(--muted, #64748b)', margin: 0, fontSize: '0.9rem' }}>
            No tenant or administrator accounts found. Set up your organization to get started.
          </p>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        {/* Mode Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
          <button 
            type="button" 
            onClick={() => { setMode('excel'); setError(''); }}
            style={{
              border: 'none', 
              padding: '0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.85rem', 
              fontWeight: mode === 'excel' ? '600' : '400',
              background: mode === 'excel' ? '#ffffff' : 'transparent',
              color: mode === 'excel' ? '#0f172a' : '#64748b',
              boxShadow: mode === 'excel' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <FileSpreadsheet size={15} /> Upload Excel Sheet
          </button>
          <button 
            type="button" 
            onClick={() => { setMode('form'); setError(''); }}
            style={{
              border: 'none', 
              padding: '0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.85rem', 
              fontWeight: mode === 'form' ? '600' : '400',
              background: mode === 'form' ? '#ffffff' : 'transparent',
              color: mode === 'form' ? '#0f172a' : '#64748b',
              boxShadow: mode === 'form' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <Building2 size={15} /> Quick Setup Form
          </button>
        </div>

        {/* Tab 1: Excel Upload Workflow */}
        {mode === 'excel' && (
          <form onSubmit={handleExcelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>Step 1: Download Onboarding Template</div>
                  <div style={{ fontSize: '0.785rem', color: '#64748b' }}>Includes sheets for Society, Campus, and IT Admin.</div>
                </div>
                <button 
                  type="button" 
                  className="btn secondary" 
                  onClick={handleDownloadTemplate} 
                  disabled={downloading}
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {downloading ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}
                  Download Template (.xlsx)
                </button>
              </div>
            </div>

            <div 
              onDragOver={e => e.preventDefault()} 
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed ' + (file ? '#16a34a' : '#94a3b8'),
                borderRadius: '8px',
                padding: '1.5rem 1rem',
                textAlign: 'center',
                background: file ? '#f0fdf4' : '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".xlsx,.csv,.xls" 
                style={{ display: 'none' }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                {file ? (
                  <>
                    <CheckCircle2 size={32} color="#16a34a" />
                    <span style={{ fontWeight: '600', color: '#15803d', fontSize: '0.9rem' }}>{file.name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#65a30d' }}>{(file.size / 1024).toFixed(1)} KB · Ready to bootstrap</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={32} color="#64748b" />
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1e293b' }}>
                      Drag and drop your filled Excel file here
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Supports .xlsx format (or click to browse)
                    </span>
                  </>
                )}
              </div>
            </div>

            <button type="submit" className="btn primary login-submit" disabled={busy || !file}>
              {busy ? <><LoaderCircle size={15} className="spin" /> Bootstrapping system…</> : 'Upload & Provision School System'}
            </button>
          </form>
        )}

        {/* Tab 2: Direct Interactive Form */}
        {mode === 'form' && (
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Building2 size={14} /> 1. Educational Society / Group
            </div>
            
            <label className="lfield">
              <span>Society / Group Name *</span>
              <input 
                type="text" 
                required 
                placeholder="e.g. Delhi Public School Society"
                value={formData.societyName} 
                onChange={e => setFormData({ ...formData, societyName: e.target.value })} 
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label className="lfield">
                <span>Society Code *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. DPS-HQ"
                  value={formData.societyCode} 
                  onChange={e => setFormData({ ...formData, societyCode: e.target.value })} 
                />
              </label>
              <label className="lfield">
                <span>Curriculum Board *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="CBSE, ICSE, IB"
                  value={formData.curriculumBoard} 
                  onChange={e => setFormData({ ...formData, curriculumBoard: e.target.value })} 
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label className="lfield">
                <span>Contact Email *</span>
                <input 
                  type="email" 
                  required 
                  placeholder="admin@dps.edu.in"
                  value={formData.contactEmail} 
                  onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} 
                />
              </label>
              <label className="lfield">
                <span>Contact Phone *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="+91-11-23456789"
                  value={formData.contactPhone} 
                  onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} 
                />
              </label>
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem' }}>
              <MapPin size={14} /> 2. Primary Campus / Branch
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
              <label className="lfield">
                <span>Branch Name *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="DPS North Campus"
                  value={formData.branchName} 
                  onChange={e => setFormData({ ...formData, branchName: e.target.value })} 
                />
              </label>
              <label className="lfield">
                <span>Branch Code *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="DPS-DELHI-NORTH"
                  value={formData.branchCode} 
                  onChange={e => setFormData({ ...formData, branchCode: e.target.value })} 
                />
              </label>
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem' }}>
              <UserCheck size={14} /> 3. IT Administrator Account
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label className="lfield">
                <span>First Name *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="Rajesh"
                  value={formData.adminFirstName} 
                  onChange={e => setFormData({ ...formData, adminFirstName: e.target.value })} 
                />
              </label>
              <label className="lfield">
                <span>Last Name *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="Sharma"
                  value={formData.adminLastName} 
                  onChange={e => setFormData({ ...formData, adminLastName: e.target.value })} 
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label className="lfield">
                <span>IT Admin Username *</span>
                <input 
                  type="text" 
                  required 
                  placeholder="itadmin"
                  value={formData.adminUsername} 
                  onChange={e => setFormData({ ...formData, adminUsername: e.target.value })} 
                />
              </label>
              <label className="lfield">
                <span>IT Admin Email *</span>
                <input 
                  type="email" 
                  required 
                  placeholder="rajesh.it@dps.edu.in"
                  value={formData.adminEmail} 
                  onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} 
                />
              </label>
            </div>

            <label className="lfield">
              <span>Initial Temporary Password</span>
              <input 
                type="text" 
                placeholder="Leave blank to auto-generate (e.g. Welcome@2026!)"
                value={formData.temporaryPassword} 
                onChange={e => setFormData({ ...formData, temporaryPassword: e.target.value })} 
              />
            </label>

            <button type="submit" className="btn primary login-submit" disabled={busy} style={{ marginTop: '0.5rem' }}>
              {busy ? <><LoaderCircle size={15} className="spin" /> Provisioning System…</> : 'Initialize School ERP System'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
          Already have an existing school account? <Link to="/login" style={{ color: '#2563eb', fontWeight: '500' }}>Sign In here</Link>
        </div>
      </div>
    </AuthShell>
  );
}
