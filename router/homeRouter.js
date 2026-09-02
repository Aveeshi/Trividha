const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.render("kiosk"));
router.get("/kiosk", (req, res) => res.redirect("/"));

module.exports = router;
