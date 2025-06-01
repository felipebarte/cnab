import request from 'supertest';
import app from '../src/index.js';

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'OK');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('uptime');
      expect(res.body.data).toHaveProperty('environment');
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('memory');
      expect(res.body.data).toHaveProperty('system');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      const res = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'OK');
    });
  });
}); 