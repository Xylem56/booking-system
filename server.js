require ('dotenv').config();
const express = require('express');
const app = express();
const authRoutes = require('./routes/auth');
const dbPool = require('./config/db');
const PORT = process.env.PORT || 5000;
const appointmentsRoutes = require('./routes/appointments');
const medicalRecordsRoutes = require('./routes/medical-records');




app.use(express.json());
app.use('/auth', authRoutes);
app.use("/appointments", appointmentsRoutes);
app.use("/medical-records", require("./routes/medical-records"));




app.listen(PORT, () => {
    console.log(`Server is listening at port ${PORT}...`)
})


