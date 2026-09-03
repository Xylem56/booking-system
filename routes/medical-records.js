const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { requireRole } = require("../middleware/auth");
const dbPool = require("../config/db");


router.post("/", authenticateToken, requireRole("doctor"), async (req,res) => {
  const { patient_id, appointment_id, notes } = req.body;

  if (!patient_id || !appointment_id || !notes) {
    return res.status(400).json({
      message: "patient_id, appointment_id and notes are required"
    });
  }

  try {
    const doctorResult = await dbPool.query(
      "SELECT id FROM doctors WHERE user_id = $1",
      [req.user.id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(403).json({ message: "Doctor profile not found" });
    }

    const doctorId = doctorResult.rows[0].id;

    const appointmentResult = await dbPool.query(
      `SELECT id
       FROM appointments
       WHERE id = $1
         AND doctor_id = $2
         AND patient_id = $3
         AND status = 'accepted'`,
      [appointment_id, doctorId, patient_id]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(403).json({
        message: "You can only add notes for an accepted appointment with this patient"
      });
    }

    const newRecord = await dbPool.query(
      `INSERT INTO medical_records
       (patient_id, doctor_id, appointment_id, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [patient_id, doctorId, appointment_id, notes]
    );

    return res.status(201).json({
      message: "Medical record created successfully",
      record: newRecord.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating medical record",
      error: error.message
    });
  }
});

router.get ("/medical-records/:patient_id", authenticateToken, requireRole("doctor"), async (req, res) => {
    const { patient_id } = req.params;

    try {
            const doctorResult = await dbPool.query(
      "SELECT id FROM doctors WHERE user_id = $1",
      [req.user.id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(403).json({ message: "Doctor profile not found" });
    }
    const doctorId = doctorResult.rows[0].id;
    
        const accessResult = await dbPool.query(
                    `SELECT id
         FROM appointments
         WHERE doctor_id = $1
           AND patient_id = $2
           AND status = 'accepted'`,
        [doctorId, patient_id]
      );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({ message: "You do not have access to this patient's medical records" });
        }
        const recordsResult = await dbPool.query(
        
            "SELECT * FROM medical_records WHERE patient_id = $1 ORDER BY created_at DESC",
            [patient_id]
        );

        return res.status(200).json({
            medical_records: recordsResult.rows
        });

    } catch (error) {
        return res.status(500).json({ message: "Error fetching medical records", error: error.message });
    }

})

module.exports = router;