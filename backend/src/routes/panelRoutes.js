const express = require('express');
const firebaseAuth = require('../middleware/firebaseAuth');
const controller = require('../controllers/parameterController');

const router = express.Router();

// All panel routes require a valid Firebase ID token.
router.use(firebaseAuth);

router.get('/parameters', controller.list);
router.post('/parameters', controller.create);
router.put('/parameters/:id', controller.update);
router.delete('/parameters/:id', controller.remove);

router.post('/parameters/suggest-countries', controller.suggest);

module.exports = router;
