import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as admissionApi from '../api/admissionService.js';
import * as studentApi from '../api/studentService.js';
import { Pill } from './ui.jsx';

const OPEN = ['NEW_INQUIRY', 'CONTACTED', 'EVALUATION_SCHEDULED', 'EVALUATION_PASSED', 'OFFER_ISSUED'];
const SA = 'SUPER_ADMIN';
const label = (code) => (code || '').toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ');
/** Admissions grade code → studentservice class name: GRADE-07 → Class 7, GRADE-NURSERY → Nursery, GRADE-LKG → LKG. */
export const gradeNameOf = (code) => {
  const c = String(code || '').replace(/^GRADE-/, '');
  return /^\d+$/.test(c) ? `Class ${Number(c)}` : c === 'NURSERY' ? 'Nursery' : c;
};
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
const localDateTime = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/**
 * The actions that move an application to its next status, each owned by a stakeholder role
 * (the roles are the @PreAuthorize of the admissionservice endpoint). `when` decides from the
 * current status and the latest offer whether the step applies.
 */
export const STEPS = [
  { key: 'call', title: 'Log a call', owner: 'Front-office counselor or admission officer',
    roles: ['FRONT_OFFICE_COUNSELOR', 'ADMISSION_OFFICER', SA], effect: 'Connected → Contacted · Not interested → Withdrawn',
    when: (s) => s === 'NEW_INQUIRY' || s === 'CONTACTED' },
  { key: 'exam', title: 'Schedule entrance exam', owner: 'Admission officer', roles: ['ADMISSION_OFFICER', SA],
    effect: 'Issues the admit card → Assessment scheduled', when: (s) => s === 'NEW_INQUIRY' || s === 'CONTACTED' },
  { key: 'evaluation', title: 'Record assessment', owner: 'Registrar or admission officer (scores from the evaluator)',
    roles: ['REGISTRAR', 'ADMISSION_OFFICER', SA], effect: 'Entrance test and interview both passed → Assessment passed',
    when: (s) => s === 'EVALUATION_SCHEDULED' || s === 'EVALUATION_PASSED' },
  { key: 'offer', title: 'Issue offer', owner: 'Admission officer or finance cashier', roles: ['FINANCE_CASHIER', 'ADMISSION_OFFICER', SA],
    effect: 'Offer letter with the seat deposit → Offer issued', when: (s) => s === 'EVALUATION_PASSED' },
  { key: 'deposit', title: 'Collect seat deposit', owner: 'Finance cashier or principal', roles: ['FINANCE_CASHIER', 'SCHOOL_PRINCIPAL', SA],
    effect: 'Receipt issued → offer Accepted', when: (s, offer) => s === 'OFFER_ISSUED' && offer?.offerStatus !== 'ACCEPTED' },
  { key: 'enrol', title: 'Enrol student', owner: 'Registrar', roles: ['REGISTRAR', 'ADMISSION_OFFICER', 'FRONT_OFFICE_COUNSELOR', SA],
    effect: 'Creates the student record → Enrolled (birth and transfer certificates must be verified)',
    // Roles that cannot read offers (registrar) see the step once an offer exists; the API checks the deposit was paid
    when: (s, offer, offersKnown) => (s === 'OFFER_ISSUED' && (offer?.offerStatus === 'ACCEPTED' || !offersKnown))
      || (s === 'EVALUATION_PASSED' && offersKnown && !offer) },
  { key: 'close', title: 'Not offered / Withdrawn', owner: 'Admission officer or principal', roles: ['ADMISSION_OFFICER', 'SCHOOL_PRINCIPAL', SA],
    effect: 'Closes the application with the reason', when: (s) => OPEN.includes(s) },
];

const In = ({ label: l, name, ...rest }) => (
  <div className="field box"><label htmlFor={`ns-${name}`}>{l.toUpperCase()}{rest.required ? ' *' : ''}</label><input id={`ns-${name}`} name={name} {...rest} /></div>
);
const Sel = ({ label: l, name, options, defaultValue }) => (
  <div className="field box"><label htmlFor={`ns-${name}`}>{l.toUpperCase()} *</label>
    <select id={`ns-${name}`} name={name} defaultValue={defaultValue}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
);

