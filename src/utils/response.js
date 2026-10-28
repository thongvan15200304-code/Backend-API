function success(res, data = {}, status = 200) {
  return res.status(status).json({
    error: false,
    code: 0,
    message: 'Success',
    data
  });
}

function failure(res, status, code, message) {
  return res.status(status).json({
    error: true,
    code,
    message,
    data: {}
  });
}

module.exports = { success, failure };
