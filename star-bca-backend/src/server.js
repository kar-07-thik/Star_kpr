const app = require('./app');
const { validateTokenRouterModel } = require('./services/aiReviewService');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  validateTokenRouterModel();
});
