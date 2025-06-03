import TokenManager from '../src/services/auth/TokenManager.js';

// Mock mais robusto das métricas
jest.mock('../src/utils/metrics.js', () => ({
  Timer: jest.fn().mockImplementation(() => ({
    end: jest.fn()
  })),
  metricsCollector: {
    incrementCounter: jest.fn(),
    setGauge: jest.fn()
  }
}));

// Importar mocks após o mock
import { Timer, metricsCollector } from '../src/utils/metrics.js';

describe('TokenManager', () => {
  let tokenManager;
  let mockApiClient;

  beforeEach(() => {
    // Reset todos os mocks
    jest.clearAllMocks();
    Timer.mockClear();
    metricsCollector.incrementCounter.mockClear();
    metricsCollector.setGauge.mockClear();

    // Mock do cliente API
    mockApiClient = {
      requestNewToken: jest.fn(),
      refreshAccessToken: jest.fn()
    };

    tokenManager = new TokenManager({
      name: 'TestTokenManager',
      apiClient: mockApiClient,
      refreshMargin: 300,
      maxRetries: 3
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    if (tokenManager) {
      try {
        tokenManager.destroy();
      } catch (error) {
        // Ignorar erros de cleanup
      }
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Inicialização', () => {
    test('deve inicializar corretamente', () => {
      expect(tokenManager).toBeDefined();
      expect(tokenManager.name).toBe('TestTokenManager');
      expect(tokenManager.refreshMargin).toBe(300);
      expect(tokenManager.maxRetries).toBe(3);
    });

    test('deve começar com cache vazio', () => {
      const tokenInfo = tokenManager.getTokenInfo();
      expect(tokenInfo.hasToken).toBe(false);
      expect(tokenInfo.isValid).toBe(false);
    });
  });

  describe('Obtenção de token', () => {
    test('deve retornar token do cache quando válido', async () => {
      // Configurar token válido no cache
      const now = Date.now();
      tokenManager.tokenCache.accessToken = 'valid-token';
      tokenManager.tokenCache.expiresAt = now + 600000; // 10 minutos
      tokenManager.tokenCache.tokenType = 'Bearer';

      const token = await tokenManager.getValidToken();

      expect(token).toBe('valid-token');
      expect(mockApiClient.requestNewToken).not.toHaveBeenCalled();
    });

    test('deve solicitar novo token quando cache inválido', async () => {
      mockApiClient.requestNewToken.mockResolvedValue('new-token');

      const token = await tokenManager.getValidToken();

      expect(token).toBe('new-token');
      expect(mockApiClient.requestNewToken).toHaveBeenCalledTimes(1);
    });

    test('deve tratar erro de obtenção de token', async () => {
      mockApiClient.requestNewToken.mockRejectedValue(new Error('API Error'));

      await expect(tokenManager.getValidToken()).rejects.toThrow('API Error');
    });
  });

  describe('Renovação de token', () => {
    test('deve renovar token corretamente', async () => {
      mockApiClient.requestNewToken.mockResolvedValue('renewed-token');

      const token = await tokenManager.refreshToken();

      expect(token).toBe('renewed-token');
      expect(tokenManager.tokenCache.accessToken).toBe('renewed-token');
    });

    test('deve usar refresh token quando disponível', async () => {
      // Configurar refresh token válido
      tokenManager.tokenCache.refreshToken = 'valid-refresh-token';
      tokenManager.tokenCache.refreshExpiresAt = Date.now() + 3600000;

      mockApiClient.refreshAccessToken.mockResolvedValue({
        access_token: 'refreshed-token',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer'
      });

      const token = await tokenManager.refreshToken();

      expect(token).toBe('refreshed-token');
      expect(mockApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockApiClient.requestNewToken).not.toHaveBeenCalled();
    });
  });

  describe('Validação de tokens', () => {
    test('deve retornar false para token inexistente', () => {
      expect(tokenManager.isTokenValid()).toBe(false);
    });

    test('deve retornar false para token expirado', () => {
      tokenManager.tokenCache.accessToken = 'expired-token';
      tokenManager.tokenCache.expiresAt = Date.now() - 1000;

      expect(tokenManager.isTokenValid()).toBe(false);
    });

    test('deve considerar margem de renovação', () => {
      tokenManager.tokenCache.accessToken = 'expiring-soon-token';
      tokenManager.tokenCache.expiresAt = Date.now() + 200000; // 3.33 min < 5 min margin

      expect(tokenManager.isTokenValid()).toBe(false);
    });

    test('deve validar refresh token corretamente', () => {
      // Sem refresh token
      expect(tokenManager.isRefreshTokenValid()).toBe(false);

      // Com refresh token válido
      tokenManager.tokenCache.refreshToken = 'valid-refresh';
      tokenManager.tokenCache.refreshExpiresAt = Date.now() + 3600000;
      expect(tokenManager.isRefreshTokenValid()).toBe(true);

      // Com refresh token expirado
      tokenManager.tokenCache.refreshExpiresAt = Date.now() - 1000;
      expect(tokenManager.isRefreshTokenValid()).toBe(false);
    });
  });

  describe('Cache e métricas', () => {
    test('deve fornecer informações de token', () => {
      const now = Date.now();
      tokenManager.tokenCache.accessToken = 'info-token';
      tokenManager.tokenCache.expiresAt = now + 1800000; // 30 min
      tokenManager.tokenCache.tokenType = 'Bearer';

      const info = tokenManager.getTokenInfo();

      expect(info.hasToken).toBe(true);
      expect(info.isValid).toBe(true);
      expect(info.tokenType).toBe('Bearer');
      expect(info.expiresIn).toBeGreaterThan(0);
    });

    test('deve limpar cache corretamente', () => {
      tokenManager.tokenCache.accessToken = 'to-be-cleared';
      tokenManager.tokenCache.expiresAt = Date.now() + 3600000;

      tokenManager.clearCache();

      expect(tokenManager.tokenCache.accessToken).toBeNull();
      expect(tokenManager.refreshTimer).toBeNull();
    });

    test('deve destruir recursos adequadamente', () => {
      tokenManager.tokenCache.accessToken = 'to-be-destroyed';

      tokenManager.destroy();

      expect(tokenManager.tokenCache.accessToken).toBeNull();
    });
  });

  describe('Agendamento', () => {
    test('deve atualizar cache com dados de token', () => {
      const now = Date.now();
      const tokenData = {
        access_token: 'scheduled-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      tokenManager._updateTokenCache(tokenData);

      expect(tokenManager.tokenCache.accessToken).toBe('scheduled-token');
      expect(tokenManager.tokenCache.tokenType).toBe('Bearer');
      expect(tokenManager.tokenCache.expiresAt).toBeCloseTo(now + 3600000, -2);
    });

    test('deve agendar próxima renovação', () => {
      const tokenData = {
        access_token: 'timer-token',
        expires_in: 3600
      };

      tokenManager._updateTokenCache(tokenData);

      // Verificar se timer foi criado
      expect(tokenManager.refreshTimer).toBeTruthy();
    });
  });
}); 