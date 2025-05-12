declare namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      MONGO_URI: string;
      ACCESS_TOKEN_SECRET: string;
      ACCESS_TOKEN_EXPIRY?: string;
      API_KEY: string;
    }
  }