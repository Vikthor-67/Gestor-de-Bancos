const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT || "1433", 10),

    options: {
        encrypt: false,
        trustServerCertificate: (process.env.DB_TRUST_CERT || "true") === "true",
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    }
};

let pool;

async function getpool() {
    try {
        if (!pool) {
            pool = await sql.connect(config);
            console.log("Conectado a la base de datos");
        }
        return pool;
    } catch (error) {
        console.error("Error conectado a SQL SERVER:", error);
        throw error;
    }
}

module.exports = { sql, getpool };