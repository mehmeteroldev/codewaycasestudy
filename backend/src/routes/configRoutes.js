const express = require('express');
const apiToken = require('../middleware/apiToken');
const controller = require('../controllers/configController');

const router = express.Router();

// Public config endpoint for mobile apps: pre-shared API token.
router.get('/', apiToken, controller.getConfig);

module.exports = router;
