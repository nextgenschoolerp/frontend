import { useState } from 'react';
import { Plus, Download, Timer, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as fin from '../api/financeService.js';
import { PageHeader, Metrics, Card, SectionHead, DataTable, Pager, Pill, KV, Footer, SearchBox, downloadCsv, todayIso } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { Loading, fmtDate, feePill, RecordPaymentModal, ReceiptsTable } from './FeeRecords.jsx';

const { ROLES, money, moneyShort, PAYMENT_MODES, classOf } = fin;
const PAGE = 8;

/** Fees & payments with live financeservice data (finance staff, principals, super administrators). */
export function FeesLive() {
  const { hasRole, branchId } = useAuth();
  const enabled = !!branchId;
  const from = fin.yearStartIso();
  const summary = useApi(() => fin.headWiseCollection(branchId, from, todayIso()), [branchId], enabled);
  const overdue = useApi(() => fin.defaulters(branchId), [branchId], enabled);
  const receipts = useApi(() => fin.listBranchReceipts(branchId, from, todayIso()), [branchId], enabled);
  const heads = useApi(() => fin.listFeeHeads(), [], enabled);
  const [open, setOpen] = useState(null);
  const reloadAll = () => { summary.reload(); overdue.reload(); receipts.reload(); };

  if (!branchId) {
    return <><PageHeader title="Fees & payments" desc="Track fee collection, receipts and outstanding accounts." /><Card><ApiNote>Select a campus to see its fees.</ApiNote></Card><Footer /></>;
  }
  const s = summary.data;
  const d = overdue.data;
  const pct = s && Number(s.totalDemanded) > 0 ? (100 * (Number(s.totalDemanded) - Number(s.totalOutstanding)) / Number(s.totalDemanded)) : null;

  const exportStatement = () => downloadCsv('fee-statement', ['Section', 'Student / account', 'Reference', 'Date / overdue', 'Detail', 'Amount'], [
    ...(s ? [['Summary', 'Billed (academic year)', '', '', '', s.totalDemanded], ['Summary', `Collected ${s.fromDate} to ${s.toDate}`, '', '', `${s.receiptCount} receipts`, s.totalCollected],
      ['Summary', 'Outstanding', '', '', '', s.totalOutstanding],
      ...s.heads.map((h) => ['Fee head', h.headName, h.ledgerCode || 'unmapped', '', `outstanding ${h.outstanding}`, h.collected])] : []),
    ...(receipts.data || []).map((r) => ['Payment', `${r.studentName} (${r.studentUid})`, r.receiptNumber, fmtDate(r.paymentTimestamp),
      `${PAYMENT_MODES[r.paymentMode]}${r.receiptStatus === 'BOUNCED' ? ' - bounced' : ''}`, r.totalAmountPaid]),
    ...(d ? d.classes.flatMap((c) => c.defaulters.map((x) => ['Overdue', `${x.studentName} (${x.studentUid}) ${classOf(c)}`, '', `${x.daysOverdue} days`,
      x.heads.map((h) => `${h.headName} ${h.overdue}`).join('; '), x.overdueAmount])) : []),
  ]);

  return (
    <>
      <PageHeader
        title="Fees & payments"
        desc="Track fee collection, receipts and outstanding accounts."
        actions={[
          { label: 'Export statement', icon: <Download size={15} />, onClick: exportStatement },
          hasRole(...ROLES.lateFees) && { label: 'Run late fees', icon: <Timer size={15} />, onClick: () => setOpen({ kind: 'late' }) },
          hasRole(...ROLES.collect) && { label: 'Record payment', icon: <Plus size={15} />, primary: true, onClick: () => setOpen({ kind: 'pick' }) },
        ].filter(Boolean)}
      />
      {summary.error ? <Card><ApiErr error={summary.error} /></Card> : (
        <Metrics items={[
          ['Billed', s ? moneyShort(s.totalDemanded) : '…', 'Academic year fee demands'],
          ['Collected', s ? moneyShort(s.totalCollected) : '…', s ? `${s.receiptCount} receipts since ${fmtDate(s.fromDate)}` : ''],
          ['Outstanding', s ? moneyShort(s.totalOutstanding) : '…', pct !== null ? `${pct.toFixed(1)}% of billing collected` : ''],
          ['Overdue', d ? moneyShort(d.totalOverdue) : '…', d ? `${d.totalDefaulters} student${d.totalDefaulters === 1 ? '' : 's'} need follow-up` : ''],
        ]} />
      )}
      <div className="cols s404">
        <div className="stack">
          <TransactionsCard receipts={receipts} onChanged={reloadAll} />
          <DefaultersCard overdue={overdue} onPay={(acc) => setOpen({ kind: 'pay', account: acc })} />
        </div>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Collection overview</h3>
            <p className="small muted" style={{ margin: '4px 0 14px' }}>{s ? `${fmtDate(s.fromDate)} – ${fmtDate(s.toDate)}` : 'Academic year to date'}</p>
            {summary.loading ? <Loading /> : s && (<>
              <div className="bignum">{money(s.totalCollected)}</div>
              <div style={{ margin: '14px 0' }}>{pct !== null && <Pill tone={pct >= 85 ? 'green' : 'amber'}>{pct.toFixed(1)}% collected</Pill>}
                {s.bouncedCount > 0 && <> <Pill tone="amber">{s.bouncedCount} bounced</Pill></>}</div>
              {s.heads.map((h) => (
                <div className="detail" key={h.feeHeadId}>{h.headName}<span>·</span><b>{money(h.collected)}</b>
                  <small className="xs muted" style={{ marginLeft: 6 }}>{h.sharePercent}% · {money(h.outstanding)} due</small></div>
              ))}
              {s.modes.length > 0 && <p className="xs muted" style={{ marginTop: 12 }}>{s.modes.map((m) => `${PAYMENT_MODES[m.paymentMode]} ${money(m.amount)}`).join(' · ')}</p>}
            </>)}
          </Card>
          <FeeHeadsCard heads={heads} onMap={(h) => setOpen({ kind: 'map', head: h })} />
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Late fees</h3>
            <p className="body-s" style={{ margin: '8px 0 12px' }}>Daily fine on dues past a grace period, capped per installment. Running it again for the same day adds nothing.</p>
            {hasRole(...ROLES.lateFees)
              ? <button className="btn" onClick={() => setOpen({ kind: 'late' })}><Timer size={14} />Run late fees</button>
              : <ApiNote>Run by the trust treasurer, fee cashier or chief accountant.</ApiNote>}
          </Card>
        </div>
      </div>
      {open?.kind === 'pick' && <PickStudentModal branchId={branchId} onClose={() => setOpen(null)} onPick={(acc) => setOpen({ kind: 'pay', account: acc })} />}
      {open?.kind === 'pay' && <RecordPaymentModal account={open.account} onClose={() => setOpen(null)} onSaved={reloadAll} />}
      {open?.kind === 'late' && <LateFeesModal branchId={branchId} onClose={() => setOpen(null)} onSaved={reloadAll} />}
      {open?.kind === 'map' && <MapLedgerModal head={open.head} onClose={() => setOpen(null)} onSaved={() => { heads.reload(); summary.reload(); }} />}
      <Footer />
    </>
  );
}

/** Recent transactions: GET /api/v1/finance/receipts?branchId&from&to (last 60 days). */
function TransactionsCard({ receipts, onChanged }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const all = receipts.data || [];
  const rows = all.filter((r) => (!mode || r.paymentMode === mode)
    && (!q || `${r.studentName} ${r.studentUid} ${r.receiptNumber}`.toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages);
  return (
    <Card>
      <SectionHead title="Recent transactions" sub="Receipts of the academic year, newest first" />
      <div className="filters" style={{ margin: '18px 0' }}>
        <SearchBox placeholder="Search student or receipt number" width={300} value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        <select className="select" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} aria-label="Payment method">
          <option value="">All payment methods</option>
          {Object.entries(PAYMENT_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {receipts.loading ? <Loading /> : receipts.error ? <ApiErr error={receipts.error} /> : !rows.length ? <p className="xs muted">No receipts match.</p> : (<>
        <ReceiptsTable rows={rows.slice((current - 1) * PAGE, current * PAGE)} onChanged={onChanged} showStudent />
        <Pager page={current} pages={pages} onPage={setPage}
          text={`Showing ${(current - 1) * PAGE + 1}–${Math.min(current * PAGE, rows.length)} of ${rows.length} receipts${rows.length < all.length ? ` (filtered from ${all.length})` : ''}`} />
      </>)}
    </Card>
  );
}

/** Outstanding accounts: GET /api/v1/finance/reports/defaulters (US-04007). */
function DefaultersCard({ overdue, onPay }) {
  const { hasRole } = useAuth();
  const [klass, setKlass] = useState('');
  const d = overdue.data;
  const rows = d ? d.classes.filter((c) => !klass || c.gradeName === klass)
    .flatMap((c) => c.defaulters.map((x) => ({ ...x, gradeName: c.gradeName, sectionName: c.sectionName }))) : [];
  const classes = d ? [...new Set(d.classes.map((c) => c.gradeName))] : [];
  return (
    <Card>
      <SectionHead title="Outstanding accounts" sub={d ? `${d.totalDefaulters} students with overdue fees · ${money(d.totalOverdue)} overdue` : 'Students with fees past their due date'} />
      <div className="filters" style={{ margin: '18px 0' }}>
        <select className="select" value={klass} onChange={(e) => setKlass(e.target.value)} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {overdue.loading ? <Loading /> : overdue.error ? <ApiErr error={overdue.error} /> : !rows.length ? <p className="xs muted">No overdue accounts.</p> : (
        <DataTable boxed cols={[
          { label: 'Student', render: (r) => <span className="cell-id"><b>{r.studentName}</b><small>{r.studentUid} · {classOf(r)}</small></span> },
          { label: 'Overdue since', render: (r) => <span className="cell-id"><b>{fmtDate(r.oldestDueDate)}</b><small>{r.daysOverdue} days · {r.overdueInstallments} installment{r.overdueInstallments === 1 ? '' : 's'}</small></span> },
          { label: 'Breakdown', render: (r) => <small className="xs">{r.heads.map((h) => `${h.headName} ${money(h.overdue)}`).join(' · ')}</small> },
          { label: 'Overdue', className: 'num', render: (r) => <b>{money(r.overdueAmount)}</b> },
          { label: 'Action', render: (r) => (hasRole(...ROLES.collect)
            ? <span className="act"><button type="button" className="link" onClick={() => onPay({ studentId: r.studentId, studentName: r.studentName, outstanding: r.totalOutstanding, overdueAmount: r.overdueAmount })}>Record payment</button></span>
            : <small className="xs muted">{money(r.totalOutstanding)} total due</small>) },
        ]} rows={rows} />
      )}
    </Card>
  );
}

/** Fee heads and their ledger codes: GET /api/v1/finance/fee-heads, PATCH …/ledger-mapping (US-04018). */
function FeeHeadsCard({ heads, onMap }) {
  const { hasRole } = useAuth();
  const canMap = hasRole(...ROLES.mapLedger);
  return (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600 }}>Fee heads & ledgers</h3>
      <p className="small muted" style={{ margin: '4px 0 14px' }}>Accounting ledger each fee head posts to</p>
      {heads.loading ? <Loading /> : heads.error ? <ApiErr error={heads.error} /> : heads.data.map((h) => (
        <div className="detail" key={h.feeHeadId}>{h.headName}<span>·</span>
          {h.ledgerCode ? <b title={h.ledgerName}>{h.ledgerCode}</b> : <Pill tone="amber">Not mapped</Pill>}
          {canMap && <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => onMap(h)}>{h.ledgerCode ? 'Change' : 'Map ledger'}</button>}
        </div>
      ))}
    </Card>
  );
}

