import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Plus, ArrowLeft, Upload, Pencil, Check, Circle, LoaderCircle, ArrowRight, IdCard, HeartPulse, UserPlus, GraduationCap } from 'lucide-react';
import {
  PageHeader, Metrics, Card, SectionHead, Tabs, DataTable, Pill, FieldGrid, Field, Footer, KV, Docs, downloadCsv,
} from '../components/ui.jsx';
import { ApplicationsTable, useApplications, useOpenFollowUps, ApiErr, ApiNote, exportApplicationsCsv } from '../components/Admissions.jsx';
import { NewAdmissionPanel, buildEnquiry, useCaptureAllowed, gradeCode } from '../components/NewAdmission.jsx';
import {
  useStudents, StudentsTable, exportStudentsCsv, useStudentRecord, statusPill, fmtDate, Loading, hasAlert,
  MedicalModal, IdCardModal, CertificatesCard, ConductCard, StudentAvatar, PhotoButton, StudentDocuments,
} from '../components/StudentRecords.jsx';
import { useAuth } from '../auth.jsx';
import { useFeeAccount, FeeStatusCard, FeeAccountDetail } from '../components/FeeRecords.jsx';
import { PromoteClassModal } from '../components/Promotion.jsx';
import { useProgressTrend, AcademicProgressCard } from '../components/ExamRecords.jsx';
import { StudentAttendanceCard } from '../components/AttendanceLive.jsx';
import { useApi } from '../api/useApi.js';
import { captureEnquiry } from '../api/admissionService.js';
import * as studentApi from '../api/studentService.js';
import { formatDate, formatDateTime, formatTime, formatNumber, formatMoney } from '../regional.js';

const { ROLES, isStudentId, fullName, classLabel } = studentApi;
const TABS = [null, 'admissions', 'archived'];

export function StudentsDirectory() {
  // Students on roll: GET /api/v1/students (studentservice). Admissions: GET /api/v1/admissions/enquiries (admissionservice)
  const list = useStudents();
  const apps = useApplications();
  const followUps = useOpenFollowUps();
  const [params, setParams] = useSearchParams();
  const tab = Math.max(0, TABS.indexOf(params.get('tab')));
  const setTab = (i) => setParams(TABS[i] ? { tab: TABS[i] } : {}, { replace: true });
  const live = apps.canRead && !apps.missingBranch && !apps.error;
  const openCount = live && apps.data ? apps.open.length : null;
  const n = (v) => (list.live ? formatNumber(v) : list.loading ? '…' : '—');
  const noAccess = 'Not available for your role';
  const { hasRole } = useAuth();
  const [promoting, setPromoting] = useState(false);
  return (
    <>
      <PageHeader
        title="Students"
        desc="Manage admissions, student records and class placement across your school."
        actions={[
          // Exports the rows of the open tab (students, applications or archived students) as CSV
          tab === 1
            ? { label: 'Export list', icon: <Download size={15} />, disabled: !(live && apps.data), title: live && apps.data ? 'Download the applications as CSV' : 'Applications are not available for your role',
              onClick: () => exportApplicationsCsv(apps.rows) }
            : { label: 'Export list', icon: <Download size={15} />, disabled: !list.live, title: list.live ? 'Download this list as CSV' : 'Student records are not available for your role',
              onClick: () => exportStudentsCsv(tab === 2 ? list.left : list.current, tab === 2 ? 'archived-students' : 'students') },
          ...(hasRole(...ROLES.promote) && list.live ? [{ label: 'Promote class', icon: <GraduationCap size={15} />, onClick: () => setPromoting(true) }] : []),
          { label: 'Add student', icon: <Plus size={15} />, primary: true, to: '/students/new' },
        ]}
      />
      {promoting && <PromoteClassModal students={list.current} onClose={() => setPromoting(false)} onDone={list.reload} />}
      <Metrics items={[
        ['Total students', n(list.current.length), list.live ? `Across ${list.classCount} class section${list.classCount === 1 ? '' : 's'}` : noAccess],
        ['New this year', n(list.newThisYear.length), list.live ? 'Enrolled since 1 April' : noAccess],
        ['Admission applications', openCount ?? (apps.loading ? '…' : '—'), openCount !== null ? 'Awaiting review' : noAccess],
        ['Incomplete records', n(list.incomplete.length), list.live ? 'Guardian, emergency phone or blood group missing' : noAccess],
      ]} />
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="sh">
          <div><h3>Student directory</h3><p>{tab === 2 ? 'Transferred and graduated students' : 'All enrolled students'} · {list.current[0]?.branchId || 'this campus'}</p></div>
        </div>
        <Tabs items={[`All students${list.live ? ` (${list.current.length})` : ''}`, `Admissions${openCount !== null ? ` (${apps.rows.length})` : ''}`,
          `Archived${list.live ? ` (${list.left.length})` : ''}`]} value={tab} onChange={setTab} />
        {tab === 1 ? <ApplicationsTable apps={apps} /> : <StudentsTable key={tab} list={list} archived={tab === 2} />}
      </Card>
      <div className="cols eq">
        <Card>
          <div className="sh"><div><h3>Admissions for 2026–2027</h3></div>
            <button className="link" onClick={() => setTab(1)}>Review applications →</button></div>
          <p className="body-s" style={{ marginTop: -6 }}>
            {openCount !== null ? `${openCount} application${openCount === 1 ? ' is' : 's are'} ready for your team to review.` : 'Applications are visible to admissions staff.'}
          </p>
          <div className="pills" style={{ marginTop: 14 }}>
            {openCount !== null && <Pill tone="purple">{apps.fresh.length} new application{apps.fresh.length === 1 ? '' : 's'}</Pill>}
            {followUps.data && <Pill tone="amber">{followUps.data.length} with documents pending</Pill>}
          </div>
        </Card>
        <Card>
          <SectionHead title="Record health" />
          <p className="body-s" style={{ marginTop: -6 }}>Keep safeguarding and contact information up to date.</p>
          {list.live ? (
            <>
              <p className="small muted" style={{ marginTop: 14 }}>
                {list.current.length - list.incomplete.length} complete record{list.current.length - list.incomplete.length === 1 ? '' : 's'}
                {list.current.length ? ` · ${(((list.current.length - list.incomplete.length) / list.current.length) * 100).toFixed(1)}% completion` : ''}
              </p>
              {list.incomplete.length > 0 && <div className="pills" style={{ marginTop: 10 }}>
                {list.incomplete.map((s) => <Link key={s.studentId} to={`/students/${s.studentId}/edit`}><Pill tone="amber">{fullName(s)}</Pill></Link>)}
              </div>}
            </>
          ) : <p className="small muted" style={{ marginTop: 14 }}>Record health is visible to staff who can read student records.</p>}
        </Card>
      </div>
      <Footer />
    </>
  );
}

