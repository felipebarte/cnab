export const notFound = (req, res, _next) => {
  res.status(404).json({
    success: false,
    error: `Rota ${req.originalUrl} não encontrada`,
  });
};

export default notFound;
