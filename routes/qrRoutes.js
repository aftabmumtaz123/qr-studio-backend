const express = require('express');
const router = express.Router();
const {
  createQR,
  getQRs,
  getQRById,
  updateQR,
  toggleQR,
  deleteQR
} = require('../controllers/qrController');

// /api/qr
router.route('/')
  .post(createQR)
  .get(getQRs);

router.route('/:id/toggle')
  .patch(toggleQR);

router.route('/:id')
  .get(getQRById)
  .put(updateQR)
  .delete(deleteQR);

module.exports = router;
