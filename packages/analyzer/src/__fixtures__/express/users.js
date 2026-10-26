import {db} from "./db.js";
export async function getUsers(req,res){res.json(await db.query("select * from users"));}