const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { requireRole } = require("../middleware/auth");
const dbPool = require("../config/db");

function isWithinBusinessHours(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
    }

    if (start >= end || start.getDay() < 1 || start.getDay() > 5) {
        return false;
    }

    if (start.getDay() !== end.getDay()) {
        return false;
    }

    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const openingTime = 9 * 60;
    const closingTime = start.getDay() === 5 ? 17 * 60 : 17 * 60 + 30;

    return startMinutes >= openingTime && endMinutes <= closingTime;
}

router.post("/", authenticateToken, async (req, res) => {
    const { doctor_id, start_time, end_time, reason } = req.body;

    if (!doctor_id || !start_time || !end_time || !reason) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (!isWithinBusinessHours(start_time, end_time)) {
        return res.status(400).json({
            message: "Appointments must be Monday-Friday during business hours"
        });
    }

    try {
        const patientResult = await dbPool.query(
            "SELECT id FROM patients WHERE user_id = $1",
            [req.user.id]
        );

        if (patientResult.rows.length === 0) {
            return res.status(403).json({ message: "Only registered patients can create appointments" });
        }

        const doctorResult = await dbPool.query(
            "SELECT id FROM doctors WHERE id = $1",
            [doctor_id]
        );

        if (doctorResult.rows.length === 0) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        const timeRange = `[${new Date(start_time).toISOString()},${new Date(end_time).toISOString()})`;
        const appointmentResult = await dbPool.query(
            "INSERT INTO appointments (patient_id, doctor_id, time_range, status, reason) VALUES ($1, $2, $3, $4, $5) RETURNING id, patient_id, doctor_id, time_range, status",
            [patientResult.rows[0].id, doctor_id, timeRange, "pending", reason]
        );

        return res.status(201).json({
            message: "Appointment requested successfully",
            appointment: appointmentResult.rows[0]
        });
    } catch (error) {
        return res.status(500).json({ message: "Error creating appointment", error: error.message });
    }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    let appointmentsResult;
    if (req.user.role === "patient") {
      const patientResult = await dbPool.query(
        "SELECT id FROM patients WHERE user_id = $1",
        [req.user.id]
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ message: "Patient profile not found" });
      }

      const appointmentsResult = await dbPool.query(
        "SELECT * FROM appointments WHERE patient_id = $1",
        [patientResult.rows[0].id]
      );

      return res.status(200).json({
        appointments: appointmentsResult.rows
      });
    }

    if (req.user.role === "doctor") {
      const doctorResult = await dbPool.query(
        "SELECT id FROM doctors WHERE user_id = $1",
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({ message: "Doctor profile not found" });
      }

      const appointmentsResult = await dbPool.query(
        "SELECT * FROM appointments WHERE doctor_id = $1",
        [doctorResult.rows[0].id]
      );

      return res.status(200).json({
        appointments: appointmentsResult.rows
      });
    }

    return res.status(403).json({ message: "Invalid role" });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching appointments",
      error: error.message
    });
  }
});

router.patch ("/:id", authenticateToken, requireRole("doctor"), async (req,res) => {

    const { id } = req.params;
    const { status } = req.body;

const appointmentBelongsToDoctor = await dbPool.query(
    "SELECT * FROM appointments WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)",
    [id, req.user.id]
);

if (appointmentBelongsToDoctor.rows.length === 0) {
    return res.status(403).json({ message: "You do not have permission to update this appointment" });
}

try {
    const updatedAppointment = await dbPool.query(
        "UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *",
        [status, id]
    );
return res.status(200).json({
    message: "Appointment status updated successfully",
    appointment: updatedAppointment.rows[0]
});
if (!["accepted", "declined"].includes(status)) {
    return res.status(400).json({ message: "Invalid status. Must be 'accepted' or 'declined'." });
}
} catch (error) {
    if (error.code === '23P01') {
        return res.status(409).json({ message: "This doctor already has an accepted appointment that overlaps with this time slot" });
    }
    return res.status(500).json({ message: "Error updating appointment status", error: error.message });
}

});

module.exports = router;