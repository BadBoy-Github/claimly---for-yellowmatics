export function apiError(error, fallback = 'The request could not be completed.') {
  const status = Number(error?.status) || (error instanceof SyntaxError ? 400 : 500);
  if (status >= 500) console.error(error);
  const message = status >= 500 ? fallback : error.message || 'Invalid JSON request body.';
  return Response.json({ error: message }, { status });
}

export function invalidRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
