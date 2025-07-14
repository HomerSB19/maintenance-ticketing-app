const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.get('/api/tickets', async (req, res) => {
    const { data, error } = await supabase.from('tickets').select('*');
    if (error) {
        console.error('Error fetching tickets:', error);
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

app.post('/api/tickets', async (req, res) => {
    const { title, description, priority, status } = req.body;
    const { data, error } = await supabase.from('tickets').insert([
        { title, description, priority, status, created_at: new Date().toISOString() }
    ]).select();
    if (error) {
        console.error('Error inserting ticket:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json({ id: data[0].id });
});

app.put('/api/tickets/:id', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
    if (error) {
        console.error('Error updating ticket:', error);
        return res.status(500).json({ error: error.message });
    }
    res.json({ updated: true });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});