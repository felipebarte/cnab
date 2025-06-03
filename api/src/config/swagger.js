import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import YAML from 'js-yaml';

// Compatibilidade com Jest e Node.js
const __dirname = process.cwd() + '/src/config';

// Caminho para o arquivo swagger.yaml (corrigido)
const swaggerPath = join(__dirname, '../../swagger.yaml');

// Carrega a especificação OpenAPI do arquivo YAML
let swaggerSpec;
try {
  const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
  swaggerSpec = YAML.load(swaggerFile);
} catch (error) {
  console.error('Erro ao carregar swagger.yaml:', error);

  // Fallback para configuração básica se o arquivo não existir
  swaggerSpec = {
    openapi: '3.0.3',
    info: {
      title: 'API CNAB 400/240 Itaú Parser',
      version: '1.0.0',
      description: 'API para processamento de arquivos CNAB 400 e 240',
    },
    servers: [
      {
        url: 'http://localhost:8080/api/v1',
        description: 'Servidor de desenvolvimento',
      },
    ],
    paths: {},
  };
}

// Configurações do Swagger UI
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none', // Mantém as seções fechadas por padrão
    filter: true, // Habilita filtro de busca
    showRequestHeaders: true,
    showResponseHeaders: true,
    tryItOutEnabled: true,
    requestSnippetsEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: {
          title: 'cURL (bash)',
          syntax: 'bash',
        },
        curl_powershell: {
          title: 'cURL (PowerShell)',
          syntax: 'powershell',
        },
        curl_cmd: {
          title: 'cURL (CMD)',
          syntax: 'bash',
        },
      },
      defaultExpanded: true,
      languages: null,
    },
  },
  customCss: `
    .swagger-ui .topbar { 
      background-color: #2c3e50; 
    }
    .swagger-ui .topbar .download-url-wrapper { 
      display: none; 
    }
    .swagger-ui .info {
      margin: 50px 0;
    }
    .swagger-ui .info .title {
      color: #2c3e50;
      font-size: 36px;
    }
    .swagger-ui .scheme-container {
      background: #f7f7f7;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin: 0 0 20px 0;
      padding: 10px;
    }
    .swagger-ui .info .description p {
      color: #555;
      font-size: 14px;
      line-height: 1.6;
    }
    .swagger-ui .opblock.opblock-post {
      border-color: #49cc90;
      background: rgba(73, 204, 144, 0.1);
    }
    .swagger-ui .opblock.opblock-get {
      border-color: #61affe;
      background: rgba(97, 175, 254, 0.1);
    }
    .swagger-ui .opblock-tag {
      border-bottom: 1px solid #ddd;
    }
    .swagger-ui .btn.execute {
      background-color: #4990e2;
      border-color: #4990e2;
    }
    .swagger-ui .btn.execute:hover {
      background-color: #357abd;
      border-color: #357abd;
    }
  `,
  customSiteTitle: 'API CNAB Documentation',
  customfavIcon: '/favicon.ico',
};

// Opções para swagger-jsdoc (caso queira usar anotações JSDoc nos controllers)
const swaggerJsdocOptions = {
  definition: swaggerSpec,
  apis: [
    join(__dirname, '../routes/*.js'),
    join(__dirname, '../controllers/*.js'),
  ],
};

// Gera a especificação final combinando YAML + JSDoc (se existir)
let finalSpec;
try {
  finalSpec = swaggerJsdoc(swaggerJsdocOptions);
} catch (error) {
  console.warn('Aviso: Não foi possível processar anotações JSDoc, usando apenas YAML:', error.message);
  finalSpec = swaggerSpec;
}

// Middleware de autenticação personalizado para Swagger (se necessário)
const swaggerAuth = (req, res, next) => {
  // Aqui você pode adicionar lógica de autenticação se necessário
  // Por exemplo, verificar se o usuário tem permissão para acessar a documentação

  // Para desenvolvimento, permitir acesso livre
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Em produção, você pode adicionar verificação de API key ou autenticação
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== process.env.SWAGGER_API_KEY) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Acesso não autorizado à documentação',
      codigo: 'UNAUTHORIZED_DOCS_ACCESS',
    });
  }

  next();
};

// Função para configurar o Swagger no Express
export const setupSwagger = (app) => {
  try {
    // Configurar a rota da documentação principal
    app.use('/api-docs', swaggerAuth, swaggerUi.serve);
    app.get('/api-docs', swaggerAuth, swaggerUi.setup(finalSpec, swaggerUiOptions));

    // Rota para obter a especificação OpenAPI em JSON
    app.get('/api-docs/swagger.json', swaggerAuth, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(finalSpec);
    });

    // Rota para obter a especificação OpenAPI em YAML
    app.get('/api-docs/swagger.yaml', swaggerAuth, (req, res) => {
      res.setHeader('Content-Type', 'text/yaml');
      res.send(YAML.dump(finalSpec));
    });

    // Rota de redirecionamento da raiz para a documentação
    app.get('/docs', (req, res) => {
      res.redirect('/api-docs');
    });

    console.log('📚 Swagger configurado com sucesso!');
    console.log('🔗 Documentação disponível em: http://localhost:8080/api-docs');
    console.log('📄 Especificação JSON: http://localhost:8080/api-docs/swagger.json');
    console.log('📄 Especificação YAML: http://localhost:8080/api-docs/swagger.yaml');

  } catch (error) {
    console.error('❌ Erro ao configurar Swagger:', error);
  }
};

export default {
  setupSwagger,
  swaggerSpec: finalSpec,
  swaggerUiOptions,
}; 