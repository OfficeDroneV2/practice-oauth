import nc from "next-connect";
import middleware from "../../../middleware/pool";
import {nanoid} from "nanoid";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { serialize } from "cookie";
import Validator from "../../../utils/form_validation";

// Get token url or userinfo url for google or facebook based on provider and fill with env variables
const oauth_token_url = (code, provider) => {
    return provider == "facebook"
    ? `https://graph.facebook.com/v11.0/oauth/access_token?client_id=${process.env.FBAPPID}&redirect_uri=${process.env.FBREDIRECT}&client_secret=${process.env.FBSECRET}&code=${code}`
    : `https://oauth2.googleapis.com/token?client_id=${process.env.GAPPID}&redirect_uri=${process.env.GREDIRECT}&client_secret=${process.env.GSECRET}&code=${code}&grant_type=authorization_code`;
};
const oauth_data_url = (token, provider) => {
    return provider == "facebook"
    ? `https://graph.facebook.com/me?access_token=${token}&fields=id,first_name,last_name,middle_name,location,hometown,gender,email`
    : `https://www.googleapis.com/userinfo/v2/me`;
}

async function getData(url, provider, token){
    try {
        const headers = {
            "Content-Type": 'application/json',
        }; 
        
        // Google requires the token to be in "Authorization" header
        // Facebook requires the token to be in url query
        if(token && provider == "google") headers["authorization"] = "Bearer " + token;

        // Google requires POST for getting token. GET is OK for the rest
        let result = await fetch(url, { "method": provider == "google" && !token ? "POST" : "GET", headers });
        if(result.status == 200){
            const json = await result.json();
            if(json["error"]) return null;
            return json;
        } return null;
    } catch (error) {
        console.error("ERROR at getData(url, provider, token): ", error);
        return null;
    }
}

async function userExists(pool, userData){
    try {
        // Check if user has logged in with oauth before and has completed registration.
        // "WHERE user_id IS NOT NULL" If user_id is not set then user registration is not complete and can be replaced.
        // "AND oauth_id = $1" Is basically unique ID provided by Google/Facebook.
        let result = await pool.query(`SELECT FROM auth_providers WHERE user_id IS NOT NULL AND oauth_id = $1`, [userData["id"]]);
        if(result.rows.length > 0) {
            return true;
        } return false;
    } catch (error) {
        console.error("ERROR at userExists(pool, userData): ", error);
        return false;
    }
}

async function startRegistration(pool, tokenData, userData, provider){
    let client = await pool.connect();
    try {
        await client.query("BEGIN");
        
        // Does not get called if userExsists() found that user already exists and completed registration
        // Insert TOKEN and UserInfo returned by Facebook/Google into auth_providers table.
        // If already exists then update access_token/refresh_token and expiry date if available.
        let result = await client.query(`
        INSERT INTO auth_providers (oauth_id, auth_type, user_id, access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(oauth_id) DO UPDATE SET access_token = $4, refresh_token = $5, expires_at = $6;`, 
        [
            userData["id"],
            provider, // Facebook/Google
            null, // Set user_id to null for now, allows for it to be replaced and can be completed on gathering incomplete user info
            tokenData["access_token"],
            tokenData["refresh_token"] || "", // Facebook does not use a refresh token, safe to store null/""
            new Date(Date.now() + tokenData["expires_in"] * 1000), // Facebook/Google returns timestamp in seconds, nodejs Date.now() is milliseconds
        ]);
        if(!result.rowCount > 0) throw (`Failed to persist ${provider} token`);
        
        await client.query("END");
        return true;
    } catch (error) {
        console.error(error);
        await client.query("ROLLBACK");
        return false;
    } finally {
        client.release();
    }
}

async function completeRegistration(req, pool, userData){
    const client = await pool.connect();
    try {
        userData = JSON.parse(userData);
        await client.query("BEGIN");

        // Check if user login info exists in auth_providers and if user_id is NULL which means the user has not completed registration
        let tmp = await client.query(`SELECT * FROM auth_providers WHERE oauth_id = $1 AND user_id IS NULL`, [userData["id"]]);
        if(tmp.rows && tmp.rows.length > 0 && tmp.rows[0] != null){
            const userId = nanoid(); // Create new ID for user

            let result = await client.query(
                `
                INSERT INTO users ("id", "first_name", "middle_name", "last_name", "email", "telephone", "country", "city", "province", "district", "scope", "verified")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'owner', $11)
                `,
                [
                    userId,
                    userData["first_name"] || userData["given_name"], // Facebook/Google returns different key for First Name
                    userData["middle_name"],
                    userData["last_name"] || userData["family_name"], // Facebook/Google returns different key for Last Name
                    userData["email"],
                    userData["phone"],
                    userData["country"],
                    userData["city"],
                    userData["province"],
                    userData["district"],
                    true // Set verified to true since user registered through Facebook/Google
                ]
            );
            if(result == null && !result.rows[0]["result"]) throw ("Failed to enter new user data");
        
            // Set user_id to the generated one completing user registration
            result = await client.query(`
            UPDATE auth_providers SET user_id = $1 WHERE oauth_id = $2 AND user_id IS NULL;
            `, [
                userId,
                userData["id"]
            ]);
            if(result == null && !result.rows[0]["result"]) throw ("Failed to update login info");
            
            // Create challenge to be stored on token and in cookie. Used to avoid XSS or was it CSRF? I don't remember.
            const xss = crypto.createHash('md5').update(nanoid() + process.env.CHALLENGE).digest("base64");
            const refresh_token = jwt.sign({ "userId": userId, "scope": "owner", "challenge": xss}, process.env.JWTSECRET, {"expiresIn": "1d"});

            // Store user login tokens, these are used for the website/api and are not related to the ones above.
            result = await client.query(`INSERT INTO login_tokens ("token", "user_id", "oauth_id", "ip_address") VALUES ($1, $2, $3, $4)`,
            [
                refresh_token,
                userId,
                userData["id"],
                (req.headers['x-forwarded-for'] || req.connection.remoteAddress || "").split(',')[0].trim(),
            ]);
            if(result == null && !result.rows[0]["result"]) throw ("Failed to persist refresh token");

            const access_token = jwt.sign({ userId: userId, scope: "owner", "challenge": xss}, process.env.JWTSECRET, {expiresIn: 300000});
            await client.query("END");
            return {xss, access_token, refresh_token};
        }

        return null;
    } catch (error) {
        console.error(error);
        await client.query("ROLLBACK");
        return null;
    } finally {
        client.release();
    }
}

