const fs = require('fs');
const path = require('path');

// Load the base CORS config
const corsConfigPath = path.join(__dirname, '..', 'cors-config.json');
const corsConfig = require(corsConfigPath);

// Allow overriding the origin from an environment variable
const corsOriginFromEnv = process.env.CORS_ORIGIN_URL;
if (corsOriginFromEnv) {
    // Find the config entry and add the env var origin if it's not there
    const mainOriginConfig = corsConfig.find(c => c.origin.includes('http://localhost:4200'));
    if (mainOriginConfig && !mainOriginConfig.origin.includes(corsOriginFromEnv)) {
        mainOriginConfig.origin.push(corsOriginFromEnv);
    }
}

module.exports = {
    allowedOrigins: corsConfig[0].origin
};
