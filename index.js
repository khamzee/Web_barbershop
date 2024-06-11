const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const twilio = require('twilio');
const path = require('path');

// Database connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'barbershop',
    password: '123456',
    port: 5432,
});

// Twilio configuration
const accountSid = 'ACb2f076a8c18c0b735a8b014076fe3aff'; // Replace with your Twilio account SID
const authToken = '615093da92b3c47a15590dbfc71993de'; // Replace with your Twilio auth token
const client = new twilio(accountSid, authToken);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname)));

// Serve index.html at the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/book-appointment', async (req, res) => {
    const { name, phone, date, time } = req.body;

    // Log request body for debugging
    console.log('Request body:', req.body);

    try {
        // Check if the desired appointment time is already booked
        const existingAppointment = await pool.query(
            'SELECT * FROM appointments WHERE appointment_date = $1 AND appointment_time = $2',
            [date, time]
        );

        if (existingAppointment.rows.length > 0) {
            res.status(400).json({ message: 'This time is already booked. Please choose another time.' });
        } else {
            const result = await pool.query(
                'INSERT INTO appointments (name, phone, appointment_date, appointment_time) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, phone, date, time]
            );

            const appointment = result.rows[0];

            // Send SMS to the barbershop owner
            const messageOwner = await client.messages.create({
                body: `\nNew Appointment Booked\nClient: ${name}\nPhone Number: ${phone}\nDate: ${date}\nTime: ${time}`,
                to: '+77022537829', // Replace with the owner's phone number
                from: '+16207984467' // Replace with your Twilio number
            });

            console.log('Owner message SID:', messageOwner.sid);

            res.status(201).json({ message: 'Appointment booked successfully', appointment });
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
