# Bulk data import: students and staff

This guide shows how to work with many students or staff members at once, using **Settings → Data import**. There are three kinds of import, chosen with the tabs under *Students / Staff*:

| Tab | What it does | File |
|---|---|---|
| **Add new** | Creates new students or staff | Excel or CSV, one person per row |
| **Update existing** | Changes details of people already in the system, found by **Student UID** or **employee code** | Excel or CSV |
| **Photos (ZIP)** | Sets profile photos, each photo named after the Student UID or employee code | One ZIP file |

For staff, **Add new** and **Update existing** can also create **sign-in accounts** (section 11).

Nothing is saved until you choose **Import**. Before that the system only checks your file and tells you which rows need fixing.

---

## 1. Who can import

| Import | Roles |
|---|---|
| Students | IT system administrator, super administrator, registrar |
| Staff | IT system administrator, super administrator, HR manager |

Creating sign-in accounts for staff needs the IT system administrator or super administrator role. Photos and updates use the same roles as the import itself.

The **Data import** tab appears in Settings only for these roles. If you can import both, a **Students / Staff** switch appears at the top of the card.

Records are added to the **campus selected in the header** (for example *DPS North Campus*). Choose the right campus before you start. The campus is not a column in the file.

---

## 2. The process at a glance

1. **Download the template.** Use the Excel template (recommended) or the CSV template.
2. **Fill it in.** One student or staff member per row, starting on row 2.
3. **Upload and check.** Choose the file and click **Check file**. The system checks every row and saves nothing.
4. **Review.** Rows marked *Ready* can be imported. Rows marked *Has errors* show what is wrong.
5. **Import.** Choose how to import and click **Import**.
6. **Fix and repeat.** Download the **error report**, correct those rows, and upload that file the same way.

---

## 3. Download the template

Go to **Settings → Data import** and choose **Students** or **Staff**. Then click one of these:

- **Excel template (.xlsx)**: recommended. It has:
  - **The data sheet** (*Students* or *Staff*), where you type the data.
    - Mandatory columns are marked `*` and shaded yellow.
    - Columns such as Class, Section, House, Gender, Blood group, Guardian relationship and Department have **dropdowns** filled with your school's own values.
    - Cells are formatted as text, so leading zeros and `+91` are kept.
  - **Instructions**: every column, whether it is mandatory, what to enter, and an example.
- **CSV template**: the header row only. Use it if you prepare data in another system. Save the file as **CSV UTF-8**.

> Always start from a freshly downloaded template. Classes, sections, houses and departments in the dropdowns are taken from the school's current setup.

---

## 4. Fill in the file

### General rules

- One record per row, starting on **row 2**. Do not change, reorder or delete the header row. Extra columns you add are ignored.
- **Dates:** `DD/MM/YYYY`, for example `14/03/2015`. `YYYY-MM-DD` and `14 Mar 2015` are also accepted, as are real Excel date cells.
- **Mobile numbers:** 10 digits starting with 6–9, for example `9810012301`. `+91`, spaces and dashes are fine. The number is saved as `+919810012301`.
- Blank rows are skipped. You can upload up to **5,000 rows and 10 MB** in one file. Split bigger lists into several files.
- Leading and trailing spaces are removed automatically.

### Student columns

| Column | Mandatory | What to enter |
|---|---|---|
| First name | **Yes** | Given name, up to 100 characters |
| Last name | **Yes** | Family name, up to 100 characters |
| Date of birth | **Yes** | DD/MM/YYYY, in the past and suitable for the class (for example about 11 years old for Class 6) |
| Gender | **Yes** | Male, Female or Other |
| Class | **Yes** | A class set up for the school, such as `Class 6`, `Nursery`, `LKG` or `UKG`. A plain number such as `6` also works |
| Section | **Yes** | A section of that class, such as `A` |
| Roll number | No | A whole number, unique within the section |
| House | No | One of the school houses |
| Admission number | No | The school's own admission number |
| Admission date | No | DD/MM/YYYY, not in the future |
| Nationality | No | For example `Indian` |
| Blood group | No | A+, A-, B+, B-, AB+, AB-, O+ or O- |
| Medical conditions | No | Conditions staff must know about; blank means none |
| Allergies | No | Known allergies |
| Residential address | No | Home address |
| Guardian name | **Yes** | The primary guardian's full name |
| Guardian relationship | **Yes** | Father, Mother, Guardian, Grandparent, Uncle, Aunt, Sibling or Other |
| Guardian mobile | **Yes** | 10-digit Indian mobile number |
| Guardian email | No | Email for school messages |
| Emergency phone | **Yes** | 10-digit mobile number to call in an emergency |

