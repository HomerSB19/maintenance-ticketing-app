const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
    const ticketId = req.params.ticketId;
    const { assigned_to, status, assigned_at } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const allowedRoles = ['Manager', 'Maintenance Technician', 'Test Technician'];
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
        }

        if (!ticketId || !assigned_to || !status || !assigned_at) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await pool.query(
            'UPDATE tickets SET assigned_to = $1, status = $2, assigned_at = $3 WHERE ticket_id = $4 RETURNING *',
            [assigned_to, status, assigned_at, ticketId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error assigning ticket:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        res.status(500).json({ error: 'Server error' });
    }
};