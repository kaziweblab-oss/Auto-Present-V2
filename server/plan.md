# Auto Present V1 — Remaining Work

শুধু বাকি কাজগুলো এই plan-এ রাখা হয়েছে। কাজ শেষ হলে `[ ]`-কে `[x]` করো। নতুন feature idea শেষে **Future backlog**-এ লিখে রাখো।

## Student roster ও class membership-এর নিয়ম

- Admin roster তৈরি ও পরিবর্তন করবে; roster-এ Gmail থাকবে না।
- Roll পুরো college-এ unique এবং ঠিক ৬ অক্ষরের।
- Student login-এর আগে roster record তৈরি করা যাবে; login হলে authenticated account roster-এর সঙ্গে link হবে।
- Student নিজের roll, class বা membership তৈরি/পরিবর্তন করতে পারবে না।
- Department, session, shift, semester `classId` থেকে resolve হবে; client-এর পাঠানো মানকে authoritative ধরা যাবে না।
- Class/semester বদলালে পুরোনো membership inactive/end-date হবে; নতুন membership record তৈরি হবে। Attendance/history delete হবে না।

---

## 1. Student roster তৈরি — Admin

### Files

- `src/models/students.model.ts`
- `src/controller/student.controller.ts`
- `src/middleware/validateStudent.middleware.ts`
- `src/routes/student.route.ts`
- `src/app.ts`

### Controller functions

- [x] `createStudentRosterRecord` — Admin-এর দেওয়া ৬ অক্ষরের roll দিয়ে unlinked roster record তৈরি; duplicate roll reject।
- [x] `createStudentRosterBatch` — Admin-provided student list একসঙ্গে validate/import; কোন row duplicate/invalid তার ফল জানানো।
- [x] `getStudentRoster` — Admin roster list/filter করবে।
- [x] `updateStudentRosterRecord` — Admin roster data সংশোধন করবে; roll uniqueness বজায় রাখবে।
- [x] `deactivateStudentRosterRecord` — roster-কে inactive/archive করবে; hard delete করে history নষ্ট করবে না।

### Suggested routes — Admin only

| Method + path | Function |
|---|---|
| `POST /api/students/roster` | `createStudentRosterRecord` |
| `POST /api/students/roster/batch` | `createStudentRosterBatch` |
| `GET /api/students/roster` | `getStudentRoster` |
| `PATCH /api/students/roster/:id` | `updateStudentRosterRecord` |
| `PATCH /api/students/roster/:id/deactivate` | `deactivateStudentRosterRecord` |

**Test:** missing/invalid roll, roll ৬ অক্ষরের নয়, duplicate roll, batch row errors, non-Admin access।

---

## 2. Student-কে class/session-এ enroll বা promote করা — Admin

### আগে model মিলিয়ে নাও

- [x] `classMemberships.model.ts`-এ `sessionId`, `studentId`, `classId`, `isActive`, `startDate`, `endDate` controller-এর সঙ্গে মেলে।
- [x] একই student/session-এ একটিই active membership enforce হয়; পুরোনো inactive membership রাখা যায়।
- [x] `studentId` বা `classId`-এ single-field unique constraint নেই।
- [x] `classId` থেকে class-এর `sessionId` resolve করে membership-এ সেট করা হয়।
- [x] Student ও class database-এ আছে এবং requested membership valid—এটি controller-এ যাচাই হয়।

### Controller

- [x] `assignOrUpdateStudentClass` — body থেকে `studentId`, `newClassId`; class থেকে session resolve; আগের active membership বন্ধ করে নতুন membership তৈরি; no-op/duplicate handle; transaction cleanup।
- [x] `getClassMembers` — Admin class-এর student roster/membership দেখতে পারবে।
- [x] প্রয়োজনে `getStudentMembershipHistory` — Admin student-এর আগের ও বর্তমান class membership দেখতে পারবে।

### Route ও wiring

- [x] `src/routes/classMembership.route.ts`-এ route যোগ করো:

| Method + path | Function | Permission |
|---|---|---|
| `POST /api/class-memberships/assign-or-update` | `assignOrUpdateStudentClass` | Admin |
| `GET /api/class-memberships/class/:classId` | `getClassMembers` | Admin |
| `GET /api/class-memberships/student/:studentId/history` | `getStudentMembershipHistory` | Admin |

- [x] Route-үүдэд `verifyAuth`-এর পরে Admin role guard বসাও।
- [x] `src/app.ts`-এ `/api/class-memberships` router mount করো।
- [x] Route/controller import, HTTP method/path মিলিয়ে Thunder Client-এ পরীক্ষা করো।

**Test:** missing/invalid IDs, student/class not found, same class পুনরায় assign, class change, session resolution, duplicate active membership, transaction failure, history preserved।

---

## 3. Student account claim/link — Google login-এর পরে

### Files

- `src/controller/student.controller.ts`
- `src/middleware/validateStudent.middleware.ts`
- `src/routes/student.route.ts`

### Functions

- [ ] `claimStudentAccount` — logged-in Google User-কে Admin-created roster record-এর সঙ্গে link।
- [ ] `getMyStudentProfile` — token user ID দিয়ে linked roster resolve।
- [ ] `getMyClassInfo` — current active membership → class থেকে session/department/shift/semester দেখানো।

### Claim rules