Each student gets a permanent **Student UID** when imported, exactly as when enrolled from the *Add student* form. The guardian is saved as the primary contact. You can add a second guardian, documents and a photo later from the student's profile.

### Staff columns

| Column | Mandatory | What to enter |
|---|---|---|
| Employee code | **Yes** | The school's staff number, unique (for example `DPS-EMP-2001`) |
| First name | **Yes** | Given name |
| Last name | **Yes** | Family name |
| Department | **Yes** | For example Mathematics or Administration. Choose from the dropdown or type your own |
| Designation | **Yes** | Job title, for example `TGT Mathematics` or `Office Clerk` |
| Joining date | **Yes** | DD/MM/YYYY, no more than 90 days ahead |
| Basic salary | **Yes** | Monthly basic pay in rupees, for example `45000` |
| Email | **Yes** | Official email address, unique |
| Mobile | **Yes** | 10-digit Indian mobile number |
| Probation end date | No | DD/MM/YYYY, not before the joining date. When blank, 6 months after joining |
| Qualifications | No | For example `M.Sc. Mathematics, B.Ed.` |
| PAN | No | 10 characters, for example `ABCDE1234F` (unique) |
| Aadhaar | No | 12 digits |
| PF UAN | No | 12 digits |
| ESI number | No | 10 or 17 digits |
| Bank name | No | For example `State Bank of India` |
| Bank account number | No | 9 to 18 digits |
| Bank IFSC | No | 11 characters, for example `SBIN0001234` |

New staff start **on probation** with an *Active* status, exactly as when added from the Staff page. Sign-in accounts are not created by the import.

---

## 5. Upload and check the file

1. In step 2 of the card, click **Choose file** and pick your `.xlsx` or `.csv` file.
2. Click **Check file**.

The system reads every row and checks it. Nothing is saved at this point. You then see:

- A summary, for example *120 rows · 112 ready · 8 with errors*.
- A table with one line per row: the **row number** in your file, the name, the class or department, the **status**, and the **problems** found.
- **Only rows with errors**, which hides the ready rows.

### What is checked

| Check | Example message |
|---|---|
| Mandatory fields are filled | *Guardian mobile: is required* |
| Formats | *Date of birth: use DD/MM/YYYY*, *Email: is not a valid email address*, *PAN: must look like ABCDE1234F* |
| Values exist in the school | *Class: "Class 13" is not a class of this school*, *Section: Section F is not set up for Class 6* |
| Sensible values | *Date of birth: age 4 does not suit Class 6*, *Joining date: is more than 90 days ahead* |
| Roll numbers | *Roll number: Roll number 12 is already used in Class 7-A* |
| Section capacity | *Section: Class 6-A is full (40 students)* |
| Duplicates in the file | *Duplicate of row 3 in this file*, *Employee code repeats row 5 of this file* |
| Duplicates already in the system | *Duplicate: already enrolled as STU-2026-00101*, *Employee code is already used by DPS-EMP-1025* |

If the whole file cannot be read, you see a single message instead of the table. For example:

- *These mandatory columns are missing from the file: Guardian mobile.* The header row was changed. Copy your data into a fresh template.
- *Upload an Excel (.xlsx) or CSV (.csv) file.* The file is another type, such as PDF or `.numbers`.
- *The file has 6,200 rows; upload at most 5000 at a time.* Split the file.

---

## 6. Import

At the bottom of the results, choose one option:

- **Import the ready rows, skip the rows with errors.** This is the default. Ready rows are saved; rows with errors are left for you to fix.
- **Import only if every row is valid (all or nothing).** Nothing is saved unless every row is ready. This option is available only when the check found no errors. Use it when the list must go in complete, for example a whole new section.

Then click **Import _n_ students** (or staff members).

Before saving, the system checks the rows once more, in case someone enrolled a student or used a roll number in the meantime. The result shows:

- *Imported _n_ students.* Each imported row links to the new record, and the Student UID or employee code is shown.
- Any row that could not be saved is marked *Not saved* with the reason.

A checked file must be imported within **24 hours**. After that, upload it again.

---

## 7. Fix the remaining rows

