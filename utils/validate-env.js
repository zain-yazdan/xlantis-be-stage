const Joi = require("joi");

module.exports.validateEnv = async () => {
  const schema = Joi.object({
    NODE_MODE: Joi.string().valid("prod", "dev", "test", "stage").required(),
    PORT: Joi.number().positive().required(),
    DATABASE_URL: Joi.string().required(),
    IMAGE_NFT_FORMATS_SUPPORTED: Joi.required(),
    NFT_FORMATS_SUPPORTED: Joi.required(),
    CRON_JOB_EXPRESSION: Joi.string().required(),
    STRIPE_API_KEY: Joi.string().required(),
    STRIPE_SUCCESS_URL: Joi.string().required(),
    STRIPE_CANCEL_URL: Joi.string().required(),
    STRIPE_SUCCESS_URL_ADMIN: Joi.string().required(),
    STRIPE_CANCEL_URL_ADMIN: Joi.string().required(),
    NETWORK: Joi.string().required(),
    GOOGLE_CLIENT_ID: Joi.string().required(),
    CORS_ALLOWED: Joi.required(),
    S3_BUCKET_NAME: Joi.string().required(),
    S3_ACCESS_ID: Joi.string().required(),
    S3_ACCESS_SECRET: Joi.string().required(),
    JWT_EXPIRY_TIME: Joi.number().positive().required(),
    JWT_KEY: Joi.required(),
    // ERC721_FACTORY_ADDRESS: Joi.string().required(),
    // ERC721_AUCTION_DROP_FACTORY_ADDRESS: Joi.string().required(),
    // ERC721_FIXED_PRICE_DROP_FACTORY_ADDRESS: Joi.string().required(),
    ERC1155_FACTORY_ADDRESS: Joi.string().required(),
    // ERC1155_AUCTION_DROP_FACTORY_ADDRESS: Joi.string().required(),
    // ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS: Joi.string().required(),
    MULTICALL_ADDRESS: Joi.string().required(),
    // ERC_20: Joi.string().required(),
    PLATFORM_FEE_MANAGER_CONTRACT: Joi.string().required(),
    SUPER_ADMIN_WALLET_ADDRESS: Joi.string().required(),
    SUPER_ADMIN_PRIVATE_KEY: Joi.string().required(),
    MASTER_WALLET_ADDRESS: Joi.string().required(),
    MASTER_WALLET_PRIVATE_KEY: Joi.string().required(),
    ESTIMATION_USER_WALLET_ADDRESS: Joi.string().required(),
    ERC_1155_ESTIMATION_CLONE_ADDRESS: Joi.string().required(),
    WEB_SOCKET: Joi.string().required(),
    STRIPE_API_KEY: Joi.string().required(),
    XMANNA_POLYGON_API_KEY: Joi.string().required(),
    XMANNA_BASIC_AUTH_TOKEN: Joi.string().required(),
    CRYPTR_SECRET_KEY: Joi.string().required(),
    PINATA_API_KEY: Joi.string().required(),
    PINATA_API_SECRET: Joi.string().required(),
    PINATA_API_JWT: Joi.string().required(),
    PINATA_API_URL: Joi.string().required(),
    DEFAULT_PLATFORM_FEE_PERCENTAGE: Joi.number().positive().required(),
    SUPER_ADMIN_EMAIL: Joi.string().required(),
    SUPER_ADMIN_PASSWORD: Joi.string().required(),
    XMANNA_SSO_API_URL: Joi.string().uri().required(),
    CRYPTO_PRICE_API_URL: Joi.string().uri().required(),
    IPFS_URL: Joi.string().uri().required(),
    POLYGON_API_URL: Joi.string().uri().required(),
    DATABASE_TESTING_URL: Joi.when("NODE_MODE", {
      is: "test",
      then: Joi.string().required(),
      otherwise: Joi.optional(),
    }),
  }).unknown();

  const { error, value } = schema.validate(process.env);

  if (error) {
    throw new Error(`env validation error: ${error.message}`);
  }
};
