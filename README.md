# Hospital Appointment Booking System — Backend API

A backend system for a single hospital that lets patients book appointments with doctors, and lets doctors manage those appointments and maintain patient medical records — with real safeguards against double-booking and unauthorized data access, enforced partly at the database level.

Built with **Node.js, Express, and PostgreSQL** (raw SQL via `pg`, no ORM), using **`node-pg-migrate`** for version-controlled schema migrations.

---

## Why this project is more than CRUD

Most beginner booking-system projects check for scheduling conflicts in application code alone which leaves a race-condition window where two overlapping bookings can slip through if requests land close together. This project instead uses a **PostgreSQL exclusion constraint** (`EXCLUDE USING gist`) on the `appointments` table, so the database itself physically refuses to let two accepted appointments overlap for the same doctor. The guarantee holds even if the application logic has a bug, or if something writes to the database outside the API entirely.

The second non-trivial piece is **role-gated registration**: anyone can register as a patient, but registering as a doctor requires a valid, unused hospital-issued staff ID, checked against a pre-seeded table and marked "used" on successful registration — preventing arbitrary users from claiming doctor status.

The third is **appointment-gated medical record access**: a doctor can only view or add to a patient's medical history if they've had at least one *accepted* appointment with that patient — modeling real hospital least-privilege access rather than giving every doctor blanket access to every patient's records.

---

## Schema Overview

Five tables:

| Table | Purpose |
|---|---|
| `users` | Shared account data — email, hashed password, role (`patient` or `doctor`) |
| `patients` | Patient-specific profile, linked to `users` via `user_id` |
| `doctors` | Doctor-specific profile (specialty, staff ID), linked to `users` via `user_id` |
| `appointments` | Booking requests — patient, doctor, time range, status, reason |
| `medical_records` | Notes tied to a patient, authored by a doctor, optionally linked to a specific appointment |
| `staff_ids` | Pre-seeded, hospital-issued IDs used to validate doctor registration |

**Key design choices:**
- `users` holds only shared account fields (email, password, role). Role-specific data lives on `patients`/`doctors`, linked by foreign key — avoids duplicating auth logic per role.
- `appointments.time_range` uses Postgres's `tstzrange` type (a single column storing a start+end timestamp), which is what makes the exclusion constraint possible.
- `medical_records.appointment_id` is nullable at the schema level (a record doesn't *have* to originate from one specific appointment), but the `POST /medical-records` route currently enforces it as required — a deliberate workflow decision for stronger auditability (every note traces back to a real, accepted visit), not a hard database limitation. This could be relaxed later without a migration if the need arises.

---

## The double-booking constraint, explained

```sql
ALTER TABLE appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (doctor_id WITH =, time_range WITH &&)
  WHERE (status = 'accepted');
```

Read as: *no two rows can exist where `doctor_id` is the same **and** `time_range` overlaps, but only among rows where `status = 'accepted'`.* Multiple **pending** requests for the same slot are allowed to coexist (patients can request freely) — the constraint only fires when a doctor tries to *accept* a second request that conflicts with one they've already accepted. Requires the `btree_gist` Postgres extension.

When this constraint is violated, Postgres returns error code `23P01`, which the API catches and converts into a clean `409 Conflict` response instead of a raw database error.

---

## Business rules enforced

- Appointments can only be booked **Mon–Thu 9:00–17:30** and **Fri 9:00–17:00** (validated in application code before any database write).
- A doctor cannot have two **accepted** appointments with overlapping times (database-enforced, see above).
- Doctor registration requires a valid, unused `hospital_staff_id` — validated against the `staff_ids` table, marked used on success.
- A doctor can only write or read a patient's medical records if they have at least one **accepted** appointment with that patient.
- Passwords are hashed with `bcrypt` before storage — never stored in plain text.
- All protected routes require a valid JWT (`Authorization: Bearer <token>`), verified via middleware.

---

## Tech Stack

- **Runtime:** Node.js, Express
- **Database:** PostgreSQL 16
- **Migrations:** node-pg-migrate
- **Auth:** JWT (jsonwebtoken), bcrypt for password hashing
- **Environment config:** dotenv

---

## Setup

```bash
git clone <repo-url>
cd booking-system
npm install
```

Create a `.env` file:
```
DATABASE_URL=postgres://<user>:<password>@localhost:5432/booking_system
JWT_SECRET=<your-secret>
PORT=5000
```

Create the database and run migrations:
```bash
sudo -u postgres psql -c "CREATE DATABASE booking_system;"
npx node-pg-migrate up
```

Seed at least one valid staff ID so doctor registration can be tested:
```bash
sudo -u postgres psql -d booking_system -c "INSERT INTO staff_ids (staff_id) VALUES ('DOC-1001');"
```

Start the server:
```bash
node server.js
```

---

## API Endpoints

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | none | Register as `patient` or `doctor` |
| POST | `/auth/login` | none | Log in, returns JWT |

**Register as a patient:**
```json
POST /auth/register
{
  "role": "patient",
  "email": "@example.com",
  "password": "password",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone_number": "08012345678",
  "date_of_birth": "1998-05-20",
  "gender": "female"
}
```

**Register as a doctor** (requires a valid, unused staff ID):
```json
POST /auth/register
{
  "role": "doctor",
  "email": "@example.com",
  "password": "password",
  "first_name": "John",
  "last_name": "Smith",
  "phone_number": "09023123567",
  "gender": "male",
  "specialty": "Cardiologist",
  "hospital_staff_id": "DOC-1001"
}
```
Reusing an already-used or invalid staff ID returns:
```json
409 Conflict
{ "message": "Invalid or already-used staff ID" }
```

---

### Appointments

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/appointments` | patient | Request an appointment with a doctor |
| GET | `/appointments` | patient or doctor | View own appointments (role-based) |
| PATCH | `/appointments/:id` | doctor | Accept or decline a pending request |

**Book an appointment:**
```json
POST /appointments
{
  "doctor_id": 1,
  "start_time": "2026-09-02T09:00:00",
  "end_time": "2026-09-02T10:00:00",
  "reason": "Routine medical consultation"
}
```

**Doctor accepts a conflicting request** (after already accepting an overlapping one):
```json
PATCH /appointments/2
{ "status": "accepted" }
```
```json
409 Conflict
{ "message": "This doctor already has an accepted appointment that overlaps with this time slot" }
```

---

### Medical Records

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/medical-records` | doctor | Add a note (requires an accepted appointment with the patient) |
| GET | `/medical-records/:patient_id` | doctor | View a patient's full record history (requires an accepted appointment with the patient) |

**Add a record:**
```json
POST /medical-records
{
  "patient_id": 10,
  "appointment_id": 1,
  "notes": "Patient is suffering from severe pneumonia and should be attended to quickly"
}
```

**A doctor with no history with this patient tries to view records:**
```json
403 Forbidden
{ "message": "You do not have access to this patient's medical records" }
```

