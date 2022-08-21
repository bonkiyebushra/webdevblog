import dotenv from 'dotenv';
import pkg from 'pg'
const  {Pool} = pkg;

dotenv.config();
// const isProduction = process.env.NODE_ENV === 'production';

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
console.log(connectionString)

const pool = new Pool({
    // connectionString:isProduction? process.env.DATABASE_URL : connectionString
    connectionString: connectionString
})

// console.log(pool)

export {pool}