1. Click **Error report**. A CSV downloads with only the rows that need fixing. It has your original values, a **Row** column (the row number in your original file) and an **Errors** column explaining each problem.
2. Open it in Excel and correct the values. You can delete the *Row* and *Errors* columns, but you don't have to; they are ignored.
3. Upload the corrected file in step 2 and import as before.

---

## 8. Import history

The **Import history** card lists the last 50 uploads of each kind. Each entry shows:

- when the file was checked or imported, by whom, and the file name;
- its status (*Checked, not imported*, *Imported* or *Expired*);
- the row counts;
- a link to the **error report**.

**Privacy:** uploaded files are never stored. After an import, the values of imported rows are removed from the history; only names, classes or departments and the new record numbers remain. Aadhaar and bank numbers are never shown on screen.

---

## 9. Update existing records (version 2)

Use **Update existing** to correct or add details for people who are already in the system, for example new guardian mobile numbers, houses or bank details.

1. **Download the current students (or staff).** Click **Current students (.xlsx)** or **Current staff (.xlsx)**. The file holds today's details of the selected campus, with the **Student UID** (or **Employee code**) in the first column. A *Blank update template* is also available.
2. **Change only what you need.** Edit the cells to change, and delete the rows you do not need. **A blank cell keeps the current value; it never clears it.** The only mandatory column is the Student UID or Employee code.
3. **Check, review and import** exactly as in sections 5 and 6. The result table has a **Changes** column naming what will change, for example *House, Guardian mobile*.

What the check does for update rows:

| Situation | Result |
|---|---|
| The UID or employee code matches one person | *Ready*, with the changed fields listed |
| Nothing differs from what is on record | *No change* (not an error, not imported) |
| Unknown UID or employee code | *No student has the UID …* / *No staff member has the employee code …* |
| The same person twice in the file | *repeats row N of this file* |
| The person is on another campus | Choose that campus, then upload again |
| Same values checked as for new records | Formats, houses, roll numbers, unique email and PAN |

Limits of an update:

- **Class and section cannot be changed** by file. Use **Transfer** on the student's profile. Leave those columns as they are or blank.
- Student guardian columns change the **primary guardian**. A student with no guardian on record needs the name, relationship and mobile together.
- Updates go through the same code as the Edit forms, so the audit log records each change.

---

## 10. Photos from a ZIP (version 2)

1. Put JPG or PNG photos (up to 5 MB each) in one ZIP file. **Name each photo after the person**: `STU-2026-0001.jpg` for a student, `DPS-EMP-2001.png` for a staff member. Capital letters do not matter. Folders inside the ZIP are fine; hidden files, `__MACOSX` and `Thumbs.db` are ignored.
2. In **Photos (ZIP)**, choose the ZIP and click **Check file**. Nothing is saved. Each photo shows its person and whether it is *Ready* or has a problem.
3. Click **Save photos**. Matching photos replace the current ones. Photos with problems are listed in the error report; fix the ZIP and upload it again.

Problems the check reports:

| Message | Meaning |
|---|---|
| *No student has the UID "…"; name the file after the Student UID* | The file name does not match anyone |
| *Only JPG or PNG photos are accepted* | Other file types in the ZIP |
| *The photo is larger than 5 MB* | Reduce the picture |
| *The file is not a valid JPEG or PNG image* | The file only looks like an image |
| *Repeats the photo in row N* | Two photos for the same person |

The ZIP may be up to 60 MB and 2,000 photos; split larger sets. The type is decided from the picture itself, so a PNG named `.jpg` is accepted.

---

## 11. Sign-in accounts for staff (version 2)

Staff do not get a sign-in automatically. The importer can create accounts for the staff in your file.

1. In the staff file, fill the **System role** column for each person who needs an account. Choose from the dropdown, for example *Subject Teacher*, *Office Clerk* or *HR Manager*. It decides what the person can open. Leave it blank for staff without an account.
2. After checking the file, tick **Also create sign-in accounts for rows that have a System role** next to the Import button. (In an **Update existing** file this applies to staff who do not have an account yet.)
3. Click **Import**. The staff are saved, then the accounts are created and linked to the staff records.
4. The **Sign-in accounts** panel shows each username and a **temporary password**. Click **Sign-in details (.csv)** and hand these over safely. **The passwords are shown only now and are not stored anywhere.** Each person must choose a new password at first sign-in.

Rules:

