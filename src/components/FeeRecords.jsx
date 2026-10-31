import { useState } from 'react';
import { LoaderCircle, Plus, Download, Send, Ban } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as fin from '../api/financeService.js';
import { DataTable, Pill, Card, SectionHead, KV, downloadFile } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

const { ROLES, money, FEE_STATUS, LINE_STATUS, PAYMENT_MODES } = fin;
export const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
export const fmtDate = (d) => formatDate(d);
const tone = (map, code) => map[code] || [code, ''];
export const feePill = (status) => { const [t, c] = tone(FEE_STATUS, status); return <Pill tone={c}>{t}</Pill>; };
export const linePill = (status) => { const [t, c] = tone(LINE_STATUS, status); return <Pill tone={c}>{t}</Pill>; };
export const receiptPill = (r) => (r.receiptStatus === 'BOUNCED' ? <Pill tone="amber">Cheque bounced</Pill> : <Pill tone="green">Issued</Pill>);

/** Saves the receipt PDF: GET /api/v1/finance/receipts/{id}/pdf (US-04004). */
export async function downloadReceipt(receipt) {
  downloadFile(`${receipt.receiptNumber}.pdf`, await fin.receiptPdf(receipt), 'application/pdf');
}

/** A student's fee account (404 = no fees posted yet, shown as a note rather than an error). */
export function useFeeAccount(studentId) {
  const { hasRole } = useAuth();
  const allowed = hasRole(...ROLES.studentFees);
  const res = useApi(() => fin.getFeeAccount(studentId), [studentId], allowed && !!studentId);
  return { ...res, allowed, none: res.error?.status === 404 };
}

/* ---------- forms ---------- */

