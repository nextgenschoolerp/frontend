import { useEffect, useState } from 'react';
import { Check, Mail, MessageSquare, MessageCircle, CreditCard, Send, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, Pill, Tabs } from './ui.jsx';
import { ApiErr } from './Admissions.jsx';
import { useApi } from '../api/useApi.js';
import { useAuth } from '../auth.jsx';
import { listIntegrations, integrationCatalog, saveIntegration, testIntegration, removeIntegration } from '../api/authService.js';
import { formatDateTime } from '../regional.js';

/* ---------- Settings → Integrations (authservice /api/v1/tenants/{tenantId}/integrations) ---------- */
// Super administrators and IT system administrators change these; principals can look.
export const INTEGRATION_EDITORS = ['SUPER_ADMIN', 'IT_SYSTEM_ADMIN'];

const ICONS = { EMAIL: Mail, EMAIL_ADMISSIONS: Mail, EMAIL_FINANCE: Mail, SMS: MessageSquare, WHATSAPP: MessageCircle, PAYMENT: CreditCard };
const BLURB = {
  EMAIL: 'The school’s main mailbox: circulars by email, and admissions or finance email when their own mailbox is not set up.',
  EMAIL_ADMISSIONS: 'Email copies of offer notifications and entrance reminders to guardians. Uses the school email when not set up.',
  EMAIL_FINANCE: 'Fee receipts by email, with the receipt PDF attached. Uses the school email when not set up.',
  SMS: 'Text messages to parents’ mobiles: absence alerts, fee reminders, OTPs.',
  WHATSAPP: 'Approved WhatsApp templates to parents through the Meta Cloud API.',
  PAYMENT: 'Online fee payment for parents. This integration is still pending and will be added in a later release.',
};
const STATUS = {
  NOT_CONFIGURED: ['', 'Not set up'], SAVED: ['amber', 'Saved · not tested'], VERIFIED: ['green', 'Verified'],
  FAILED: ['red', 'Test failed'], PENDING: ['purple', 'Coming soon'],
};
const TEST_HINT = { EMAIL: ['Email address', 'name@example.com', 'email'], EMAIL_ADMISSIONS: ['Email address', 'name@example.com', 'email'], EMAIL_FINANCE: ['Email address', 'name@example.com', 'email'], SMS: ['Mobile number', '98765 43210', 'tel'], WHATSAPP: ['WhatsApp number', '98765 43210', 'tel'] };
const SELECTS = { security: ['STARTTLS', 'SSL', 'NONE'] };
// a new SMTP setup starts on STARTTLS (port 587), the usual choice
const DEFAULTS = { SMTP: { security: 'STARTTLS' } };
const PLACEHOLDER = { username: 'office@yourschool.edu.in', port: '587', host: 'smtp.gmail.com', fromNumber: '+14155550100', accountSid: 'AC…', testTemplate: 'hello_world', templateLanguage: 'en_US' };

export function IntegrationsPanel() {
  const { user, hasRole } = useAuth();
  const list = useApi(() => listIntegrations(user.tenantId), [user.tenantId]);
  const catalog = useApi(() => integrationCatalog(user.tenantId), [user.tenantId]);
  const canEdit = hasRole(...INTEGRATION_EDITORS);
  // one tab per channel group (Email holds the school, Admissions and Finance mailboxes); kept in the address:
  // ?tab=integrations&channel=email&mailbox=email_finance
  const [params, setParams] = useSearchParams();
  const all = list.data || [];
  const groups = [...new Set(all.map((i) => i.group || i.channel))];
  const gIndex = Math.max(0, groups.findIndex((g) => g.toLowerCase() === params.get('channel')));
  const members = all.filter((i) => (i.group || i.channel) === groups[gIndex]);
  const mIndex = Math.max(0, members.findIndex((i) => i.channel.toLowerCase() === params.get('mailbox')));
  const open = members[mIndex];
  const go = (channel, mailbox) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('channel', channel.toLowerCase());
    if (mailbox) n.set('mailbox', mailbox.toLowerCase()); else n.delete('mailbox');
    return n;
  }, { replace: true });
  const TAB = { EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp', PAYMENT: 'Payment gateway' };

  if (list.error || catalog.error) return <Card><div className="cardhead"><h3>Integrations</h3></div><ApiErr error={list.error || catalog.error} /></Card>;
  if (!list.data || !catalog.data) return <Card><div className="cardhead"><h3>Integrations</h3></div><p className="xs muted" style={{ marginTop: 12 }}>Loading…</p></Card>;

  return (
    <div className="stack">
      <Card>
        <div className="cardhead"><h3>Integrations</h3><p>Connect the school’s own email, SMS and WhatsApp accounts. Admissions and Finance can each send from their own mailbox. Passwords, keys and tokens are stored encrypted and are never shown again.</p></div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          Use <b>Send test message</b> to check a connection. Circulars and emergency alerts from Communications are sent through the providers switched on here: WhatsApp first, then SMS if WhatsApp fails. For WhatsApp, add an approved circular template whose body uses {'{{1}}'} for the title and {'{{2}}'} for the message, because Meta accepts free text only from parents who wrote in the last 24 hours. An MSG91 DLT template can use ##title## and ##message##.
          {!canEdit && ' Only a super administrator or IT system administrator can change these settings.'}
        </p>
      </Card>
      <Card>
        <Tabs items={groups.map((g) => TAB[g] || g)} value={gIndex} onChange={(i) => go(groups[i])} />
        {members.length > 1 && (
          <div className="mailboxes" role="group" aria-label="Mailbox">
            {members.map((m, i) => {
              const [tone, text] = STATUS[m.status] || ['', m.status];
              return (
                <button type="button" key={m.channel} className={i === mIndex ? 'on' : ''} aria-pressed={i === mIndex} onClick={() => go(groups[gIndex], m.channel)}>
                  <b>{m.label}</b><Pill tone={tone}>{m.status === 'NOT_CONFIGURED' && m.channel !== 'EMAIL' ? 'Uses school email' : text}</Pill>
                </button>
              );
            })}
          </div>
        )}
        {open && (
          <IntegrationCard key={open.channel} item={open} spec={catalog.data[open.channel]} canEdit={canEdit}
            tenantId={user.tenantId} onChanged={list.reload} />
        )}
      </Card>
    </div>
  );
}