/* ---------- modals ---------- */

const In = ({ label: l, name, required, ...rest }) => (
  <div className="field box"><label htmlFor={`fl-${name}`}>{l.toUpperCase()}{required ? ' *' : ''}</label><input id={`fl-${name}`} name={name} {...rest} /></div>
);
function FormModal({ title, sub, onClose, submitLabel, run, children, result }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { setDone(await run(Object.fromEntries(new FormData(e.currentTarget)))); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  if (done && result) {
    return <Modal title={title} sub={sub} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>{result(done)}</Modal>;
  }
  return (
    <Modal title={title} sub={sub} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" form="fl-form" disabled={busy}>{busy && <LoaderCircle size={14} className="spin" />}{submitLabel}</button></>}>
      <form id="fl-form" className="fieldlist" noValidate onSubmit={submit}>{children}{error && <ApiErr error={error} />}</form>
    </Modal>
  );
}

/** Record payment from the page header: search the student first (GET /api/v1/finance/fee-accounts). */
function PickStudentModal({ branchId, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const found = useApi(() => fin.searchAccounts(branchId, term), [branchId, term], term.length >= 2);
  return (
    <Modal title="Record payment" sub="Find the student by name or student UID" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Cancel</button>}>
      <form className="fieldlist" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <div className="field box"><label htmlFor="fl-q">STUDENT</label>
          <input id="fl-q" autoFocus value={q} placeholder="e.g. Aarav or STU-2026-00101" onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length >= 2) setTerm(e.target.value.trim()); }} /></div>
      </form>
      <div style={{ marginTop: 12 }}>
        {term.length < 2 ? <p className="xs muted">Type at least two letters.</p>
          : found.error ? <ApiErr error={found.error} /> : (found.loading || !found.data) ? <Loading />
            : !found.data.length ? <p className="xs muted">No fee account matches “{term}”.</p> : (
              <DataTable boxed cols={[
                { label: 'Student', render: (a) => <span className="cell-id"><b>{a.studentName}</b><small>{a.studentUid} · {classOf(a)}</small></span> },
                { label: 'Outstanding', className: 'num', render: (a) => money(a.outstanding) },
                { label: 'Status', render: (a) => feePill(a.feeStatus) },
                { label: '', render: (a) => (Number(a.outstanding) > 0
                  ? <span className="act"><button type="button" className="link" onClick={() => onPick(a)}>Select</button></span> : <small className="xs muted">Nothing due</small>) },
              ]} rows={found.data} />
            )}
      </div>
    </Modal>
  );
}

