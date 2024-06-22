const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path');

// Database connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'barbershop',
    password: '123456',
    port: 5432,
});

// Telegram configuration
const telegramToken = '7490473003:AAG0Llrd5V60Epi3KRPCsFpZCDJec4o3ETI'; // Replace with your Telegram bot token
const telegramChatId = '628936187'; // Replace with the recipient's chat ID

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

            // Send message to the barbershop owner on Telegram
            const messageText = `\nNew Appointment Booked\nClient: ${name}\nPhone Number: ${phone}\nDate: ${date}\nTime: ${time}`;
            const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

            const response = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: messageText
                })
            });

            const data = await response.json();

            if (data.ok) {
                console.log('Message sent to Telegram:', data.result);
                res.status(201).json({ message: 'Appointment booked successfully', appointment });
            } else {
                console.error('Error sending message to Telegram:', data);
                res.status(500).json({ message: 'Internal server error' });
            }
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
