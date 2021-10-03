import { Pool } from "pg";
import nextConnect from "next-connect";

let pool = null;
const config = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
};

async function init(req, res, next) {
    if(pool == null){
        console.log("Postgres initializing");
        pool = new Pool(config);
        pool.on("error", (err, client) => {
            console.error("Unexpected error on client", err);
            procecss.exit(-1);
        });
    }
    console.log("Postgres initialized: ", pool != null);
    req.pg = pool;
    return next();
}

const middleware = nextConnect();
middleware.use(init);
export default middleware;