/** Review modal → "Next step": the applicable actions; enabled for the stakeholder roles, otherwise "Done by …". */
export function NextStep({ enquiry, offers, onChanged }) {
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(null);
  const [done, setDone] = useState('');
  const status = enquiry.enquiryStatus;
  const offer = offers.data?.[0];
  const steps = STEPS.filter((s) => s.when(status, offer, !!offers.data));
  if (!OPEN.includes(status)) {
    return (
      <div className="api-note" style={{ marginTop: 14 }}>
        <Check size={14} style={{ flex: 'none' }} />
        <span>This application is closed ({(admissionApi.STATUS[status] || [label(status)])[0]}); no further steps.{done ? <> {done}</> : null}</span>
      </div>
    );
  }
  return (
    <div className="nextstep" style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Next step</h4>
      {done && <div className="api-note ok" style={{ marginBottom: 10 }}><Check size={14} style={{ flex: 'none' }} /><span>{done}</span></div>}
      <div className="steps">
        {steps.map((s) => {
          const allowed = hasRole(...s.roles);
          return (
            <div key={s.key} className={`step${open === s.key ? ' on' : ''}`}>
              <div className="steprow">
                <div><b>{s.title}</b><small>{s.effect}</small></div>
                {allowed
                  ? <button type="button" className={`btn${s.key === 'close' ? '' : ' primary'}`} onClick={() => setOpen(open === s.key ? null : s.key)}>
                      {open === s.key ? 'Cancel' : <>{s.title}<ArrowRight size={14} /></>}</button>
                  : <Pill>Done by {s.owner}</Pill>}
              </div>
              {open === s.key && (
                <StepForm step={s.key} enquiry={enquiry} offer={offer}
                  onDone={(msg) => { setOpen(null); setDone(msg); onChanged(); }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepForm({ step, enquiry, offer, onDone }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [evalType, setEvalType] = useState('ENTRANCE_TEST');
  const rubric = useApi(() => admissionApi.getRubric(evalType), [evalType], step === 'evaluation');
  const id = enquiry.enquiryId;
  // Enrolment also creates the student master record in studentservice, placed in a section of the offered class
  const className = gradeNameOf(offer?.offeredGradeId || enquiry.targetGradeId);
  const grades = useApi(() => studentApi.listGrades(enquiry.tenantId), [enquiry.tenantId], step === 'enrol');
  const grade = grades.data?.find((g) => g.gradeName === className);
  const sections = useApi(() => studentApi.listSections(grade.gradeId), [grade?.gradeId], step === 'enrol' && !!grade);

  const actions = {
    call: async (v) => {
      const c = await admissionApi.logCall(id, { direction: v.direction, outcome: v.outcome, durationSeconds: Math.round(Number(v.minutes || 0) * 60),
        notes: v.notes.trim() || undefined, callbackAt: v.callbackAt ? new Date(v.callbackAt).toISOString() : undefined });
      return `Call logged (${label(c.outcome)}).`;
    },
    exam: async (v) => {
      const ex = await admissionApi.scheduleExam({ tenantId: enquiry.tenantId, branchId: enquiry.branchId,
        examTitle: v.title.trim(), academicYearId: enquiry.academicYearId, targetGradeId: enquiry.targetGradeId,
        examStartAt: new Date(v.startAt).toISOString(), durationMinutes: Number(v.duration), venue: v.venue.trim(),
        maxMarks: Number(v.maxMarks), passingMarks: Number(v.passingMarks), reportingInstructions: v.instructions.trim() || undefined, enquiryIds: [id] });
      return `Entrance exam ${ex.examCode} scheduled; admit card issued.`;
    },
    evaluation: async (v) => {
      const scores = (rubric.data || []).map((c) => ({ criterion: c.criterion, awardedScore: Number(v[`score-${c.criterion}`]) }));
      if (scores.some((x) => Number.isNaN(x.awardedScore) || v[`score-${x.criterion}`] === '')) throw Object.assign(new Error(), { detail: 'Enter a score for every criterion.' });
      const e = await admissionApi.recordEvaluation({ enquiryId: id, evaluationType: evalType, evaluationDate: new Date().toISOString(),
        examinerId: v.examiner.trim() || user.email || user.username, passingScore: Number(v.passingScore), rubricScores: scores, feedbackNotes: v.feedback.trim() || undefined });
      return `${label(e.evaluationType)} recorded: ${e.totalScore}/${e.maxTotalScore}, ${label(e.evaluationStatus)}.`;
    },
    offer: async (v) => {
      const o = await admissionApi.issueOffer({ enquiryId: id, offeredGradeId: enquiry.targetGradeId, validUntilDate: v.validUntil, initialFeeAmount: Number(v.fee) });
      return `Offer ${o.offerCode} issued: ${o.currency} ${o.initialFeeAmount} due by ${o.validUntilDate}.`;
    },
    deposit: async (v) => {
      const r = await admissionApi.collectDeposit(offer.offerId, { amountPaid: Number(v.amount), paymentMode: v.mode,
        transactionReference: v.reference.trim() || undefined, remarks: v.remarks.trim() || undefined });
      return `Deposit received: receipt ${r.receiptNumber}. The offer is accepted.`;
    },
    enrol: async (v) => {
      if (!v.dob) throw Object.assign(new Error(), { detail: 'Enter the date of birth.' });
      if (!grade || !v.sectionId) throw Object.assign(new Error(), { detail: `Choose a section of ${className}.` });
      const s = await admissionApi.convertToStudent(id, { dateOfBirth: v.dob, gender: v.gender });
      try {
        const st = await studentApi.enrollStudent({ tenantId: enquiry.tenantId, branchId: enquiry.branchId,
          firstName: enquiry.candidateFirstName, lastName: enquiry.candidateLastName, dateOfBirth: v.dob, gender: v.gender,
          gradeId: grade.gradeId, sectionId: v.sectionId, guardianName: enquiry.guardianName || undefined,
          guardianPhone: enquiry.guardianPhone || undefined, guardianEmail: enquiry.guardianEmail || undefined });
        return <>Enrolled as {s.admissionNumber}: student {st.studentUid} in {className}-{sections.data?.find((x) => x.sectionId === v.sectionId)?.sectionName}.{' '}
          <Link className="link" to={`/students/${st.studentId}`}>Open student profile →</Link></>;
      } catch (err) {
        return `Enrolled as ${s.admissionNumber}, but the student record could not be created (${err.status === 403 ? 'your role cannot add students; a registrar can add them from Add student' : err.detail || err.message}).`;
      }
    },
    close: async (v) => {
      if (!v.reason.trim()) throw Object.assign(new Error(), { detail: 'Enter the reason.' });
      const e = await admissionApi.closeApplication(id, { decision: v.decision, reason: v.reason.trim() });
      return `Application closed as ${(admissionApi.STATUS[e.enquiryStatus] || [e.enquiryStatus])[0]}.`;
    },
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setError(null);
    try { onDone(await actions[step](v)); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const start = daysFromNow(3); start.setHours(10, 0, 0, 0);
  const fields = {
    call: <>
      <Sel label="Direction" name="direction" defaultValue="OUTBOUND" options={[['OUTBOUND', 'Outbound (we called)'], ['INBOUND', 'Inbound (family called)']]} />
      <Sel label="Outcome" name="outcome" defaultValue="CONNECTED" options={[['CONNECTED', 'Connected'], ['CALLBACK_REQUESTED', 'Callback requested'],
        ['NO_ANSWER', 'No answer'], ['BUSY', 'Busy'], ['NOT_INTERESTED', 'Not interested (withdraws the application)']]} />
      <In label="Duration (minutes)" name="minutes" type="number" min="0" max="120" defaultValue="5" required />
      <In label="Callback at" name="callbackAt" type="datetime-local" />
      <In label="Notes" name="notes" placeholder="What was discussed" />
    </>,
    exam: <>
      <In label="Exam title" name="title" required defaultValue={`${enquiry.targetGradeId?.replace('GRADE-', 'Class ').replace(/Class 0/, 'Class ')} entrance test`} />
      <In label="Starts at" name="startAt" type="datetime-local" required defaultValue={localDateTime(start)} />
      <In label="Duration (minutes)" name="duration" type="number" min="15" max="480" defaultValue="90" required />
      <In label="Venue" name="venue" required defaultValue="Main block, Room 12" />
      <In label="Maximum marks" name="maxMarks" type="number" min="1" defaultValue="100" required />
      <In label="Passing marks" name="passingMarks" type="number" min="0" defaultValue="50" required />
      <In label="Reporting instructions" name="instructions" defaultValue="Report 30 minutes early with the admit card." />
    </>,
    evaluation: <>
      <div className="field box"><label htmlFor="ns-type">ASSESSMENT *</label>
        <select id="ns-type" value={evalType} onChange={(e) => setEvalType(e.target.value)}>
          <option value="ENTRANCE_TEST">Entrance test</option><option value="INTERVIEW">Interview</option></select></div>
      {rubric.loading ? <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading rubric…</p>
        : rubric.error ? <div className="api-error"><span>{rubric.error.status === 403 ? 'The rubric is not available for your role.' : rubric.error.detail}</span></div>
          : (rubric.data || []).map((c) => <In key={`${evalType}-${c.criterion}`} label={`${c.criterionName} (out of ${c.maxScore})`} name={`score-${c.criterion}`} type="number" min="0" max={c.maxScore} required />)}
      <In label="Passing score (%)" name="passingScore" type="number" min="0" max="100" defaultValue="50" required />
      <In label="Examiner" name="examiner" placeholder={user.email || user.username} />
      <In label="Feedback" name="feedback" placeholder="Optional" />
    </>,
    offer: <>
      <In label="Valid until" name="validUntil" type="date" required defaultValue={isoDate(daysFromNow(14))} min={isoDate(daysFromNow(1))} />
      <In label="Seat deposit (INR)" name="fee" type="number" min="1" defaultValue="25000" required />
    </>,
    deposit: <>
      <p className="xs muted">Offer {offer?.offerCode} · {offer?.currency} {offer?.initialFeeAmount} (less any approved fee waiver)</p>
      <In label="Amount received" name="amount" type="number" min="0.01" step="0.01" defaultValue={offer?.initialFeeAmount} required />
      <Sel label="Payment mode" name="mode" defaultValue="UPI" options={[['UPI', 'UPI'], ['CARD', 'Card'], ['NET_BANKING', 'Net banking'], ['CASH', 'Cash'], ['WAIVER', 'Fully waived']]} />
      <In label="Transaction reference" name="reference" placeholder="e.g. UPI-123456" />
      <In label="Remarks" name="remarks" placeholder="Optional" />
    </>,
    enrol: <>
      <In label="Date of birth" name="dob" type="date" required max={isoDate(new Date())} />
      <Sel label="Gender" name="gender" defaultValue="FEMALE" options={[['FEMALE', 'Female'], ['MALE', 'Male'], ['OTHER', 'Other']]} />
      {grades.loading || sections.loading ? <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading sections…</p>
        : !grade ? <div className="api-note"><span>{grades.error ? 'Classes are not available for your role.' : `${className} is not set up in Academic setup.`}</span></div>
          : <Sel label={`Section of ${className}`} name="sectionId" defaultValue={sections.data?.[0]?.sectionId}
              options={(sections.data || []).map((x) => [x.sectionId, `${className}-${x.sectionName}`])} />}
    </>,
    close: <>
      <Sel label="Decision" name="decision" defaultValue="REJECTED" options={[['REJECTED', 'Not offered'], ['WITHDRAWN', 'Withdrawn by the family']]} />
      <In label="Reason" name="reason" required placeholder="e.g. Class full for 2026–27" />
    </>,
  };
  const stepTitle = STEPS.find((s) => s.key === step).title;
  return (
    <form className="fieldlist stepform" noValidate onSubmit={submit}>
      {fields[step]}
      {error && <div className={error.status === 403 ? 'api-note' : 'api-error'}><span>{error.status === 403 ? 'Not available for your role.' : error.detail}</span></div>}
      <div><button className="btn primary" disabled={busy}>{busy && <LoaderCircle size={14} className="spin" />}{step === 'close' ? 'Close application' : stepTitle}</button></div>
    </form>
  );
}