- [ ] `userId`/Gmail request body থেকে নেওয়া যাবে না; authenticated user থেকে নিতে হবে।
- [ ] Student-provided roll roster-এর সঙ্গে match না হলে link reject করে “Student record not found; Admin-এর সঙ্গে যোগাযোগ করুন” জানাবে।
- [ ] Roster-এ Gmail না থাকায় ভুল account claim আটকাতে Admin-issued one-time code বা Admin approval ব্যবহার করো।
- [ ] Roster record বা membership student-এর request দিয়ে create/update হবে না।
- [ ] Already-linked user/roster, duplicate claim, code expired/reused case handle করো।

### Suggested routes

| Method + path | Function | Permission |
|---|---|---|
| `POST /api/students/claim` | `claimStudentAccount` | Authenticated Student |
| `GET /api/students/me` | `getMyStudentProfile` | Linked Student |
| `GET /api/students/me/classes` | `getMyClassInfo` | Linked Student |

**Test:** roster match/no match, wrong role, approval/code failures, already linked, unlinked user dashboard access।

---

## 4. CR assignment — Admin

### Files

- `src/models/crAssignments.model.ts`
- `src/controller/crAssignment.controller.ts`
- `src/routes/crAssignment.route.ts`
- `src/app.ts`

### Functions

- [ ] `assignCR` — CR role-এর User-কে class-এ assign; class/session ও duplicate validate।
- [ ] `getCRAssignments` — Admin list/filter।
- [ ] `getMyCRAssignments` — CR নিজের assignment-গুলো দেখবে।
- [ ] `reassignCR` / `revokeCRAssignment` — Admin assignment পরিবর্তন/বন্ধ করবে; attendance history অক্ষত থাকবে।

### Suggested routes

| Method + path | Function | Permission |
|---|---|---|
| `POST /api/cr-assignments` | `assignCR` | Admin |
| `GET /api/cr-assignments` | `getCRAssignments` | Admin |
| `GET /api/cr-assignments/me` | `getMyCRAssignments` | CR |
| `PATCH /api/cr-assignments/:id` | `reassignCR` | Admin |
| `DELETE /api/cr-assignments/:id` | `revokeCRAssignment` | Admin |

**Test:** non-CR target, duplicate assignment, wrong class/session, CR অন্যের assignment দেখতে পারে না, revoke/reassign।

---

## 5. Class routine ও attendance — Admin/CR

নির্ধারিত সময় শেষে attendance বন্ধ করতে class routine বা attendance window লাগবে। Model না থাকলে attendance logic-এর আগে routine model যোগ করো।

### Files

- `src/models/classRoutines.model.ts` (প্রয়োজন হলে)
- `src/models/classSessions.model.ts`
- `src/models/attendanceRecords.model.ts`
- `src/controller/classRoutine.controller.ts` (প্রয়োজন হলে)
- `src/controller/attendance.controller.ts`
- `src/routes/attendance.route.ts`
- `src/app.ts`

### Functions

- [ ] `createClassRoutine` / `updateClassRoutine` — Admin class schedule নির্ধারণ।
- [ ] `openClassSession` — assigned CR, class ও সময় যাচাই করে session খোলা।
- [ ] `getOpenClassSession` — CR নিজের assigned class-এর open session দেখবে।
- [ ] `submitAttendance` — open deadline, membership, `PRESENT`/`LATE`/`ABSENT` যাচাই; duplicate আটকানো।
- [ ] `closeClassSession` — assigned CR session বন্ধ করবে; deadline শেষে attendance বন্ধ।
- [ ] `getClassAttendance` — CR নিজের class-এর attendance দেখবে।

### Suggested routes

| Method + path | Function | Permission |
|---|---|---|
| `POST /api/classes/:classId/sessions/open` | `openClassSession` | ঐ class-এর assigned CR |
| `GET /api/classes/:classId/sessions/open` | `getOpenClassSession` | ঐ class-এর assigned CR |
| `POST /api/class-sessions/:id/attendance` | `submitAttendance` | ঐ class-এর assigned CR |
| `PATCH /api/class-sessions/:id/close` | `closeClassSession` | ঐ class-এর assigned CR |
| `GET /api/class-sessions/:id/attendance` | `getClassAttendance` | Assigned CR; Admin oversight |

**Test:** অন্য class-এর CR, non-member student, expired/closed session, Late rule, duplicate record, close twice।

---

## 6. Student dashboard — নিজের attendance

### Functions

- [ ] `getMyAttendanceHistory` — linked Student-এর সব class/session-এর attendance history।
- [ ] `getMyAttendanceSummary` — database record থেকে Present/Late/Absent summary।
- [ ] Semester/class বদলালে current membership থেকে নতুন class info, পুরোনো membership ও attendance history বজায় থাকে।

### Routes — authenticated Student only

| Method + path | Function |
|---|---|
| `GET /api/students/me/attendance` | `getMyAttendanceHistory` |
| `GET /api/students/me/attendance/summary` | `getMyAttendanceSummary` |

**Test:** Student শুধু নিজের data পায়; client-এর পাঠানো অন্য student ID উপেক্ষিত/নিষিদ্ধ; history database থেকে আসে।

---

## 7. Final check

- [ ] Admin roster তৈরি → membership assign → Student login/claim → CR assignment → attendance → Student dashboard end-to-end কাজ করে।
- [ ] Admin ছাড়া roster বা membership পরিবর্তন করা যায় না।
- [ ] Student roster-এ Gmail নেই; roll unique ও ঠিক ৬ অক্ষরের।
- [ ] Semester/class promotion-এ পুরোনো membership ও attendance অক্ষত থাকে।
- [ ] Protected routes-এ no token `401`, wrong role `403`; invalid input `400`, missing record `404`, duplicate `409`।
- [ ] Typecheck, server startup ও route test pass।

## Future backlog

| Feature idea | Dependency / note |
|---|---|
|  |  |