// Convert obj to query string for URL
function objectToString(obj){
    return Object.keys(obj).map((key) => {if(key != null && key != "" && obj[key] != null) return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`}).join("&");
}

async function loginUser(pool, provider, tokenData, userData){
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        let result = await client.query(`SELECT user_id, access_token, expires_at, employee FROM auth_providers WHERE auth_type = $1 AND oauth_id = $2`, [provider, userData["id"]]);

        if(result.rows.length > 0){
            // Refresh the challenge and tokens. Challenge is used to avoid XSS or was it CSRF? I don't remember.
            const xss = crypto.createHash('md5').update(nanoid() + process.env.CHALLENGE).digest("base64");
            const refresh_token = jwt.sign({ "userId": result.rows[0]["user_id"], "scope": "owner", "challenge": xss}, process.env.JWTSECRET, {"expiresIn": "1d"});
            const access_token = jwt.sign({ "userId": result.rows[0]["user_id"], "scope": "owner", "challenge": xss}, process.env.JWTSECRET, {"expiresIn": 300000});

            // Update the OAuth tokens stored, auth_provider ones get updated with the tokens returned from Facebook/Google
            result = await client.query("UPDATE auth_providers SET access_token = $1, refresh_token = $2, expires_at = $3", [tokenData["access_token"], tokenData["refresh_token"] || "", new Date(Date.now() + tokenData["expires_in"] * 1000)]);
            // Update the user refresh token stored
            result = await client.query(`UPDATE login_tokens SET token = $1 WHERE user_id = $2`, [refresh_token, userData["id"]]);

            return {access_token, refresh_token, xss};
        }

        return null
    } catch(error){
        console.log(error);
        await client.query("ROLLBACK");
        return null;
    } finally {
        await client.query("END");
        client.release();
    }
}
// List of providers allowed, redirect others to 404
const allowedProviders = ["google", "facebook"];
export default nc().use(middleware).get(async (req, res) => {
    try {
        if(!allowedProviders.includes(req.query["provider"])) res.status(404).send();

        // Get token from Facebook/Google
        const token = await getData(oauth_token_url(req.query.code, req.query["provider"]), req.query["provider"]);
        if(!token) throw("An error occured");

        // Get UserInfo from Facebook/Google
        const userData = await getData(oauth_data_url(token["access_token"], req.query["provider"]), req.query["provider"], token["access_token"]);
        if(!userData) throw("An error occured");
        
        // Check if user exists
        if(await userExists(req.pg, userData)) {
            // Then login user
            const sessionData = await loginUser(req.pg, req.query["provider"], token, userData);
            if(sessionData){
                // Store challenge in cookie and return tokens as JSON to be stored in localstorage.
                res.setHeader("Set-Cookie", serialize("__security", sessionData["xss"], {httpOnly: true, "max-age": 300, "Path": '/', "secure": true, "samesite": "Lax"})).status(200).json({"status": "success", "data": { "access_token": sessionData["access_token"], "refresh_token": sessionData["refresh_token"], "ayylmao": "ayylmao" }});
            } else {
                res.status(200).json({"status": "error", "data": {"message": "Failed to login"}});
            }
        } else { 
            // If user does not exist, start user registration
            if(await startRegistration(req.pg, token, userData, req.query["provider"])){
                // If registration is started, create query string from the info acquired from Facebook/Google and redirect user to /auth/finalsteps to complete registration with missing info
                res.redirect(302, "/auth/finalsteps?" + objectToString({"id": userData["id"], "first_name": userData["first_name"] || userData["given_name"], "middle_name": userData["middle_name"], "last_name": userData["last_name"] || userData["family_name"], "email": userData["email"], "phone": userData["phone"], "country": userData["country"]}));
            } else {
                res.redirect(302, `/?error=Facebook%20registration%20failed`);
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(200).json({"status": "error", "message": "Unknown error occured"});
    }
}).post(async (req, res) => {
    try {
        // This route is POSTed to through /auth/finalsteps
        const validator = new Validator(req.body, true);
        // Validate form data
        validator.validateFormData();

        // If validator found errors, return error list
        if(Object.keys(validator.errors).length > 0) {
            return res.status(200).json({"status": "error", "data": validator.errors});
        } else {
            // Else complete user registration
            let sessionData = await completeRegistration(req, req.pg, req.body);
            if(sessionData) {
                // And return user tokens and challenge
                return res.setHeader("Set-Cookie", serialize("__security", sessionData["xss"], {httpOnly: true, "max-age": 300, "Path": '/', "secure": true, "samesite": "Lax"})).status(200).json({"status": "success", "data": {"access_token": sessionData["access_token"], "refresh_token": sessionData["refresh_token"]}});
            } else {
                return res.status(200).json({"status": "error", "data": {"message": "Failed to complete registration"}});
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(200).json({"status": "error", "message": "An error occured while registering account"});
    };
});