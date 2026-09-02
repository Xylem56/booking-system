const express = require("express")

const router =express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbPool = require("../config/db");

router.post("/register", async (req, res) => {
  const { email, password, role, first_name, last_name, phone_number, date_of_birth, gender, specialty, hospital_staff_id } = req.body;

  const validRoles = ["patient", "doctor"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role. Role must be either patient or doctor" });
  }

  if (!email || !password || !first_name || !last_name || !phone_number || !gender ) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // 1. Check if email already exists
    const existingUser = await dbPool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 2. Hash the password before storing it — never store plaintext
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert into users table first
    const newUser = await dbPool.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role",
      [email, hashedPassword, role]
    );

    const userId = newUser.rows[0].id;

    // 4. Insert into patients or doctors depending on roleS
    if (role === "patient") {
      await dbPool.query(
        "INSERT INTO patients (user_id, first_name, last_name, phone_number, date_of_birth, gender) VALUES ($1, $2, $3, $4, $5, $6)",
        [userId, first_name, last_name, phone_number, date_of_birth, gender]
      );
    } else if (role === "doctor") {

      const staffCheck = await dbPool.query(
        "SELECT * FROM staff_ids WHERE staff_id = $1 AND is_used = false",
        [hospital_staff_id]
      );
      if (staffCheck.rows.length === 0) {
        return res.status(409).json({message: "Invalid or already used staff ID"});
      }
      await dbPool.query(
        "INSERT INTO doctors (user_id, first_name, last_name, phone_number, specialty, staff_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [userId, first_name, last_name, phone_number, specialty, hospital_staff_id]
      );
      await dbPool.query(
        "UPDATE staff_ids SET is_used = true WHERE staff_id = $1",
        [hospital_staff_id]

      );
    }

    // 5. Issue a JWT
    const token = jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(201).json({ message: "User registered successfully", token });

  } catch (error) {
    res.status(500).json({ message: "Error creating user", error: error.message });
  }
});
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const result = await dbPool.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});

module.exports = router;
