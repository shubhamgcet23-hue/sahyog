/** Consistent envelope: { success, data, meta } / { success:false, message, errors } */
const ok = (res, data, meta, status = 200) => res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
const created = (res, data) => ok(res, data, undefined, 201);
module.exports = { ok, created };
