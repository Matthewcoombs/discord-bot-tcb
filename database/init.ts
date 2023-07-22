import postgres = require("postgres");

// init env variables
require('dotenv').config();

function connectToPG() {
    const sql = postgres({
        port: 5432,
        host: process.env.POSTGRES_HOSTNAME,
        username: process.env.POSTGRES_USERNAME,
        password:process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
    });

    console.log(`Connected to postgres!`)
    return sql;
}

export {
    connectToPG,
}