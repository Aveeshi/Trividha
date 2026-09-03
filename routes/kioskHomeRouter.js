const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.render("booking/kiosk"));
router.get("/kiosk", (req, res) => res.redirect("/booking"));

module.exports = router;
