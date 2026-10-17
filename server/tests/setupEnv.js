process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sahyog-test';
process.env.LOG_LEVEL = 'silent';
process.env.BCRYPT_ROUNDS = '4';