const ModalForm = ({ title, sub, onClose, onSubmit, busy, error, submitLabel, children }) => (
  <Modal title={title} sub={sub} onClose={onClose}
    footer={<><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="fee-form" disabled={busy}>{busy && <LoaderCircle size={14} className="spin" />}{submitLabel}</button></>}>
    <form id="fee-form" className="fieldlist" noValidate onSubmit={onSubmit}>
      {children}
      {error && <ApiErr error={error} />}
    </form>
  </Modal>
);
const In = ({ label: l, name, required, ...rest }) => (
  <div className="field box"><label htmlFor={`f-${name}`}>{l.toUpperCase()}{required ? ' *' : ''}</label><input id={`f-${name}`} name={name} {...rest} /></div>
);
const Sel = ({ label: l, name, options, value, onChange }) => (
  <div className="field box"><label htmlFor={`f-${name}`}>{l.toUpperCase()} *</label>
    <select id={`f-${name}`} name={name} defaultValue={value} onChange={onChange}>
      {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select></div>
);
const fail = (detail) => Object.assign(new Error(detail), { detail });

function useSubmit(fn, onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setError(null);
    try { onDone(await fn(values)); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return { busy, error, submit };
}

/** Record payment: POST /api/v1/finance/receipts/counter (US-04013). `account` needs studentId, studentName, outstanding. */
export function RecordPaymentModal({ account, onClose, onSaved }) {
  const [mode, setMode] = useState('CASH');
  const [done, setDone] = useState(null);
  const { busy, error, submit } = useSubmit(async (v) => {
    const amount = Number(v.amount);
    if (!(amount > 0)) throw fail('Enter the amount received.');
    if (amount > Number(account.outstanding)) throw fail(`The outstanding balance is ${money(account.outstanding)}; the counter does not take advance payments.`);
    return fin.collectAtCounter({
      studentId: account.studentId, amount, paymentMode: v.paymentMode, payerName: v.payerName?.trim() || undefined,
      remarks: v.remarks?.trim() || undefined,
      ...(v.paymentMode !== 'CASH' ? { instrumentNumber: v.instrumentNumber?.trim(), bankName: v.bankName?.trim(), instrumentDate: v.instrumentDate || undefined } : {}),
    });
  }, (receipt) => { setDone(receipt); onSaved?.(receipt); });

  if (done) {
    return (
      <Modal title="Payment recorded" sub={`${account.studentName} · ${done.receiptNumber}`} onClose={onClose}
        footer={<><button className="btn" onClick={() => downloadReceipt(done)}><Download size={14} />Download receipt</button>
          <button className="btn primary" onClick={onClose}>Done</button></>}>
        <KV rows={[['Receipt', done.receiptNumber], ['Amount', money(done.totalAmountPaid)], ['Mode', PAYMENT_MODES[done.paymentMode]],
          ['Paid towards', done.allocations.map((a) => `${a.headName} · ${a.installmentLabel} (${money(a.amount)})`).join(', ')]]} />
      </Modal>
    );
  }
  return (
    <ModalForm title="Record payment" sub={`${account.studentName} · outstanding ${money(account.outstanding)}`} onClose={onClose}
      onSubmit={submit} busy={busy} error={error} submitLabel="Record payment">
      <In label="Amount (₹)" name="amount" type="number" min="1" step="1" required defaultValue={account.overdueAmount > 0 ? Number(account.overdueAmount) : ''} />
      <Sel label="Payment mode" name="paymentMode" value="CASH" onChange={(e) => setMode(e.target.value)}
        options={[['CASH', 'Cash'], ['CHEQUE', 'Cheque'], ['DEMAND_DRAFT', 'Demand draft']]} />
      {mode !== 'CASH' && (<>
        <In label={mode === 'CHEQUE' ? 'Cheque number' : 'DD number'} name="instrumentNumber" required placeholder="6 digits" maxLength={6} />
        <In label="Bank" name="bankName" required placeholder="e.g. HDFC Bank" />
        <In label="Instrument date" name="instrumentDate" type="date" />
      </>)}
      <In label="Received from" name="payerName" placeholder="Parent or guardian name" />
      <In label="Remarks" name="remarks" />
      <p className="xs muted">The payment clears the oldest dues first. A receipt number is issued automatically.</p>
    </ModalForm>
  );
}

/** Send receipt: POST /api/v1/finance/receipts/{id}/dispatch (US-04004). */
/** The saved contact for a channel: e-mail for EMAIL, otherwise the mobile number (SMS and WhatsApp), from the primary guardian first. */
const savedContact = (guardians, channel) => {
  const list = [...(guardians || [])].sort((a, b) => Number(!!b.primaryContact) - Number(!!a.primaryContact));
  const field = channel === 'EMAIL' ? 'email' : 'mobileNumber';
  return list.find((g) => g[field])?.[field] || '';
};

function SendReceiptModal({ receipt, contacts, onClose }) {
  const [channel, setChannel] = useState('WHATSAPP');
  const [done, setDone] = useState(null);
  const { busy, error, submit } = useSubmit((v) => fin.dispatchReceipt(receipt.receiptId, { channel: v.channel, recipient: v.recipient.trim() }), setDone);
  if (done) {
    const by = done.channel === 'EMAIL' ? 'e-mail' : done.channel === 'SMS' ? 'SMS' : 'WhatsApp';
    // SENT / FAILED come back at once; SMS has no sender yet and stays QUEUED
    const title = done.status === 'SENT' ? 'Receipt sent' : done.status === 'FAILED' ? 'Receipt not sent' : 'Receipt queued';
    return (
      <Modal title={title} sub={receipt.receiptNumber} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
        <p className="body-s">{receipt.receiptNumber} {done.status === 'SENT' ? 'was sent' : done.status === 'FAILED' ? 'could not be sent' : 'will be sent'} by {by} to {done.recipient}.</p>
        {done.statusDetail && <div className={done.status === 'SENT' ? 'api-note ok' : 'api-note err'} style={{ marginTop: 10 }}><span>{done.statusDetail}</span></div>}
        {done.status === 'QUEUED' && <ApiNote>SMS is not connected yet; the request stays queued.</ApiNote>}
      </Modal>
    );
  }
  return (
    <ModalForm title="Send receipt" sub={`${receipt.receiptNumber} · ${receipt.studentName}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Send">
      <Sel label="Channel" name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}
        options={[['WHATSAPP', 'WhatsApp'], ['SMS', 'SMS'], ['EMAIL', 'E-mail']]} />
      {/* Keyed by channel so the field refills with that channel's saved contact when the channel changes */}
      <In key={channel} label={channel === 'EMAIL' ? 'E-mail address' : 'Mobile number'} name="recipient" required
        defaultValue={savedContact(contacts, channel)}
        placeholder={channel === 'EMAIL' ? 'parent@example.com' : '+91 98111 00114'} />
    </ModalForm>
  );
}

/** Mark cheque bounced: PATCH /api/v1/finance/receipts/{id}/bounce (US-04019). */
function BounceModal({ receipt, onClose, onSaved }) {
  const { busy, error, submit } = useSubmit(async (v) => {
    if (!v.reason.trim()) throw fail('Enter the reason the bank gave.');
    return fin.bounceReceipt(receipt.receiptId, { reason: v.reason.trim(), bounceCharge: v.bounceCharge ? Number(v.bounceCharge) : undefined });
  }, () => { onSaved?.(); onClose(); });
  return (
    <ModalForm title="Mark cheque as bounced" sub={`${receipt.receiptNumber} · ${PAYMENT_MODES[receipt.paymentMode]} ${receipt.instrumentNumber || ''} · ${money(receipt.totalAmountPaid)}`}
      onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Mark as bounced">
      <In label="Reason" name="reason" required placeholder="e.g. Returned unpaid: insufficient funds" />
      <In label="Bank charge (₹)" name="bounceCharge" type="number" min="0" step="1" placeholder="0" />
      <p className="xs muted">The receipt becomes void and its {money(receipt.totalAmountPaid)} goes back on the student's dues, with the bank charge added.</p>
    </ModalForm>
  );
}

/** Receipt row actions: PDF for everyone who can see it; Send and Bounce by role. */
export function ReceiptActions({ receipt, onChanged, contacts }) {
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState(null);
  const issued = receipt.receiptStatus === 'ISSUED';
  const pdf = async () => { setErr(null); try { await downloadReceipt(receipt); } catch (e) { setErr(e.detail); } };
  return (
    <span className="act" style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
      <button type="button" className="link" onClick={pdf} title="Download the receipt PDF"><Download size={13} />PDF</button>
      {issued && hasRole(...ROLES.dispatch) && <button type="button" className="link" onClick={() => setOpen('send')}><Send size={13} />Send</button>}
      {issued && ['CHEQUE', 'DEMAND_DRAFT'].includes(receipt.paymentMode) && hasRole(...ROLES.bounce)
        && <button type="button" className="link" onClick={() => setOpen('bounce')}><Ban size={13} />Bounced</button>}
      {err && <small className="xs" style={{ color: "var(--red, #b42318)" }}>{err}</small>}
      {open === 'send' && <SendReceiptModal receipt={receipt} contacts={contacts} onClose={() => setOpen(null)} />}
      {open === 'bounce' && <BounceModal receipt={receipt} onClose={() => setOpen(null)} onSaved={onChanged} />}
    </span>
  );
}

/* ---------- student profile ---------- */

/** Profile · Fee status card: GET /api/v1/finance/students/{id}/fee-account. */
export function FeeStatusCard({ student, fees, onOpenTab }) {
  const { hasRole } = useAuth();
  const [paying, setPaying] = useState(false);
  const a = fees.data;
  const name = `${student.firstName} ${student.lastName}`;
  return (
    <Card>
      <SectionHead title="Fee status" sub={a ? `${a.academicYear} · ${a.gradeName}${a.sectionName ? `-${a.sectionName}` : ''}` : 'Academic year to date'} />
      {!fees.allowed ? <div style={{ marginTop: 14 }}><ApiNote>Fee accounts are visible to finance staff, principals, registrars and the student's parent.</ApiNote></div>
        : fees.loading ? <div style={{ marginTop: 14 }}><Loading /></div>
          : fees.none ? <div style={{ marginTop: 14 }}><ApiNote>No fees have been posted for this student yet.</ApiNote>
              {hasRole(...ROLES.configure) && <RaiseFees student={student} onDone={fees.reload} />}</div>
            : fees.error ? <div style={{ marginTop: 14 }}><ApiErr error={fees.error} /></div> : (<>
              <div className="bignum" style={{ marginTop: 18 }}>{money(a.outstanding)}</div>
              <p className="xs muted" style={{ margin: '14px 0 12px' }}>Outstanding balance{a.overdueAmount > 0 ? ` · ${money(a.overdueAmount)} overdue` : ''}</p>
              <div className="pills">{feePill(a.feeStatus)}{a.totalLateFine > 0 && <Pill tone="amber">Late fee {money(a.totalLateFine)}</Pill>}</div>
              <p className="xs muted" style={{ marginTop: 12 }}>
                {money(a.totalPaid)} paid of {money(Number(a.totalDemanded) + Number(a.totalLateFine) - Number(a.totalConcession))}
                {a.nextDueDate ? ` · next ${money(a.nextDueAmount)} due ${fmtDate(a.nextDueDate)}` : ''}
              </p>
              <div className="pills" style={{ marginTop: 14 }}>
                {onOpenTab && <button className="btn" onClick={onOpenTab}>View account</button>}
                {hasRole(...ROLES.collect) && a.outstanding > 0 && <button className="btn primary" onClick={() => setPaying(true)}><Plus size={14} />Record payment</button>}
              </div>
            </>)}
      {paying && <RecordPaymentModal account={{ ...a, studentName: name }} onClose={() => setPaying(false)} onSaved={fees.reload} />}
    </Card>
  );
}

/**
 * Raise fees for a newly enrolled student: posts the class's fee schedule as demands
 * (POST /api/v1/finance/fee-schedules/{id}/demands, US-04000). Posting skips installments already demanded.
 */
function RaiseFees({ student, onDone }) {
  const schedules = useApi(() => fin.listSchedules(student.branchId), [student.branchId], !!student.branchId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const schedule = (schedules.data || []).filter((s) => s.gradeName === student.gradeName)
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear))[0];
  if (schedules.loading && !schedules.data) return <Loading />;
  if (!schedule) return <p className="xs muted" style={{ marginTop: 10 }}>{student.gradeName ? `There is no fee schedule for ${student.gradeName} yet.` : 'Place the student in a class first.'}</p>;
  const post = async () => {
    setBusy(true); setError(null);
    try {
      await fin.postDemands(schedule.scheduleId, [{ studentId: student.studentId, studentUid: student.studentUid,
        studentName: `${student.firstName} ${student.lastName}`, sectionName: student.sectionName || undefined }]);
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <button className="btn primary" onClick={post} disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}
        Raise {schedule.academicYear} fees · {money(schedule.totalAmount)}</button>
      <p className="xs muted" style={{ marginTop: 8 }}>{schedule.gradeName} fee schedule, {schedule.lines?.length || 0} installments</p>
      {error && <ApiErr error={error} />}
    </div>
  );
}

/** Profile · Fees & payments tab: installments and receipts. */
export function FeeAccountDetail({ fees, guardians }) {
  if (!fees.allowed || fees.loading || fees.error) return null;
  const a = fees.data;
  return (<>
    <Card>
      <SectionHead title="Installments" sub={`${a.ledger.length} fee demands · ${a.academicYear}`} />
      <div style={{ marginTop: 14 }}>
        <DataTable boxed cols={[
          { label: 'Fee head', render: (l) => <span className="cell-id"><b>{l.headName}</b><small>{l.installmentLabel}</small></span> },
          { label: 'Due', render: (l) => fmtDate(l.dueDate) },
          { label: 'Amount', className: 'num', render: (l) => money(l.netPayable) },
          { label: 'Paid', className: 'num', render: (l) => money(l.paidAmount) },
          { label: 'Balance', className: 'num', render: (l) => <b>{money(l.outstanding)}</b> },
          { label: 'Status', render: (l) => <>{linePill(l.paymentStatus)}{l.lateFineAmount > 0 && <small className="xs muted"> incl. {money(l.lateFineAmount)} fine</small>}</> },
        ]} rows={a.ledger} />
      </div>
    </Card>
    <Card>
      <SectionHead title="Receipts" sub={a.receipts.length ? `${a.receipts.length} payments` : 'No payments yet'} />
      {a.receipts.length > 0 && <div style={{ marginTop: 14 }}><ReceiptsTable rows={a.receipts} onChanged={fees.reload} contacts={guardians} /></div>}
    </Card>
  </>);
}

/** Receipts table (profile and the Fees page day-book). */
/** Receipt table columns, shared with the Fees page so its transactions list can sort before paging */
export function receiptCols({ onChanged, showStudent, contacts }) {
  return [
    ...(showStudent ? [{ label: 'Student / receipt', sortBy: (r) => r.studentName, render: (r) => <span className="cell-id"><b>{r.studentName}</b><small>{r.receiptNumber} · {fin.classOf(r)}</small></span> }]
      : [{ label: 'Receipt', sortBy: (r) => r.receiptNumber, render: (r) => <span className="cell-id"><b>{r.receiptNumber}</b><small>{r.collectedBy}</small></span> }]),
    { label: 'Date', sortBy: (r) => r.paymentTimestamp, render: (r) => fmtDate(r.paymentTimestamp) },
    { label: 'Method', sortBy: (r) => PAYMENT_MODES[r.paymentMode] || r.paymentMode, render: (r) => `${PAYMENT_MODES[r.paymentMode] || r.paymentMode}${r.instrumentNumber ? ` ${r.instrumentNumber}` : ''}` },
    { label: 'Amount', className: 'num', sortBy: (r) => Number(r.totalAmountPaid), render: (r) => money(r.totalAmountPaid) },
    { label: 'Status', sortBy: (r) => r.receiptStatus, render: receiptPill },
    { label: 'Action', render: (r) => <ReceiptActions receipt={r} onChanged={onChanged} contacts={contacts} /> },
  ];
}

export function ReceiptsTable({ rows, onChanged, showStudent, sort, contacts }) {
  return <DataTable boxed cols={receiptCols({ onChanged, showStudent, contacts })} sort={sort} rows={rows} />;
}