/** Run late fees: POST /api/v1/finance/late-fees/accrue (US-04005). */
function LateFeesModal({ branchId, onClose, onSaved }) {
  return (
    <FormModal title="Run late fees" sub={`${branchId} · dues past the grace period`} onClose={onClose} submitLabel="Run late fees"
      run={async (v) => {
        const r = await fin.accrueLateFees({ branchId, asOfDate: v.asOfDate || undefined, graceDays: Number(v.graceDays),
          finePerDay: Number(v.finePerDay), maxFinePerInstallment: Number(v.maxFinePerInstallment || 0) });
        onSaved?.();
        return r;
      }}
      result={(r) => (<>
        <KV rows={[['As of', fmtDate(r.asOfDate)], ['Installments charged', r.installmentsCharged], ['Students', r.studentsAffected],
          ['Fine added', money(r.fineAdded)], ['Late fines now due', money(r.totalLateFine)]]} />
        {Number(r.fineAdded) === 0 && <ApiNote>Nothing new to charge: fines for this date were already applied, or no dues are past the grace period.</ApiNote>}
      </>)}>
      <In label="Grace period (days)" name="graceDays" type="number" min="0" max="60" required defaultValue="15" />
      <In label="Fine per day (₹)" name="finePerDay" type="number" min="1" max="1000" required defaultValue="10" />
      <In label="Maximum per installment (₹, 0 = no cap)" name="maxFinePerInstallment" type="number" min="0" required defaultValue="1000" />
      <In label="As of" name="asOfDate" type="date" max={todayIso()} defaultValue={todayIso()} />
    </FormModal>
  );
}

/** Map ledger: PATCH /api/v1/finance/fee-heads/{id}/ledger-mapping (US-04018). */
function MapLedgerModal({ head, onClose, onSaved }) {
  return (
    <FormModal title="Map fee head to ledger" sub={`${head.headName} (${head.headCode})`} onClose={onClose} submitLabel="Save"
      run={async (v) => { const r = await fin.mapLedger(head.feeHeadId, { ledgerCode: v.ledgerCode.trim().toUpperCase(), ledgerName: v.ledgerName.trim() }); onSaved?.(); onClose(); return r; }}>
      <In label="Ledger code" name="ledgerCode" required defaultValue={head.ledgerCode || ''} placeholder="e.g. 4600-ACTIVITY" />
      <In label="Ledger name" name="ledgerName" required defaultValue={head.ledgerName || ''} placeholder="e.g. Activity Fee Income" />
    </FormModal>
  );
}
