const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL and Key are required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to check user role
function checkRole(allowedRoles) {
    return async (req, res, next) => {
        if (!Array.isArray(allowedRoles)) {
            console.error('checkRole: allowedRoles is not an array:', allowedRoles);
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'Authorization header missing' });
            return;
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({ error: 'Invalid authorization header' });
            return;
        }
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { data, error } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (error || !data || !allowedRoles.includes(data.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        req.user = { id: user.id, role: data.role };
        next();
    };
}

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: userData, error: userError } = await supabase.from('users').select('role').eq('id', data.user.id).single();
        if (userError) throw userError;
        res.json({ access_token: data.session.access_token, role: userData.role });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(401).json({ error: error.message });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        res.json({ message: 'Logged out' });
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user', async (req, res) => {
    try {
        const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1]);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        const { data, error } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (error) throw error;
        res.json({ role: data.role });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(401).json({ error: error.message });
    }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const { status } = req.query;
        let query = supabase.from('tickets').select('*');
        if (status) {
            query = query.in('status', status.split(','));
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tickets/:ticket_id', async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('ticket_id', ticket_id)
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Ticket not found' });
        res.json(data);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tickets', checkRole(['Line Leader', 'Manager']), async (req, res) => {
    try {
        const { employee_id, name, line, process, description, status } = req.body;
        if (!employee_id || !name || !line || !process || !description || !status) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const ticket_id = Math.random().toString(16).slice(2, 8).toUpperCase();
        const { error } = await supabase.from('tickets').insert({
            ticket_id,
            employee_id,
            name,
            line,
            process,
            description,
            status,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        res.status(201).json({ ticket_id });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tickets/:ticket_id/assign', checkRole(['Manager']), async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { assigned_to, status, assigned_at } = req.body;
        if (!assigned_to || !status || !assigned_at) {
            return res.status(400).json({ error: 'Assigned_to, status, and assigned_at are required' });
        }
        const { error } = await supabase
            .from('tickets')
            .update({ assigned_to, status, assigned_at })
            .eq('ticket_id', ticket_id);
        if (error) throw error;
        res.json({ updated: true });
    } catch (error) {
        console.error('Error assigning ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tickets/:ticket_id/resolve', checkRole(['Manager']), async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { issue, fix, status, resolved_by, resolved_at } = req.body;
        if (!issue || !fix || !status || !resolved_by || !resolved_at) {
            return res.status(400).json({ error: 'Issue, fix, status, resolved_by, and resolved_at are required' });
        }
        const { error } = await supabase
            .from('tickets')
            .update({ issue, fix, status, resolved_by, resolved_at })
            .eq('ticket_id', ticket_id);
        if (error) throw error;
        res.json({ updated: true });
    } catch (error) {
        console.error('Error resolving ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/ticket-stats', async (req, res) => {
    try {
        const { data, error } = await supabase.from('tickets').select('created_at');
        if (error) throw error;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        let todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
        if (now.getHours() < 8) {
            todayStart.setDate(todayStart.getDate() - 1);
            todayEnd.setDate(todayEnd.getDate() - 1);
        }
        const weekStart = new Date(todayStart);
        weekStart.setDate(todayStart.getDate() - todayStart.getDay());

        const todayCount = data.filter(ticket => {
            const createdAt = new Date(ticket.created_at);
            return createdAt >= todayStart && createdAt < todayEnd;
        }).length;

        const weekCount = data.filter(ticket => {
            const createdAt = new Date(ticket.created_at);
            return createdAt >= weekStart && createdAt < todayEnd;
        }).length;

        res.json({ today: todayCount, week: weekCount });
    } catch (error) {
        console.error('Error fetching ticket stats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/downtime', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tickets')
            .select('line, created_at, resolved_at')
            .eq('status', 'Closed');
        if (error) throw error;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        let todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
        if (now.getHours() < 8) {
            todayStart.setDate(todayStart.getDate() - 1);
            todayEnd.setDate(todayEnd.getDate() - 1);
        }

        const downtimeByLine = {};
        const lines = ['MRR', 'FCM', 'IDB', 'MGH', 'PPK', 'IAMM'];
        lines.forEach(line => downtimeByLine[line] = 0);

        data.forEach(ticket => {
            const createdAt = new Date(ticket.created_at);
            const resolvedAt = new Date(ticket.resolved_at);
            if (createdAt >= todayStart && createdAt < todayEnd && resolvedAt) {
                const downtimeMinutes = (resolvedAt - createdAt) / (1000 * 60);
                downtimeByLine[ticket.line] = (downtimeByLine[ticket.line] || 0) + downtimeMinutes;
            }
        });

        const result = Object.entries(downtimeByLine).map(([line, minutes]) => ({
            line,
            downtime: Math.round(minutes)
        }));

        res.json(result);
    } catch (error) {
        console.error('Error fetching downtime:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/downtime-by-process', async (req, res) => {
    try {
        const { line } = req.query;
        if (!line) return res.status(400).json({ error: 'Line is required' });
        const { data, error } = await supabase
            .from('tickets')
            .select('process, created_at, resolved_at')
            .eq('status', 'Closed')
            .eq('line', line);
        if (error) throw error;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        let todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
        if (now.getHours() < 8) {
            todayStart.setDate(todayStart.getDate() - 1);
            todayEnd.setDate(todayEnd.getDate() - 1);
        }

        const downtimeByProcess = {};
        data.forEach(ticket => {
            const createdAt = new Date(ticket.created_at);
            const resolvedAt = new Date(ticket.resolved_at);
            if (createdAt >= todayStart && createdAt < todayEnd && resolvedAt) {
                const downtimeMinutes = (resolvedAt - createdAt) / (1000 * 60);
                downtimeByProcess[ticket.process] = (downtimeByProcess[ticket.process] || 0) + downtimeMinutes;
            }
        });

        const result = Object.entries(downtimeByProcess)
            .map(([process, minutes]) => ({ process, downtime: Math.round(minutes) }))
            .sort((a, b) => b.downtime - a.downtime);

        res.json(result);
    } catch (error) {
        console.error('Error fetching downtime by process:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tickets-by-process', async (req, res) => {
    try {
        const { line } = req.query;
        if (!line) return res.status(400).json({ error: 'Line is required' });
        const { data, error } = await supabase
            .from('tickets')
            .select('process')
            .eq('status', 'Open')
            .eq('line', line);
        if (error) throw error;

        const ticketCountByProcess = {};
        data.forEach(ticket => {
            ticketCountByProcess[ticket.process] = (ticketCountByProcess[ticket.process] || 0) + 1;
        });

        const result = Object.entries(ticketCountByProcess)
            .map(([process, count]) => ({ process, count }))
            .sort((a, b) => b.count - a.count);

        res.json(result);
    } catch (error) {
        console.error('Error fetching tickets by process:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics', async (req, res) => {
    try {
        const { data, error } = await supabase.from('tickets').select('status, line, process');
        if (error) throw error;

        const statusCounts = { Open: 0, Ongoing: 0, Closed: 0 };
        const lineCounts = {};
        const processCounts = {};

        data.forEach(ticket => {
            statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
            lineCounts[ticket.line] = (lineCounts[ticket.line] || 0) + 1;
            processCounts[ticket.process] = (processCounts[ticket.process] || 0) + 1;
        });

        res.json({ status: statusCounts, line: lineCounts, process: processCounts });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});