- The username is the part of the email before the @ (for example `meera.iyer`); a number is added if it is taken.
- An email that already has an account is not given a second one. The result shows the existing username.
- Principals, IT administrators, auditors, trustees and super administrators cannot be created from an import. Create those accounts by hand.
- An account that could not be created does not undo the staff import. Fix the cause and use **Update existing** with the System role to try again.

---

## 12. Practice with the sample files

Two sample files are in `frontend/docs/import-samples/`:

| File | Rows | What the check should show |
|---|---|---|
| `students-sample.csv` | 11 | 8 ready. 3 with errors: row 10 has no guardian mobile, row 11 has an impossible date (31/02/2015), and row 12 repeats row 3 |
| `staff-sample.csv` | 7 | 5 ready. 2 with errors: row 7 has an invalid PAN (`ABC123`), and row 8 uses employee code `DPS-EMP-1025`, which already exists |

Upload one in **Settings → Data import**, look at the results, import the ready rows, then download the error report and see how the remaining rows are explained.

> The sample students are added to the selected campus as real records. Use them on a test system only.

---

## 13. For administrators: setup and API

- **Database:** two tables hold the checked uploads, `student_import_jobs` (studentservice) and `staff_import_jobs` (hrservice).
  - They are in `database/create.sql` and the module 03 and 07 `create.sql` files.
  - Upgrade scripts: `studentservice/src/main/resources/db/upgrade/module03_student_import_jobs.sql` and `hrservice/src/main/resources/db/upgrade/module07_staff_import_jobs.sql`.
  - Version 2 adds `import_mode` (CREATE, UPDATE or PHOTOS) and `updated_count` to both tables: `module03_student_import_v2.sql` and `module07_staff_import_v2.sql`. Run them before starting the services.
- **Build:** both services now depend on Apache POI (`org.apache.poi:poi-ooxml:5.2.5`). Restart them after pulling the change.
- **Endpoints** (students under `/api/v1/students/import`, staff under `/api/v1/hr/employees/import`):

| Method and path | Purpose |
|---|---|
| `GET /template?format=xlsx\|csv&mode=CREATE\|UPDATE&prefill=true\|false&branchId=` | Download the template (students also need `tenantId`). `UPDATE` with `prefill=true` fills in the campus's current records |
| `POST /check?mode=CREATE\|UPDATE` (multipart `file`, `branchId`) | Read and check the file; returns the job and every row. Nothing is saved |
| `POST /photos?dryRun=true\|false` (multipart ZIP `file`, `branchId`) | Check or save a ZIP of photos named after the Student UID / employee code. `dryRun=true` saves nothing |
| `POST /link-accounts` (staff only; body `{links:[{staffId,userId}]}`) | Links new sign-in accounts to staff who have none |
| `POST /{jobId}/commit?mode=VALID_ONLY\|ALL_OR_NOTHING` | Import a checked upload |
| `GET /jobs` | Import history |
| `GET /jobs/{jobId}` | One upload with its rows |
| `GET /jobs/{jobId}/errors` | Error report (CSV) |

- **Sign-in accounts** are created by authservice: `POST /api/v1/users/staff-accounts` (IT system administrator or super administrator). Body `{accounts:[{employeeCode, firstName, lastName, email, roleName, branchId}]}`, up to 500 per call. Each reply holds `status` (CREATED or FAILED), `username`, `roleCode`, the one-time `temporaryPassword` and a message. The account has `must_change_password` set. The password is never written to the audit log. `SUPER_ADMIN`, `TRUSTEE` and `APPLICANT_PARENT` can never be given; `PRINCIPAL`, `SCHOOL_PRINCIPAL`, `VICE_PRINCIPAL`, `IT_SYSTEM_ADMIN`, `SECURITY_AUDITOR` and `AUDITOR` only by a super administrator. The screen calls authservice, then hrservice `link-accounts`, so the three services stay independent.
- **Upload limits:** spreadsheets 10 MB and 5,000 rows; ZIP 60 MB and 2,000 files (each photo 5 MB, 400 MB unpacked). Both services accept requests up to 63 MB (`spring.servlet.multipart`).
- **Behaviour:** new records are created through the same code as the forms, `StudentService.enrollStudent` and `EmployeeService.createEmployee`. Student UIDs, guardians, probation dates and audit-log entries are therefore the same as for records added one by one.
- **Current limits:**
  - It adds one guardian per student.
  - Class and section changes are not done by update (use Transfer).
  - A staff member's sign-in account can be created from the import but not changed or removed there.
  - Photos are stored the same way as photos uploaded on a profile (student and HR file vaults).
