const express = require('express');
const router = express.Router();
const { createShortURL, getShortURLs, updateShortURL, toggleShortURL, deleteShortURL } = require('../controllers/shortURLController');

router.route('/').post(createShortURL).get(getShortURLs);
router.route('/:id').put(updateShortURL).delete(deleteShortURL);
router.route('/:id/toggle').patch(toggleShortURL);

module.exports = router;