/* ---------- add / edit form ---------- */

const DOCS_ADD = [
  ['Birth certificate', 'Identity and date of birth · Required'],
  ['Proof of address', 'Dated within the last 3 months · Required'],
  ['Previous school report', 'Academic history · Optional · Pending'],
];
const DOCS_EDIT = [
  ['Birth certificate.pdf', '284 KB · Verified 02 Sep 2024 · Verified'],
  ['Proof of address.pdf', '196 KB · Verified 02 Sep 2024 · Verified'],
  ['Medical care plan.pdf', '312 KB · Updated 01 Sep 2026 · Verified'],
];

const YEAR_GROUPS = Array.from({ length: 13 }, (_, i) => `Year ${i + 4}`);
// Class = the grade the student is admitted to (targetGradeId / gradeId); Section is chosen separately
export const CLASSES = ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const HOUSES = ['Tagore', 'Raman', 'Shivaji', 'Ashoka'];
// Form tutors of the known class sections (static until the academic service exists); others show "To be assigned"
const CLASS_TUTORS = {
  'Class 6-A': 'Priya Nair',
  'Class 7-A': 'Priya Nair', 'Class 7-B': 'Thomas Reid', 'Class 8-A': 'Hannah Lewis', 'Class 8-B': 'Omar Siddiqui',
  'Class 9-A': 'Charlotte Evans', 'Class 9-B': 'James Carter', 'Class 10-A': 'Eleanor Hughes', 'Class 10-B': 'Aisha Rahman',
  'Class 11-A': 'Daniel Brooks', 'Class 11-B': 'Grace Chen',
};
const GENDER_LABEL = { FEMALE: 'Female', MALE: 'Male', OTHER: 'Prefer not to say' };

// Record checklist: a section is done when all of its fields are filled (names are the Field ids)
const CHECKLIST = [
  ['Student & admission information', ['first-name', 'last-name', 'date-of-birth', 'admission-date']],
  ['Class placement', ['academic-year', 'year-group', 'class', 'section']],
  ['Guardian and emergency contacts', ['primary-guardian', 'relationship', 'email-address', 'mobile-number', 'emergency-contact', 'emergency-phone', 'home-address']],
  ['Medical declaration', ['medical-conditions', 'allergies']],
];
const REQUIRED_DOCS = ['BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE'];

// Values of the static sample record (/students/st-2024-106/edit)
const SAMPLE = {
  firstName: 'Amara', lastName: 'Thompson', preferredName: 'Amara', dob: '2011-05-12', admissionDate: '2024-09-02', gender: 'Female',
  admissionNumber: 'OA-2024-106', uid: 'ST-2024-106', nationality: 'British', klass: 'Class 10', section: 'A', house: 'Tagore',
  yearGroup: 'Year 10', guardian: 'Sarah Thompson', email: 's.thompson@example.com', emergencyContact: 'David Thompson', relationship: 'Mother',
  secondary: 'David Thompson · Father', emergencyPhone: '+44 7700 900 143', mobile: '+44 7700 900 142', secondaryPhone: '+44 7700 900 143',
  collection: 'Both guardians authorised', address: '24 Willow Lane, Oxford, OX2 7AB', blood: 'O+', conditions: 'Mild asthma',
  allergies: 'No known allergies', medication: 'Salbutamol inhaler held at school office.', gp: 'Willow Medical Centre · 01865 555 210',
};
/** Form values of a studentservice record (GET /api/v1/students/{id}). */
const valuesOf = (s) => {
  const [g1, g2] = s.guardians || [];
  return {
    firstName: s.firstName, lastName: s.lastName, dob: s.dateOfBirth, admissionDate: s.createdAt?.slice(0, 10), gender: GENDER_LABEL[s.gender],
    uid: s.studentUid, klass: s.gradeName || '', section: s.sectionName || '', house: s.houseName || '',
    guardian: g1?.fullName, email: g1?.email, relationship: g1?.relationship, mobile: g1?.mobileNumber,
    secondary: g2 ? `${g2.fullName} · ${g2.relationship}` : '', secondaryPhone: g2?.mobileNumber,
    emergencyContact: (g2 || g1)?.fullName, emergencyPhone: s.emergencyContactPhone, blood: s.bloodGroup, conditions: s.medicalAlerts || '',
  };
};

