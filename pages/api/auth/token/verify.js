import nc from "next-connect";
import jwt from "jsonwebtoken";

// Verify token is signed by us
export default nc().get(async (req, res) => {
    const result = await jwt.verify(req.headers["authorization"].split(" ")[1], process.env.JWTSECRET);
    res.status(200).json({"TOPKEK": result});
});