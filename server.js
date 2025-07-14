const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' folder

// Initialize SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Get all tickets
app.get('/api/tickets', (req, res) => {
    db.all('SELECT * FROM tickets', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a new ticket
app.post('/api/tickets', (req, res) => {
    const { title, description, priority, status } = req.body;
    db.run(
        'INSERT INTO tickets (title, description, priority, status) VALUES (?, ?, ?, ?)',
        [title, description, priority, status],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Update ticket status
app.put('/api/tickets/:id', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    db.run(
        'UPDATE tickets SET status = ? WHERE id = ?',
        [status, id],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ updated: this.changes });
        }
    );
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});