/** Grade and section ids for a class name ("Class 6") and section letter (GET /academic/grades, /academic/sections). */
async function placementIds(grades, klass, section) {
  const grade = (grades || []).find((g) => g.gradeName === klass || g.gradeCode === gradeCode(klass));
  if (!grade) return { error: `Class “${klass}” is not set up for this school.` };
  const sec = (await studentApi.listSections(grade.gradeId)).find((x) => x.sectionName === section);
  if (!sec) return { error: `Section ${section} is not set up for ${klass}.` };
  return { gradeId: grade.gradeId, sectionId: sec.sectionId };
}

export function StudentForm({ mode }) {
  const edit = mode === 'edit';
  const { id } = useParams();
  const live = edit && isStudentId(id);
  // Live record: GET /api/v1/students/{id}; the form renders once it has loaded so the fields start with its values
  const record = useStudentRecord(id, live);
  if (live && (record.loading || !record.data)) {
    return (
      <>
        <PageHeader title="Edit student" desc="Update the student’s information, contacts and supporting documents."
          actions={[{ label: 'Back to profile', icon: <ArrowLeft size={15} />, to: `/students/${id}` }]} />
        <Card>{!record.canView ? <ApiNote>Student records are not available for your role.</ApiNote> : record.error ? <ApiErr error={record.error} /> : <Loading />}</Card>
      </>
    );
  }
  return <StudentFormBody key={record.data?.updatedAt || mode} mode={mode} student={live ? record.data : null} />;
}