const draftOf = (item, spec) => {
  const provider = item.provider || Object.keys(spec.providers)[0];
  return { provider, enabled: item.provider ? item.enabled : true, settings: { ...(item.provider === provider ? item.settings : DEFAULTS[provider]) }, secret: '' };
};
// the password box is shown right after these fields (SMTP: right after SMTP USERNAME)
const SECRET_AFTER = { SMTP: 'username' };
// on-screen order where it differs from the catalog's (SMTP: FROM NAME sits where SECURITY was, SECURITY goes last)
const FIELD_ORDER = { SMTP: ['host', 'port', 'username', 'fromName', 'fromAddress', 'security'] };
const fieldsOf = (spec, provider) => {
  const p = spec.providers[provider];
  if (!p) return [];
  const all = [...Object.entries(p.required).map(([k, l]) => [k, l, true]), ...Object.entries(p.optional).map(([k, l]) => [k, l, false])];
  const order = FIELD_ORDER[provider];
  return order ? order.map((k) => all.find(([key]) => key === k)).filter(Boolean) : all;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clean = (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== '' && v != null));

function IntegrationCard({ item, spec, canEdit, tenantId, onChanged }) {
  const Icon = ICONS[item.channel] || Mail;
  const [tone, statusLabel] = STATUS[item.status] || ['', item.status];
  const base = draftOf(item, spec);
  const [draft, setDraft] = useState(base);
  const [busy, setBusy] = useState(null); // 'save' | 'test' | 'remove'
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [test, setTest] = useState(null);
  useEffect(() => { setDraft(draftOf(item, spec)); }, [item.updatedAt, item.provider]);

  const head = (
    <div className="inthead">
      <span className="intic"><Icon size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3>{item.label}</h3>
        <p className="xs muted">{BLURB[item.channel]}</p>
      </div>
      <Pill tone={tone}>{statusLabel}</Pill>
    </div>
  );

  if (!item.available) {
    return (
      <div className="intpane">
        {head}
        <p className="xs muted" style={{ marginTop: 12 }}>Planned providers: {Object.values(spec.providers).map((p) => p.label).join(', ')}.</p>
        <p className="xs muted" style={{ marginTop: 6 }}>Until then, fees are collected at the school counter and recorded in Fees.</p>
      </div>
    );
  }

  const providerSpec = spec.providers[draft.provider];
  const fields = fieldsOf(spec, draft.provider);
  const keepSecret = item.secretSaved && item.provider === draft.provider;
  const changed = !same({ ...draft, settings: clean(draft.settings) }, { ...base, settings: clean(base.settings) });
  const missing = fields.filter(([k, , req]) => req && !(draft.settings[k] || '').trim()).map(([, l]) => l);
  if (!keepSecret && !draft.secret.trim()) missing.push(providerSpec.secretLabel);
  const set = (k) => (e) => setDraft({ ...draft, settings: { ...draft.settings, [k]: e.target.value } });
  const id = (k) => `int-${item.channel}-${k}`;
  // the password is required, so it is always marked; a saved one is kept when the box is left blank
  const secretBox = (
    <div className="field box" key="secret"><label htmlFor={id('secret')}>{providerSpec.secretLabel.toUpperCase()} *</label>
      <input id={id('secret')} type="password" value={draft.secret} disabled={!canEdit} autoComplete="new-password"
        placeholder={keepSecret ? `Saved ••••${item.secretHint || ''}` : `Enter the ${providerSpec.secretLabel}`}
        onChange={(e) => setDraft({ ...draft, secret: e.target.value })} />
    </div>
  );

  const run = async (kind, fn) => {
    setBusy(kind); setError(null); setNote(null);
    try { await fn(); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  const save = () => run('save', async () => {
    await saveIntegration(tenantId, item.channel, { provider: draft.provider, enabled: draft.enabled, settings: clean(draft.settings), secret: draft.secret.trim() || null });
    setTest(null);
    setNote(`${item.label} settings saved. Send a test message to check them.`);
    onChanged();
  });
  const remove = () => {
    if (!window.confirm(`Remove the ${item.label} settings and the saved ${providerSpec.secretLabel}?`)) return;
    run('remove', async () => { await removeIntegration(tenantId, item.channel); setTest(null); setNote(`${item.label} settings removed.`); onChanged(); });
  };
  const sendTest = () => run('test', async () => {
    const r = await testIntegration(tenantId, item.channel, recipient.trim());
    setTest(r);
    onChanged();
  });
  const [tLabel, tPlaceholder, tType] = TEST_HINT[item.channel] || ['Recipient', '', 'text'];
  const result = test || (item.lastTestResult ? { ok: item.status === 'VERIFIED', message: item.lastTestResult, at: item.lastTestAt } : null);

  return (
    <div className="intpane">
      {head}
      <div className="fieldgrid" style={{ '--cols': 2, marginTop: 12 }}>
        {Object.keys(spec.providers).length > 1 && (
          <div className="field box"><label htmlFor={id('provider')}>PROVIDER</label>
            <select id={id('provider')} value={draft.provider} disabled={!canEdit}
              onChange={(e) => { const v = e.target.value; setDraft({ provider: v, enabled: draft.enabled, settings: item.provider === v ? { ...item.settings } : { ...DEFAULTS[v] }, secret: '' }); }}>
              {Object.entries(spec.providers).map(([code, p]) => <option key={code} value={code}>{p.label}</option>)}
            </select>
          </div>
        )}
        {fields.flatMap(([k, label, req]) => {
          const field = (
            <div className="field box" key={k}><label htmlFor={id(k)}>{label.toUpperCase()}{req ? ' *' : ''}</label>
              {SELECTS[k]
                ? <select id={id(k)} value={draft.settings[k] || ''} onChange={set(k)} disabled={!canEdit}>
                    <option value="">Choose…</option>{SELECTS[k].map((v) => <option key={v} value={v}>{v}</option>)}</select>
                : <input id={id(k)} value={draft.settings[k] || ''} onChange={set(k)} disabled={!canEdit} placeholder={PLACEHOLDER[k]} autoComplete="off" />}
            </div>
          );
          return k === SECRET_AFTER[draft.provider] ? [field, secretBox] : [field];
        })}
        {!SECRET_AFTER[draft.provider] && secretBox}
      </div>
      {canEdit && keepSecret && <p className="xs muted" style={{ marginTop: 8 }}>Leave the {providerSpec.secretLabel} blank to keep the saved one.</p>}
      <label className="xs" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <input type="checkbox" checked={draft.enabled} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        Enabled for this school
      </label>
      {canEdit && changed && missing.length > 0 && <p className="xs" style={{ color: 'var(--rd)', marginTop: 8 }}>Still needed: {missing.join(', ')}.</p>}
      {note && !changed && <div className="api-note ok" style={{ marginTop: 10 }}><Check size={14} style={{ flex: 'none' }} /><span>{note}</span></div>}
      {error && <ApiErr error={error} />}
      {canEdit && (
        <div className="pills" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!changed || !!busy} onClick={() => { setDraft(base); setError(null); }}>Discard</button>
          <button className="btn primary" disabled={!changed || !!busy || missing.length > 0} onClick={save}><Check size={14} />{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
          {item.provider && <button className="btn" style={{ marginLeft: 'auto' }} disabled={!!busy} onClick={remove} aria-label={`Remove ${item.label} settings`} title={`Remove ${item.label} settings`}><Trash2 size={14} />{busy === 'remove' ? 'Removing…' : 'Remove'}</button>}
        </div>
      )}

      {item.provider && (
        <div className="inttest">
          <div className="field box" style={{ flex: 1, minWidth: 0 }}><label htmlFor={id('to')}>SEND A TEST TO · {tLabel.toUpperCase()}</label>
            <input id={id('to')} type={tType} value={recipient} placeholder={tPlaceholder} disabled={!canEdit} onChange={(e) => setRecipient(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && recipient.trim() && !changed && !busy) sendTest(); }} />
          </div>
          <button className="btn" disabled={!canEdit || !recipient.trim() || changed || !!busy} onClick={sendTest}
            title={changed ? 'Save your changes first' : undefined}><Send size={14} />{busy === 'test' ? 'Sending…' : 'Send test message'}</button>
        </div>
      )}
      {item.provider && changed && canEdit && <p className="xs muted" style={{ marginTop: 6 }}>Save your changes before sending a test.</p>}
      {result && (
        <div className={`api-note ${result.ok ? 'ok' : 'err'}`} role="status" style={{ marginTop: 10 }}>
          <span>{result.message}{result.at && <span className="muted"> · last test {formatDateTime(result.at)}</span>}</span>
        </div>
      )}
      {item.updatedBy && <p className="xs muted" style={{ marginTop: 8 }}>Last changed by {item.updatedBy}{item.updatedAt ? ` · ${formatDateTime(item.updatedAt)}` : ''}</p>}
    </div>
  );
}
