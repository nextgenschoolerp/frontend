import { useMemo, useState } from 'react';
import { Check, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, SectionHead, Tabs, DataTable, Pill, SkeletonTable } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useStudents } from './StudentRecords.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import * as hr from '../api/hrService.js';
import { formatNumber } from '../regional.js';

/*
 * Settings → Academic setup → Classes, sections & houses (studentservice /api/v1/academic):
 * the classes with their sections (seats, students on roll, class teacher) and the school houses.
 * Registrars and super administrators add classes, sections and houses, change a section's capacity and a house's
 * name and colour, and delete a class, section or house that nothing uses yet; principals, vice principals and registrars
 * also set class teachers (hrservice staff list).
 */

const { ROLES } = studentApi;
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : word.endsWith('s') ? 'es' : 's'}`;
const box = (id, label, input, hint) => (
  <div className="field box" key={id}><label htmlFor={id}>{label}</label>{input}{hint && <small className="xs muted">{hint}</small>}</div>
);
const fullName = (s) => `${s.firstName} ${s.lastName}`;
const nextLetter = (names) => {
  for (let c = 65; c <= 90; c += 1) { const l = String.fromCharCode(c); if (!names.includes(l)) return l; }
  return '';
};
/** Class 7 → GRADE-07, Nursery → GRADE-NURSERY, as the classes set up so far are coded */
const codeFor = (name) => {
  const n = name.trim().match(/^class\s+(\d+)$/i);
  return n ? `GRADE-${n[1].padStart(2, '0')}` : name.trim() ? `GRADE-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}` : '';
};

export function ClassStructureCard() {
  const { user, hasRole } = useAuth();
  const canEdit = hasRole(...ROLES.structure);
  const canTeacher = hasRole(...ROLES.classTeacher);
  const canRead = hasRole(...ROLES.classes);
  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user.tenantId], canRead);
  const gradeIds = (grades.data || []).map((g) => g.gradeId);
  const sections = useApi(() => Promise.all(gradeIds.map((id) => studentApi.listSections(id))).then((all) => all.flat()),
    [gradeIds.join(',')], gradeIds.length > 0);
  const canHouses = hasRole(...ROLES.houses);
  const houses = useApi(() => studentApi.listHouses(user.tenantId), [user.tenantId], canHouses);
  const students = useStudents();
  const [tab, setTab] = useState(0);
  const [modal, setModal] = useState(null); // { kind: 'class' | 'section' | 'editSection' | 'house', ... }
  const [notice, setNotice] = useState('');

  const onRoll = useMemo(() => {
    const bySection = new Map(), byHouse = new Map();
    (students.current || []).forEach((s) => {
      if (s.sectionId) bySection.set(s.sectionId, (bySection.get(s.sectionId) || 0) + 1);
      if (s.houseName) byHouse.set(s.houseName, (byHouse.get(s.houseName) || 0) + 1);
    });
    return { bySection, byHouse };
  }, [students.current]);
  const rows = useMemo(() => (grades.data || []).slice().sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)).map((g) => {
    const own = (sections.data || []).filter((s) => s.gradeId === g.gradeId).sort((a, b) => a.sectionName.localeCompare(b.sectionName, undefined, { numeric: true }));
    const seats = own.reduce((n, s) => n + (s.maxCapacity || 0), 0);
    const roll = own.reduce((n, s) => n + (onRoll.bySection.get(s.sectionId) || 0), 0);
    return { grade: g, sections: own, seats, roll };
  }), [grades.data, sections.data, onRoll]);
  const totalSections = rows.reduce((n, r) => n + r.sections.length, 0);
  const totalSeats = rows.reduce((n, r) => n + r.seats, 0);
  const done = (message) => { setModal(null); setNotice(message); grades.reload(); sections.reload(); houses.reload(); };

  if (!canRead) return <Card><SectionHead title="Classes, sections & houses" /><div style={{ marginTop: 12 }}><ApiNote>Classes and sections are visible to registrars, office clerks, teachers, principals and super administrators.</ApiNote></div></Card>;
  const loading = !grades.data || (gradeIds.length > 0 && !sections.data);
  return (
    <Card>
      <SectionHead title="Classes, sections & houses"
        sub={loading ? 'Loading the school structure…' : `${plural(rows.length, 'class')} · ${plural(totalSections, 'section')} · ${formatNumber(totalSeats)} seats · ${plural((houses.data || []).length, 'house')}`} />
      <div className="row" style={{ marginTop: 12, gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Tabs items={[`Classes & sections${grades.data ? ` (${rows.length})` : ''}`, `Houses${houses.data ? ` (${houses.data.length})` : ''}`]} value={tab} onChange={(i) => { setTab(i); setNotice(''); }} />
        {canEdit && (tab === 0
          ? <button className="btn" onClick={() => setModal({ kind: 'class' })}><Plus size={14} />Add class</button>
          : <button className="btn" onClick={() => setModal({ kind: 'house' })}><Plus size={14} />Add house</button>)}
      </div>
      {notice && <div className="api-note ok" style={{ marginTop: 12 }}><Check size={14} style={{ flex: 'none' }} /><span>{notice}</span></div>}
      {grades.error && <div style={{ marginTop: 12 }}><ApiErr error={grades.error} /></div>}

      {tab === 0 && !grades.error && (
        <div style={{ marginTop: 12 }}>
          {loading ? <SkeletonTable cols={['Class', 'Sections', 'Students', 'Seats', '']} rows={8} /> : !rows.length ? <ApiNote>No classes yet. Add the first class, then its sections.</ApiNote> : (
            <DataTable boxed cols={[
              { label: 'Class', render: (r) => <span className="cell-id"><b>{r.grade.gradeName}</b><small>{r.grade.gradeCode}</small></span> },
              { label: 'Sections', render: (r) => (r.sections.length ? (
                <div className="sectionchips">
                  {r.sections.map((s) => {
                    const n = onRoll.bySection.get(s.sectionId) || 0;
                    const full = s.maxCapacity && n >= s.maxCapacity;
                    const content = <><b>{s.sectionName}</b><span>{n}/{s.maxCapacity}</span><small>{s.classTeacherName || 'No class teacher'}</small></>;
                    return canEdit || canTeacher
                      ? <button type="button" key={s.sectionId} className={'sectionchip' + (full ? ' full' : '')} title={`Edit ${r.grade.gradeName}-${s.sectionName}`}
                          onClick={() => setModal({ kind: 'editSection', grade: r.grade, section: s, roll: n })}>{content}</button>
                      : <span key={s.sectionId} className={'sectionchip' + (full ? ' full' : '')}>{content}</span>;
                  })}
                </div>) : <span className="muted xs">No sections</span>) },
              { label: 'Students', className: 'num', render: (r) => (students.live ? formatNumber(r.roll) : '—') },
              { label: 'Seats', className: 'num', render: (r) => formatNumber(r.seats) },
              { label: '', render: (r) => (canEdit ? (
                <span className="row" style={{ gap: 12, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  <button className="link" onClick={() => setModal({ kind: 'section', grade: r.grade, taken: r.sections.map((s) => s.sectionName) })} aria-label={`Add section to ${r.grade.gradeName}`} title={`Add section to ${r.grade.gradeName}`}><Plus size={14} /></button>
                  <button className="link danger" aria-label={`Delete ${r.grade.gradeName}`} title={`Delete ${r.grade.gradeName}`}
                    onClick={() => setModal({ kind: 'delete', what: 'class', label: r.grade.gradeName, roll: r.roll, sections: r.sections.length,
                      run: () => studentApi.deleteGrade(r.grade.gradeId) })}><Trash2 size={13} /></button>
                </span>) : null) },
            ]} rows={rows} />
          )}
          <p className="xs muted" style={{ marginTop: 8 }}>
            Students on roll are for the campus selected in the header. {canEdit || canTeacher ? 'Choose a section to change its capacity or class teacher.' : ''}
          </p>
        </div>
      )}

      {tab === 1 && (
        <div style={{ marginTop: 12 }}>
          {!canHouses ? <ApiNote>Houses are visible to registrars, office clerks, class teachers, house masters, principals and super administrators.</ApiNote>
            : houses.error ? <ApiErr error={houses.error} /> : !houses.data ? <SkeletonTable cols={['House', 'Colour', 'Students', '']} rows={4} /> : !houses.data.length ? <ApiNote>No houses yet.</ApiNote> : (
            <DataTable boxed cols={[
              { label: 'House', render: (h) => <span className="row" style={{ gap: 8, justifyContent: 'flex-start' }}><i className="houseswatch" style={{ background: h.colorHex || 'var(--bd)' }} /><b style={{ fontWeight: 600 }}>{h.houseName}</b></span> },
              { label: 'Colour', render: (h) => <span className="xs">{h.colorHex || '—'}</span> },
              { label: 'Students', className: 'num', render: (h) => (students.live ? formatNumber(onRoll.byHouse.get(h.houseName) || 0) : '—') },
              { label: '', render: (h) => (canEdit ? (
                <span className="row" style={{ gap: 12, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  <button className="link" aria-label={`Edit ${h.houseName} house`} title={`Edit ${h.houseName} house`} onClick={() => setModal({ kind: 'house', house: h })}><Pencil size={13} /></button>
                  <button className="link danger" aria-label={`Delete ${h.houseName} house`} title={`Delete ${h.houseName} house`}
                    onClick={() => setModal({ kind: 'delete', what: 'house', label: `${h.houseName} house`, roll: onRoll.byHouse.get(h.houseName) || 0,
                      run: () => studentApi.deleteHouse(h.houseId) })}><Trash2 size={13} /></button>
                </span>) : null) },
            ]} rows={houses.data.slice().sort((a, b) => a.houseName.localeCompare(b.houseName))} />
          )}
        </div>
      )}

      {modal?.kind === 'class' && <ClassModal grades={grades.data || []} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'section' && <SectionModal grade={modal.grade} taken={modal.taken} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'editSection' && <EditSectionModal {...modal} canEdit={canEdit} canTeacher={canTeacher} onClose={() => setModal(null)} onSaved={done}
        onDelete={() => setModal({ kind: 'delete', what: 'section', label: `${modal.grade.gradeName}-${modal.section.sectionName}`, roll: modal.roll,
          run: () => studentApi.deleteSection(modal.section.sectionId) })} />}
      {modal?.kind === 'delete' && <DeleteModal {...modal} onClose={() => setModal(null)} onDeleted={done} />}
      {modal?.kind === 'house' && <HouseModal house={modal.house} onClose={() => setModal(null)} onSaved={done} />}
    </Card>
  );
}

/** Runs a save; keeps the error for the modal. */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); return true; } catch (e) { setError(e); return false; } finally { setBusy(false); }
  };
  return { busy, error, run };
}

function Foot({ busy, onClose, onSave, label, disabled }) {
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
      <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
      <button className="btn primary" onClick={onSave} disabled={busy || disabled}>{busy ? 'Saving…' : label}</button>
    </div>
  );
}

function ClassModal({ grades, onClose, onSaved }) {
  const { user } = useAuth();
  const nextOrder = grades.reduce((n, g) => Math.max(n, g.sequenceOrder || 0), 0) + 1;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [order, setOrder] = useState(String(nextOrder));
  const save = useSave();
  const finalCode = code || codeFor(name);
  const dupName = grades.some((g) => g.gradeName.toLowerCase() === name.trim().toLowerCase());
  const dupCode = grades.some((g) => g.gradeCode.toLowerCase() === finalCode.toLowerCase());
  const valid = name.trim() && finalCode && Number(order) >= 1 && !dupName && !dupCode;
  const submit = () => save.run(async () => {
    await studentApi.createGrade({ tenantId: user.tenantId, gradeName: name.trim(), gradeCode: finalCode, sequenceOrder: Number(order) });
    onSaved(`${name.trim()} added. Add its sections next.`);
  });
  return (
    <Modal title="Add class" sub="A class (grade) of the school; add its sections afterwards" onClose={onClose}
      footer={<Foot busy={save.busy} onClose={onClose} onSave={submit} label="Add class" disabled={!valid} />}>
      <div className="fieldgrid">
        {box('cl-name', 'CLASS NAME *', <input id="cl-name" value={name} maxLength={50} placeholder="e.g. Class 13 or Pre-Nursery" onChange={(e) => setName(e.target.value)} />,
          dupName ? 'A class with this name already exists' : '')}
        {box('cl-code', 'CODE', <input id="cl-code" value={code} maxLength={20} placeholder={codeFor(name) || 'GRADE-13'} onChange={(e) => setCode(e.target.value.toUpperCase())} />,
          dupCode ? 'This code is already used' : 'Leave blank to use the suggested code')}
        {box('cl-order', 'ORDER *', <input id="cl-order" type="number" min={1} value={order} onChange={(e) => setOrder(e.target.value)} />, 'Position in class lists (Nursery is 1)')}
      </div>
      {save.error && <div style={{ marginTop: 12 }}><ApiErr error={save.error} /></div>}
    </Modal>
  );
}

function SectionModal({ grade, taken, onClose, onSaved }) {
  const [name, setName] = useState(nextLetter(taken));
  const [capacity, setCapacity] = useState(String((grade.sequenceOrder || 4) <= 3 ? 30 : 40));
  const save = useSave();
  const n = name.trim().toUpperCase();
  const dup = taken.includes(n);
  const cap = Number(capacity);
  const valid = n && !dup && cap >= 1 && cap <= 100;
  const submit = () => save.run(async () => {
    await studentApi.createSection({ gradeId: grade.gradeId, sectionName: n, maxCapacity: cap });
    onSaved(`${grade.gradeName}-${n} added with ${cap} seats.`);
  });
  return (
    <Modal title={`Add a section to ${grade.gradeName}`} sub={taken.length ? `Existing sections: ${taken.join(', ')}` : 'This class has no sections yet'} onClose={onClose}
      footer={<Foot busy={save.busy} onClose={onClose} onSave={submit} label="Add section" disabled={!valid} />}>
      <div className="fieldgrid">
        {box('se-name', 'SECTION *', <input id="se-name" value={name} maxLength={10} onChange={(e) => setName(e.target.value)} />, dup ? `${grade.gradeName} already has section ${n}` : 'Usually a letter: A, B, C…')}
        {box('se-cap', 'SEATS *', <input id="se-cap" type="number" min={1} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} />, '1 to 100 students')}
      </div>
      <p className="xs muted" style={{ marginTop: 10 }}>Set the class teacher after adding the section.</p>
      {save.error && <div style={{ marginTop: 12 }}><ApiErr error={save.error} /></div>}
    </Modal>
  );
}

function EditSectionModal({ grade, section, roll, canEdit, canTeacher, onClose, onSaved, onDelete }) {
  const { branchId } = useAuth();
  const staff = useApi(() => hr.listEmployees(branchId ? { branchId } : {}), [branchId], canTeacher);
  const teachers = useMemo(() => (staff.data || [])
    .filter((s) => s.isActive !== false && !['RESIGNED', 'RETIRED', 'TERMINATED'].includes(s.employmentStatus) && hr.TEACHING_DEPARTMENTS.includes(s.department))
    .sort((a, b) => fullName(a).localeCompare(fullName(b))), [staff.data]);
  const [capacity, setCapacity] = useState(String(section.maxCapacity ?? 40));
  const [teacherId, setTeacherId] = useState(section.classTeacherId || '');
  const save = useSave();
  const cap = Number(capacity);
  const capChanged = canEdit && cap !== section.maxCapacity;
  const teacherChanged = canTeacher && teacherId && teacherId !== (section.classTeacherId || '');
  const capError = cap < 1 || cap > 100 ? '1 to 100 students' : cap < roll ? `${roll} students are on roll; the capacity cannot be lower` : '';
  const label = `${grade.gradeName}-${section.sectionName}`;
  const submit = () => save.run(async () => {
    if (capChanged) await studentApi.updateSection(section.sectionId, { maxCapacity: cap });
    if (teacherChanged) {
      const t = teachers.find((x) => x.staffId === teacherId);
      await studentApi.assignClassTeacher(section.sectionId, { staffId: teacherId, staffName: fullName(t) });
    }
    onSaved(`${label} saved.`);
  });
  return (
    <Modal title={`Section ${label}`} sub={`${plural(roll, 'student')} on roll at this campus`} onClose={onClose}
      footer={<div className="row" style={{ gap: 8, justifyContent: 'space-between', width: '100%' }}>
        {canEdit ? <button className="btn danger" onClick={onDelete} disabled={save.busy}><Trash2 size={14} />Delete section</button> : <span />}
        <Foot busy={save.busy} onClose={onClose} onSave={submit} label="Save" disabled={(!capChanged && !teacherChanged) || !!capError} />
      </div>}>
      <div className="fieldgrid">
        {box('es-cap', 'SEATS', <input id="es-cap" type="number" min={Math.max(1, roll)} max={100} value={capacity} disabled={!canEdit} onChange={(e) => setCapacity(e.target.value)} />,
          capError || (canEdit ? '' : 'Registrars and super administrators change capacity'))}
        {box('es-teacher', 'CLASS TEACHER', canTeacher ? (
          <select id="es-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} disabled={!staff.data}>
            <option value="">{staff.data ? 'Not assigned' : 'Loading teachers…'}</option>
            {teachers.map((t) => <option key={t.staffId} value={t.staffId}>{fullName(t)} · {t.designation}</option>)}
          </select>) : <input id="es-teacher" readOnly value={section.classTeacherName || 'Not assigned'} />,
        staff.error ? 'The staff list could not be loaded' : canTeacher ? 'Teaching staff of this campus' : 'Principals and registrars set the class teacher')}
      </div>
      {section.classTeacherName && <p className="xs muted" style={{ marginTop: 10 }}>Current class teacher: <Pill>{section.classTeacherName}</Pill></p>}
      {save.error && <div style={{ marginTop: 12 }}><ApiErr error={save.error} /></div>}
    </Modal>
  );
}

function HouseModal({ house, onClose, onSaved }) {
  const { user } = useAuth();
  const [name, setName] = useState(house?.houseName || '');
  const [colour, setColour] = useState(house?.colorHex || '#7E57C2');
  const save = useSave();
  const valid = name.trim() && /^#[0-9A-Fa-f]{6}$/.test(colour);
  const submit = () => save.run(async () => {
    const body = { houseName: name.trim(), colorHex: colour.toUpperCase() };
    if (house) await studentApi.updateHouse(house.houseId, body);
    else await studentApi.createHouse({ tenantId: user.tenantId, ...body });
    onSaved(house ? `${body.houseName} house saved.` : `${body.houseName} house added.`);
  });
  return (
    <Modal title={house ? `Edit ${house.houseName} house` : 'Add house'} sub="Houses group students across classes for sports and activities" onClose={onClose}
      footer={<Foot busy={save.busy} onClose={onClose} onSave={submit} label={house ? 'Save' : 'Add house'} disabled={!valid} />}>
      <div className="fieldgrid">
        {box('ho-name', 'HOUSE NAME *', <input id="ho-name" value={name} maxLength={50} placeholder="e.g. Kalam" onChange={(e) => setName(e.target.value)} />)}
        {box('ho-colour', 'COLOUR *', (
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <input id="ho-colour" type="color" value={/^#[0-9A-Fa-f]{6}$/.test(colour) ? colour : '#7E57C2'} onChange={(e) => setColour(e.target.value)} style={{ width: 44, padding: 2 }} />
            <input aria-label="Colour code" value={colour} maxLength={7} onChange={(e) => setColour(e.target.value)} style={{ width: 100 }} />
          </div>), 'Shown on ID cards and house lists')}
      </div>
      {save.error && <div style={{ marginTop: 12 }}><ApiErr error={save.error} /></div>}
    </Modal>
  );
}

/**
 * Confirms a delete. The server checks every table that could still refer to the record (students now or in the past,
 * attendance, timetable, homework, marks, fee schedules, admissions …) and refuses with the list; nothing is removed then.
 */
function DeleteModal({ what, label, roll, sections, run, onClose, onDeleted }) {
  const save = useSave();
  const blocked = roll > 0;
  const submit = () => save.run(async () => { await run(); onDeleted(`${label} deleted.`); });
  const effect = what === 'class' ? (sections ? `${label} and its ${plural(sections, 'section')} will be removed.` : `${label} will be removed.`)
    : what === 'section' ? `Section ${label} will be removed.` : `The ${label} will be removed.`;
  return (
    <Modal title={`Delete ${label}?`} sub="This cannot be undone" onClose={onClose}
      footer={<div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose} disabled={save.busy}>Cancel</button>
        <button className="btn danger" onClick={submit} disabled={save.busy || blocked}><Trash2 size={14} />{save.busy ? 'Deleting…' : `Delete ${what}`}</button>
      </div>}>
      {blocked
        ? <ApiNote>{label} has {plural(roll, 'student')} on roll at this campus. Move them to another {what === 'house' ? 'house' : 'class or section'} first.</ApiNote>
        : <p className="body-s">{effect} It can only be deleted while nothing uses it: no students (current or past), attendance, timetable, homework, marks, fees or admissions. If something still does, you will see what.</p>}
      {save.error && <div style={{ marginTop: 12 }}><ApiErr error={save.error} /></div>}
    </Modal>
  );
}
