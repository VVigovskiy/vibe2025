const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const url = require('url');
const querystring = require('querystring');

const PORT = 3000;
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'todolist',
};

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => body += chunk.toString());
        req.on('end', () => resolve(querystring.parse(body)));
    });
}

async function getAllItems() {
    const [rows] = await pool.query('SELECT id, text FROM items');
    return rows;
}

async function addItem(text) {
    const [result] = await pool.query(
        'INSERT INTO items (text) VALUES (?)',
        [text]
    );
    return result.insertId;
}

async function updateItem(id, text) {
    await pool.query(
        'UPDATE items SET text = ? WHERE id = ?',
        [text, id]
    );
}

async function deleteItem(id) {
    await pool.query(
        'DELETE FROM items WHERE id = ?',
        [id]
    );
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

async function getHtmlRows() {
    const items = await getAllItems();
    return items.map(item => `
        <tr data-id="${item.id}">
            <td>${item.id}</td>
            <td class="item-text">${escapeHtml(item.text)}</td>
            <td>
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Remove</button>
            </td>
        </tr>
    `).join('');
}

async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    
    // Serve index.html
    if (req.method === 'GET' && parsedUrl.pathname === '/') {
        try {
            const html = await fs.promises.readFile('index.html', 'utf8');
            const processedHtml = html.replace('{{rows}}', await getHtmlRows());
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(processedHtml);
        } catch (err) {
            res.writeHead(500);
            res.end('Server Error');
        }
    }
    
    // API endpoints
    else if (req.method === 'POST') {
        const body = await parseBody(req);
        
        if (parsedUrl.pathname === '/add') {
            const id = await addItem(body.text);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({id}));
        }
        else if (parsedUrl.pathname === '/update') {
            await updateItem(body.id, body.text);
            res.writeHead(200);
            res.end();
        }
        else if (parsedUrl.pathname === '/delete') {
            await deleteItem(body.id);
            res.writeHead(200);
            res.end();
        }
        else {
            res.writeHead(404);
            res.end();
        }
    }
    else {
        res.writeHead(404);
        res.end();
    }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));