import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { currentBrand } from '../branding.js';

/*
 * Privacy policy and terms of use, reachable before sign-in (links in the sign-in footer).
 * Standard wording for a school management system. The school should have its own legal adviser review and adapt it
 * (or point VITE_PRIVACY_URL / VITE_TERMS_URL at its own pages, see AuthShell).
 */
const UPDATED = '1 November 2026';

function Page({ title, children }) {
  const school = currentBrand();
  useEffect(() => { document.title = `${title} – ${school.name}`; }, [title, school.name]);
  return (
    <main className="legal">
      <Link to="/login" className="login-back" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={14} />Back to sign in</Link>
      <h1>{title}</h1>
      <p className="legal-meta">{school.name} · Last updated {UPDATED}</p>
      {children(school)}
    </main>
  );
}

const Contact = ({ school }) => (school.email
  ? <>write to <a href={`mailto:${school.email}`}>{school.email}</a></>
  : <>contact the school office or your school’s IT administrator</>);

export function Privacy() {
  return (
    <Page title="Privacy policy">
      {(school) => (
        <>
          <p>This policy explains how {school.name} uses this school management system (“the system”) to look after information about students, parents and guardians, and staff.</p>

          <h2>What we keep</h2>
          <ul>
            <li><b>Students:</b> name, date of birth, class, attendance, marks, fees, health and emergency details, photographs and documents the school needs for admission and safety.</li>
            <li><b>Parents and guardians:</b> name, relationship, phone number and email address.</li>
            <li><b>Staff:</b> name, role, contact details, joining and pay details, leave and attendance, and identity and bank details where the school needs them for payroll and statutory returns.</li>
            <li><b>Sign-in data:</b> username, the times you sign in and the actions you take in the system (the audit log). Passwords are stored only in scrambled (hashed) form.</li>
          </ul>

          <h2>Why we use it</h2>
          <p>To run the school: admissions, classes and timetables, attendance, examinations, fees, payroll, safety, and communication with families. We do not sell personal information and we do not use it for advertising.</p>

          <h2>Who can see it</h2>
          <p>Access depends on the role the school gives you. For example, a teacher sees the students they teach, the accounts team sees fees, and only a few administrators can see identity and bank numbers. Sensitive actions are recorded in the audit log. Information is shared outside the school only when the law requires it or the school has your permission, for example with the board or examination authority, a payment provider, or a messaging provider the school uses to reach families.</p>

          <h2>How we protect it</h2>
          <p>Sign-in is required, access is limited by role, data travels over encrypted connections, and temporary passwords must be changed at first sign-in. Please keep your password private, sign out on shared computers, and tell the school at once if you think your account was used by someone else.</p>

          <h2>How long we keep it</h2>
          <p>Records are kept while a student is enrolled or a staff member is employed, and afterwards for the period the school and the law require (for example admission, transfer certificate, fee and payroll records). After that they are deleted or anonymised.</p>

          <h2>Your rights</h2>
          <p>You may ask to see the information held about you or your child, to have mistakes corrected, and to ask questions about how it is used. For a student under 18 a parent or guardian makes the request. To do so, <Contact school={school} />.</p>

          <h2>Changes</h2>
          <p>If this policy changes, the new version appears on this page with a new date.</p>
        </>
      )}
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use">
      {(school) => (
        <>
          <p>By signing in to the system provided by {school.name} you agree to these terms.</p>

          <h2>Your account</h2>
          <ul>
            <li>Your account is for you alone. Do not share your password or let anyone use your session.</li>
            <li>Sign out on shared computers. Report a lost password or suspected misuse to the school at once.</li>
            <li>The school may suspend an account that is misused, or when a person leaves the school.</li>
          </ul>

          <h2>Acceptable use</h2>
          <ul>
            <li>Use the system only for school purposes and only for the records your role allows.</li>
            <li>Do not look up, copy, export or share personal information of students, families or colleagues without a school reason.</li>
            <li>Do not try to get around access limits, test the security of the system, or upload harmful or unlawful content.</li>
            <li>Enter accurate information. Corrections to records should be made through the proper screens so they are logged.</li>
          </ul>

          <h2>Records and monitoring</h2>
          <p>Your sign-ins and actions are recorded in an audit log, which the school may review for security, fairness and legal reasons.</p>

          <h2>Availability</h2>
          <p>The school works to keep the system available but it may be unavailable for maintenance or for reasons outside the school’s control. The school is not responsible for loss that results from that.</p>

          <h2>Ownership</h2>
          <p>School records belong to {school.name}. The software is provided under licence; you may not copy it or reverse engineer it.</p>

          <h2>Changes and questions</h2>
          <p>These terms may be updated; the latest version is always on this page. Questions: <Contact school={school} />. See also the <Link to="/privacy">privacy policy</Link>.</p>
        </>
      )}
    </Page>
  );
}