function StudentFormBody({ mode, student: loaded }) {
  const edit = mode === 'edit';
  // The photo upload returns the updated record; keep it so the avatar refreshes without reloading the form
  const [student, setStudent] = useState(loaded);
  const nav = useNavigate();
  const { id } = useParams();
  const rec = student ? valuesOf(student) : edit ? SAMPLE : {};
  const v = (k) => rec[k] ?? '';
  const back = edit ? `/students/${id}` : '/students';
  const { user, branchId, hasRole } = useAuth();
  const canCapture = useCaptureAllowed();
  const canEnrol = !edit && hasRole(...ROLES.enroll);
  const canMedical = hasRole(...ROLES.medical);
  const canAllocate = hasRole(...ROLES.allocate);
  // Classes and houses of the school (studentservice); the static lists are used when the role cannot read them
  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user.tenantId], hasRole(...ROLES.grades) && !!user.tenantId);
  const houses = useApi(() => studentApi.listHouses(user.tenantId), [user.tenantId], hasRole(...ROLES.houses) && !!user.tenantId);
  const houseNames = houses.data?.length ? houses.data.map((h) => h.houseName) : HOUSES;
  const formRef = useRef(null);
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [klass, setKlass] = useState(v('klass'));
  const [section, setSection] = useState(v('section'));
  const tutor = CLASS_TUTORS[`${klass}-${section}`];
  const [docs, setDocs] = useState([]);
  // Re-evaluate the checklist whenever any field changes (change/input events bubble to the form)
  const [, setTick] = useState(0);
  const touch = () => { setTick((t) => t + 1); setSaved(''); };
  useEffect(() => setTick((t) => t + 1), []);
  const fd = formRef.current ? new FormData(formRef.current) : null;
  const done = (names) => !!fd && names.every((n) => String(fd.get(n) || '').trim());
  const checklist = [
    ...CHECKLIST.map(([title, names]) => [title, edit || done(names)]),
    ['Required documents', edit || REQUIRED_DOCS.every((t) => docs.some((d) => d.documentType === t))],
  ];
  const fail = (detail) => { setSaveError({ detail }); return null; };

  function addAnother() {
    formRef.current.reset();
    setCreated(null); setDocs([]); setSaveError(null); setKlass(''); setSection('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Add student / Save draft -> POST /api/v1/admissions/enquiries (admissionservice, US-02001).
  // The application becomes a Student Master record later through the admissions pipeline.
  async function saveApplication(openAdmissions, thenUpload) {
    if (created) { if (openAdmissions) nav('/students?tab=admissions'); return; }
    const { body, error } = buildEnquiry(new FormData(formRef.current), user.tenantId, branchId);
    if (error) { setSaveError({ detail: error }); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const enquiry = await captureEnquiry(body);
      setCreated(enquiry);
      if (openAdmissions) nav('/students?tab=admissions');
      // "Upload documents" before saving: the documents panel replaces this card; bring its upload form into view
      if (thenUpload) setTimeout(() => document.getElementById('doc-file')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  // Enrol student -> POST /api/v1/students (studentservice, US-03000): a student master record with a permanent UID
  async function enrol() {
    const form = new FormData(formRef.current);
    const get = (k) => String(form.get(k) || '').trim();
    const missing = [['first-name', 'first name'], ['last-name', 'last name'], ['date-of-birth', 'date of birth'], ['gender', 'gender'],
      ['class', 'class'], ['section', 'section']].filter(([k]) => !get(k)).map(([, t]) => t);
    if (missing.length) return fail(`Complete the required fields: ${missing.join(', ')}.`);
    if (!user.tenantId || !branchId) return fail('Your account has no campus assigned; ask an administrator or pick a campus in the sidebar.');
    setSaving(true); setSaveError(null);
    try {
      const place = await placementIds(grades.data, get('class'), get('section'));
      if (place.error) return fail(place.error);
      const house = houses.data?.find((h) => h.houseName === get('house'));
      const alerts = [get('medical-conditions'), get('allergies')].filter((x) => x && !/^(none|no known allergies)$/i.test(x)).join('; ');
      const phone = (k) => get(k).replace(/[\s().-]/g, '') || undefined;
      const s = await studentApi.enrollStudent({
        tenantId: user.tenantId, branchId,
        firstName: get('first-name'), lastName: get('last-name'), dateOfBirth: get('date-of-birth'), gender: studentApi.GENDERS[get('gender')] || 'OTHER',
        bloodGroup: get('blood-group') || undefined, medicalAlerts: alerts || undefined, emergencyContactPhone: phone('emergency-phone'),
        gradeId: place.gradeId, sectionId: place.sectionId, houseId: house?.houseId,
        guardianName: get('primary-guardian') || undefined, guardianRelationship: get('relationship') || undefined,
        guardianPhone: phone('mobile-number'), guardianEmail: get('email-address') || undefined,
      });
      nav(`/students/${s.studentId}`);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
    return null;
  }

  // Save changes (live record): PUT …/medical (US-03001) and PUT …/allocation (US-03003) for what changed and the role may change
  async function saveChanges(thenView) {
    const form = new FormData(formRef.current);
    const get = (k) => String(form.get(k) || '').trim();
    const calls = [];
    const alerts = [get('medical-conditions'), get('allergies')].filter(Boolean).join('; ');
    const medical = { bloodGroup: get('blood-group'), medicalAlerts: alerts, emergencyContactPhone: get('emergency-phone').replace(/[\s().-]/g, '') };
    if (canMedical && (medical.bloodGroup !== (student.bloodGroup || '') || medical.medicalAlerts !== (student.medicalAlerts || '')
      || medical.emergencyContactPhone !== (student.emergencyContactPhone || ''))) {
      if (!medical.bloodGroup || !medical.medicalAlerts || !medical.emergencyContactPhone) return fail('Blood group, medical conditions and emergency phone are all required to save medical information (write “None” if there are none).');
      calls.push(() => studentApi.updateMedical(student.studentId, medical));
    }
    const houseId = houses.data?.find((h) => h.houseName === get('house'))?.houseId;
    const placeChanged = get('class') !== (student.gradeName || '') || get('section') !== (student.sectionName || '') || (houseId && houseId !== student.houseId);
    if (canAllocate && placeChanged) {
      calls.push(async () => {
        const same = get('class') === student.gradeName && get('section') === student.sectionName;
        const place = same ? { gradeId: student.gradeId, sectionId: student.sectionId } : await placementIds(grades.data, get('class'), get('section'));
        if (place.error) throw Object.assign(new Error(place.error), { detail: place.error });
        return studentApi.assignAllocation(student.studentId, { gradeId: place.gradeId, sectionId: place.sectionId, houseId: houseId || student.houseId || undefined, rollNumber: student.rollNumber ?? undefined });
      });
    }
    if (!calls.length) { if (thenView) nav(back); else setSaved('No changes to save for your role.'); return null; }
    setSaving(true); setSaveError(null);
    try {
      for (const c of calls) await c();
      if (thenView) nav(back); else { setSaved('Changes saved'); }
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
    return null;
  }

  const submit = (e) => {
    e.preventDefault();
    if (student) saveChanges(true);
    else if (edit) nav(back);
    else if (canCapture) saveApplication(true);
    else enrol();
  };
  const name = student ? fullName(student) : 'Amara Thompson';

  return (
    <form ref={formRef} onSubmit={submit} onChange={touch} noValidate style={{ display: 'contents' }}>
      <PageHeader
        title={edit ? 'Edit student' : 'Add student'}
        desc={edit ? `Update ${name}’s information, contacts and supporting documents.` : 'Create a student record and prepare a new admission to Oakridge Academy.'}
        actions={[{ label: edit ? 'Back to profile' : 'Back to students', icon: <ArrowLeft size={15} />, to: back }]}
      />
      <div className="cols s404">
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Student & admission information</h3><p>Required fields are marked with an asterisk.</p></div>
            <div className="photo">
              {student ? <StudentAvatar student={student} /> : <div className="bigavatar">{edit ? name.split(' ').map((w) => w[0]).join('').slice(0, 2) : '+'}</div>}
              {student ? <PhotoButton student={student} onUploaded={setStudent} /> : (
                <div>
                  <button type="button" className="btn" disabled title={edit ? 'Sample record: open a student from the directory' : 'Enrol the student first, then add the photo from Edit student'}>
                    <Upload size={15} />{edit ? 'Change photo' : 'Upload student photo'}</button>
                  <small>{edit ? 'Sample record · photos are stored for enrolled students' : 'Added after enrolment · JPG or PNG · Maximum 5 MB'}</small>
                </div>
              )}
              {edit && (student ? statusPill(student.studentStatus) : <Pill tone="green">Active student</Pill>)}
            </div>
            <FieldGrid cols={[
              [
                { label: 'First name', required: true, value: v('firstName'), placeholder: 'Enter first name' },
                { label: 'Date of birth', required: true, type: 'date', value: v('dob'), max: today },
                { label: 'Admission date', required: true, type: 'date', value: v('admissionDate') },
              ],
              [
                { label: 'Last name', required: true, value: v('lastName'), placeholder: 'Enter last name' },
                { label: 'Gender', required: canEnrol, select: true, value: v('gender'), placeholder: 'Select gender', options: ['Female', 'Male', 'Non-binary', 'Prefer not to say'] },
                { label: 'Admission number', value: v('admissionNumber'), placeholder: edit ? 'Enter admission number' : 'Assigned on enrolment' },
              ],
              [
                { label: 'Preferred name', value: v('preferredName'), placeholder: 'Enter preferred name' },
                { label: 'Student ID', value: v('uid'), placeholder: 'Assigned on admission', readOnly: !!student },
                { label: 'Nationality', select: true, value: v('nationality'), placeholder: 'Select nationality', options: ['Indian', 'British', 'Irish', 'Other'] },
              ],
            ]} />
          </Card>

          <Card>
            <div className="cardhead"><h3>Class placement</h3><p>Assign the student to the current academic year.</p></div>
            <FieldGrid cols={[
              [
                { label: 'Academic year', required: true, select: true, value: '2026–2027' },
                { label: 'Class', required: true, select: true, value: klass, placeholder: 'Select class', options: CLASSES, onChange: (e) => setKlass(e.target.value) },
                { label: 'House', select: true, value: v('house'), placeholder: 'Select house', options: houseNames },
              ],
              [
                { label: 'Year group', required: true, select: true, value: v('yearGroup'), placeholder: 'Select year group', options: YEAR_GROUPS },
                { label: 'Section', required: true, select: true, value: section, placeholder: 'Select section', options: SECTIONS, onChange: (e) => setSection(e.target.value) },
              ],
              [
                { label: 'Enrolment status', select: true, value: edit ? 'Active' : 'Pending admission', options: ['Active', 'Pending admission'] },
                { label: 'Form tutor', key: `tutor-${klass}-${section}`, value: tutor || '', placeholder: klass && section ? 'To be assigned' : 'Assigned from class and section', readOnly: true },
              ],
            ]} />
          </Card>

          <Card>
            <div className="cardhead"><h3>Guardian & emergency contacts</h3><p>At least one guardian and one emergency contact are required.</p></div>
            <FieldGrid cols={[
              [
                { label: 'Primary guardian', required: true, value: v('guardian'), placeholder: 'Enter full name' },
                { label: 'Email address', required: true, value: v('email'), placeholder: 'Enter email address' },
                { label: 'Emergency contact', required: true, value: v('emergencyContact'), placeholder: 'Enter emergency contact' },
              ],
              [
                { label: 'Relationship', required: true, select: true, value: v('relationship'), placeholder: 'Select relationship', options: ['Mother', 'Father', 'Guardian', 'Other'] },
                { label: 'Secondary guardian', value: v('secondary'), placeholder: 'Enter full name & relationship' },
                { label: 'Emergency phone', required: true, value: v('emergencyPhone'), placeholder: 'Enter emergency number' },
              ],
              [
                { label: 'Mobile number', required: true, value: v('mobile'), placeholder: 'Enter mobile number' },
                { label: 'Secondary phone', value: v('secondaryPhone'), placeholder: 'Enter mobile number' },
                { label: 'Collection permission', select: true, value: v('collection'), placeholder: 'Select authorised contacts', options: ['Both guardians authorised', 'Primary guardian only'] },
              ],
            ]} />
            <Field box label="Home address" required value={v('address')} placeholder="Enter street address, town and postcode" />
            <label className="check"><input type="checkbox" defaultChecked />Primary guardian receives school notices and fee reminders.</label>
          </Card>
        </div>

        <div className="stack">
          {!edit && created ? <NewAdmissionPanel enquiry={created} onDocuments={setDocs} /> : (
          <Card className="notice">
            <h4>{edit ? `Editing ${name}` : 'New student admission'}</h4>
            <p>{student
              ? `Saving updates the medical information${canMedical ? '' : ' (school nurse or registrar)'} and the class, section and house${canAllocate ? '' : ' (registrar, class teacher or house master)'}. The student UID and admission history are retained.`
              : edit ? 'Changes update the existing student record. The student ID and admission history are retained.'
                : canCapture ? 'Create a complete record before confirming admission. You can save a draft at any time.'
                  : 'Enrolling creates the student record straight away with a permanent student UID.'}</p>
          </Card>
          )}
          <Card>
            <div className="cardhead"><h3>Medical information</h3><p>Restricted to authorised staff.</p></div>
            <div className="fieldlist">
              <Field box label="Blood group" select value={v('blood')} placeholder="Select blood group" options={studentApi.BLOOD_GROUPS} />
              <Field box label="Medical conditions" value={v('conditions')} placeholder="Enter conditions or “None”" />
              <Field box label="Allergies" value={v('allergies')} placeholder="Enter allergies or “None”" />
              <Field box label="Medication / care instructions" value={v('medication')} placeholder="Enter medication and care instructions" />
              <Field box label="GP / surgery contact" value={v('gp')} placeholder="Enter surgery name and phone" />
            </div>
            <div style={{ marginTop: 18 }}><Pill tone="purple">Restricted · Safeguarding team</Pill></div>
          </Card>
          {student && <Card>
            <div className="cardhead"><h3>Documents</h3><p>PDF, JPG or PNG · Up to 10 MB per file.</p></div>
            <div style={{ marginTop: 14 }}><StudentDocuments student={student} /></div>
          </Card>}
          {!student && (edit || !created) && <Card>
            <div className="cardhead"><h3>Documents</h3><p>PDF, JPG or PNG · Up to {edit ? 10 : 5} MB per file.</p></div>
            <div style={{ margin: '14px 0' }}><Docs items={edit ? DOCS_EDIT : DOCS_ADD} /></div>
            <button type="button" className="btn" disabled={!edit && (saving || !canCapture)} onClick={edit ? undefined : () => saveApplication(false, true)}>
              {saving ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}Upload documents
            </button>
            {!edit && <p className="xs muted" style={{ marginTop: 8 }}>{canCapture
              ? 'Documents are attached to the application: this saves it first, then opens the upload form.'
              : 'Documents are attached to admission applications, which your role cannot record.'}</p>}
          </Card>}
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Record checklist</h3>
            <div className="checklist">
              {checklist.map(([t, ok]) => (
                <div key={t} className={ok ? 'ok' : ''} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {ok ? <Check size={13} /> : <Circle size={11} />}<span style={{ color: ok ? 'var(--tx)' : 'var(--mu)' }}>{t}</span>
                </div>
              ))}
            </div>
            <p className="xs muted" style={{ marginTop: 18 }}>Only authorised staff can access personal information. Changes are recorded in the audit log.</p>
          </Card>
        </div>
      </div>

      <div className="formbar">
        <span>{student ? (saved || `Last updated ${fmtDate(student.updatedAt)}`)
          : edit ? 'Last updated 09 Oct 2026 by Sarah Williams'
            : created ? `Application ${created.applicationNumber} saved`
              : canCapture ? 'Draft not yet saved · Required fields must be completed before admission'
                : canEnrol ? 'Enrols the student with a permanent student UID'
                  : 'Your role cannot record admission applications or enrol students'}</span>
        {saveError && <div style={{ flex: 1, minWidth: 220 }}><ApiErr error={saveError} /></div>}
        <div className="actions">
          {edit
            ? <><Link to={back} className="btn">Cancel</Link>
                <button type="button" className="btn" disabled={saving} onClick={student ? () => saveChanges(false) : undefined}>Save changes</button>
                <button type="submit" className="btn primary" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}Save & view profile</button></>
            : created
              // Saved: start the next application or go to the list
              ? <><button type="button" className="btn" onClick={addAnother}><Plus size={15} />Add another student</button>
                  <button type="submit" className="btn primary">View applications<ArrowRight size={15} /></button></>
              : <><Link to={back} className="btn">Cancel</Link>
                  {canCapture && <button type="button" className="btn" disabled={saving} onClick={() => saveApplication(false)}>Save draft</button>}
                  {canCapture && canEnrol && <button type="button" className="btn" disabled={saving} onClick={enrol}><UserPlus size={15} />Enrol directly</button>}
                  {canCapture || !canEnrol
                    ? <button type="submit" className="btn primary" disabled={saving || !canCapture}><Plus size={15} />Add student</button>
                    : <button type="submit" className="btn primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="spin" /> : <UserPlus size={15} />}Enrol student</button>}</>}
        </div>
      </div>
      <Footer />
    </form>
  );
}

/* ---------- profile ---------- */

const PROFILE_TABS = [
  ['overview', 'Overview'], ['academics', 'Academics'], ['attendance', 'Attendance'],
  ['fees', 'Fees & payments'], ['guardians', 'Guardians'], ['documents', 'Documents'], ['conduct', 'Conduct'],
];
const age = (dob) => {
  const d = new Date(dob); const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};

export function StudentProfile() {
  const { id } = useParams();
  const live = isStudentId(id);
  const { hasRole } = useAuth();
  // Live record: GET /api/v1/students/{id} (studentservice). Other ids show the static sample profile.
  const record = useStudentRecord(id, live);
  const s = live ? record.data : null;
  const [modal, setModal] = useState(null);
  // Fee status: GET /api/v1/finance/students/{id}/fee-account (financeservice, Module 04)
  const fees = useFeeAccount(live ? id : null);
  // Academic progress: GET /api/v1/academic/students/{id}/progress-trend (Module 05 assessments in studentservice)
  const trend = useProgressTrend(live ? id : null);
  // One section per tab, kept in the URL (/students/:id?tab=academics); Overview shows the whole summary
  const [params, setParams] = useSearchParams();
  const index = Math.max(0, PROFILE_TABS.findIndex(([key]) => key === params.get('tab')));
  const tab = PROFILE_TABS[index][0];
  const setTab = (i) => setParams(i === 0 ? {} : { tab: PROFILE_TABS[i][0] }, { replace: true });

  const header = (extra = []) => (
    <PageHeader
      title="Student profile"
      desc="A complete view of student progress, wellbeing and school records."
      actions={[
        { label: 'Back to students', icon: <ArrowLeft size={15} />, to: '/students' },
        ...extra,
        { label: 'Edit student', icon: <Pencil size={14} />, primary: true, to: `/students/${id}/edit` },
      ]}
    />
  );
  if (live && !s) {
    return <>{header()}<Card>{!record.canView ? <ApiNote>Student records are not available for your role.</ApiNote> : record.error ? <ApiErr error={record.error} /> : <Loading />}</Card></>;
  }

  const academicCard = s ? <AcademicProgressCard student={s} trend={trend} detailed={tab === 'academics'} /> : (
    <Card>
      <SectionHead title="Academic progress" sub="Term 1 · Latest assessment results" link="View academics →" to="/academics" />
      <>      <div style={{ margin: '18px 0 14px' }}>
        <DataTable boxed cols={[
          { label: 'Subject', key: 'a' }, { label: 'Teacher', key: 'b' }, { label: 'Grade', key: 'c', className: 'num' },
          { label: 'Progress', render: (r) => <span style={{ color: r.d === 'Above expected' ? 'var(--gr)' : 'var(--pr)', fontWeight: 500 }}>{r.d}</span> },
        ]} rows={[
          { a: 'Mathematics', b: 'Eleanor Hughes', c: '8', d: 'Above expected' },
          { a: 'English language', b: 'James Carter', c: '7', d: 'On track' },
          { a: 'Combined science', b: 'Aisha Rahman', c: '8–8', d: 'Above expected' },
          { a: 'History', b: 'Charlotte Evans', c: '7', d: 'On track' },
        ]} />
      </div>
      <p className="xs muted">Mid-term progress reports due Friday, 23 October at 16:00.</p></>
    </Card>
  );
  // Attendance: GET /api/v1/attendance/students/{id} (studentservice AM / PM registers)
  const attendanceCard = s ? <StudentAttendanceCard student={s} detailed={tab === 'attendance'} /> : (
    <Card>
      <SectionHead title="Attendance" sub="Term 1 to date" link="Register →" to="/attendance" />
      <>
      <div className="bignum" style={{ marginTop: 18 }}>97.8%</div>
      <div className="bar" style={{ margin: '14px 0 12px' }}><i style={{ width: '85%' }} /></div>
      <p className="xs muted" style={{ marginBottom: 14 }}>44 present · 1 excused · 0 unexcused</p>
      <Pill tone="green">Present today</Pill></>
    </Card>
  );
  const feesCard = s ? <FeeStatusCard student={s} fees={fees} onOpenTab={tab === 'fees' ? undefined : () => setTab(3)} /> : (
    <Card>
      <SectionHead title="Fee status" sub="Term 1 · 2026–2027" link="View account →" to="/fees" />
      <><div className="bignum" style={{ marginTop: 18 }}>{formatMoney(0, { decimals: 2 })}</div>
      <p className="xs muted" style={{ margin: '14px 0 12px' }}>Outstanding balance</p>
      <Pill tone="green">Paid in full</Pill>
      <p className="xs muted" style={{ marginTop: 12 }}>{formatMoney(2400)} received · {formatDate('2026-09-05')}</p></>
    </Card>
  );
  const guardiansCard = (
    <Card>
      <SectionHead title="Guardians & emergency contacts" link={s ? undefined : 'Manage contacts →'} />
      <div className="contacts" style={{ marginTop: 18 }}>
        {s ? (s.guardians?.length ? s.guardians.map((g) => (
          <div key={g.guardianId}><h4>{g.fullName}</h4>
            <Pill tone={g.primaryContact ? 'purple' : ''}>{g.relationship}{g.primaryContact ? ' · Primary contact' : ' · Emergency contact'}</Pill>
            <p>{g.mobileNumber}</p>{g.email && <p className="link" style={{ display: 'block' }}>{g.email}</p>}</div>
        )) : <ApiNote>No guardian on record. Edit the student to add one.</ApiNote>) : (<>
          <div><h4>Sarah Thompson</h4><Pill tone="purple">Mother · Primary contact</Pill><p>+44 7700 900 142</p><p className="link" style={{ display: 'block' }}>s.thompson@example.com</p></div>
          <div><h4>David Thompson</h4><Pill>Father · Emergency contact</Pill><p>+44 7700 900 143</p><p>Authorised for collection</p></div></>)}
      </div>
      {s?.emergencyContactPhone && <p className="xs muted" style={{ marginTop: 12 }}>Emergency phone on the record: {s.emergencyContactPhone}</p>}
      {s?.parentAccountId && <p className="xs muted" style={{ marginTop: 4 }}>Linked to a parent account shared with siblings.</p>}
    </Card>
  );
  const personalCard = (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Personal information</h3>
      <KV rows={s
        ? [['Date of birth', `${fmtDate(s.dateOfBirth)} · Age ${age(s.dateOfBirth)}`], ['Gender', GENDER_LABEL[s.gender] || s.gender],
          ['Student UID', s.studentUid], ['Roll number', s.rollNumber ?? '—'], ['Campus', s.branchId]]
        : [['Date of birth', '12 May 2011 · Age 15'], ['Gender', 'Female'], ['Nationality', 'British'], ['Admission number', 'OA-2024-106'], ['Address', '24 Willow Lane, Oxford, OX2 7AB']]} />
    </Card>
  );
  const medicalCard = (
    <Card>
      <div className="cardhead"><h3>Medical & wellbeing</h3><p>Restricted · Authorised staff only</p></div>
      {s ? (<>
        <div style={{ margin: '14px 0' }}>{hasAlert(s) ? <Pill tone="amber">Medical alert</Pill> : <Pill tone="green">No medical alerts</Pill>}</div>
        {hasAlert(s) && <p className="body-s">{s.medicalAlerts}</p>}
        <KV rows={[['Blood group', s.bloodGroup || 'Not recorded'], ['Emergency phone', s.emergencyContactPhone || 'Not recorded']]} />
        {hasRole(...ROLES.medical) && <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setModal('medical')}><HeartPulse size={14} />Update medical information</button></div>}
      </>) : (<>
        <div style={{ margin: '14px 0' }}><Pill tone="amber">Mild asthma</Pill></div>
        <p className="body-s">Salbutamol inhaler held at the school office. No known allergies. Care plan reviewed 01 September 2026.</p>
        <KV rows={[['GP surgery', 'Willow Medical Centre']]} />
      </>)}
    </Card>
  );
  const documentsCard = s ? <CertificatesCard student={s} onStudentChanged={record.reload} /> : (
    <Card>
      <SectionHead title="Documents" link="View all →" />
      <div style={{ marginTop: 14 }}>
        <Docs items={[['Birth certificate.pdf', '284 KB · 02 Sep 2024 · Verified'], ['Proof of address.pdf', '196 KB · 02 Sep 2024 · Verified'], ['Medical care plan.pdf', '312 KB · 01 Sep 2026 · Verified']]} />
      </div>
    </Card>
  );
  const conductCard = s ? <ConductCard student={s} /> : (
    <Card><SectionHead title="Conduct & counseling" sub="Disciplinary incidents and counseling notes · Restricted" />
      <div style={{ marginTop: 14 }}><ApiNote>This is a sample record. Open a student from the directory to see conduct records.</ApiNote></div></Card>
  );
  const name = s ? fullName(s) : 'Amara Thompson';
  // "Download record": the student's record as shown on this page, one field per row
  const downloadRecord = () => downloadCsv(`student-record-${s ? s.studentUid : 'ST-2024-106'}`, ['Section', 'Field', 'Value'], s ? [
    ['Student', 'Name', fullName(s)], ['Student', 'Student UID', s.studentUid], ['Student', 'Status', (studentApi.STUDENT_STATUS[s.studentStatus] || [s.studentStatus])[0]],
    ['Student', 'Date of birth', s.dateOfBirth], ['Student', 'Gender', GENDER_LABEL[s.gender] || s.gender], ['Student', 'Campus', s.branchId],
    ['Placement', 'Class', classLabel(s)], ['Placement', 'Roll number', s.rollNumber ?? ''], ['Placement', 'House', s.houseName || ''],
    ['Medical', 'Blood group', s.bloodGroup || ''], ['Medical', 'Alerts', hasAlert(s) ? s.medicalAlerts : 'None'], ['Medical', 'Emergency phone', s.emergencyContactPhone || ''],
    ...(s.guardians || []).map((g) => ['Guardian', `${g.fullName} (${g.relationship}${g.primaryContact ? ', primary' : ''})`, [g.mobileNumber, g.email].filter(Boolean).join(' · ')]),
    ['Record', 'Created', s.createdAt?.slice(0, 10) || ''], ['Record', 'Updated', s.updatedAt?.slice(0, 10) || ''],
  ] : [
    ['Student', 'Name', 'Amara Thompson'], ['Student', 'Student ID', 'ST-2024-106'], ['Student', 'Date of birth', '2011-05-12'], ['Student', 'Gender', 'Female'],
    ['Placement', 'Class', 'Year 10A'], ['Placement', 'House', 'Willow'], ['Medical', 'Alerts', 'Mild asthma'],
    ['Guardian', 'Sarah Thompson (Mother, primary)', '+44 7700 900 142 · s.thompson@example.com'], ['Guardian', 'David Thompson (Father)', '+44 7700 900 143'],
  ]);
  return (
    <>
      {header([
        { label: 'Download record', icon: <Download size={15} />, onClick: downloadRecord },
        s && hasRole(...ROLES.idCard) && { label: 'ID card', icon: <IdCard size={15} />, onClick: () => setModal('idcard') },
      ].filter(Boolean))}
      <Card className="summary">
        {s ? <StudentAvatar student={s} /> : <div className="bigavatar">{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>}
        <div className="id">
          <h2>{name}</h2>
          <p>{s ? `${s.studentUid} · ${classLabel(s)}${s.houseName ? ` · ${s.houseName} house` : ''}` : 'ST-2024-106 · Year 10A · Willow house'}</p>
          <div className="pills">{s ? <>{statusPill(s.studentStatus)}{hasAlert(s) && <Pill tone="purple">Medical alert</Pill>}</>
            : <><Pill tone="green">Active</Pill><Pill tone="purple">Medical care plan</Pill></>}</div>
        </div>
        <div className="side">
          {s ? <><span>{s.rollNumber ? `Roll number ${s.rollNumber}` : 'Roll number not assigned'}</span><span>Record created {fmtDate(s.createdAt)}</span></>
            : <><span>Form tutor: Eleanor Hughes</span><span>Admitted 02 September 2024</span></>}
          <span className="link strong">Message guardian →</span>
        </div>
      </Card>
      <Tabs items={PROFILE_TABS.map(([, label]) => label)} value={index} onChange={setTab} />
      {tab === 'overview' && (
        <div className="cols">
          <div className="stack">
            {academicCard}
            <div className="cols eq">{attendanceCard}{feesCard}</div>
            {guardiansCard}
          </div>
          <div className="stack">{personalCard}{medicalCard}{documentsCard}</div>
        </div>
      )}
      {tab === 'academics' && <div className="stack">{academicCard}</div>}
      {tab === 'attendance' && <div className="stack">{attendanceCard}</div>}
      {tab === 'fees' && <div className="stack">{feesCard}{s && <FeeAccountDetail fees={fees} />}</div>}
      {tab === 'guardians' && <div className="stack">{guardiansCard}</div>}
      {tab === 'documents' && <div className="stack">{documentsCard}</div>}
      {tab === 'conduct' && <div className="stack">{conductCard}</div>}
      {modal === 'medical' && <MedicalModal student={s} onClose={() => setModal(null)} onSaved={record.reload} />}
      {modal === 'idcard' && <IdCardModal student={s} onClose={() => setModal(null)} />}
      <Footer />
    </>
  );
}
